/*
 * Handlers: chatMessages (hội thoại RAG) — listBySession/listSessions/append/removeSession.
 */
import type { DatabaseSync } from 'node:sqlite'
import { z } from 'zod'

import { allRows, getRow } from '../db.js'
import { ApiError } from '../errors.js'
import { chatListSchema, chatRowToJs, type ChatRow } from '../rows.js'
import {
  chatAppendSchema,
  chatListQuerySchema,
  chatResponseSchema,
  chatSessionParamSchema,
  type ChatData,
} from '../schemas.js'
import { assertShape, parseBody, parseWith } from '../validate.js'

export function listChatBySession(db: DatabaseSync, query: unknown): ChatData[] {
  const { sessionId } = parseBody(chatListQuerySchema, query)
  const rows = allRows<ChatRow>(
    db.prepare('SELECT * FROM chatMessages WHERE sessionId = ? ORDER BY createdAt, id'),
    sessionId,
  )
  return assertShape(chatListSchema, rows.map(chatRowToJs), 'Lịch chat')
}

export function listChatSessions(db: DatabaseSync): string[] {
  const rows = allRows<{ sessionId: string }>(db.prepare('SELECT DISTINCT sessionId FROM chatMessages ORDER BY sessionId'))
  return assertShape(z.array(z.string()), rows.map((r) => String(r.sessionId)), 'Danh sách phiên chat')
}

export function appendChat(db: DatabaseSync, body: unknown): ChatData {
  const input = parseBody(chatAppendSchema, body)
  const ts = Date.now()
  const info = db
    .prepare('INSERT INTO chatMessages (sessionId, role, content, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)')
    .run(input.sessionId, input.role, input.content, ts, ts)
  const row = getRow<ChatRow>(db.prepare('SELECT * FROM chatMessages WHERE id = ?'), info.lastInsertRowid)
  if (!row) throw new ApiError(500, 'Không đọc lại được tin nhắn vừa lưu.')
  return assertShape(chatResponseSchema, chatRowToJs(row), 'Tin nhắn')
}

export function deleteChatSession(db: DatabaseSync, rawSessionId: string): void {
  const sessionId = parseWith(chatSessionParamSchema, rawSessionId, 'Id phiên chat')
  db.prepare('DELETE FROM chatMessages WHERE sessionId = ?').run(sessionId)
}
