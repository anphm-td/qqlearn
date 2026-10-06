/*
 * Handlers: sessions (buổi học) — listBetween/create/update/remove.
 */
import type { DatabaseSync } from 'node:sqlite'

import { allRows, getRow, type SqlValue } from '../db.js'
import { ApiError } from '../errors.js'
import { sessionListSchema, sessionRowToJs, type SessionRow } from '../rows.js'
import {
  rangeQuerySchema,
  sessionCreateSchema,
  sessionPatchSchema,
  sessionResponseSchema,
  type SessionData,
} from '../schemas.js'
import { assertShape, parseBody, parseId, parseQuery } from '../validate.js'

export function listSessions(db: DatabaseSync, query: unknown): SessionData[] {
  const { from, to } = parseQuery(rangeQuerySchema, query)
  let rows: SessionRow[]
  if (from !== undefined && to !== undefined) {
    rows = allRows<SessionRow>(
      db.prepare('SELECT * FROM sessions WHERE date >= ? AND date <= ? ORDER BY startedAt, id'),
      from,
      to,
    )
  } else {
    rows = allRows<SessionRow>(db.prepare('SELECT * FROM sessions ORDER BY startedAt, id'))
  }
  return assertShape(sessionListSchema, rows.map(sessionRowToJs), 'Danh sách buổi học')
}

export function createSession(db: DatabaseSync, body: unknown): SessionData {
  const input = parseBody(sessionCreateSchema, body)
  const info = db
    .prepare(
      `INSERT INTO sessions (date, startedAt, endedAt, durationMin, subject_id, part, activity, source, note, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.date,
      input.startedAt,
      input.endedAt,
      input.durationMin,
      input.subjectId,
      // part = cột legacy của khung TOEIC cũ — hàng mới luôn ghi 0.
      0,
      input.activity,
      input.source,
      input.note,
      Date.now(),
    )
  const row = getRow<SessionRow>(db.prepare('SELECT * FROM sessions WHERE id = ?'), info.lastInsertRowid)
  if (!row) throw new ApiError(500, 'Không đọc lại được buổi học vừa tạo.')
  return assertShape(sessionResponseSchema, sessionRowToJs(row), 'Buổi học')
}

export function updateSession(db: DatabaseSync, rawId: string, body: unknown): void {
  const id = parseId(rawId, 'Id buổi học')
  const patch = parseBody(sessionPatchSchema, body)
  const sets: string[] = []
  const values: SqlValue[] = []
  const push = (column: string, value: SqlValue): void => {
    sets.push(`${column} = ?`)
    values.push(value)
  }
  if (patch.date !== undefined) push('date', patch.date)
  if (patch.startedAt !== undefined) push('startedAt', patch.startedAt)
  if (patch.endedAt !== undefined) push('endedAt', patch.endedAt)
  if (patch.durationMin !== undefined) push('durationMin', patch.durationMin)
  if (patch.subjectId !== undefined) push('subject_id', patch.subjectId)
  if (patch.activity !== undefined) push('activity', patch.activity)
  if (patch.source !== undefined) push('source', patch.source)
  if (patch.note !== undefined) push('note', patch.note)
  sets.push('updatedAt = ?')
  values.push(Date.now(), id)
  const info = db.prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  if (Number(info.changes) === 0) throw new ApiError(404, 'Không tìm thấy buổi học.')
}

export function deleteSession(db: DatabaseSync, rawId: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(parseId(rawId, 'Id buổi học'))
}
