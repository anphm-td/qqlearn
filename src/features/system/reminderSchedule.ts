/*
 * Nhóm D (hệ thống) — LOGIC THUẦN tính toán thời điểm nhắc lịch (C12).
 *
 * QUY TẮC LỚP: file này KHÔNG import React/Dexie/window — chỉ dùng Date/Number.
 * Phần lên lịch thật (setTimeout, Notification) nằm ở useReminders.ts.
 *
 * Giờ nhắc lưu dạng 'HH:mm' (24h, giờ ĐỊA PHƯƠNG) hoặc '' khi chưa đặt.
 */

export interface TimeHM {
  h: number
  m: number
}

/** Đọc 'HH:mm' (chấp nhận 'H:mm') → {h, m}; trả null khi sai định dạng/giá trị. */
export function parseTimeHM(value: string): TimeHM | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (!Number.isInteger(h) || !Number.isInteger(m) || h > 23 || m > 59) return null
  return { h, m }
}

/** 'HH:mm' → số phút từ nửa đêm (0–1439); null khi sai. */
export function timeToMinutes(value: string): number | null {
  const t = parseTimeHM(value)
  if (!t) return null
  return t.h * 60 + t.m
}

/** Số phút (có thể âm/qua ngày) → 'HH:mm', tự wrap trong 0–1439. */
export function minutesToTime(total: number): string {
  const wrapped = ((Math.round(total) % 1440) + 1440) % 1440
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Nudge giờ bằng stepper (vd. ±15 phút), tự wrap qua nửa đêm. Giờ sai → giữ nguyên. */
export function stepTime(value: string, deltaMinutes: number): string {
  const total = timeToMinutes(value)
  if (total === null) return value
  return minutesToTime(total + deltaMinutes)
}

/** Epoch ms của giờ 'HH:mm' trong NGÀY của `day` (giờ địa phương). */
export function occurrenceAt(day: Date, value: string): number | null {
  const t = parseTimeHM(value)
  if (!t) return null
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), t.h, t.m, 0, 0).getTime()
}

function addOneDay(d: Date): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + 1)
  return next
}

/** Mốc nhắc gần nhất SẮP TỚI: hôm nay nếu còn tương lai, không thì mai. Giờ sai → null. */
export function nextOccurrence(now: Date, value: string): number | null {
  const today = occurrenceAt(now, value)
  if (today === null) return null
  if (today > now.getTime()) return today
  return occurrenceAt(addOneDay(now), value)
}

/**
 * App vừa mở lại — giờ nhắc HÔM NAY đã qua nhưng còn trong khoảng "bù" (graceMinutes)?
 * Dùng để hiện lời nhắc đã lỡ thay vì bỏ qua im lặng.
 */
export function catchUpNeeded(now: Date, value: string, graceMinutes: number): boolean {
  const today = occurrenceAt(now, value)
  if (today === null) return false
  const minutesLate = (now.getTime() - today) / 60000
  return minutesLate >= 0 && minutesLate <= graceMinutes
}
