/*
 * Test tín hiệu "dữ liệu vừa đổi" (data-changed) — cơ chế DOM event trên window
 * nên test trực tiếp trên jsdom: phát đúng chi tiết, mọi người nghe đều nhận,
 * và hàm gỡ listener (cleanup của useEffect) thật sự ngắt.
 */
import { describe, expect, it, vi } from 'vitest'

import { DATA_CHANGED_EVENT, emitDataChanged, onDataChanged } from './dataEvents'

describe('dataEvents — tín hiệu data-changed giữa các trang đang mở', () => {
  it('emitDataChanged phát CustomEvent trên window với detail { table }', () => {
    const listener = vi.fn()
    window.addEventListener(DATA_CHANGED_EVENT, listener)
    try {
      emitDataChanged('sessions')

      expect(listener).toHaveBeenCalledTimes(1)
      const event = listener.mock.calls[0][0] as CustomEvent
      expect(event.type).toBe('qqlearn:data-changed')
      expect(event.detail).toEqual({ table: 'sessions' })
    } finally {
      window.removeEventListener(DATA_CHANGED_EVENT, listener)
    }
  })

  it('onDataChanged đưa chi tiết vào handler; tín hiệu bảng nào cũng tới (người nghe tự lọc)', () => {
    const handler = vi.fn()
    const off = onDataChanged(handler)
    try {
      emitDataChanged('sessions')
      emitDataChanged('notes')

      expect(handler).toHaveBeenCalledTimes(2)
      expect(handler).toHaveBeenNthCalledWith(1, { table: 'sessions' })
      expect(handler).toHaveBeenNthCalledWith(2, { table: 'notes' })
    } finally {
      off()
    }
  })

  it('hàm gỡ listener thật sự ngắt — không nhận tín hiệu sau khi gỡ', () => {
    const handler = vi.fn()
    const off = onDataChanged(handler)
    off()

    emitDataChanged('sessions')

    expect(handler).not.toHaveBeenCalled()
  })
})
