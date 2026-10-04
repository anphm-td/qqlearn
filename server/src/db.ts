/*
 * Mở SQLite (node:sqlite — builtin của Node 24+) + schema 9 bảng.
 *
 * 9 bảng ánh xạ 1-1 từ các entity trong src/core/types.ts, giữ `id` (hoặc `date`
 * cho dailyNotes) + `updatedAt` (epoch ms) để sau này đồng bộ/merge:
 *   settings · sessions · dailyNotes · vocab · srsCards · mistakes · scores ·
 *   photos (blob nhị phân) · chatMessages
 *
 * Giá trị cột ↔ JSON được đổi ở src/rows.ts; mọi validate Zod ở src/schemas.ts.
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync, type StatementSync } from 'node:sqlite'

/** Kiểu giá trị bind được vào SQLite (SQLite không có boolean → dùng 0/1). */
export type SqlValue = string | number | bigint | Uint8Array | null

/**
 * Đọc hàng SELECT — node:sqlite trả Record<string, SQLOutputValue>; hai helper này
 * là chỗ DUY NHẤT đổi kiểu sang hàng đã định nghĩa (xem src/rows.ts).
 */
export function getRow<T>(stmt: StatementSync, ...params: SqlValue[]): T | undefined {
  return stmt.get(...params) as T | undefined
}

export function allRows<T>(stmt: StatementSync, ...params: SqlValue[]): T[] {
  return stmt.all(...params) as T[]
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY,
  dailyGoalMinutes INTEGER NOT NULL,
  targetScore INTEGER NOT NULL,
  examDate TEXT NOT NULL,
  reminderTime TEXT NOT NULL,
  ragBaseUrl TEXT NOT NULL,
  onboardingDone INTEGER NOT NULL,
  checkinEnabled INTEGER NOT NULL DEFAULT 1,
  pomodoro TEXT NOT NULL,
  syncMode TEXT NOT NULL DEFAULT 'local',
  serverUrl TEXT NOT NULL DEFAULT '',
  updatedAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  startedAt INTEGER NOT NULL,
  endedAt INTEGER,
  durationMin INTEGER NOT NULL,
  part INTEGER NOT NULL,
  activity TEXT NOT NULL,
  source TEXT NOT NULL,
  note TEXT NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS dailyNotes (
  date TEXT PRIMARY KEY,
  partStudied TEXT NOT NULL,
  newWords INTEGER NOT NULL,
  mistakesSummary TEXT NOT NULL,
  reflection TEXT NOT NULL,
  photoIds TEXT NOT NULL,
  autoDrafted INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS vocab (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  example TEXT NOT NULL,
  part INTEGER NOT NULL,
  sourceTest TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS srsCards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vocabId INTEGER NOT NULL,
  box INTEGER NOT NULL,
  dueDate TEXT NOT NULL,
  lastReviewed INTEGER,
  correctCount INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS mistakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  testNo INTEGER NOT NULL,
  part INTEGER NOT NULL,
  questionNo INTEGER NOT NULL,
  myAnswer TEXT NOT NULL,
  correctAnswer TEXT NOT NULL,
  cause TEXT NOT NULL,
  explanation TEXT NOT NULL,
  reviewed INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  testLabel TEXT NOT NULL,
  listening INTEGER NOT NULL,
  reading INTEGER NOT NULL,
  total INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blob BLOB NOT NULL,
  mime TEXT NOT NULL,
  refType TEXT NOT NULL,
  refId TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS chatMessages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
`

/**
 * Migration nhẹ cho tệp DB tạo trước khi có cột mới: thiếu cột nào của settings
 * thì ALTER TABLE ADD COLUMN với DEFAULT khớp DEFAULT_SETTINGS — hàng cũ tự nhận
 * giá trị mặc định, không cần đổi dữ liệu. Idempotent (kiểm tra PRAGMA trước).
 */
function ensureSettingsColumns(db: DatabaseSync): void {
  const cols = allRows<{ name: string }>(db.prepare(`PRAGMA table_info(settings)`))
  if (!cols.some((c) => c.name === 'checkinEnabled')) {
    db.exec('ALTER TABLE settings ADD COLUMN checkinEnabled INTEGER NOT NULL DEFAULT 1')
  }
}

/**
 * Mở DB + tạo bảng nếu chưa có. `:memory:` cho test (không mkdir, không WAL);
 * đường dẫn tệp cho thật (server/data/qlearn.db — tự tạo thư mục).
 */
export function openDb(dbPath: string): DatabaseSync {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true })
  const db = new DatabaseSync(dbPath)
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode = WAL;')
  db.exec(SCHEMA_SQL)
  ensureSettingsColumns(db)
  return db
}

/**
 * Đường dẫn DB mặc định: <gốc dự án>/server/data/qlearn.db.
 * `npm run server` luôn chạy ở gốc dự án; đổi được bằng biến môi trường QLEARN_DB_PATH.
 */
export function defaultDbPath(): string {
  return process.env.QLEARN_DB_PATH ?? join(process.cwd(), 'server', 'data', 'qlearn.db')
}

/** Thư mục bản build PWA (vite build → <gốc dự án>/dist) mà server phục vụ. */
export function defaultDistDir(): string {
  return process.env.QLEARN_DIST_DIR ?? join(process.cwd(), 'dist')
}
