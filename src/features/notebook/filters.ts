/*
 * Bộ lọc + ô tìm kiếm nhanh cho Sổ tay (B6/B7) — logic thuần, KHÔNG import
 * React/Dexie/window. UI gọi sau khi lấy dữ liệu qua repos (từ '@data').
 */
import type { DailyNote, Mistake, Vocab } from '@core/types'

/** Chuẩn hoá ô tìm kiếm: bỏ khoảng trắng thừa 2 đầu + giữa, chữ thường. */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** true khi `query` rỗng hoặc khớp (contains) một trong các chuỗi nội dung. */
export function matchesQuery(fields: string[], query: string): boolean {
  const q = normalizeQuery(query)
  if (!q) return true
  return fields.some((f) => f.toLowerCase().includes(q))
}

// ===== Từ vựng (B5/B7) =====

export interface VocabFilter {
  query: string
  /** Part lọc; 0 = tất cả (từ part 0 "không rõ" chỉ hiện ở chế độ tất cả). */
  part: number
}

export function filterVocab(items: Vocab[], f: VocabFilter): Vocab[] {
  return items.filter((v) => {
    if (f.part > 0 && v.part !== f.part) return false
    return matchesQuery([v.word, v.meaning, v.example, v.sourceTest], f.query)
  })
}

// ===== Ghi chú cuối ngày (B7/B8) =====

export interface NoteFilter {
  query: string
  /** Part lọc theo partStudied; 0 = tất cả. */
  part: number
}

export function filterNotes(items: DailyNote[], f: NoteFilter): DailyNote[] {
  return items.filter((n) => {
    if (f.part > 0 && !n.partStudied.includes(f.part)) return false
    return matchesQuery([n.reflection, n.mistakesSummary, n.date], f.query)
  })
}

// ===== Lỗi sai (B6) =====

export type ReviewedFilter = 'all' | 'unreviewed' | 'reviewed'

export interface MistakeFilter {
  /** Part lọc; 0 = tất cả. */
  part: number
  reviewed: ReviewedFilter
}

export function filterMistakes(items: Mistake[], f: MistakeFilter): Mistake[] {
  return items.filter((m) => {
    if (f.part > 0 && m.part !== f.part) return false
    if (f.reviewed === 'unreviewed' && m.reviewed) return false
    if (f.reviewed === 'reviewed' && !m.reviewed) return false
    return true
  })
}

/** Số lỗi chưa ôn lại — dùng cho nhãn đếm nhanh. */
export function countUnreviewed(items: Mistake[]): number {
  return items.filter((m) => !m.reviewed).length
}
