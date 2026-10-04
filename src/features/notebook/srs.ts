/*
 * Logic thuần SRS Leitner (B5) — nhóm B "Sổ tay nội dung TOEIC".
 * QUY TẮC LỚP: KHÔNG import React/Dexie/window — chỉ @core/date (thuần) + types.
 *
 * Quy tắc ôn giãn cách (theo đặt hàng tính năng B5):
 *  - 5 hộp Leitner. Trả ĐÚNG → tăng 1 hộp (tối đa hộp 5); hạn ôn kế tiếp theo
 *    khoảng của hộp MỚI: hộp 1 · 3 · 7 · 16 · 35 ngày (hộp 1 = 1 ngày dành cho
 *    thẻ mới/trả sai → mai ôn lại).
 *  - Trả SAI → về hộp 1, hạn ôn = ngày mai.
 *  - Hạn ôn là 'YYYY-MM-DD' múi giờ LOCAL (dùng addDaysISO từ '@core/date' —
 *    KHÔNG dùng new Date().toISOString() vì lệch ngày UTC).
 */
import { addDaysISO } from '@core/date'
import type { SrsCard } from '@core/types'

/** Số ngày tới hạn sau khi trả ĐÚNG khi thẻ đang ở từng hộp (index = box - 1). */
export const BOX_INTERVALS: readonly number[] = [1, 3, 7, 16, 35]

export const MIN_BOX = 1
export const MAX_BOX = 5

/** Ép hộp vào khoảng 1–5 (chặn dữ liệu lệch khỏi schema). */
export function clampBox(box: number): number {
  if (!Number.isFinite(box)) return MIN_BOX
  return Math.min(MAX_BOX, Math.max(MIN_BOX, Math.round(box)))
}

/** Hộp kế tiếp sau 1 lượt ôn: đúng → +1 (tối đa 5); sai → về hộp 1. */
export function nextBox(box: number, correct: boolean): number {
  if (!correct) return MIN_BOX
  return Math.min(MAX_BOX, clampBox(box) + 1)
}

/** Khoảng nghỉ (ngày) của 1 hộp — hạn ôn áp cho thẻ khi Ở hộp đó. */
export function intervalForBox(box: number): number {
  const b = clampBox(box)
  return BOX_INTERVALS[b - 1] ?? BOX_INTERVALS[0]!
}

/** Hạn ôn kế tiếp ('YYYY-MM-DD' local) sau lượt ôn hôm nay. */
export function nextDueDate(today: string, boxBefore: number, correct: boolean): string {
  const box = nextBox(boxBefore, correct)
  return addDaysISO(today, intervalForBox(box))
}

/** Các trường thẻ cần ghi lại sau 1 lượt ôn. */
export interface CardReviewPatch {
  box: number
  dueDate: string
  lastReviewed: number
  correctCount: number
  updatedAt: number
}

/**
 * Áp dụng 1 lượt ôn lên thẻ (hàm thuần — UI ghi qua repos.srs.review()).
 * `now` truyền vào để test xác định được; mặc định epoch ms hiện tại.
 */
export function reviewCard(
  card: Pick<SrsCard, 'box' | 'correctCount'>,
  correct: boolean,
  today: string,
  now: number = Date.now(),
): CardReviewPatch {
  const box = nextBox(card.box, correct)
  return {
    box,
    dueDate: addDaysISO(today, intervalForBox(box)),
    lastReviewed: now,
    correctCount: card.correctCount + (correct ? 1 : 0),
    updatedAt: now,
  }
}

/** Thẻ đến hạn ở `today` (so sánh chuỗi ISO cùng định dạng là đủ). */
export function isDue(card: Pick<SrsCard, 'dueDate'>, today: string): boolean {
  return card.dueDate <= today
}

/** Sắp thẻ theo hạn: đến hạn trước đứng trước; hoà thì so id để ổn định. */
export function sortByDue(cards: SrsCard[]): SrsCard[] {
  return [...cards].sort(
    (a, b) => a.dueDate.localeCompare(b.dueDate) || (a.id ?? 0) - (b.id ?? 0),
  )
}

/** Số ngày giữa 2 ngày ISO local (dương nếu `toISO` sau `fromISO`). */
export function daysUntil(fromISO: string, toISO: string): number {
  return Math.round((isoDay(toISO) - isoDay(fromISO)) / 86_400_000)
}

function isoDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y || 1970, (m || 1) - 1, d || 1)
}
