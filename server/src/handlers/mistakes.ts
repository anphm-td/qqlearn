/*
 * Handlers: mistakes (lỗi sai luyện đề) — list/create/update/setReviewed/remove.
 */
import type { DatabaseSync } from 'node:sqlite'

import { allRows, getRow, type SqlValue } from '../db.js'
import { ApiError } from '../errors.js'
import { mistakeListSchema, mistakeRowToJs, type MistakeRow } from '../rows.js'
import {
  mistakeCreateSchema,
  mistakePatchSchema,
  mistakeResponseSchema,
  mistakeReviewedSchema,
  type MistakeData,
} from '../schemas.js'
import { assertShape, parseBody, parseId } from '../validate.js'

export function listMistakes(db: DatabaseSync): MistakeData[] {
  const rows = allRows<MistakeRow>(db.prepare('SELECT * FROM mistakes ORDER BY createdAt DESC, id DESC'))
  return assertShape(mistakeListSchema, rows.map(mistakeRowToJs), 'Danh sách lỗi sai')
}

export function createMistake(db: DatabaseSync, body: unknown): MistakeData {
  const input = parseBody(mistakeCreateSchema, body)
  const ts = Date.now()
  const info = db
    .prepare(
      `INSERT INTO mistakes (testNo, subject_id, part, questionNo, myAnswer, correctAnswer, cause, explanation, reviewed, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.testNo,
      input.subjectId,
      // part = cột legacy của khung TOEIC cũ — hàng mới luôn ghi 0.
      0,
      input.questionNo,
      input.myAnswer,
      input.correctAnswer,
      input.cause,
      input.explanation,
      input.reviewed ? 1 : 0,
      ts,
      ts,
    )
  const row = getRow<MistakeRow>(db.prepare('SELECT * FROM mistakes WHERE id = ?'), info.lastInsertRowid)
  if (!row) throw new ApiError(500, 'Không đọc lại được lỗi sai vừa tạo.')
  return assertShape(mistakeResponseSchema, mistakeRowToJs(row), 'Lỗi sai')
}

export function updateMistake(db: DatabaseSync, rawId: string, body: unknown): void {
  const id = parseId(rawId, 'Id lỗi sai')
  const patch = parseBody(mistakePatchSchema, body)
  const sets: string[] = []
  const values: SqlValue[] = []
  const push = (column: string, value: SqlValue): void => {
    sets.push(`${column} = ?`)
    values.push(value)
  }
  if (patch.testNo !== undefined) push('testNo', patch.testNo)
  if (patch.subjectId !== undefined) push('subject_id', patch.subjectId)
  if (patch.questionNo !== undefined) push('questionNo', patch.questionNo)
  if (patch.myAnswer !== undefined) push('myAnswer', patch.myAnswer)
  if (patch.correctAnswer !== undefined) push('correctAnswer', patch.correctAnswer)
  if (patch.cause !== undefined) push('cause', patch.cause)
  if (patch.explanation !== undefined) push('explanation', patch.explanation)
  if (patch.reviewed !== undefined) push('reviewed', patch.reviewed ? 1 : 0)
  sets.push('updatedAt = ?')
  values.push(Date.now(), id)
  const info = db.prepare(`UPDATE mistakes SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  if (Number(info.changes) === 0) throw new ApiError(404, 'Không tìm thấy lỗi sai.')
}

export function setMistakeReviewed(db: DatabaseSync, rawId: string, body: unknown): void {
  const id = parseId(rawId, 'Id lỗi sai')
  const input = parseBody(mistakeReviewedSchema, body)
  const info = db
    .prepare('UPDATE mistakes SET reviewed = ?, updatedAt = ? WHERE id = ?')
    .run(input.reviewed ? 1 : 0, Date.now(), id)
  if (Number(info.changes) === 0) throw new ApiError(404, 'Không tìm thấy lỗi sai.')
}

export function deleteMistake(db: DatabaseSync, rawId: string): void {
  db.prepare('DELETE FROM mistakes WHERE id = ?').run(parseId(rawId, 'Id lỗi sai'))
}
