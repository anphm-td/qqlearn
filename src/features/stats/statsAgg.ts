/*
 * Logic thuần thống kê — nhóm stats (C9/C11).
 * LỚP THUẦN: KHÔNG import React/Dexie/window. Có test vitest (statsAgg.test.ts).
 *
 * Quy ước ngày: 'YYYY-MM-DD' múi giờ LOCAL (từ localDateISO()/todayISO() của '@core/date'),
 * tuần bắt đầu THỨ HAI. So sánh ngày dùng so sánh chuỗi (ISO cùng dạng, so được như số).
 */
import { addDaysISO } from '@core/date'
import { t, type Lang } from '@core/i18n'
import type { Session } from '@core/types'

/** Hàng dữ liệu tối giản để tính phút — chỉ cần date + durationMin. */
export type SessionMinuteRow = Pick<Session, 'date' | 'durationMin'>
/** Hàng dữ liệu tối giản để phân bổ môn. */
export type SessionSubjectRow = Pick<Session, 'subjectId' | 'durationMin'>

// ===== Helpers ngày (bổ sung cho '@core/date', vẫn thuần TS) =====

function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

// ===== Nhãn thứ/tháng theo ngôn ngữ (i18n — dict 'stats', mặc định 'vi') =====

/** Nhãn ngắn 1 thứ (getDay(): 0=CN..6=T7) — dịch theo `lang` (dict 'stats'). */
export function weekdayLabel(day0: number, lang: Lang = 'vi'): string {
  return t(lang, 'stats', `weekday.${((day0 % 7) + 7) % 7}`)
}

/** 7 nhãn thứ theo tuần bắt đầu thứ Hai (cho lưới heatmap) — dịch theo `lang`. */
export function weekdayLabelsMon(lang: Lang = 'vi'): string[] {
  return [1, 2, 3, 4, 5, 6, 0].map((d) => weekdayLabel(d, lang))
}

/** Nhãn ngắn 1 tháng (1–12): vi 'T5' · en 'May' — dịch theo `lang` (dict 'stats'). */
export function monthShort(month1: number, lang: Lang = 'vi'): string {
  return t(lang, 'stats', `month.${((month1 % 12) + 12) % 12 || 12}`)
}

function weekdayOf(iso: string): number {
  const { y, m, d } = parseISO(iso)
  return new Date(y, m - 1, d).getDay()
}

/** Thứ Hai của tuần chứa `iso` (tuần bắt đầu thứ Hai). */
export function startOfWeekISO(iso: string): string {
  const offset = (weekdayOf(iso) + 6) % 7 // CN(0)→6, T2(1)→0 ...
  return addDaysISO(iso, -offset)
}

/** Chủ Nhật (ngày cuối tuần) của tuần chứa `iso`. */
export function endOfWeekISO(iso: string): string {
  return addDaysISO(startOfWeekISO(iso), 6)
}

/** Ngày đầu tiên của tháng chứa `iso`, lùi/tiến `offset` tháng (day luôn = 01, không lo tràn ngày). */
export function firstOfMonthISO(iso: string, offset = 0): string {
  const { y, m } = parseISO(iso)
  const total = y * 12 + (m - 1) + offset
  const ny = Math.floor(total / 12)
  const nm = ((total % 12) + 12) % 12
  return `${ny}-${pad2(nm + 1)}-01`
}

/** Ngày cuối cùng của tháng chứa `iso`. */
export function lastDayOfMonthISO(iso: string): string {
  const { y, m } = parseISO(iso)
  const dt = new Date(y, m, 0) // ngày 0 của tháng sau = ngày cuối tháng này
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`
}

/** Ngày trong tháng (1–31). */
export function dayOfMonth(iso: string): number {
  return parseISO(iso).d
}

/** '2026-09-28' → '28/9' — nhãn gọn cho trục ngang (năm bỏ để nhãn gọn). */
export function shortDate(iso: string): string {
  const { m, d } = parseISO(iso)
  return `${d}/${m}`
}

/** Epoch ms đầu ngày LOCAL của 1 ngày ISO (để lọc mistakes theo createdAt). */
export function epochOfDayStartISO(iso: string): number {
  const { y, m, d } = parseISO(iso)
  return new Date(y, m - 1, d).getTime()
}

// ===== Định dạng số (mục 6: số liệu Quicksand, luôn kèm đơn vị ở UI) =====

/** Phút → giờ 1 chữ số thập phân: 60→'1.0', 90→'1.5', 45→'0.8'. */
export function formatHours(minutes: number): string {
  return (Math.max(0, minutes) / 60).toFixed(1)
}

/** Phút → giờ viết gọn cho trục: 60→'1', 90→'1.5', 180→'3'. */
export function formatAxisHours(minutes: number): string {
  const h = Math.round((Math.max(0, minutes) / 60) * 10) / 10
  return String(h)
}

// ===== Gom buckets "giờ học theo ngày/tuần/tháng" =====

export type Granularity = 'day' | 'week' | 'month'

export interface StatBucket {
  /** Nhãn cột: 'CN'..'T7'/'Sun'..'Sat' (ngày) · '28/9' (tuần — thứ Hai) · 'T10'/'Oct' (tháng) — theo `lang`. */
  label: string
  /** Tổng phút trong bucket. */
  minutes: number
  /** Ngày đầu bucket (inclusive). */
  from: string
  /** Ngày cuối bucket (inclusive). */
  to: string
  /** Bucket chứa ngày tham chiếu (hôm nay) — UI tô đậm. */
  isCurrent: boolean
}

export interface AggregateOptions {
  /** Số bucket: mặc định ngày 7 · tuần 8 · tháng 6. */
  count?: number
}

/**
 * Gom phút học theo granularity, kết thúc ở ngày tham chiếu `refISO`.
 * - day: `count` ngày liên tiếp cuối (label theo thứ — dịch theo `lang`).
 * - week: `count` tuần (bắt đầu thứ Hai) cuối.
 * - month: `count` tháng dương lịch cuối (label 'T5'/'May' theo `lang`).
 */
export function aggregateBuckets(
  rows: readonly SessionMinuteRow[],
  gran: Granularity,
  refISO: string,
  options: AggregateOptions = {},
  lang: Lang = 'vi',
): StatBucket[] {
  const byDate = new Map<string, number>()
  for (const r of rows) {
    if (!r.date) continue
    byDate.set(r.date, (byDate.get(r.date) ?? 0) + Math.max(0, r.durationMin))
  }

  const sumRange = (from: string, to: string): number => {
    let total = 0
    let cur = from
    while (cur <= to) {
      total += byDate.get(cur) ?? 0
      cur = addDaysISO(cur, 1)
    }
    return total
  }

  const out: StatBucket[] = []

  if (gran === 'day') {
    const n = options.count ?? 7
    for (let i = n - 1; i >= 0; i--) {
      const date = addDaysISO(refISO, -i)
      out.push({
        label: weekdayLabel(weekdayOf(date), lang),
        minutes: byDate.get(date) ?? 0,
        from: date,
        to: date,
        isCurrent: i === 0,
      })
    }
    return out
  }

  if (gran === 'week') {
    const n = options.count ?? 8
    const refStart = startOfWeekISO(refISO)
    for (let i = n - 1; i >= 0; i--) {
      const start = addDaysISO(refStart, -7 * i)
      const end = addDaysISO(start, 6)
      out.push({
        label: shortDate(start),
        minutes: sumRange(start, end),
        from: start,
        to: end,
        isCurrent: i === 0,
      })
    }
    return out
  }

  const n = options.count ?? 6
  for (let i = n - 1; i >= 0; i--) {
    const first = firstOfMonthISO(refISO, -i)
    const last = lastDayOfMonthISO(first)
    out.push({
      label: monthShort(parseISO(first).m, lang),
      minutes: sumRange(first, last),
      from: first,
      to: last,
      isCurrent: i === 0,
    })
  }
  return out
}

// ===== Phân bổ theo môn =====

export interface SubjectSlice {
  /** Môn học (subjectId); 0 = "chưa phân môn" (luôn xếp cuối). */
  subjectId: number
  minutes: number
}

/**
 * Tổng phút theo môn từ các buổi học — chỉ liệt kê môn CÓ dữ liệu, sắp giảm dần
 * theo phút; subjectId 0 ("chưa phân môn") xếp cuối nếu có. Môn chưa học không
 * xuất hiện (biểu đồ chỉ vẽ những gì có số liệu).
 */
export function allocateBySubject(rows: readonly SessionSubjectRow[]): SubjectSlice[] {
  const sums = new Map<number, number>()
  for (const r of rows) {
    const id = Math.max(0, Math.trunc(r.subjectId))
    sums.set(id, (sums.get(id) ?? 0) + Math.max(0, r.durationMin))
  }

  const withData = [...sums.entries()]
    .map(([subjectId, minutes]) => ({ subjectId, minutes: Math.max(0, minutes) }))
    .filter((s) => s.minutes > 0)

  // Giảm dần theo phút; "chưa phân môn" (0) luôn xếp cuối, hoà thì id nhỏ trước.
  withData.sort(
    (a, b) =>
      (a.subjectId === 0 ? 1 : 0) - (b.subjectId === 0 ? 1 : 0) ||
      b.minutes - a.minutes ||
      a.subjectId - b.subjectId,
  )
  return withData
}

// ===== Heatmap bubble theo tháng =====

export type HeatLevel = 0 | 1 | 2 | 3

export interface HeatmapDay {
  /** Tổng phút học trong ngày. */
  minutes: number
  /** Ngày có dữ liệu khác (ghi chú cuối ngày...) dù 0 phút. */
  hasNote?: boolean
}

export interface HeatCell {
  date: string
  minutes: number
  level: HeatLevel
  /** Có thuộc tháng đang xem không (lưới luôn đủ tuần Thứ Hai → Chủ Nhật). */
  inMonth: boolean
}

/** Mức tô bubble: 0 trống · 1 có học ít · 2 trung bình · 3 đạt mục tiêu. */
export function heatmapLevel(minutes: number, goalMinutes: number, hasAnyData = false): HeatLevel {
  if (minutes > 0) {
    const goal = goalMinutes > 0 ? goalMinutes : 60
    if (minutes >= goal) return 3
    if (minutes >= goal / 2) return 2
    return 1
  }
  return hasAnyData ? 1 : 0
}

/**
 * Lưới heatmap 1 tháng: các tuần đầy (Thứ Hai → Chủ Nhật) phủ trọn tháng,
 * lùi sang tháng trước/tiến sang tháng sau nếu đầu/cuối tháng rơi lệch tuần.
 */
export function buildMonthHeatmap(
  days: ReadonlyMap<string, HeatmapDay>,
  monthRefISO: string,
  goalMinutes = 60,
): HeatCell[] {
  const first = firstOfMonthISO(monthRefISO, 0)
  const last = lastDayOfMonthISO(first)
  const monthKey = first.slice(0, 7)

  const gridStart = startOfWeekISO(first)
  const gridEnd = endOfWeekISO(last)

  const cells: HeatCell[] = []
  let cur = gridStart
  while (cur <= gridEnd) {
    const day = days.get(cur)
    const minutes = day?.minutes ?? 0
    cells.push({
      date: cur,
      minutes,
      level: heatmapLevel(minutes, goalMinutes, day?.hasNote ?? false),
      inMonth: cur.slice(0, 7) === monthKey,
    })
    cur = addDaysISO(cur, 1)
  }
  return cells
}

// ===== Streak =====

/**
 * Chuỗi ngày học liên tiếp tính đến hôm nay; nếu hôm nay chưa học thì lùi về
 * hôm qua (grace — không "gãy" streak ngay trong ngày). `studiedDates`: các ngày
 * có ít nhất 1 buổi > 0 phút.
 */
export function computeStreak(studiedDates: readonly string[], todayISOStr: string): number {
  const set = new Set(studiedDates)
  let cur = set.has(todayISOStr) ? todayISOStr : addDaysISO(todayISOStr, -1)
  if (!set.has(cur)) return 0
  let count = 0
  while (set.has(cur)) {
    count++
    cur = addDaysISO(cur, -1)
  }
  return count
}
