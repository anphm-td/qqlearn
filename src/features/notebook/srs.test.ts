/*
 * Test logic thuần SRS Leitner (B5) — hộp 1–5, hạn ôn 1/3/7/16/35 ngày.
 */
import { describe, expect, it } from 'vitest'

import {
  BOX_INTERVALS,
  MAX_BOX,
  MIN_BOX,
  clampBox,
  daysUntil,
  intervalForBox,
  isDue,
  nextBox,
  nextDueDate,
  reviewCard,
  sortByDue,
} from './srs'

const TODAY = '2026-10-03'

describe('BOX_INTERVALS (đặt hàng B5: 1/3/7/16/35 ngày)', () => {
  it('đúng bảng 5 hộp', () => {
    expect(BOX_INTERVALS).toEqual([1, 3, 7, 16, 35])
    expect(BOX_INTERVALS).toHaveLength(5)
  })

  it('intervalForBox trả đúng từng hộp', () => {
    expect(intervalForBox(1)).toBe(1)
    expect(intervalForBox(2)).toBe(3)
    expect(intervalForBox(3)).toBe(7)
    expect(intervalForBox(4)).toBe(16)
    expect(intervalForBox(5)).toBe(35)
  })
})

describe('nextBox', () => {
  it('trả đúng tăng hộp, chặn ở hộp 5', () => {
    expect(nextBox(1, true)).toBe(2)
    expect(nextBox(4, true)).toBe(5)
    expect(nextBox(5, true)).toBe(MAX_BOX)
  })

  it('trả sai về hộp 1', () => {
    expect(nextBox(3, false)).toBe(MIN_BOX)
    expect(nextBox(5, false)).toBe(MIN_BOX)
  })

  it('ép hộp lệch vào khoảng 1–5', () => {
    expect(clampBox(0)).toBe(1)
    expect(clampBox(9)).toBe(5)
    expect(clampBox(2.6)).toBe(3)
    expect(clampBox(Number.NaN)).toBe(1)
  })
})

describe('nextDueDate + reviewCard (hạn ôn local, không lệch UTC)', () => {
  it('đúng từ hộp 1 → hộp 2, hạn sau 3 ngày (vượt tháng)', () => {
    expect(nextDueDate('2026-09-29', 1, true)).toBe('2026-10-02')
    const patch = reviewCard({ box: 1, correctCount: 0 }, true, TODAY, 1_000)
    expect(patch).toEqual({
      box: 2,
      dueDate: '2026-10-06',
      lastReviewed: 1_000,
      correctCount: 1,
      updatedAt: 1_000,
    })
  })

  it('đúng từ hộp 4 → hộp 5 (+35 theo hộp MỚI, như DexieSrsRepo); hộp 3 → 4 là +16', () => {
    expect(reviewCard({ box: 4, correctCount: 3 }, true, TODAY).box).toBe(5)
    expect(nextDueDate(TODAY, 4, true)).toBe('2026-11-07')
    expect(nextDueDate(TODAY, 3, true)).toBe('2026-10-19')
    expect(reviewCard({ box: 5, correctCount: 9 }, true, TODAY).box).toBe(5)
    expect(nextDueDate(TODAY, 5, true)).toBe('2026-11-07')
  })

  it('sai về hộp 1, hạn = ngày mai (kể cả qua cuối tháng)', () => {
    const patch = reviewCard({ box: 3, correctCount: 2 }, false, '2026-10-31', 5_000)
    expect(patch.box).toBe(1)
    expect(patch.dueDate).toBe('2026-11-01')
    expect(patch.correctCount).toBe(2) // sai không cộng correctCount
  })
})

describe('isDue + sortByDue', () => {
  const card = (id: number | undefined, dueDate: string) => ({
    id,
    vocabId: 1,
    box: 1,
    dueDate,
    lastReviewed: null,
    correctCount: 0,
    updatedAt: 0,
  })

  it('đến hạn khi dueDate ≤ hôm nay', () => {
    expect(isDue({ dueDate: TODAY }, TODAY)).toBe(true)
    expect(isDue({ dueDate: '2026-10-02' }, TODAY)).toBe(true)
    expect(isDue({ dueDate: '2026-10-04' }, TODAY)).toBe(false)
  })

  it('sắp theo hạn, hoà theo id, không làm_mutations mảng gốc', () => {
    const cards = [card(3, '2026-10-05'), card(1, '2026-10-01'), card(2, '2026-10-01')]
    const sorted = sortByDue(cards)
    expect(sorted.map((c) => c.id)).toEqual([1, 2, 3])
    expect(cards.map((c) => c.id)).toEqual([3, 1, 2])
  })
})

describe('daysUntil', () => {
  it('đếm ngày giữa 2 mốc, xử lý âm và sang năm', () => {
    expect(daysUntil('2026-10-03', '2026-10-10')).toBe(7)
    expect(daysUntil('2026-10-10', '2026-10-03')).toBe(-7)
    expect(daysUntil('2026-12-20', '2027-01-05')).toBe(16)
  })
})
