/*
 * Handlers: vocab (từ vựng) — list/search/create/update/remove.
 */
import type { DatabaseSync } from 'node:sqlite'

import { allRows, getRow, type SqlValue } from '../db.js'
import { ApiError } from '../errors.js'
import { vocabListSchema, vocabRowToJs, type VocabRow } from '../rows.js'
import {
  vocabCreateSchema,
  vocabPatchSchema,
  vocabResponseSchema,
  vocabSearchQuerySchema,
  type VocabData,
} from '../schemas.js'
import { assertShape, parseBody, parseId, parseQuery } from '../validate.js'

export function listVocab(db: DatabaseSync): VocabData[] {
  const rows = allRows<VocabRow>(db.prepare('SELECT * FROM vocab ORDER BY createdAt, id'))
  return assertShape(vocabListSchema, rows.map(vocabRowToJs), 'Danh sách từ vựng')
}

export function searchVocab(db: DatabaseSync, query: unknown): VocabData[] {
  const { q } = parseQuery(vocabSearchQuerySchema, query)
  const text = q.trim()
  if (text === '') return []
  const like = `%${text.toLowerCase()}%`
  const rows = allRows<VocabRow>(
    db.prepare(
      `SELECT * FROM vocab WHERE lower(word) LIKE ? OR lower(meaning) LIKE ? OR lower(example) LIKE ?
       ORDER BY createdAt, id`,
    ),
    like,
    like,
    like,
  )
  return assertShape(vocabListSchema, rows.map(vocabRowToJs), 'Kết quả tìm từ')
}

export function createVocab(db: DatabaseSync, body: unknown): VocabData {
  const input = parseBody(vocabCreateSchema, body)
  const ts = Date.now()
  const info = db
    .prepare(
      `INSERT INTO vocab (word, meaning, example, subject_id, part, sourceTest, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(input.word, input.meaning, input.example, input.subjectId, 0, input.sourceTest, ts, ts)
  const row = getRow<VocabRow>(db.prepare('SELECT * FROM vocab WHERE id = ?'), info.lastInsertRowid)
  if (!row) throw new ApiError(500, 'Không đọc lại được từ vừa tạo.')
  return assertShape(vocabResponseSchema, vocabRowToJs(row), 'Từ vựng')
}

export function updateVocab(db: DatabaseSync, rawId: string, body: unknown): void {
  const id = parseId(rawId, 'Id từ vựng')
  const patch = parseBody(vocabPatchSchema, body)
  const sets: string[] = []
  const values: SqlValue[] = []
  const push = (column: string, value: SqlValue): void => {
    sets.push(`${column} = ?`)
    values.push(value)
  }
  if (patch.word !== undefined) push('word', patch.word)
  if (patch.meaning !== undefined) push('meaning', patch.meaning)
  if (patch.example !== undefined) push('example', patch.example)
  if (patch.subjectId !== undefined) push('subject_id', patch.subjectId)
  if (patch.sourceTest !== undefined) push('sourceTest', patch.sourceTest)
  sets.push('updatedAt = ?')
  values.push(Date.now(), id)
  const info = db.prepare(`UPDATE vocab SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  if (Number(info.changes) === 0) throw new ApiError(404, 'Không tìm thấy từ vựng.')
}

export function deleteVocab(db: DatabaseSync, rawId: string): void {
  db.prepare('DELETE FROM vocab WHERE id = ?').run(parseId(rawId, 'Id từ vựng'))
}
