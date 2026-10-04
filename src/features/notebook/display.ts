/*
 * Tiện ích hiển thị nhóm Sổ tay — thuần, KHÔNG import React/Dexie/window.
 * (Date constructor là builtin ECMAScript, không phải window — dùng như @core/date.)
 */
import { addDaysISO, localDateISO } from '@core/date'

const WEEKDAYS = ['chủ nhật', 'thứ hai', 'thứ ba', 'thứ tư', 'thứ năm', 'thứ sáu', 'thứ bảy']

/** '2026-10-03' → 'hôm nay' / 'hôm qua' / 'thứ sáu · 03/10'. */
export function formatDateVN(iso: string, today: string = localDateISO()): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  if (iso === today) return 'hôm nay'
  if (iso === addDaysISO(today, -1)) return 'hôm qua'
  const dow = new Date(y, m - 1, d).getDay()
  const dd = String(d).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  return `${WEEKDAYS[dow] ?? iso} · ${dd}/${mm}`
}

/** Dòng preview 1–2 dòng cho note card; gộp khoảng trắng + cắt có dấu '…'. */
export function preview(text: string, max = 90): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trimEnd()}…`
}
