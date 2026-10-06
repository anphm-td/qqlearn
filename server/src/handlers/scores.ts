/*
 * Handlers: scores (điểm kiểm tra/đề) — list/create/remove.
 * Mỗi bản ghi là MỘT điểm duy nhất theo môn ({subjectId, label, score, note}) —
 * không còn khung Listening/Reading/Total của TOEIC. Các cột legacy
 * (testLabel/listening/reading/total) vẫn ghi giá trị tương ứng để DB cũ không
 * vướng NOT NULL và migration không fill đè.
 */
import type { DatabaseSync } from 'node:sqlite'

import { allRows, getRow } from '../db.js'
import { ApiError } from '../errors.js'
import { scoreListSchema, scoreRowToJs, type ScoreRow } from '../rows.js'
import { scoreCreateSchema, scoreResponseSchema, type ScoreData } from '../schemas.js'
import { assertShape, parseBody, parseId } from '../validate.js'

export function listScores(db: DatabaseSync): ScoreData[] {
  const rows = allRows<ScoreRow>(db.prepare('SELECT * FROM scores ORDER BY date, id'))
  return assertShape(scoreListSchema, rows.map(scoreRowToJs), 'Danh sách điểm')
}

export function createScore(db: DatabaseSync, body: unknown): ScoreData {
  const input = parseBody(scoreCreateSchema, body)
  const info = db
    .prepare(
      `INSERT INTO scores (date, subject_id, label, score, note, testLabel, listening, reading, total, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
    )
    .run(
      input.date,
      input.subjectId,
      input.label,
      input.score,
      input.note,
      // legacy: giữ cột cũ đồng nhất — score của DB cũ = total.
      input.label,
      input.score,
      Date.now(),
    )
  const row = getRow<ScoreRow>(db.prepare('SELECT * FROM scores WHERE id = ?'), info.lastInsertRowid)
  if (!row) throw new ApiError(500, 'Không đọc lại được điểm vừa tạo.')
  return assertShape(scoreResponseSchema, scoreRowToJs(row), 'Điểm kiểm tra')
}

export function deleteScore(db: DatabaseSync, rawId: string): void {
  db.prepare('DELETE FROM scores WHERE id = ?').run(parseId(rawId, 'Id điểm'))
}
