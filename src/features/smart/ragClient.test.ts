import { afterEach, describe, expect, it, vi } from 'vitest'

import { queryRag, RAG_NOT_CONNECTED_MESSAGE, RAG_TIMEOUT_MS } from './ragClient'

/** Đối tượng đủ interface mà ragClient đọc từ response (ok/status/text) — không cần Response thật. */
function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    text: async () => JSON.stringify(body),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('queryRag — POST {ragBaseUrl}/ask', () => {
  it('RAG_TIMEOUT_MS mặc định là 30 giây', () => {
    expect(RAG_TIMEOUT_MS).toBe(30_000)
  })

  it('địa chỉ rỗng → empty-url với thông điệp chuẩn, KHÔNG gọi fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await queryRag('   ', 'xin chào')
    expect(result).toEqual({
      ok: false,
      reason: 'empty-url',
      message: RAG_NOT_CONNECTED_MESSAGE,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('câu hỏi rỗng → empty-question, không gọi fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await queryRag('http://127.0.0.1:8300', '   ')
    expect(result).toMatchObject({ ok: false, reason: 'empty-question' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('thành công: POST đúng endpoint, bỏ slash thừa, đọc answer + citations', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ answer: 'Ôn Part 5 nhé', citations: ['ets2023_t2'] }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await queryRag('http://127.0.0.1:8300///', 'giải thích câu 134')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://127.0.0.1:8300/ask')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ question: 'giải thích câu 134', mode: 'qa', top_k: 6 }))
    expect(result).toEqual({ ok: true, answer: 'Ôn Part 5 nhé', citations: ['ets2023_t2'] })
  })

  it('đọc được các tên trường thay thế (response/text) và citations dạng đối tượng', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          response: 'Trả lời dự phòng',
          citations: [{ chunk_id: 'q_ets2023_t2_p5_134' }, 'nguồn thô', 42],
        }),
      ),
    )
    const result = await queryRag('http://x', 'q')
    expect(result).toEqual({
      ok: true,
      answer: 'Trả lời dự phòng',
      citations: ['q_ets2023_t2_p5_134', 'nguồn thô'],
    })
  })

  it('mã HTTP lỗi → reason "server" kèm mã', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)))
    const result = await queryRag('http://x', 'q')
    expect(result).toMatchObject({ ok: false, reason: 'server' })
    expect((result as { message: string }).message).toContain('500')
  })

  it('JSON hỏng → reason "bad-response" (không throw)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => 'không phải json' }),
    )
    const result = await queryRag('http://x', 'q')
    expect(result).toMatchObject({ ok: false, reason: 'bad-response' })
  })

  it('thiếu câu trả lời trong phản hồi → reason "bad-response"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ foo: 1 })))
    const result = await queryRag('http://x', 'q')
    expect(result).toMatchObject({ ok: false, reason: 'bad-response' })
  })

  it('fetch từ chối (backend chưa chạy) → reason "network"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const result = await queryRag('http://x', 'q')
    expect(result).toMatchObject({
      ok: false,
      reason: 'network',
      message: 'Không kết nối được máy trợ lý. Kiểm tra máy trợ lý đã mở chưa rồi thử lại nhé.',
    })
  })

  it('quá hạn chờ → reason "timeout" (dùng timeoutMs nhỏ để test nhanh)', async () => {
    // Mô phỏng fetch thật: khi signal abort → fetch từ chối (AbortError).
    vi.stubGlobal(
      'fetch',
      (_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')), {
            once: true,
          })
        }),
    )
    const result = await queryRag('http://x', 'q', { timeoutMs: 20 })
    expect(result).toMatchObject({ ok: false, reason: 'timeout' })
    expect((result as { message: string }).message).toContain('quá lâu')
  })

  it('luôn resolve — không bao giờ throw kể cả khi fetch không tồn tại', async () => {
    vi.stubGlobal('fetch', undefined)
    const result = await queryRag('http://x', 'q')
    expect(result.ok).toBe(false)
  })
})
