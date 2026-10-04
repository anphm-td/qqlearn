/*
 * Handlers: restore — khôi phục TOÀN BỘ bản sao lưu trong MỘT transaction.
 *
 * Thứ tự: xoá sạch 8 bảng dữ liệu → ghi lại payload (settings giữ nguyên
 * syncMode/serverUrl của máy). Lỗi bất kỳ giữa chừng → ROLLBACK: dữ liệu quay về
 * đúng trạng thái trước khi gọi, không bao giờ một phần. Chạy lại cho cùng kết
 * quả (clear-trước-ghi) nên không bao giờ nhân đôi dữ liệu.
 */
import { Buffer } from 'node:buffer'
import type { DatabaseSync } from 'node:sqlite'

import { readSettingsRow } from '../rows.js'
import { restorePayloadSchema } from '../schemas.js'
import { parseBody } from '../validate.js'
import { getSettings } from './settings.js'

const DATA_TABLES = [
  'sessions',
  'dailyNotes',
  'vocab',
  'srsCards',
  'mistakes',
  'scores',
  'photos',
  'chatMessages',
] as const

export function restoreAll(db: DatabaseSync, body: unknown): { ok: true } {
  const payload = parseBody(restorePayloadSchema, body)
  const now = Date.now()

  db.exec('BEGIN')
  try {
    for (const table of DATA_TABLES) {
      db.prepare(`DELETE FROM ${table}`).run()
    }

    // Settings: ghi các trường của payload, GIỮ nguyên syncMode/serverUrl hiện có
    // (getSettings tự tạo hàng mặc định nếu chưa có; cột syncMode/serverUrl không bị UPDATE đụng tới).
    getSettings(db)
    db.prepare(
      `UPDATE settings SET dailyGoalMinutes = ?, targetScore = ?, examDate = ?, reminderTime = ?,
         ragBaseUrl = ?, onboardingDone = ?, pomodoro = ?, updatedAt = ?
       WHERE id = 1`,
    ).run(
      payload.settings.dailyGoalMinutes,
      payload.settings.targetScore,
      payload.settings.examDate,
      payload.settings.reminderTime,
      payload.settings.ragBaseUrl,
      payload.settings.onboardingDone ? 1 : 0,
      JSON.stringify(payload.settings.pomodoro),
      now,
    )

    // Sessions + ánh xạ chỉ mục → id mới (ảnh 'session' tham chiếu theo chỉ mục).
    const sessionIds: number[] = []
    for (const s of payload.sessions) {
      const info = db
        .prepare(
          `INSERT INTO sessions (date, startedAt, endedAt, durationMin, part, activity, source, note, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(s.date, s.startedAt, s.endedAt, s.durationMin, s.part, s.activity, s.source, s.note, now)
      sessionIds.push(Number(info.lastInsertRowid))
    }

    // Vocab + ánh xạ chỉ mục → id mới (thẻ SRS tham chiếu theo chỉ mục).
    const vocabIds: number[] = []
    for (const v of payload.vocab) {
      const info = db
        .prepare(
          `INSERT INTO vocab (word, meaning, example, part, sourceTest, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(v.word, v.meaning, v.example, v.part, v.sourceTest, now, now)
      vocabIds.push(Number(info.lastInsertRowid))
    }

    for (const c of payload.srsCards) {
      const vocabId = vocabIds[c.vocabKey]
      if (vocabId === undefined) continue // từ gốc không có trong payload — bỏ an toàn
      db.prepare(
        `INSERT INTO srsCards (vocabId, box, dueDate, lastReviewed, correctCount, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(vocabId, c.box, c.dueDate, c.lastReviewed, c.correctCount, now)
    }

    const mistakeIds: number[] = []
    for (const m of payload.mistakes) {
      const info = db
        .prepare(
          `INSERT INTO mistakes (testNo, part, questionNo, myAnswer, correctAnswer, cause, explanation, reviewed, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(m.testNo, m.part, m.questionNo, m.myAnswer, m.correctAnswer, m.cause, m.explanation, m.reviewed ? 1 : 0, now, now)
      mistakeIds.push(Number(info.lastInsertRowid))
    }

    for (const s of payload.scores) {
      db.prepare(
        `INSERT INTO scores (date, testLabel, listening, reading, total, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(s.date, s.testLabel, s.listening, s.reading, s.total, now)
    }

    for (const n of payload.dailyNotes) {
      db.prepare(
        `INSERT INTO dailyNotes (date, partStudied, newWords, mistakesSummary, reflection, photoIds, autoDrafted, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET
           partStudied = excluded.partStudied, newWords = excluded.newWords,
           mistakesSummary = excluded.mistakesSummary, reflection = excluded.reflection,
           photoIds = excluded.photoIds, autoDrafted = excluded.autoDrafted, updatedAt = excluded.updatedAt`,
      ).run(
        n.date,
        JSON.stringify(n.partStudied),
        n.newWords,
        n.mistakesSummary,
        n.reflection,
        JSON.stringify(n.photoIds),
        n.autoDrafted ? 1 : 0,
        now,
      )
    }

    for (const c of payload.chat) {
      db.prepare(
        `INSERT INTO chatMessages (sessionId, role, content, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`,
      ).run(c.sessionId, c.role, c.content, now, now)
    }

    // Ảnh: refKey = chỉ mục (session/mistake) hoặc ngày (note) — giữ đúng đích gắn.
    for (const p of payload.photos) {
      let refId: string | null
      if (p.refType === 'note') {
        refId = p.refKey
      } else {
        const ids = p.refType === 'session' ? sessionIds : mistakeIds
        const newId = ids[Number(p.refKey)]
        refId = newId === undefined ? null : String(newId)
      }
      if (refId === null) continue // bản ghi đích không có trong payload — bỏ an toàn
      db.prepare(
        `INSERT INTO photos (blob, mime, refType, refId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(Buffer.from(p.dataBase64, 'base64'), p.mime, p.refType, refId, now, now)
    }

    db.exec('COMMIT')
    return { ok: true }
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

/** Đọc lại 1 hàng settings sau restore (tiện test). */
export function settingsUpdatedAt(db: DatabaseSync): number {
  const row = readSettingsRow(db)
  return row ? Number(row.updatedAt) : 0
}
