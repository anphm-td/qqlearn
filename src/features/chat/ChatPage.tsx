import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import EmptyState from '@/components/ui/EmptyState'
import Icon from '@/components/ui/Icon'
import { PrimaryButton } from '@/components/ui/buttons'
import type { ChatMessage } from '@core/types'
import { repos } from '@data'
import { useT } from '@data/useT'

import { queryRag } from '@/features/smart/ragClient'

/*
 * D13 — /tro-chuyên: chat hỏi đáp RAG (bong bóng chat, mobile-first khung 390px).
 * - ragClient.ts gọi POST {ragBaseUrl}/ask (timeout 30s, mọi lỗi trả kết quả có cấu trúc
 *   → UI không chết khi fetch lỗi; thông điệp lỗi do client dịch theo `lang`).
 * - Lịch chat lưu bảng chatMessages qua repos.chat (sessionId sinh 1 lần và
 *   nhớ ở máy để tải lại trang vẫn còn cuộc trò chuyện).
 * - ragBaseUrl rỗng → trạng thái rõ ràng kèm giải thích (backend RAG dựng sau,
 *   theo docs/thiet-ke-rag-toeic.md).
 * - Đọc settings qua SettingsRepo trong effect CÓ catch (thay vì useSettings() —
 *   hook scaffold không bắt lỗi, môi trường không IndexedDB sẽ sinh unhandled rejection).
 * - i18n: mọi chuỗi hiển thị qua useT('chat'); lang truyền xuống queryRag để thông
 *   điệp lỗi dịch theo ngôn ngữ hiện tại.
 * - ≥768px: cột giữa hẹp 480–720px căn giữa (design-system.md mục 10) — max-w-[600px].
 */

/** Key lưu sessionId hiện tại — để tải lại trang không mất cuộc trò chuyện. */
export const CHAT_SESSION_STORAGE_KEY = 'qlearn.chat.sessionId'

function createSessionId(): string {
  // crypto.randomUUID khi trình duyệt hỗ trợ, dự phòng tự sinh (không thêm dependency).
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function loadSessionId(): string {
  try {
    const saved = window.localStorage.getItem(CHAT_SESSION_STORAGE_KEY)
    if (saved) return saved
  } catch {
    // localStorage bị chặn (privacy mode) — vẫn chat được, chỉ là không nhớ phiên.
  }
  const id = createSessionId()
  try {
    window.localStorage.setItem(CHAT_SESSION_STORAGE_KEY, id)
  } catch {
    // bỏ qua — phiên chỉ sống trong lần mở này
  }
  return id
}

function saveSessionId(id: string): void {
  try {
    window.localStorage.setItem(CHAT_SESSION_STORAGE_KEY, id)
  } catch {
    // bỏ qua
  }
}

function localOnlyMessage(
  sessionId: string,
  role: ChatMessage['role'],
  content: string,
): ChatMessage {
  const now = Date.now()
  return { sessionId, role, content, createdAt: now, updatedAt: now }
}

export default function ChatPage() {
  const { t, lang } = useT('chat')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [ragBaseUrl, setRagBaseUrl] = useState('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const listRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)
  const abortRef = useRef<AbortController | null>(null)

  const ragConfigured = ragBaseUrl !== ''

  // Mở phiên (tạo nếu chưa có) + tải lịch của phiên + đọc ragBaseUrl — 1 effect có catch.
  // Đọc TUẦN TỰ (không Promise.all): Dexie mở DB lỗi khi nhiều op chạy đồng thời vẫn
  // nhả 1 unhandled rejection nội bộ (môi trường không có IndexedDB).
  useEffect(() => {
    mountedRef.current = true
    const id = loadSessionId()
    setSessionId(id)
    void (async () => {
      try {
        const rows = await repos.chat.listBySession(id)
        const settings = await repos.settings.get()
        if (!mountedRef.current) return
        setMessages(rows)
        setRagBaseUrl(settings.ragBaseUrl.trim())
        setHistoryLoaded(true)
      } catch {
        // Không đọc được lịch/cài đặt (IndexedDB lỗi) — vẫn cho chat, chỉ là trắng trang.
        if (!mountedRef.current) return
        setHistoryLoaded(true)
      }
    })()
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  // Cuộn xuống tin nhắn mới nhất.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, sending])

  function startNewConversation(): void {
    if (sending) return
    const id = createSessionId()
    saveSessionId(id)
    setSessionId(id)
    setMessages([])
    setError(null)
  }

  async function handleSend(): Promise<void> {
    const text = input.trim()
    if (!text || sending || !sessionId || !ragConfigured) return

    setInput('')
    setError(null)
    setSending(true)

    // 1) Lưu + hiện tin nhắn của người học (lưu lỗi thì vẫn hiện tạm trên màn).
    let userMessage = localOnlyMessage(sessionId, 'user', text)
    try {
      userMessage = await repos.chat.append(sessionId, 'user', text)
    } catch {
      // bỏ qua — hiển thị bản tạm
    }
    if (!mountedRef.current) return
    setMessages((prev) => [...prev, userMessage])

    // 2) Hỏi backend RAG — mọi lỗi đều là kết quả có cấu trúc, không throw;
    //    thông điệp lỗi do client soạn theo `lang` hiện tại.
    const controller = new AbortController()
    abortRef.current = controller
    const outcome = await queryRag(ragBaseUrl, text, { signal: controller.signal, lang })
    if (!mountedRef.current) return

    if (outcome.ok) {
      let assistantMessage = localOnlyMessage(sessionId, 'assistant', outcome.answer)
      try {
        assistantMessage = await repos.chat.append(sessionId, 'assistant', outcome.answer)
      } catch {
        // bỏ qua — hiển thị bản tạm
      }
      if (!mountedRef.current) return
      setMessages((prev) => [...prev, assistantMessage])
    } else {
      setError(outcome.message)
    }
    setSending(false)
  }

  const canChat = historyLoaded && ragConfigured

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-4">
      <div>
        <p className="section-label">{t('page.kicker')}</p>
        <h1 className="type-display">{t('page.title')}</h1>
      </div>

      <p className="type-body text-muted">{t('page.intro')}</p>

      <div ref={listRef} className="flex max-h-[55dvh] flex-col gap-3 overflow-y-auto pr-1">
        {!historyLoaded && <p className="type-body text-muted">{t('history.loading')}</p>}

        {historyLoaded && messages.length === 0 && canChat && (
          <EmptyState message={t('empty.invite')} />
        )}

        {messages.map((message, index) => (
          <div
            key={`${message.role}-${message.createdAt}-${index}`}
            className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
          >
            <div
              className={
                message.role === 'user'
                  ? 'type-body max-w-[85%] rounded-[12px] rounded-br-[4px] bg-teal-soft px-3.5 py-2.5 whitespace-pre-wrap'
                  : 'type-body max-w-[85%] rounded-[12px] rounded-bl-[4px] border border-rule bg-card px-3.5 py-2.5 whitespace-pre-wrap'
              }
            >
              {message.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="type-body rounded-[12px] rounded-bl-[4px] border border-rule bg-card px-3.5 py-2.5 text-muted">
              {t('sending.status')}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-[10px] border border-coral bg-pink-soft px-4 py-3" role="alert">
          <p className="type-body text-ink">{error}</p>
          <p className="type-caption mt-1 text-muted">{t('error.keepMessage')}</p>
        </div>
      )}

      {historyLoaded && !canChat && (
        <>
          <EmptyState
            message={t('notConnected.message')}
            action={
              <Link to="/caidat" className="btn btn-secondary type-body">
                {t('notConnected.action')}
              </Link>
            }
          />
          <p className="type-caption text-muted">{t('notConnected.hint')}</p>
        </>
      )}

      {canChat && (
        <div className="paper-card px-4 pt-4 pb-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            rows={2}
            placeholder={t('composer.placeholder')}
            aria-label={t('composer.aria')}
            className="type-body w-full resize-none border-0 bg-transparent text-ink placeholder:text-muted focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-dashed border-rule pt-3">
            {messages.length > 0 ? (
              <button
                type="button"
                onClick={startNewConversation}
                className="type-caption text-muted underline underline-offset-2"
              >
                {t('composer.newChat')}
              </button>
            ) : (
              <span className="type-caption text-muted">{t('composer.hint')}</span>
            )}
            <PrimaryButton onClick={() => void handleSend()} disabled={sending || !input.trim()}>
              <Icon name="chat" size={18} />
              {t('composer.send')}
            </PrimaryButton>
          </div>
        </div>
      )}

      {historyLoaded && messages.length > 0 && (
        <p className="type-caption text-muted">{t('history.savedLocally')}</p>
      )}
    </div>
  )
}
