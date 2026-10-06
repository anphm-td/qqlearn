/*
 * Tiện ích hiển thị nhóm Sổ tay — thuần, KHÔNG import React/Dexie/window.
 * (Date constructor là builtin ECMAScript, không phải window — dùng như @core/date;
 * lõi i18n @core/i18n cũng thuần nên dùng được ở đây.)
 * i18n: chuỗi "hôm nay"/"hôm qua"/thứ trong tuần qua namespace 'notebook' — hàm nhận
 * `lang` (mặc định 'vi' như nhóm smart đã làm) để UI truyền ngôn ngữ hiện tại.
 */
import { addDaysISO, localDateISO } from '@core/date'
import { t, type Lang } from '@core/i18n'

/** '2026-10-03' → 'hôm nay' / 'hôm qua' / 'thứ sáu · 03/10' (dịch theo `lang`). */
export function formatDateVN(iso: string, today: string = localDateISO(), lang: Lang = 'vi'): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  if (iso === today) return t(lang, 'notebook', 'date.today')
  if (iso === addDaysISO(today, -1)) return t(lang, 'notebook', 'date.yesterday')
  const dow = new Date(y, m - 1, d).getDay()
  const dd = String(d).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  return `${t(lang, 'notebook', `date.dow.${dow}`)} · ${dd}/${mm}`
}

/** Dòng preview 1–2 dòng cho note card; gộp khoảng trắng + cắt có dấu '…'. */
export function preview(text: string, max = 90): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trimEnd()}…`
}
