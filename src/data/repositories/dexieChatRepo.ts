/*
 * Impl local của ChatRepo — bảng chatMessages (hội thoại RAG).
 */
import type { ChatRepo } from '@core/ports'
import type { ChatMessage } from '@core/types'

import { db } from '../db'

export class DexieChatRepo implements ChatRepo {
  listBySession(sessionId: string): Promise<ChatMessage[]> {
    return db.chatMessages.where('sessionId').equals(sessionId).sortBy('createdAt')
  }

  async listSessions(): Promise<string[]> {
    const keys = await db.chatMessages.orderBy('sessionId').uniqueKeys()
    return keys.filter((k): k is string => typeof k === 'string')
  }

  async append(sessionId: string, role: ChatMessage['role'], content: string): Promise<ChatMessage> {
    const now = Date.now()
    const row: ChatMessage = { sessionId, role, content, createdAt: now, updatedAt: now }
    const id = await db.chatMessages.add(row)
    return { ...row, id }
  }

  async removeSession(sessionId: string): Promise<void> {
    await db.chatMessages.where('sessionId').equals(sessionId).delete()
  }
}
