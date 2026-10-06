/*
 * D15 — Logic thuần soạn nháp "Ghi chú cuối ngày".
 *
 * LỚP THUẦN: KHÔNG import React/Dexie/window. buildDailyDraft() (dailyDraft.ts)
 * fetch dữ liệu qua repos rồi truyền vào đây để sinh văn bản/prompt.
 *
 * i18n: văn bản nháp là template ĐỘNG (ghép môn, phút, từ mới…) — sinh theo `lang`
 * (mặc định 'vi', nguồn chuẩn) qua key ở namespace 'smart' (dict/smart.ts). Prompt
 * gửi RAG cũng dịch theo lang để trợ lý trả lời đúng ngôn ngữ người học đang dùng.
 */

import { t, type Lang } from '@core/i18n'
import type { Mistake, Session, Vocab } from '@core/types'

/** Ranh giới thời gian (epoch ms) của 1 ngày local 'YYYY-MM-DD' — nửa mở [start, end). */
export function dayRangeMs(dateISO: string): { startMs: number; endMs: number } {
  const [y, m, d] = dateISO.split('-').map(Number)
  const startMs = new Date(y, m - 1, d).getTime()
  const endMs = new Date(y, m - 1, d + 1).getTime()
  return { startMs, endMs }
}

/** 'YYYY-MM-DD' → 'dd/mm' để nhắc ngày trong văn bản/prompt. */
export function formatDayMonth(dateISO: string): string {
  const [, m, d] = dateISO.split('-')
  return `${d}/${m}`
}

/** Môn ở dạng rút gọn (id + tên) — UI nạp qua repos rồi truyền vào DayFacts. */
export interface SubjectLite {
  id: number
  name: string
}

/** Dữ liệu thô trong ngày mà buildDailyDraft thu được. */
export interface DayFacts {
  sessions: ReadonlyArray<Pick<Session, 'subjectId' | 'durationMin'>>
  /** Từ vựng tạo hôm nay (lọc trước theo createdAt). */
  vocab: ReadonlyArray<Pick<Vocab, 'word'>>
  mistakes: ReadonlyArray<Pick<Mistake, 'subjectId' | 'cause'>>
  /** Các môn của app (id + tên) — để hiện TÊN môn thay vì số. */
  subjects: readonly SubjectLite[]
}

export interface DaySummary {
  /** Các môn đã học hôm nay (tăng dần theo id, bỏ môn 0 "chưa phân môn" — số phút của nó nằm ở unassignedMinutes). */
  subjectIdsStudied: number[]
  /** Số phút của buổi CHƯA PHÂN MÔN (subjectId 0) — vẫn là buổi học thật, nháp không được bỏ sót. */
  unassignedMinutes: number
  minutes: number
  newWords: number
  /** Tối đa 5 từ đầu tiên để liệt kê trong nháp/prompt. */
  words: string[]
  mistakeCount: number
  /** Môn có nhiều lỗi nhất trước — dùng khi tóm tắt. */
  mistakesBySubject: Array<{ subjectId: number; name: string; count: number }>
  /** true khi ngày có ít nhất 1 dữ liệu thật (buổi học/từ mới/lỗi sai). */
  hasAnything: boolean
  /** Tóm tắt lỗi sai do người gọi truyền sẵn (ghi đè phần tự tóm tắt). */
  mistakesNote?: string
}

function subjectNameOf(facts: DayFacts, subjectId: number, lang: Lang): string {
  return facts.subjects.find((s) => s.id === subjectId)?.name ?? t(lang, 'smart', 'draft.subjectDeleted')
}

export function summarizeDay(facts: DayFacts, lang: Lang = 'vi'): DaySummary {
  const minutes = facts.sessions.reduce((sum, s) => sum + s.durationMin, 0)
  const subjectIdsStudied = [
    ...new Set(facts.sessions.map((s) => s.subjectId).filter((id) => id >= 1)),
  ].sort((a, b) => a - b)
  // Buổi chưa phân môn (subjectId 0) vẫn là buổi học thật — tính riêng số phút để
  // nháp/prompt ghi nhận (BUG: 1 buổi nghe 1 phút subjectId 0 → nháp bảo "chưa ghi
  // buổi học nào" vì danh sách môn rỗng).
  const unassignedMinutes = facts.sessions
    .filter((s) => s.subjectId < 1)
    .reduce((sum, s) => sum + s.durationMin, 0)

  const countBySubject = new Map<number, number>()
  for (const m of facts.mistakes) {
    countBySubject.set(m.subjectId, (countBySubject.get(m.subjectId) ?? 0) + 1)
  }
  const mistakesBySubject = [...countBySubject.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([subjectId, count]) => ({ subjectId, name: subjectNameOf(facts, subjectId, lang), count }))

  return {
    subjectIdsStudied,
    unassignedMinutes,
    minutes,
    newWords: facts.vocab.length,
    words: facts.vocab.map((v) => v.word).slice(0, 5),
    mistakeCount: facts.mistakes.length,
    mistakesBySubject,
    hasAnything: facts.sessions.length > 0 || facts.vocab.length > 0 || facts.mistakes.length > 0,
  }
}

/** Ngày có dữ liệu thật (tính cả số liệu ghi đè từ input) không. */
export function hasMeaningfulData(summary: DaySummary): boolean {
  return (
    summary.hasAnything ||
    summary.minutes > 0 ||
    summary.subjectIdsStudied.length > 0 ||
    summary.newWords > 0 ||
    summary.mistakeCount > 0 ||
    Boolean(summary.mistakesNote?.trim())
  )
}

/** Tóm tắt lỗi sai 1 dòng: "2 lỗi sai — nhiều nhất ở Toán (2 câu)" — dịch theo lang. */
export function composeMistakesSummary(summary: DaySummary, lang: Lang = 'vi'): string {
  if (summary.mistakesNote !== undefined) return summary.mistakesNote
  if (summary.mistakeCount === 0) return ''
  const bySubject = summary.mistakesBySubject
    .map((x) => t(lang, 'smart', 'draft.mistakesSubject', { name: x.name, count: x.count }))
    .join(' · ')
  return bySubject
    ? t(lang, 'smart', 'draft.mistakesSummary', { count: summary.mistakeCount, subjects: bySubject })
    : t(lang, 'smart', 'draft.mistakesSummaryOnly', { count: summary.mistakeCount })
}

/** Danh sách tên môn đã học để liệt kê trong nháp/prompt — buổi chưa phân môn
 *  (subjectId 0) hiện là "chưa phân môn" thay vì bị lọc mất. */
function studiedNames(
  summary: DaySummary,
  lang: Lang,
  subjectNames?: ReadonlyMap<number, string>,
): string[] {
  const names = summary.subjectIdsStudied.map(
    (id) => subjectNames?.get(id) ?? t(lang, 'smart', 'draft.subjectId', { id }),
  )
  if (summary.unassignedMinutes > 0) names.push(t(lang, 'smart', 'subject.unassigned'))
  return names
}

/** Nội dung nháp đề xuất — người học sửa rồi mới lưu vào dailyNotes (dịch theo lang). */
export function composeDraftText(
  summary: DaySummary,
  subjectNames?: ReadonlyMap<number, string>,
  lang: Lang = 'vi',
): string {
  const lines: string[] = []
  const names = studiedNames(summary, lang, subjectNames)

  if (names.length > 0) {
    lines.push(
      summary.minutes === 1
        ? t(lang, 'smart', 'draft.studiedOne', { names: names.join(', ') })
        : t(lang, 'smart', 'draft.studied', { minutes: summary.minutes, names: names.join(', ') }),
    )
  } else {
    lines.push(t(lang, 'smart', 'draft.noSessions'))
  }

  if (summary.newWords > 0) {
    if (summary.words.length > 0) {
      const rest = summary.newWords - summary.words.length
      lines.push(
        rest > 0
          ? t(lang, 'smart', 'draft.wordsListMore', { words: summary.words.join(', '), rest })
          : t(lang, 'smart', 'draft.wordsList', { words: summary.words.join(', ') }),
      )
    } else {
      lines.push(t(lang, 'smart', 'draft.wordsCount', { count: summary.newWords }))
    }
  }

  const mistakes = composeMistakesSummary(summary, lang)
  if (mistakes) lines.push(`${mistakes}.`)

  lines.push(t(lang, 'smart', 'draft.feeling'))
  return lines.join('\n')
}

/** Nháp khi chưa có dữ liệu — vẫn để người học viết tay cảm nhận được (dịch theo lang). */
export function composeEmptyDraftText(lang: Lang = 'vi'): string {
  return [
    t(lang, 'smart', 'draft.emptyIntro'),
    t(lang, 'smart', 'draft.emptyHandwritten'),
    t(lang, 'smart', 'draft.feeling'),
  ].join('\n')
}

/** Prompt gửi RAG để xin nháp ghi chú cuối ngày từ dữ liệu thật (dịch theo lang —
 *  nhờ vậy trợ lý soạn nháp đúng ngôn ngữ người học đang dùng). */
export function buildDraftPrompt(
  summary: DaySummary,
  dateISO: string,
  subjectNames?: ReadonlyMap<number, string>,
  lang: Lang = 'vi',
): string {
  const names = studiedNames(summary, lang, subjectNames).join(', ')
  const studied = names
    ? t(lang, 'smart', 'draft.minutesNames', { minutes: summary.minutes, names })
    : t(lang, 'smart', 'draft.noSessionsShort')
  const words =
    summary.newWords === 0
      ? t(lang, 'smart', 'draft.promptWordsNone')
      : summary.words.length > 0
        ? t(lang, 'smart', 'draft.promptWordsList', {
            count: summary.newWords,
            words: summary.words.join(', '),
          })
        : t(lang, 'smart', 'draft.promptWordsCount', { count: summary.newWords })
  const mistakes = composeMistakesSummary(summary, lang) || t(lang, 'smart', 'draft.promptMistakesNone')
  return [
    t(lang, 'smart', 'draft.promptRole'),
    t(lang, 'smart', 'draft.promptFor', { date: formatDayMonth(dateISO) }),
    t(lang, 'smart', 'draft.promptStudied', { studied }),
    t(lang, 'smart', 'draft.promptWords', { words }),
    t(lang, 'smart', 'draft.promptMistakes', { mistakes }),
    t(lang, 'smart', 'draft.promptRequire'),
  ].join('\n')
}
