/*
 * Tiện ích ngày — LỚP CORE (thuần TS, không window/Dexie/React).
 */

/**
 * Ngày THEO MÚI GIỜ LOCAL, 'YYYY-MM-DD'.
 * Luôn dùng hàm này cho trường date — KHÔNG dùng new Date().toISOString() (trả về UTC, lệch ngày).
 */
export function localDateISO(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Alias ngắn cho chỗ gọi nhiều. */
export const todayISO = localDateISO

/** Cộng/trừ n ngày trên ngày ISO local (dùng cho dueDate SRS, lùi 7 ngày...). */
export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return localDateISO(dt)
}
