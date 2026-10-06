/*
 * Mở SQLite (node:sqlite — builtin của Node 24+) + schema các bảng.
 *
 * Các bảng ánh xạ 1-1 từ các entity trong src/core/types.ts, giữ `id` (hoặc `date`
 * cho dailyNotes) + `updatedAt` (epoch ms) để sau này đồng bộ/merge:
 *   subjects · settings · sessions · dailyNotes · vocab · srsCards · mistakes ·
 *   scores · photos (blob nhị phân) · chatMessages
 *
 * Giá trị cột ↔ JSON được đổi ở src/rows.ts; mọi validate Zod ở src/schemas.ts.
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync, type StatementSync } from 'node:sqlite'

import { SEED_SUBJECTS } from '../../src/core/subjects.js'

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

/**
 * Cột part/testLabel/listening/reading/total là DI SẢN của khung TOEIC cũ:
 * giữ trong schema (NOT NULL DEFAULT) để DB cũ không phải dựng lại bảng — hàng mới
 * luôn ghi giá trị rác 0, dữ liệu thật nằm ở subject_id/label/score/note.
 */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  colorHex TEXT NOT NULL,
  goalMinutesPerDay INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
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
  language TEXT NOT NULL DEFAULT 'vi',
  updatedAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  startedAt INTEGER NOT NULL,
  endedAt INTEGER,
  durationMin INTEGER NOT NULL,
  subject_id INTEGER NOT NULL DEFAULT 0,
  part INTEGER NOT NULL DEFAULT 0,
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
  subject_id INTEGER NOT NULL DEFAULT 0,
  part INTEGER NOT NULL DEFAULT 0,
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
  subject_id INTEGER NOT NULL DEFAULT 0,
  part INTEGER NOT NULL DEFAULT 0,
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
  subject_id INTEGER NOT NULL DEFAULT 0,
  label TEXT NOT NULL DEFAULT '',
  score INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  testLabel TEXT NOT NULL DEFAULT '',
  listening INTEGER NOT NULL DEFAULT 0,
  reading INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
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
 * (export để test migration trong server/tests/migration.test.ts.)
 */
export function ensureSettingsColumns(db: DatabaseSync): void {
  const cols = allRows<{ name: string }>(db.prepare(`PRAGMA table_info(settings)`))
  if (!cols.some((c) => c.name === 'checkinEnabled')) {
    db.exec('ALTER TABLE settings ADD COLUMN checkinEnabled INTEGER NOT NULL DEFAULT 1')
  }
  // language — ngôn ngữ giao diện ('vi' mặc định, design-system.md mục 12):
  // hàng cũ tự nhận 'vi' qua DEFAULT, không phải đổi dữ liệu.
  if (!cols.some((c) => c.name === 'language')) {
    db.exec("ALTER TABLE settings ADD COLUMN language TEXT NOT NULL DEFAULT 'vi'")
  }
}

/** Cột của 1 bảng — dùng PRAGMA (cùng phong cách ensureSettingsColumns). */
function tableColumns(db: DatabaseSync, table: string): string[] {
  return allRows<{ name: string }>(db.prepare(`PRAGMA table_info(${table})`)).map((c) => c.name)
}

/**
 * Migration ĐA MÔN HOÁ (idempotent, chạy an toàn mọi lần mở DB):
 *  1. Bảng subjects đã được SCHEMA_SQL tạo; seed 4 môn khi trống
 *     (TOEIC · Toán · Tiếng Nhật · Lập trình — màu theo design-system.md mục 5).
 *  2. sessions/vocab/mistakes: thiếu cột subject_id → ALTER TABLE ADD COLUMN,
 *     rồi fill TỪ `part` cũ (1–7 → môn TOEIC, 0/null → 0) — fill CHỈ chạy ĐÚNG
 *     LẦN ĐẦU (lúc cột vừa thêm, detect bằng PRAGMA trước/sau) để các lần mở
 *     sau không bao giờ đụng subjectId người học đã chọn (kể cả 0 "chưa phân môn").
 *  3. scores: thiếu cột mới (subject_id/label/score/note) → ALTER TABLE, rồi fill
 *     MỘT LẦN từ cột legacy (testLabel→label, total→score, nghe/đọc→note, môn
 *     TOEIC); label rỗng (testLabel trống hoặc total 0) nhận 'Bài kiểm tra'.
 *  4. dailyNotes.partStudied (Part 1–7 cũ): remap MỘT LẦN — giá trị 1–7 → id môn
 *     TOEIC, giữ nguyên 0/giá trị khác — cùng mốc một-lần với việc thêm cột.
 */
export function ensureSubjectTables(db: DatabaseSync): void {
  // 1) Seed 4 môn khi bảng trống.
  const count = getRow<{ n: number }>(db.prepare(`SELECT COUNT(*) AS n FROM subjects`))
  if (!count || Number(count.n) === 0) {
    const now = Date.now()
    const insert = db.prepare(
      `INSERT INTO subjects (name, colorHex, goalMinutesPerDay, archived, createdAt, updatedAt)
       VALUES (?, ?, ?, 0, ?, ?)`,
    )
    for (const [i, s] of SEED_SUBJECTS.entries()) {
      insert.run(s.name, s.colorHex, s.goalMinutesPerDay, now + i, now + i)
    }
  }
  const toeic = getRow<{ id: number }>(
    db.prepare(`SELECT id FROM subjects WHERE name = 'TOEIC' COLLATE NOCASE`),
  )
  const toeicId = toeic ? Number(toeic.id) : 1

  // 2) sessions/vocab/mistakes — thêm subject_id (đánh dấu DB legacy) rồi fill MỘT LẦN.
  let firstMigration = false
  for (const table of ['sessions', 'vocab', 'mistakes'] as const) {
    const cols = tableColumns(db, table)
    const addedSubjectId = !cols.includes('subject_id')
    if (addedSubjectId) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN subject_id INTEGER NOT NULL DEFAULT 0`)
      firstMigration = true
    }
    if (addedSubjectId && cols.includes('part')) {
      db.prepare(
        `UPDATE ${table} SET subject_id = ?, part = 0 WHERE part >= 1 AND part <= 7`,
      ).run(toeicId)
    }
  }

  // 3) scores — thêm 4 cột mới (đánh dấu DB legacy) rồi fill MỘT LẦN từ cột legacy.
  const scoreCols = tableColumns(db, 'scores')
  const addedScoreSubjectId = !scoreCols.includes('subject_id')
  const addedLabel = !scoreCols.includes('label')
  const addedScore = !scoreCols.includes('score')
  const addedNote = !scoreCols.includes('note')
  if (addedScoreSubjectId) db.exec('ALTER TABLE scores ADD COLUMN subject_id INTEGER NOT NULL DEFAULT 0')
  if (addedLabel) db.exec("ALTER TABLE scores ADD COLUMN label TEXT NOT NULL DEFAULT ''")
  if (addedScore) db.exec('ALTER TABLE scores ADD COLUMN score INTEGER NOT NULL DEFAULT 0')
  if (addedNote) db.exec("ALTER TABLE scores ADD COLUMN note TEXT NOT NULL DEFAULT ''")
  if (addedScoreSubjectId) {
    firstMigration = true
    db.prepare('UPDATE scores SET subject_id = ?').run(toeicId)
  }
  if (addedScore && scoreCols.includes('total')) {
    db.prepare(`UPDATE scores SET label = testLabel, score = total`).run()
  }
  if (addedNote && scoreCols.includes('listening')) {
    db.prepare(
      `UPDATE scores SET note = 'nghe ' || listening || ' · đọc ' || reading
       WHERE listening > 0 OR reading > 0`,
    ).run()
  }
  // MEDIUM 5: label rỗng (testLabel trống / total 0) → nhãn mặc định, không để
  // hàng nào lệch schema (label rỗng làm GET /api/scores và backup fail).
  if (addedLabel) {
    db.prepare(`UPDATE scores SET label = 'Bài kiểm tra' WHERE label = ''`).run()
  }

  // 4) dailyNotes.partStudied — remap MỘT LẦN đúng mốc thêm cột (cùng lần đầu).
  //    Giá trị 1–7 (Part TOEIC cũ) → id môn TOEIC; 0/giá trị khác giữ nguyên.
  if (firstMigration && tableColumns(db, 'dailyNotes').includes('partStudied')) {
    const notes = allRows<{ date: string; partStudied: string }>(
      db.prepare('SELECT date, partStudied FROM dailyNotes'),
    )
    const update = db.prepare('UPDATE dailyNotes SET partStudied = ? WHERE date = ?')
    for (const note of notes) {
      let parsed: unknown
      try {
        parsed = JSON.parse(note.partStudied)
      } catch {
        continue // JSON hỏng — bỏ qua an toàn, không chặn mở app
      }
      if (!Array.isArray(parsed)) continue
      const mapped = parsed.map((v) => (typeof v === 'number' && v >= 1 && v <= 7 ? toeicId : v))
      if (JSON.stringify(mapped) !== JSON.stringify(parsed)) {
        update.run(JSON.stringify(mapped), note.date)
      }
    }
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
  ensureSubjectTables(db)
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
