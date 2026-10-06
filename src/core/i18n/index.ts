import { dict as chatDict } from './dict/chat'
import { dict as commonDict } from './dict/common'
import { dict as notebookDict } from './dict/notebook'
import { dict as settingsDict } from './dict/settings'
import { dict as smartDict } from './dict/smart'
import { dict as statsDict } from './dict/stats'
import { dict as studyDict } from './dict/study'
import { dict as subjectsDict } from './dict/subjects'
import { dict as todayDict } from './dict/today'

/*
 * qqlearn — lõi i18n TỰ VIẾT, không thêm dependency (LỚP CORE, thuần TypeScript).
 *
 * ⚠️ Quy tắc lớp: src/core/ KHÔNG import React/Dexie/window — hàm t() thuần,
 *   hook React nằm ở src/data/useT.ts (đọc language từ settings).
 *
 * Cách tổ chức (design-system.md mục 12):
 *  - Mỗi nhóm màn hình MỘT file từ điển riêng ở src/core/i18n/dict/ — các dev làm
 *    song song không đụng file của nhau. Namespace mới = thêm file dict + đăng ký
 *    trong `dicts` bên dưới + thêm tên vào union `Namespace`.
 *  - 'vi' là NGUỒN CHUẨN: key thiếu ở 'en' rớt về 'vi'; thiếu cả hai → trả chính
 *    key (chỉ warn ở dev, KHÔNG BAO GIỜ ném lỗi — UI không được rơi vì i18n).
 *  - Nội suy biến dạng {ten} trong chuỗi; biến thiếu giữ nguyên placeholder.
 *  - Không dịch (mục 12): số liệu/ngày tháng, tên môn user tự đặt, TOEIC/Part/SRS,
 *    "qqlearn".
 */

/** Ngôn ngữ giao diện — 'vi' mặc định, 'en' tùy chọn trong Cài đặt. */
export type Lang = 'vi' | 'en'

/** Nhóm màn hình — trùng tên file trong src/core/i18n/dict/ (mỗi nhóm một file). */
export type Namespace =
  | 'common'
  | 'settings'
  | 'today'
  | 'notebook'
  | 'stats'
  | 'study'
  | 'smart'
  | 'subjects'
  | 'chat'

/** Một từ điển namespace: 2 bản ghi vi/en, mỗi bản là map phẳng key → chuỗi. */
export type NamespaceDict = Record<Lang, Record<string, string>>

/** Biến nội suy cho placeholder {ten} trong chuỗi dịch. */
export type I18nVars = Record<string, string | number>

/** Toàn bộ từ điển — export cho TEST key-parity và debug. Không sửa lúc chạy. */
export const dicts: Record<Namespace, NamespaceDict> = {
  common: commonDict,
  settings: settingsDict,
  today: todayDict,
  notebook: notebookDict,
  stats: statsDict,
  study: studyDict,
  smart: smartDict,
  subjects: subjectsDict,
  chat: chatDict,
}

/**
 * Tra 1 key theo lang — thuần, dùng được độc lập t().
 * en có → trả en; en thiếu → RỚT VỀ vi (nguồn chuẩn); vi cũng thiếu → undefined.
 */
export function lookup(dict: NamespaceDict, lang: Lang, key: string): string | undefined {
  const direct = dict[lang]?.[key]
  if (direct !== undefined) return direct
  if (lang !== 'vi') return dict.vi?.[key]
  return undefined
}

/** Nội suy {ten} → vars.ten; biến thiếu giữ nguyên placeholder (thấy ngay lúc dev). */
export function interpolate(template: string, vars?: I18nVars): string {
  if (!vars) return template
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole,
  )
}

/** Chỉ ở dev (vite) mới warn key thiếu — production im lặng, không log, không ném. */
function isDev(): boolean {
  try {
    return Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV)
  } catch {
    return false // môi trường không có import.meta.env — coi như production
  }
}

/**
 * Dịch 1 key: t('vi', 'common', 'nav.today') → 'Hôm nay'.
 *  - key thiếu ở en → dùng vi; thiếu cả hai → trả CHÍNH KEY (không ném, kể cả dev).
 *  - vars nội suy {ten}; chuỗi trả về luôn là string — an toàn render trực tiếp.
 */
export function t(lang: Lang, ns: Namespace, key: string, vars?: I18nVars): string {
  const template = lookup(dicts[ns] ?? { vi: {}, en: {} }, lang, key)
  if (template === undefined) {
    if (isDev()) console.warn(`[i18n] thiếu key "${ns}:${key}" (lang: ${lang}) — trả lại chính key`)
    return key
  }
  return interpolate(template, vars)
}
