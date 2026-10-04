/*
 * D13 — Client gọi backend RAG: POST {ragBaseUrl}/ask (fetch thuần, không React/Dexie).
 *
 * Endpoint theo docs/thiet-ke-rag-toeic.md mục 11.2:
 *   POST /ask  body {question, mode, top_k?, filters?} → {answer, citations[], …}
 * Backend RAG (FastAPI) được dựng riêng sau, nên mọi lỗi (mạng, timeout, mã HTTP,
 * JSON sai) đều trả về KẾT QUẢ CÓ CẤU TRÚC thay vì throw — UI không bao giờ "chết".
 */

/** Hạn chờ tối đa cho một câu hỏi — 30 giây (theo yêu cầu tính năng). */
export const RAG_TIMEOUT_MS = 30_000

/** Thông điệp chuẩn khi chưa cấu hình máy trợ lý — dùng chung SuggestionCard/ChatPage. */
export const RAG_NOT_CONNECTED_MESSAGE =
  'Chưa kết nối máy trợ lý — nhập địa chỉ máy trợ lý trong Cài đặt'

export interface RagQuerySuccess {
  ok: true
  answer: string
  /** Trích dẫn nguồn nếu backend trả — có thể rỗng. */
  citations: string[]
}

export type RagQueryFailureReason =
  | 'empty-url' // chưa nhập địa chỉ backend trong Cài đặt
  | 'empty-question'
  | 'network' // fetch lỗi (backend chưa chạy, máy không có mạng…)
  | 'timeout' // quá 30s (hoặc timeoutMs truyền vào)
  | 'server' // backend trả mã HTTP lỗi
  | 'bad-response' // không đọc được JSON hoặc thiếu câu trả lời

export interface RagQueryFailure {
  ok: false
  reason: RagQueryFailureReason
  /** Thông điệp thân thiện, hiển thị thẳng cho người học. */
  message: string
}

export type RagQueryResult = RagQuerySuccess | RagQueryFailure

export interface RagQueryOptions {
  /** Mặc định RAG_TIMEOUT_MS (30s) — test truyền số nhỏ cho nhanh. */
  timeoutMs?: number
  /** Tín hiệu huỷ từ bên ngoài (component unmount) — tuỳ chọn. */
  signal?: AbortSignal
}

/**
 * Hỏi backend RAG một câu hỏi. Luôn resolve, không throw.
 * Endpoint: POST {ragBaseUrl}/ask — body { question, mode, top_k }.
 */
export async function queryRag(
  baseUrl: string,
  question: string,
  options: RagQueryOptions = {},
): Promise<RagQueryResult> {
  const trimmedQuestion = question.trim()
  if (!trimmedQuestion) {
    return {
      ok: false,
      reason: 'empty-question',
      message: 'Bạn chưa nhập câu hỏi — gõ điều bạn muốn hỏi đã nhé.',
    }
  }

  const base = baseUrl.trim().replace(/\/+$/, '')
  if (!base) {
    return { ok: false, reason: 'empty-url', message: RAG_NOT_CONNECTED_MESSAGE }
  }

  const timeoutMs = options.timeoutMs ?? RAG_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onOuterAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onOuterAbort, { once: true })

  try {
    const res = await fetch(`${base}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: trimmedQuestion, mode: 'qa', top_k: 6 }),
      signal: controller.signal,
    })

    if (!res.ok) {
      return {
        ok: false,
        reason: 'server',
        message: `Máy trợ lý gặp sự cố (mã ${res.status}). Thử lại sau ít phút nhé.`,
      }
    }

    const raw = await res.text()
    let data: unknown
    try {
      data = JSON.parse(raw)
    } catch {
      return {
        ok: false,
        reason: 'bad-response',
        message: 'Máy trợ lý trả kết quả không đọc được. Thử lại nhé.',
      }
    }

    const answer = pickString(data, ['answer', 'response', 'text', 'result'])
    if (!answer) {
      return {
        ok: false,
        reason: 'bad-response',
        message: 'Máy trợ lý chưa trả lời được câu này. Thử hỏi cách khác nhé.',
      }
    }
    return { ok: true, answer, citations: extractCitations(data) }
  } catch {
    if (controller.signal.aborted) {
      if (options.signal?.aborted) {
        return { ok: false, reason: 'network', message: 'Đã huỷ câu hỏi này.' }
      }
      return {
        ok: false,
        reason: 'timeout',
        message: `Máy trợ lý trả lời quá lâu (quá ${Math.round(timeoutMs / 1000)} giây). Thử hỏi ngắn gọn hơn nhé.`,
      }
    }
    return {
      ok: false,
      reason: 'network',
      message: 'Không kết nối được máy trợ lý. Kiểm tra máy trợ lý đã mở chưa rồi thử lại nhé.',
    }
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onOuterAbort)
  }
}

/** Đọc chuỗi từ trường đầu tiên có trong đối tượng phản hồi (chống lệch tên field). */
function pickString(data: unknown, keys: readonly string[]): string | null {
  if (typeof data !== 'object' || data === null) return null
  const record = data as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

/** Citations có thể là mảng chuỗi hoặc mảng đối tượng — gom về chuỗi đọc được. */
function extractCitations(data: unknown): string[] {
  if (typeof data !== 'object' || data === null) return []
  const raw = (data as Record<string, unknown>)['citations']
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (typeof item === 'string' && item.trim()) return item.trim()
      if (typeof item === 'object' && item !== null) {
        return pickString(item, ['chunk_id', 'test_id', 'title', 'source'])
      }
      return null
    })
    .filter((s): s is string => s !== null)
}
