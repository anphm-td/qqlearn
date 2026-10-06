/*
 * D14 — Logic thuần chọn "Hôm nay nên học gì" (SuggestionCard).
 *
 * LỚP THUẦN: KHÔNG import React/Dexie/window — chỉ types từ @core, ngày từ @core/date
 * và lõi i18n thuần từ @core/i18n (t() không đụng React).
 * Thứ tự ưu tiên (theo yêu cầu tính năng):
 *   1. Lỗi sai chưa reviewed  →  2. Thẻ SRS đến hạn hôm nay  →
 *   3. Môn có số giờ ít nhất trong 7 ngày qua  →  4. Chưa có dữ liệu → mời bắt đầu.
 *
 * i18n: title/body/unit là template động — sinh theo `lang` (mặc định 'vi', nguồn
 * chuẩn) qua key ở namespace 'smart' (src/core/i18n/dict/smart.ts). UI truyền
 * lang hiện tại (useT('smart').lang) để dịch theo ngôn ngữ đã chọn.
 */

import { addDaysISO } from '@core/date'
import { t, type Lang } from '@core/i18n'

import type { Session } from '@core/types'

/** Môn ở dạng rút gọn cho logic thuần (UI nạp qua repos rồi truyền vào). */
export interface SubjectLite {
  id: number
  name: string
}

/** Đầu vào đã rút gọn từ dữ liệu thật (UI fetch qua repos rồi truyền vào đây). */
export interface SuggestionInput {
  /** Số lỗi sai có reviewed = false. */
  unreviewedMistakes: number
  /** Số thẻ SRS đến hạn ở ngày hôm nay. */
  dueCards: number
  /** Tổng phút học theo môn trong 7 ngày qua — môn không có buổi = 0 phút. */
  minutesBySubject: Partial<Record<number, number>>
  /** Các môn đang học (đã lọc lưu trữ), theo thứ tự hiển thị trong app. */
  subjects: readonly SubjectLite[]
}

export interface Suggestion {
  kind: 'mistakes' | 'srs' | 'subject' | 'start'
  /** Tiêu đề ngắn trong card (đã dịch theo lang). */
  title: string
  /** Lời gợi ý thân thiện (design-system.md mục 8) — đã dịch theo lang. */
  body: string
  /** Số liệu kèm theo (lỗi sai / thẻ đến hạn / phút) — 0 khi không áp dụng. */
  count: number
  /** Đơn vị hiển thị cạnh số ('lỗi sai' | 'từ' | 'phút' | '' — đã dịch theo lang). */
  unit: string
  /** Chỉ có ở kind 'subject' — môn nên học. */
  subjectId?: number
  subjectName?: string
}

/** Cộng phút theo môn (giữ cả subjectId 0 = chưa phân môn — người gọi tự quyết có dùng không). */
export function sumMinutesBySubject(
  sessions: ReadonlyArray<Pick<Session, 'subjectId' | 'durationMin'>>,
): Partial<Record<number, number>> {
  const bySubject: Partial<Record<number, number>> = {}
  for (const s of sessions) {
    bySubject[s.subjectId] = (bySubject[s.subjectId] ?? 0) + s.durationMin
  }
  return bySubject
}

/** Cửa sổ "7 ngày qua" tính cả hôm nay: [hôm nay − 6 ngày, hôm nay]. */
export function weekWindowISO(todayISO: string): { from: string; to: string } {
  return { from: addDaysISO(todayISO, -6), to: todayISO }
}

/**
 * Môn đang học có số phút thấp nhất trong 7 ngày qua — môn chưa học = 0 phút;
 * hoà thì chọn môn đứng TRƯỚC trong danh sách (thứ tự app hiển thị).
 * Danh sách môn rỗng → null (không có môn nào để gợi ý).
 */
export function weakestSubject(
  minutesBySubject: Partial<Record<number, number>>,
  subjects: readonly SubjectLite[],
): number | null {
  if (subjects.length === 0) return null
  let weakest = subjects[0]!.id
  for (const s of subjects.slice(1)) {
    const minutes = minutesBySubject[s.id] ?? 0
    const weakestMinutes = minutesBySubject[weakest] ?? 0
    if (minutes < weakestMinutes) weakest = s.id
  }
  return weakest
}

function totalMinutes(minutesBySubject: Partial<Record<number, number>>): number {
  return Object.values(minutesBySubject).reduce<number>((sum, m) => sum + (m ?? 0), 0)
}

/** Chọn gợi ý theo thứ tự ưu tiên — hàm thuần, không gọi dữ liệu.
 *  `lang` mặc định 'vi' (nguồn chuẩn) — UI truyền ngôn ngữ hiện tại để dịch. */
export function pickSuggestion(input: SuggestionInput, lang: Lang = 'vi'): Suggestion {
  const { unreviewedMistakes, dueCards, minutesBySubject, subjects } = input

  // Ưu tiên 1 — lỗi sai chưa reviewed (sửa sớm khi còn nhớ ngữ cảnh).
  if (unreviewedMistakes > 0) {
    return {
      kind: 'mistakes',
      title: t(lang, 'smart', 'suggestion.mistakes.title'),
      body:
        unreviewedMistakes === 1
          ? t(lang, 'smart', 'suggestion.mistakes.bodyOne')
          : t(lang, 'smart', 'suggestion.mistakes.body', { count: unreviewedMistakes }),
      count: unreviewedMistakes,
      unit: t(lang, 'smart', 'unit.mistakes'),
    }
  }

  // Ưu tiên 2 — thẻ từ vựng đến hạn (Leitner): ngắn, quên là mất.
  if (dueCards > 0) {
    return {
      kind: 'srs',
      title: t(lang, 'smart', 'suggestion.srs.title'),
      body:
        dueCards === 1
          ? t(lang, 'smart', 'suggestion.srs.bodyOne')
          : t(lang, 'smart', 'suggestion.srs.body', { count: dueCards }),
      count: dueCards,
      unit: t(lang, 'smart', 'unit.words'),
    }
  }

  // Ưu tiên 3 — môn có số giờ ít nhất trong 7 ngày qua (chỉ khi có môn + 7 ngày qua có học).
  const subjectId = weakestSubject(minutesBySubject, subjects)
  const subjectName = subjects.find((s) => s.id === subjectId)?.name
  if (subjectId !== null && subjectName && totalMinutes(minutesBySubject) > 0) {
    const minutes = minutesBySubject[subjectId] ?? 0
    return {
      kind: 'subject',
      title:
        minutes === 0
          ? t(lang, 'smart', 'suggestion.subject.titleBack', { subject: subjectName })
          : t(lang, 'smart', 'suggestion.subject.titleBoost', { subject: subjectName }),
      body:
        minutes === 0
          ? t(lang, 'smart', 'suggestion.subject.bodyBack', { subject: subjectName })
          : t(lang, 'smart', 'suggestion.subject.bodyBoost', { subject: subjectName, minutes }),
      count: minutes,
      unit: t(lang, 'smart', 'unit.minutes'),
      subjectId,
      subjectName,
    }
  }

  // Ưu tiên 4 — chưa có gì để gợi ý: mời bắt đầu buổi đầu tiên.
  return {
    kind: 'start',
    title: t(lang, 'smart', 'suggestion.start.title'),
    body: t(lang, 'smart', 'suggestion.start.body'),
    count: 0,
    unit: '',
  }
}

/** Prompt gửi RAG (ragClient) — mô tả dữ liệu hôm nay, xin MỘT gợi ý ngắn.
 *  Dịch theo `lang` để trợ lý trả lời đúng ngôn ngữ người học đang dùng. */
export function buildSuggestionPrompt(input: SuggestionInput, todayISO: string, lang: Lang = 'vi'): string {
  const subjectLines = input.subjects.length
    ? input.subjects
        .map((s) =>
          t(lang, 'smart', 'prompt.subjectLine', { name: s.name, minutes: input.minutesBySubject[s.id] ?? 0 }),
        )
        .join('\n')
    : t(lang, 'smart', 'prompt.noSubjects')
  return [
    t(lang, 'smart', 'prompt.intro'),
    `(${todayISO})`,
    t(lang, 'smart', 'prompt.mistakesLine', { count: input.unreviewedMistakes }),
    t(lang, 'smart', 'prompt.dueLine', { count: input.dueCards }),
    subjectLines,
    t(lang, 'smart', 'prompt.require'),
  ].join('\n')
}
