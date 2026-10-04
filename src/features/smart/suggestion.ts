/*
 * D14 — Logic thuần chọn "Hôm nay nên học gì" (SuggestionCard).
 *
 * LỚP THUẦN: KHÔNG import React/Dexie/window — chỉ types từ @core và ngày từ @core/date.
 * Thứ tự ưu tiên (theo yêu cầu tính năng):
 *   1. Lỗi sai chưa reviewed  →  2. Thẻ SRS đến hạn hôm nay  →
 *   3. Part có số phút ít nhất trong 7 ngày qua  →  4. Chưa có dữ liệu → mời bắt đầu.
 */

import { addDaysISO } from '@core/date'

import type { Session } from '@core/types'

/** Đầu vào đã rút gọn từ dữ liệu thật (UI fetch qua repos rồi truyền vào đây). */
export interface SuggestionInput {
  /** Số lỗi sai có reviewed = false. */
  unreviewedMistakes: number
  /** Số thẻ SRS đến hạn ở ngày hôm nay. */
  dueCards: number
  /** Tổng phút học theo Part trong 7 ngày qua — Part không có buổi = 0 phút. */
  minutesByPart: Partial<Record<number, number>>
}

export interface Suggestion {
  kind: 'mistakes' | 'srs' | 'part' | 'start'
  /** Tiêu đề ngắn trong card. */
  title: string
  /** Lời gợi ý thân thiện (design-system.md mục 8). */
  body: string
  /** Số liệu kèm theo (lỗi sai / thẻ đến hạn / phút) — 0 khi không áp dụng. */
  count: number
  /** Đơn vị hiển thị cạnh số ('lỗi sai' | 'từ' | 'phút' | ''). */
  unit: string
  /** Chỉ có ở kind 'part' — Part 1–7 nên học. */
  part?: number
}

/** Cộng phút theo Part (giữ cả part 0 = không rõ — người gọi tự quyết có dùng không). */
export function sumMinutesByPart(
  sessions: ReadonlyArray<Pick<Session, 'part' | 'durationMin'>>,
): Partial<Record<number, number>> {
  const byPart: Partial<Record<number, number>> = {}
  for (const s of sessions) {
    byPart[s.part] = (byPart[s.part] ?? 0) + s.durationMin
  }
  return byPart
}

/** Cửa sổ "7 ngày qua" tính cả hôm nay: [hôm nay − 6 ngày, hôm nay]. */
export function weekWindowISO(todayISO: string): { from: string; to: string } {
  return { from: addDaysISO(todayISO, -6), to: todayISO }
}

/** Part 1–7 có số phút thấp nhất — part không học = 0 phút; hoà thì chọn Part số nhỏ hơn. */
export function weakestPart(minutesByPart: Partial<Record<number, number>>): number {
  let weakest = 1
  for (let part = 1; part <= 7; part++) {
    const minutes = minutesByPart[part] ?? 0
    const weakestMinutes = minutesByPart[weakest] ?? 0
    if (minutes < weakestMinutes) weakest = part
  }
  return weakest
}

function totalMinutes(minutesByPart: Partial<Record<number, number>>): number {
  return Object.values(minutesByPart).reduce<number>((sum, m) => sum + (m ?? 0), 0)
}

/** Chọn gợi ý theo thứ tự ưu tiên — hàm thuần, không gọi dữ liệu. */
export function pickSuggestion(input: SuggestionInput): Suggestion {
  const { unreviewedMistakes, dueCards, minutesByPart } = input

  // Ưu tiên 1 — lỗi sai chưa reviewed (sửa sớm khi còn nhớ ngữ cảnh).
  if (unreviewedMistakes > 0) {
    return {
      kind: 'mistakes',
      title: 'Ôn lại lỗi sai',
      body:
        unreviewedMistakes === 1
          ? 'Bạn còn 1 lỗi sai chưa ôn lại — xem lại nguyên nhân để hôm nay không vấp lần nữa nhé.'
          : `Bạn còn ${unreviewedMistakes} lỗi sai chưa ôn lại — xem lại nguyên nhân để hôm nay không vấp lần nữa nhé.`,
      count: unreviewedMistakes,
      unit: 'lỗi sai',
    }
  }

  // Ưu tiên 2 — thẻ từ vựng đến hạn (Leitner): ngắn, quên là mất.
  if (dueCards > 0) {
    return {
      kind: 'srs',
      title: 'Ôn từ vựng đến hạn',
      body:
        dueCards === 1
          ? 'Có 1 từ đến hạn ôn hôm nay — vài phút là xong, nhớ trước khi quên.'
          : `Có ${dueCards} từ đến hạn ôn hôm nay — vài phút là xong, nhớ trước khi quên.`,
      count: dueCards,
      unit: 'từ',
    }
  }

  // Ưu tiên 3 — Part có số giờ ít nhất trong 7 ngày qua (chỉ khi 7 ngày qua có học).
  if (totalMinutes(minutesByPart) > 0) {
    const part = weakestPart(minutesByPart)
    const minutes = minutesByPart[part] ?? 0
    return {
      kind: 'part',
      title: minutes === 0 ? `Mở lại Part ${part}` : `Bổ sung Part ${part}`,
      body:
        minutes === 0
          ? `7 ngày qua bạn chưa chạm Part ${part} chút nào — hôm nay thử một buổi ngắn Part ${part} nhé.`
          : `7 ngày qua Part ${part} ít được ôn nhất (${minutes} phút) — hôm nay dành một buổi cho Part ${part} nhé.`,
      count: minutes,
      unit: 'phút',
      part,
    }
  }

  // Ưu tiên 4 — chưa có gì để gợi ý: mời bắt đầu buổi đầu tiên.
  return {
    kind: 'start',
    title: 'Bắt đầu buổi học đầu tiên',
    body: 'Sổ của bạn đang trống — một buổi học ngắn hoặc vài từ mới là card này sẽ gợi ý được ngay.',
    count: 0,
    unit: '',
  }
}

/** Prompt gửi RAG (ragClient) — mô tả dữ liệu hôm nay, xin MỘT gợi ý ngắn. */
export function buildSuggestionPrompt(input: SuggestionInput, todayISO: string): string {
  const partLines = [1, 2, 3, 4, 5, 6, 7]
    .map((part) => `Part ${part}: ${input.minutesByPart[part] ?? 0} phút`)
    .join(', ')
  return [
    `Bạn là trợ lý học TOEIC. Dữ liệu học của học viên tính đến hôm nay (${todayISO}):`,
    `- Lỗi sai chưa ôn lại: ${input.unreviewedMistakes} câu`,
    `- Thẻ từ vựng đến hạn ôn: ${input.dueCards} từ`,
    `- Số phút học theo Part trong 7 ngày qua: ${partLines}`,
    'Hãy chọn MỘT việc nên làm tiếp theo và trả lời NGẮN (tối đa 2 câu), tiếng Việt thân thiện, cụ thể và khả thi trong một buổi học. Không dùng emoji, không dùng Markdown.',
  ].join('\n')
}
