/*
 * D15 — Logic thuần soạn nháp "Ghi chú cuối ngày".
 *
 * LỚP THUẦN: KHÔNG import React/Dexie/window. buildDailyDraft() (dailyDraft.ts)
 * fetch dữ liệu qua repos rồi truyền vào đây để sinh văn bản/prompt.
 */

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

/** Dữ liệu thô trong ngày mà buildDailyDraft thu được. */
export interface DayFacts {
  sessions: ReadonlyArray<Pick<Session, 'part' | 'durationMin'>>
  /** Từ vựng tạo hôm nay (lọc trước theo createdAt). */
  vocab: ReadonlyArray<Pick<Vocab, 'word'>>
  mistakes: ReadonlyArray<Pick<Mistake, 'part' | 'cause'>>
}

export interface DaySummary {
  /** Part 1–7 đã học hôm nay (tăng dần, bỏ part 0). */
  partStudied: number[]
  minutes: number
  newWords: number
  /** Tối đa 5 từ đầu tiên để liệt kê trong nháp/prompt. */
  words: string[]
  mistakeCount: number
  /** Part có nhiều lỗi nhất trước — dùng khi tóm tắt. */
  mistakesByPart: Array<{ part: number; count: number }>
  /** true khi ngày có ít nhất 1 dữ liệu thật (buổi học/từ mới/lỗi sai). */
  hasAnything: boolean
  /** Tóm tắt lỗi sai do người gọi truyền sẵn (ghi đè phần tự tóm tắt). */
  mistakesNote?: string
}

export function summarizeDay(facts: DayFacts): DaySummary {
  const minutes = facts.sessions.reduce((sum, s) => sum + s.durationMin, 0)
  const partStudied = [
    ...new Set(facts.sessions.map((s) => s.part).filter((p) => p >= 1 && p <= 7)),
  ].sort((a, b) => a - b)

  const countByPart = new Map<number, number>()
  for (const m of facts.mistakes) {
    countByPart.set(m.part, (countByPart.get(m.part) ?? 0) + 1)
  }
  const mistakesByPart = [...countByPart.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([part, count]) => ({ part, count }))

  return {
    partStudied,
    minutes,
    newWords: facts.vocab.length,
    words: facts.vocab.map((v) => v.word).slice(0, 5),
    mistakeCount: facts.mistakes.length,
    mistakesByPart,
    hasAnything: facts.sessions.length > 0 || facts.vocab.length > 0 || facts.mistakes.length > 0,
  }
}

/** Ngày có dữ liệu thật (tính cả số liệu ghi đè từ input) không. */
export function hasMeaningfulData(summary: DaySummary): boolean {
  return (
    summary.hasAnything ||
    summary.minutes > 0 ||
    summary.partStudied.length > 0 ||
    summary.newWords > 0 ||
    summary.mistakeCount > 0 ||
    Boolean(summary.mistakesNote?.trim())
  )
}

/** Tóm tắt lỗi sai 1 dòng: "2 lỗi sai — nhiều nhất ở Part 5 (2 câu)". */
export function composeMistakesSummary(summary: DaySummary): string {
  if (summary.mistakesNote !== undefined) return summary.mistakesNote
  if (summary.mistakeCount === 0) return ''
  const byPart = summary.mistakesByPart
    .map((x) => `Part ${x.part} (${x.count} câu)`)
    .join(' · ')
  return byPart
    ? `${summary.mistakeCount} lỗi sai — nhiều nhất ở ${byPart}`
    : `${summary.mistakeCount} lỗi sai`
}

/** Nội dung nháp đề xuất — người học sửa rồi mới lưu vào dailyNotes. */
export function composeDraftText(summary: DaySummary): string {
  const lines: string[] = []

  if (summary.partStudied.length > 0) {
    const parts = summary.partStudied.map((p) => `Part ${p}`).join(', ')
    lines.push(`Hôm nay học ${summary.minutes} phút — ${parts}.`)
  } else {
    lines.push('Hôm nay chưa ghi buổi học nào.')
  }

  if (summary.newWords > 0) {
    if (summary.words.length > 0) {
      const rest = summary.newWords - summary.words.length
      lines.push(
        `Từ mới: ${summary.words.join(', ')}${rest > 0 ? ` và ${rest} từ khác` : ''}.`,
      )
    } else {
      lines.push(`Từ mới: ${summary.newWords} từ.`)
    }
  }

  const mistakes = composeMistakesSummary(summary)
  if (mistakes) lines.push(`${mistakes}.`)

  lines.push('Cảm nhận hôm nay: …')
  return lines.join('\n')
}

/** Nháp khi chưa có dữ liệu — vẫn để người học viết tay cảm nhận được. */
export function composeEmptyDraftText(): string {
  return [
    'Hôm nay chưa có dữ liệu để soạn nháp — học một buổi ngắn, thêm vài từ mới',
    'hoặc ghi lỗi sai là nháp sẽ có ngay.',
    'Bạn vẫn có thể viết tay cảm nhận của mình vào đây nhé.',
    'Cảm nhận hôm nay: …',
  ].join('\n')
}

/** Prompt gửi RAG để xin nháp ghi chú cuối ngày từ dữ liệu thật. */
export function buildDraftPrompt(summary: DaySummary, dateISO: string): string {
  const parts = summary.partStudied.map((p) => `Part ${p}`).join(', ')
  const studied = parts
    ? `${summary.minutes} phút — ${parts}`
    : 'chưa ghi buổi học nào'
  const words =
    summary.newWords === 0
      ? 'không có từ mới'
      : summary.words.length > 0
        ? `${summary.newWords} từ (${summary.words.join(', ')})`
        : `${summary.newWords} từ`
  const mistakes = composeMistakesSummary(summary) || 'không có lỗi sai mới'
  return [
    `Bạn là trợ lý học TOEIC. Hãy soạn NHÁP ghi chú cuối ngày (${formatDayMonth(dateISO)}) cho học viên từ dữ liệu sau:`,
    `- Đã học: ${studied}`,
    `- Từ mới: ${words}`,
    `- Lỗi sai: ${mistakes}`,
    'Yêu cầu: viết 3–4 dòng ngắn, tiếng Việt thân thiện (giọng sổ tay), dòng cuối gợi mở một câu "Cảm nhận hôm nay: …" cho học viên điền tiếp. Không dùng emoji, không dùng Markdown.',
  ].join('\n')
}
