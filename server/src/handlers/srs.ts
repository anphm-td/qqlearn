/*
 * Handlers: srsCards (thẻ ôn tập Leitner).
 * Bảng khoảng ôn 1 · 3 · 7 · 16 · 35 ngày — ĐỒNG BỘ với src/data/repositories/
 * dexieSrsRepo.ts và src/features/notebook/srs.ts (3 nơi đổi cùng nhau).
 */
import type { DatabaseSync } from 'node:sqlite'

import { addDaysISO } from '../../../src/core/date.js'
import { dateISO } from '../../../src/core/schemas.js'
import { allRows, getRow } from '../db.js'
import { ApiError } from '../errors.js'
import { srsListSchema, srsRowToJs, type SrsRow } from '../rows.js'
import { srsCreateSchema, srsPutSchema, srsResponseSchema, srsReviewSchema, type SrsData } from '../schemas.js'
import { assertShape, parseBody, parseId } from '../validate.js'

/** Số ngày tới hạn sau khi trả lời ĐÚNG ở từng hộp Leitner 1–5. */
export const BOX_INTERVALS = [1, 3, 7, 16, 35] as const

export function listSrs(db: DatabaseSync): SrsData[] {
  const rows = allRows<SrsRow>(db.prepare('SELECT * FROM srsCards ORDER BY dueDate, id'))
  return assertShape(srsListSchema, rows.map(srsRowToJs), 'Danh sách thẻ SRS')
}

export function listDueSrs(db: DatabaseSync, rawDate: string): SrsData[] {
  const parsed = dateISO.safeParse(rawDate)
  if (!parsed.success) {
    throw new ApiError(400, `Ngày đến hạn phải là 'YYYY-MM-DD' — nhận được "${rawDate}".`)
  }
  // JOIN vocab: thẻ mồ côi (từ đã xoá khỏi sổ) không trả về — mọi nơi đếm qua
  // listDue đều nhất quán với màn Ôn tập.
  const rows = allRows<SrsRow>(
    db.prepare(
      'SELECT s.* FROM srsCards s JOIN vocab v ON v.id = s.vocabId WHERE s.dueDate <= ? ORDER BY s.dueDate, s.id',
    ),
    parsed.data,
  )
  return assertShape(srsListSchema, rows.map(srsRowToJs), 'Danh sách thẻ đến hạn')
}

export function getSrsByVocab(db: DatabaseSync, rawVocabId: string): SrsData | undefined {
  const vocabId = parseId(rawVocabId, 'Id từ vựng')
  const row = getRow<SrsRow>(db.prepare('SELECT * FROM srsCards WHERE vocabId = ?'), vocabId)
  return row ? assertShape(srsResponseSchema, srsRowToJs(row), 'Thẻ SRS') : undefined
}

export function createSrsForVocab(db: DatabaseSync, body: unknown): SrsData {
  const input = parseBody(srsCreateSchema, body)
  const info = db
    .prepare(
      `INSERT INTO srsCards (vocabId, box, dueDate, lastReviewed, correctCount, updatedAt)
       VALUES (?, 1, ?, NULL, 0, ?)`,
    )
    .run(input.vocabId, input.dueDate, Date.now())
  const row = getRow<SrsRow>(db.prepare('SELECT * FROM srsCards WHERE id = ?'), info.lastInsertRowid)
  if (!row) throw new ApiError(500, 'Không đọc lại được thẻ vừa tạo.')
  return assertShape(srsResponseSchema, srsRowToJs(row), 'Thẻ SRS')
}

/** Xoá mọi thẻ của 1 từ vựng — gọi khi xoá từ khỏi sổ (không để lại thẻ mồ côi). */
export function removeSrsByVocab(db: DatabaseSync, rawVocabId: string): void {
  const vocabId = parseId(rawVocabId, 'Id từ vựng')
  db.prepare('DELETE FROM srsCards WHERE vocabId = ?').run(vocabId)
}

export function putSrs(db: DatabaseSync, body: unknown): SrsData {
  const input = parseBody(srsPutSchema, body)
  if (input.id !== undefined) {
    const info = db
      .prepare(
        `UPDATE srsCards SET vocabId = ?, box = ?, dueDate = ?, lastReviewed = ?, correctCount = ?, updatedAt = ?
         WHERE id = ?`,
      )
      .run(input.vocabId, input.box, input.dueDate, input.lastReviewed, input.correctCount, Date.now(), input.id)
    if (Number(info.changes) === 0) throw new ApiError(404, 'Không tìm thấy thẻ SRS.')
    const row = getRow<SrsRow>(db.prepare('SELECT * FROM srsCards WHERE id = ?'), input.id) as SrsRow
    return assertShape(srsResponseSchema, srsRowToJs(row), 'Thẻ SRS')
  }
  const info = db
    .prepare(
      `INSERT INTO srsCards (vocabId, box, dueDate, lastReviewed, correctCount, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(input.vocabId, input.box, input.dueDate, input.lastReviewed, input.correctCount, Date.now())
  const row = getRow<SrsRow>(db.prepare('SELECT * FROM srsCards WHERE id = ?'), info.lastInsertRowid) as SrsRow
  return assertShape(srsResponseSchema, srsRowToJs(row), 'Thẻ SRS')
}

export function reviewSrs(db: DatabaseSync, rawId: string, body: unknown): SrsData | undefined {
  const id = parseId(rawId, 'Id thẻ SRS')
  const input = parseBody(srsReviewSchema, body)
  const row = getRow<SrsRow>(db.prepare('SELECT * FROM srsCards WHERE id = ?'), id)
  if (!row) return undefined
  const current = srsRowToJs(row)
  const box = input.correct ? Math.min(5, current.box + 1) : 1
  const dueDate = addDaysISO(input.today, BOX_INTERVALS[box - 1])
  const now = Date.now()
  db.prepare(
    `UPDATE srsCards SET box = ?, dueDate = ?, lastReviewed = ?, correctCount = ?, updatedAt = ? WHERE id = ?`,
  ).run(box, dueDate, now, current.correctCount + (input.correct ? 1 : 0), now, id)
  const updated = getRow<SrsRow>(db.prepare('SELECT * FROM srsCards WHERE id = ?'), id) as SrsRow
  return assertShape(srsResponseSchema, srsRowToJs(updated), 'Thẻ SRS')
}
