/*
 * Logic thuần của nhóm "vòng lặp học hằng ngày" — file KHÔNG import React/Dexie/window.
 * Home (TodayPage), OnboardingPage và các trang Học dùng chung; nạp dữ liệu ở tầng UI
 * qua '@data' rồi đưa vào các hàm thuần ở đây để tính toán (dễ test vitest).
 * i18n: các chuỗi hiển thị (lời chào, nhãn thứ) qua lõi thuần '@core/i18n' — hàm nhận
 * `lang` (mặc định 'vi', nguồn chuẩn), UI truyền useT('today').lang để dịch theo ngôn ngữ.
 */
import { addDaysISO } from '@core/date'
import { t, type Lang } from '@core/i18n'

import type { Session } from '@core/types'

// ===== Ngày & lịch (múi giờ LOCAL — 'YYYY-MM-DD' từ '@core/date') =====

/**
 * Thứ (getDay 0=CN…6=T7) → đuôi key dict 'today:weekday.*' — nhãn thứ đi qua
 * từ điển i18n ('vi' nguồn chuẩn, 'en' xem dict/today.ts). Cứ gắn cứng nhãn vi
 * ở đây là lệch ngay khi người học đổi ngôn ngữ.
 */
const WEEKDAY_KEY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Nhãn thứ ngắn cho ngày ISO local ('2026-10-03' → 'T7' ở vi, 'Sat' ở en). */
export function weekdayShort(iso: string, lang: Lang = 'vi'): string {
  return t(lang, 'today', `weekday.${WEEKDAY_KEY[isoToDate(iso).getDay()]}`)
}

/** Dòng ngày gọn cho tiêu đề Home ('2026-10-03' → 'T7 · 3/10'). */
export function formatDayShort(iso: string, lang: Lang = 'vi'): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${weekdayShort(iso, lang)} · ${d}/${m}`
}

/** n ngày liên tiếp kết thúc bằng `todayISOStr` (trước → sau, phần tử cuối = hôm nay). */
export function lastNDays(todayISOStr: string, n = 7): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i -= 1) out.push(addDaysISO(todayISOStr, -i))
  return out
}

/** Lời chào theo giờ local (mục 8 — giọng thân thiện, chủ động); dịch theo `lang`. */
export function greeting(hour: number, lang: Lang = 'vi'): string {
  if (hour >= 5 && hour < 12) return t(lang, 'today', 'greeting.morning')
  if (hour >= 12 && hour < 18) return t(lang, 'today', 'greeting.afternoon')
  return t(lang, 'today', 'greeting.evening')
}

/** Số ngày từ `fromISO` đến `toISO` (âm = ngày thi đã qua). */
export function daysUntil(fromISO: string, toISO: string): number {
  const ms = isoToDate(toISO).getTime() - isoToDate(fromISO).getTime()
  return Math.round(ms / 86_400_000)
}

// ===== Tổng hợp một ngày =====

export interface DaySummary {
  totalMinutes: number
  sessionCount: number
  /** Các môn đã học (subjectId > 0), tăng dần, không trùng. */
  subjectsStudied: number[]
  /** Buổi bắt đầu sớm nhất (epoch ms) — null khi chưa có buổi. */
  firstStartedAt: number | null
}

export function summarizeDay(
  sessions: Array<Pick<Session, 'durationMin' | 'subjectId' | 'startedAt'>>,
): DaySummary {
  let totalMinutes = 0
  let sessionCount = 0
  let firstStartedAt: number | null = null
  const subjects = new Set<number>()
  for (const s of sessions) {
    sessionCount += 1
    totalMinutes += s.durationMin
    if (s.subjectId > 0) subjects.add(s.subjectId)
    if (firstStartedAt === null || s.startedAt < firstStartedAt) firstStartedAt = s.startedAt
  }
  return {
    totalMinutes,
    sessionCount,
    subjectsStudied: [...subjects].sort((a, b) => a - b),
    firstStartedAt,
  }
}

/** % hoàn thành mục tiêu trong ngày — làm tròn, chặn 0–100; mục tiêu ≤ 0 coi như 0. */
export function percentOfDay(totalMinutes: number, goalMinutes: number): number {
  if (goalMinutes <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((totalMinutes / goalMinutes) * 100)))
}

// ===== Streak & tuần 7 BubbleCheck =====

export interface DayActivity {
  date: string
  weekday: string
  minutes: number
  /** Ngày đó có học (ít nhất 1 buổi — tổng phút > 0). */
  done: boolean
  isToday: boolean
}

/** Gộp buổi học thành số phút theo ngày 'YYYY-MM-DD'. */
export function minutesByDate(sessions: Array<Pick<Session, 'date' | 'durationMin'>>): Map<string, number> {
  const map = new Map<string, number>()
  for (const s of sessions) map.set(s.date, (map.get(s.date) ?? 0) + s.durationMin)
  return map
}

/** Ngày tính là "đã học" khi tổng phút > 0. */
export function isDayStudied(minutes: number): boolean {
  return minutes > 0
}

/**
 * Cửa sổ nạp dữ liệu phục vụ tính STREAK — MỌI trang (Home, Báo cáo tuần, Thống kê)
 * dùng CÙNG hằng số này. computeStreak dừng ở ngày đầu tiên thiếu dữ liệu, nên kết
 * quả phụ thuộc khoảng được nạp: nạp lệch cửa sổ là ba trang ra ba con số khác nhau.
 */
export const STREAK_WINDOW_DAYS = 400

/** Điểm đầu cửa sổ streak (inclusive) tính lùi từ hôm nay. */
export function streakWindowFrom(todayISOStr: string): string {
  return addDaysISO(todayISOStr, -(STREAK_WINDOW_DAYS - 1))
}

/**
 * Streak = số ngày đã học liên tiếp, đếm lùi từ hôm nay.
 * Hôm nay chưa học thì streak được "bảo toàn" — đếm tiếp từ hôm qua
 * (còn kịp học hôm nay để nối dài chuỗi).
 */
export function computeStreak(sessions: Array<Pick<Session, 'date' | 'durationMin'>>, todayISOStr: string): number {
  const map = minutesByDate(sessions)
  let cursor = isDayStudied(map.get(todayISOStr) ?? 0) ? todayISOStr : addDaysISO(todayISOStr, -1)
  let streak = 0
  while (isDayStudied(map.get(cursor) ?? 0)) {
    streak += 1
    cursor = addDaysISO(cursor, -1)
  }
  return streak
}

/** 7 bubble của tuần — 7 ngày gần nhất kết thúc bằng hôm nay. */
export function buildWeek(
  todayISOStr: string,
  sessions: Array<Pick<Session, 'date' | 'durationMin'>>,
  lang: Lang = 'vi',
): DayActivity[] {
  const map = minutesByDate(sessions)
  return lastNDays(todayISOStr, 7).map((date) => {
    const minutes = map.get(date) ?? 0
    return {
      date,
      weekday: weekdayShort(date, lang),
      minutes,
      done: isDayStudied(minutes),
      isToday: date === todayISOStr,
    }
  })
}

// ===== Chỉnh số liệu (mục 3 — thời gian tự chỉnh) =====

/**
 * Ép số nguyên vào khoảng [min, max]; chuỗi/không hợp lệ → fallback.
 * Dùng cho ô nhập tự do của stepper thời gian và các giá trị settings.
 */
export function clampInt(value: number | string, min: number, max: number, fallback = min): number {
  const n = typeof value === 'number' ? value : Number.parseInt(value, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

// ===== Giờ hiển thị & nhập tay =====

/** 'HH:mm' local từ epoch ms. */
export function formatHHMM(epochMs: number): string {
  const d = new Date(epochMs)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Epoch ms (local) từ ngày 'YYYY-MM-DD' + giờ 'HH:mm' — cho form nhập buổi học tay. */
export function localEpoch(dateISOStr: string, hhmm: string): number {
  const [h, m] = hhmm.split(':').map((x) => Number.parseInt(x, 10) || 0)
  return isoToDate(dateISOStr).getTime() + (h * 60 + m) * 60_000
}
