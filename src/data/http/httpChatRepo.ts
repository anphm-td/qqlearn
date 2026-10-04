/*
 * Impl HTTP của ChatRepo — bảng chatMessages trên server.
 */
import type { ChatRepo } from '@core/ports'
import type { ChatMessage } from '@core/types'

import { httpGet, httpSend } from './client'

export class HttpChatRepo implements ChatRepo {
  constructor(private readonly base: string) {}

  listBySession(sessionId: string): Promise<ChatMessage[]> {
    return httpGet<ChatMessage[]>(this.base, `/chat?sessionId=${encodeURIComponent(sessionId)}`)
  }

  listSessions(): Promise<string[]> {
    return httpGet<string[]>(this.base, '/chat/sessions')
  }

  append(sessionId: string, role: ChatMessage['role'], content: string): Promise<ChatMessage> {
    return httpSend<ChatMessage>(this.base, '/chat', 'POST', { sessionId, role, content })
  }

  async removeSession(sessionId: string): Promise<void> {
    await httpSend<void>(this.base, `/chat/session/${encodeURIComponent(sessionId)}`, 'DELETE')
  }
}
