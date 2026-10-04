/*
 * Port: Chat (hội thoại RAG) — LỚP CORE.
 */
import type { ChatMessage } from '../types'

export interface ChatRepo {
  listBySession(sessionId: string): Promise<ChatMessage[]>
  /** Id của TẤT CẢ các phiên đã có tin nhắn (xuất sao lưu, duyệt lịch chat). */
  listSessions(): Promise<string[]>
  /** Thêm 1 tin nhắn vào phiên; tự sinh id + createdAt + updatedAt. */
  append(sessionId: string, role: ChatMessage['role'], content: string): Promise<ChatMessage>
  removeSession(sessionId: string): Promise<void>
}
