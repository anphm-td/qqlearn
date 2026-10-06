// @vitest-environment node
/*
 * Test migration ĐA MÔN HOÁ của server (ensureSubjectTables):
 *  - dựng DB "cũ" đúng schema v1 (cột part, scores testLabel/listening/reading/total);
 *  - chạy openDb(':memory:') style migration qua ensureSubjectTables;
 *  - khẳng định: seed 4 môn, part 1–7 → id môn TOEIC, part 0 → 0,
 *    scores reshape (testLabel→label, total→score, nghe/đọc→note, môn TOEIC),
 *    và CHẠY LẠI 2 LẦN là idempotent (không nhân đôi, không ghi đè dữ liệu mới).
 */
import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'

import { allRows, ensureSettingsColumns, ensureSubjectTables, getRow, openDb } from '../src/db.js'

let db: DatabaseSync
let now: number

/** SCHEMA v1 (trước đa môn hoá) — dựng tay trong :memory:. */
const LEGACY_SCHEMA = `
CREATE TABLE settings (
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
CREATE TABLE subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  colorHex TEXT NOT NULL,
  goalMinutesPerDay INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE TABLE sessions (
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
CREATE TABLE dailyNotes (
  date TEXT PRIMARY KEY,
  partStudied TEXT NOT NULL,
  newWords INTEGER NOT NULL,
  mistakesSummary TEXT NOT NULL,
  reflection TEXT NOT NULL,
  photoIds TEXT NOT NULL,
  autoDrafted INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE TABLE vocab (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  example TEXT NOT NULL,
  part INTEGER NOT NULL,
  sourceTest TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE TABLE srsCards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vocabId INTEGER NOT NULL,
  box INTEGER NOT NULL,
  dueDate TEXT NOT NULL,
  lastReviewed INTEGER,
  correctCount INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE TABLE mistakes (
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
CREATE TABLE scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  testLabel TEXT NOT NULL,
  listening INTEGER NOT NULL,
  reading INTEGER NOT NULL,
  total INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE TABLE photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blob BLOB NOT NULL,
  mime TEXT NOT NULL,
  refType TEXT NOT NULL,
  refId TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE TABLE chatMessages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
`

beforeEach(() => {
  now = Date.now()
  // Dựng DB legacy thủ công (không chạy SCHEMA_SQL mới): dùng node:sqlite trực tiếp.
  db = new DatabaseSync(':memory:')
  db.exec(LEGACY_SCHEMA)

  // Dữ liệu legacy: sessions/vocab/mistakes có part 1–7 và part 0.
  db.prepare(
    `INSERT INTO sessions (date, startedAt, endedAt, durationMin, part, activity, source, note, updatedAt)
     VALUES ('2026-10-01', 1, 2, 25, 3, 'nghe', 'timer', '', ?)`,
  ).run(now)
  db.prepare(
    `INSERT INTO sessions (date, startedAt, endedAt, durationMin, part, activity, source, note, updatedAt)
     VALUES ('2026-10-02', 3, 4, 40, 0, 'đọc', 'manual', '', ?)`,
  ).run(now)
  db.prepare(
    `INSERT INTO vocab (word, meaning, example, part, sourceTest, createdAt, updatedAt)
     VALUES ('commute', 'đi làm', 'I commute.', 5, 'ETS', ?, ?)`,
  ).run(now, now)
  db.prepare(
    `INSERT INTO mistakes (testNo, part, questionNo, myAnswer, correctAnswer, cause, explanation, reviewed, createdAt, updatedAt)
     VALUES (2, 7, 14, 'A', 'B', 'từ vựng', '', 0, ?, ?)`,
  ).run(now, now)
  db.prepare(
    `INSERT INTO scores (date, testLabel, listening, reading, total, updatedAt)
     VALUES ('2026-10-01', 'ETS 2023 · Đề 2', 350, 390, 740, ?)`,
  ).run(now)
  // Điểm legacy nhãn trống — migration phải điền 'Bài kiểm tra' (không lệch schema).
  db.prepare(
    `INSERT INTO scores (date, testLabel, listening, reading, total, updatedAt)
     VALUES ('2026-10-02', '', 0, 0, 0, ?)`,
  ).run(now)
  // Ghi chú cuối ngày legacy với partStudied Part 1–7 cũ + 0 + giá trị lạ.
  db.prepare(
    `INSERT INTO dailyNotes (date, partStudied, newWords, mistakesSummary, reflection, photoIds, autoDrafted, updatedAt)
     VALUES ('2026-10-01', '[3,0,9]', 0, '', '', '[]', 0, ?)`,
  ).run(now)
})

describe('ensureSubjectTables — migration DB legacy đa môn hoá', () => {
  it('seed đúng 4 môn khi bảng trống; TOEIC có màu #FFD273', () => {
    ensureSubjectTables(db)
    const subjects = allRows<{ id: number; name: string; colorHex: string }>(
      db.prepare('SELECT id, name, colorHex FROM subjects ORDER BY id'),
    )
    expect(subjects.map((s) => s.name)).toEqual(['TOEIC', 'Toán', 'Tiếng Nhật', 'Lập trình'])
    expect(subjects[0].colorHex).toBe('#FFD273')
  })

  it('part 1–7 → subject_id của môn TOEIC; part 0 → 0; part được zero để idempotent', () => {
    ensureSubjectTables(db)
    const toeicId = getRow<{ id: number }>(db.prepare(`SELECT id FROM subjects WHERE name = 'TOEIC'`))!.id
    const sessions = allRows<{ part: number; subject_id: number }>(
      db.prepare('SELECT part, subject_id FROM sessions ORDER BY id'),
    )
    expect(sessions[0]).toEqual({ part: 0, subject_id: toeicId }) // part 3 cũ
    expect(sessions[1]).toEqual({ part: 0, subject_id: 0 }) // part 0 cũ → chưa phân môn
    expect(getRow<{ subject_id: number }>(db.prepare('SELECT subject_id FROM vocab WHERE id = 1'))!.subject_id).toBe(toeicId)
    expect(getRow<{ subject_id: number }>(db.prepare('SELECT subject_id FROM mistakes WHERE id = 1'))!.subject_id).toBe(toeicId)
  })

  it('scores reshape: testLabel→label, total→score, nghe/đọc→note, môn TOEIC', () => {
    ensureSubjectTables(db)
    const toeicId = getRow<{ id: number }>(db.prepare(`SELECT id FROM subjects WHERE name = 'TOEIC'`))!.id
    const row = getRow<{ subject_id: number; label: string; score: number; note: string }>(
      db.prepare('SELECT subject_id, label, score, note FROM scores WHERE id = 1'),
    )!
    expect(row).toEqual({
      subject_id: toeicId,
      label: 'ETS 2023 · Đề 2',
      score: 740,
      note: 'nghe 350 · đọc 390',
    })
  })

  it('label trống legacy → điền "Bài kiểm tra" (không để hàng lệch schema)', () => {
    ensureSubjectTables(db)
    const row = getRow<{ label: string; score: number; note: string }>(
      db.prepare('SELECT label, score, note FROM scores WHERE id = 2'),
    )!
    expect(row).toEqual({ label: 'Bài kiểm tra', score: 0, note: '' })
  })

  it('dailyNotes.partStudied: giá trị 1–7 → id môn TOEIC, giữ nguyên 0/giá trị khác', () => {
    ensureSubjectTables(db)
    const toeicId = getRow<{ id: number }>(db.prepare(`SELECT id FROM subjects WHERE name = 'TOEIC'`))!.id
    const row = getRow<{ partStudied: string }>(db.prepare(`SELECT partStudied FROM dailyNotes WHERE date = '2026-10-01'`))!
    expect(JSON.parse(row.partStudied)).toEqual([toeicId, 0, 9])
  })

  it('fill MỘT LẦN: chạy lại không lật subjectId = 0 người học đã chọn (HIGH 1)', () => {
    ensureSubjectTables(db) // lần 1 — migration
    // Người học tạo điểm MỚI và cố ý để "chưa phân môn" (subject_id = 0);
    // cũng chỉnh 1 buổi cũ về 0 — restart server không được đụng tới.
    db.prepare('UPDATE scores SET subject_id = 0 WHERE id = 1').run()
    db.prepare('UPDATE sessions SET subject_id = 0 WHERE id = 2').run()

    ensureSubjectTables(db) // lần 2 — restart
    expect(getRow<{ subject_id: number }>(db.prepare('SELECT subject_id FROM scores WHERE id = 1'))!.subject_id).toBe(0)
    expect(getRow<{ subject_id: number }>(db.prepare('SELECT subject_id FROM sessions WHERE id = 2'))!.subject_id).toBe(0)
    // Dữ liệu đã migrate đúng vẫn giữ nguyên sau lần chạy thứ hai.
    const toeicId = getRow<{ id: number }>(db.prepare(`SELECT id FROM subjects WHERE name = 'TOEIC'`))!.id
    expect(getRow<{ subject_id: number }>(db.prepare('SELECT subject_id FROM sessions WHERE id = 1'))!.subject_id).toBe(toeicId)
  })

  it('remap partStudied cũng MỘT LẦN — ghi chú tạo sau migration không bị đụng', () => {
    ensureSubjectTables(db)
    // Ghi chú MỚI sau migration (đã là subjectId: 0 = chưa phân môn).
    db.prepare(
      `INSERT INTO dailyNotes (date, partStudied, newWords, mistakesSummary, reflection, photoIds, autoDrafted, updatedAt)
       VALUES ('2026-10-05', '[0,99]', 0, '', '', '[]', 0, ?)`,
    ).run(Date.now())

    ensureSubjectTables(db) // restart
    const row = getRow<{ partStudied: string }>(db.prepare(`SELECT partStudied FROM dailyNotes WHERE date = '2026-10-05'`))!
    expect(JSON.parse(row.partStudied)).toEqual([0, 99])
  })

  it('chạy lại 2 lần → idempotent, không nhân đôi subjects cũng không mất dữ liệu', () => {
    ensureSubjectTables(db)
    ensureSubjectTables(db)
    expect(getRow<{ n: number }>(db.prepare('SELECT COUNT(*) AS n FROM subjects'))!.n).toBe(4)
    expect(getRow<{ n: number }>(db.prepare('SELECT COUNT(*) AS n FROM sessions'))!.n).toBe(2)
    const row = getRow<{ label: string; score: number }>(db.prepare('SELECT label, score FROM scores WHERE id = 1'))!
    expect(row).toEqual({ label: 'ETS 2023 · Đề 2', score: 740 })
  })

  it('DB mới (openDb) có sẵn cột subject_id và 4 môn seed', () => {
    const fresh = openDb(':memory:')
    const subjects = allRows<{ name: string }>(fresh.prepare('SELECT name FROM subjects ORDER BY id'))
    expect(subjects.map((s) => s.name)).toEqual(['TOEIC', 'Toán', 'Tiếng Nhật', 'Lập trình'])
    expect(allRows(fresh.prepare('PRAGMA table_info(sessions)')).some((c) => c.name === 'subject_id')).toBe(true)
    expect(allRows(fresh.prepare('PRAGMA table_info(scores)')).some((c) => c.name === 'label')).toBe(true)
    // Cột settings.language có sẵn ở DB mới (ngôn ngữ giao diện, mục 12).
    expect(allRows(fresh.prepare('PRAGMA table_info(settings)')).some((c) => c.name === 'language')).toBe(true)
  })
})

describe('ensureSettingsColumns — migration cột settings thêm sau', () => {
  it('DB legacy thiếu cột language → ALTER TABLE thêm DEFAULT vi; idempotent', () => {
    // db (LEGACY_SCHEMA) chưa có cột language — thêm 1 hàng legacy trước khi migrate.
    db.prepare(
      `INSERT INTO settings (id, dailyGoalMinutes, targetScore, examDate, reminderTime, ragBaseUrl,
         onboardingDone, checkinEnabled, pomodoro, syncMode, serverUrl, updatedAt)
       VALUES (1, 90, 700, '', '', '', 0, 1, '{}', 'local', '', ?)`,
    ).run(now)
    expect(allRows(db.prepare('PRAGMA table_info(settings)')).some((c) => c.name === 'language')).toBe(false)

    ensureSettingsColumns(db) // lần 1 — migration
    expect(allRows(db.prepare('PRAGMA table_info(settings)')).some((c) => c.name === 'language')).toBe(true)
    // Hàng cũ tự nhận DEFAULT 'vi', không phải đổi dữ liệu.
    const row = getRow<{ language: string }>(db.prepare('SELECT language FROM settings WHERE id = 1'))!
    expect(row.language).toBe('vi')

    ensureSettingsColumns(db) // lần 2 — restart, idempotent
    const again = getRow<{ language: string }>(db.prepare('SELECT language FROM settings WHERE id = 1'))!
    expect(again.language).toBe('vi')
  })
})
