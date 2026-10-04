/*
 * Handlers: scores (điểm luyện đề) — list/create/remove.
 * scoreInputSchema có refine total = listening + reading → đề sai tổng tự thành 400.
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
      `INSERT INTO scores (date, testLabel, listening, reading, total, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(input.date, input.testLabel, input.listening, input.reading, input.total, Date.now())
  const row = getRow<ScoreRow>(db.prepare('SELECT * FROM scores WHERE id = ?'), info.lastInsertRowid)
  if (!row) throw new ApiError(500, 'Không đọc lại được điểm vừa tạo.')
  return assertShape(scoreResponseSchema, scoreRowToJs(row), 'Điểm luyện đề')
}

export function deleteScore(db: DatabaseSync, rawId: string): void {
  db.prepare('DELETE FROM scores WHERE id = ?').run(parseId(rawId, 'Id điểm'))
}
