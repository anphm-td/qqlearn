/*
 * Logic thuần BÁO CÁO TUẦN (C11) — so tuần hiện tại với tuần trước.
 * LỚP THUẦN: KHÔNG import React/Dexie/window. Có test vitest (weekReport.test.ts).
 *
 * Tuần bắt đầu THỨ HAI, ngày 'YYYY-MM-DD' local (xem statsAgg.ts).
 * Nguồn dữ liệu (UI nạp qua '@data', KHÔNG đụng Dexie):
 *   - sessions.listBetween(...) → phút học + số buổi.
 *   - notes.listBetween(...)    → newWords (số từ mới ghi trong ngày, trường DailyNote.newWords).
 *   - mistakes.list()           → lọc theo createdAt nằm trong khoảng tuần (repo không có lọc ngày).
 */
import { addDaysISO } from '@core/date'
import type { DailyNote, Mistake, Session } from '@core/types'

import { endOfWeekISO, epochOfDayStartISO } from './statsAgg'

export interface WeekRange {
  /** Thứ Hai đầu tuần. */
  start: string
  /** Chủ Nhật cuối tuần (inclusive). */
  end: string
}

/** Khoảng [Thứ Hai, Chủ Nhật] của tuần chứa `weekStartISO`. */
export function weekRangeOf(weekStartISO: string): WeekRange {
  return { start: weekStartISO, end: endOfWeekISO(weekStartISO) }
}

export interface WeekTotals {
  /** Tổng phút học trong tuần (chỉ đếm buổi durationMin > 0). */
  minutes: number
  /** Số buổi học (bỏ qua buổi 0 phút). */
  sessionCount: number
  /** Số ngày có học ít nhất 1 buổi > 0 phút (tối đa 7). */
  daysStudied: number
  /** Tổng từ mới ghi trong tuần (DailyNote.newWords của các ngày trong tuần). */
  newWords: number
  /** Số lỗi sai được tạo trong tuần (mistakes.createdAt ∈ [đầu tuần, đầu tuần sau)). */
  mistakeCount: number
}

export interface WeekInput {
  sessions: ReadonlyArray<Pick<Session, 'date' | 'durationMin'>>
  notes: ReadonlyArray<Pick<DailyNote, 'date' | 'newWords'>>
  mistakes: ReadonlyArray<Pick<Mistake, 'createdAt'>>
  /** Thứ Hai của tuần đang xem ('YYYY-MM-DD' local). */
  weekStart: string
}

/** Tổng hợp 1 tuần từ dữ liệu thô — tự lọc từng nguồn theo khoảng tuần. */
export function summarizeWeek(input: WeekInput & { range: WeekRange }): WeekTotals {
  const { range } = input

  let minutes = 0
  let sessionCount = 0
  const studiedDates = new Set<string>()
  for (const s of input.sessions) {
    if (s.date < range.start || s.date > range.end) continue
    const m = Math.max(0, s.durationMin)
    if (m <= 0) continue
    minutes += m
    sessionCount += 1
    studiedDates.add(s.date)
  }

  let newWords = 0
  for (const n of input.notes) {
    if (n.date < range.start || n.date > range.end) continue
    newWords += Math.max(0, n.newWords)
  }

  const startEpoch = epochOfDayStartISO(range.start)
  const endEpochExclusive = epochOfDayStartISO(addDaysISO(range.end, 1))
  let mistakeCount = 0
  for (const mk of input.mistakes) {
    if (mk.createdAt >= startEpoch && mk.createdAt < endEpochExclusive) mistakeCount += 1
  }

  return { minutes, sessionCount, daysStudied: studiedDates.size, newWords, mistakeCount }
}

export interface WeekDelta {
  minutes: number
  sessionCount: number
  daysStudied: number
  newWords: number
  mistakeCount: number
}

export interface WeekReport {
  range: WeekRange
  totals: WeekTotals
  /** Tổng hợp của tuần liền trước (7 ngày trước `weekStart`). */
  previous: WeekTotals
  /** totals − previous theo từng chỉ số. */
  delta: WeekDelta
}

/** Báo cáo tuần `weekStart` + so với tuần liền trước — 1 lần gọi cho cả hai tuần. */
export function buildWeekReport(input: WeekInput): WeekReport {
  const range = weekRangeOf(input.weekStart)
  const prevStart = addDaysISO(input.weekStart, -7)

  const totals = summarizeWeek({ ...input, range })
  const previous = summarizeWeek({ ...input, range: weekRangeOf(prevStart) })

  return {
    range,
    totals,
    previous,
    delta: {
      minutes: totals.minutes - previous.minutes,
      sessionCount: totals.sessionCount - previous.sessionCount,
      daysStudied: totals.daysStudied - previous.daysStudied,
      newWords: totals.newWords - previous.newWords,
      mistakeCount: totals.mistakeCount - previous.mistakeCount,
    },
  }
}

/** Câu tóm tắt "so với tuần trước" cho card báo cáo tuần (StatsPage). */
export function describeDelta(delta: WeekDelta): string {
  const parts: string[] = []
  if (delta.minutes === 0) parts.push('giờ học giữ nguyên')
  else parts.push(`${delta.minutes > 0 ? 'học nhiều' : 'học kém'} hơn ${Math.abs(delta.minutes)} phút`)

  if (delta.newWords === 0) parts.push('từ mới giữ nguyên')
  else parts.push(`${delta.newWords > 0 ? 'thêm' : 'bớt'} ${Math.abs(delta.newWords)} từ mới`)

  if (delta.mistakeCount === 0) parts.push('lỗi sai giữ nguyên')
  else parts.push(`${delta.mistakeCount > 0 ? 'nhiều' : 'ít'} hơn ${Math.abs(delta.mistakeCount)} lỗi`)

  return `so với tuần trước: ${parts.join(' · ')}`
}
