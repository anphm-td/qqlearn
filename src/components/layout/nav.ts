import type { IconName } from '@/components/ui/Icon'

/**
 * NGUỒN DỮ LIỆU MENU DÙNG CHUNG cho TabBar (mobile <768px) và Sidebar (desktop ≥768px)
 * — design-system.md mục 10 ("4 mục chính… nhóm phụ… cùng nguồn dữ liệu menu").
 * KHÔNG khai báo menu trùng lặp ở chỗ khác.
 *
 * i18n: labelKey là KEY dịch trong namespace 'common' (src/core/i18n/dict/common.ts)
 * — TabBar/Sidebar render qua t(); KHÔNG lưu chuỗi hiển thị ở đây (một ngôn ngữ
 * duy nhất sẽ phá vi/en).
 */
export interface NavItem {
  to: string
  /** Key dịch trong namespace 'common' (vd. 'nav.today'). */
  labelKey: string
  icon: IconName
  /** true với tab "/" để tránh active sai do prefix match. */
  end?: boolean
}

/** 4 tab chính — phím tắt 1–4 tương ứng thứ tự này. */
export const MAIN_TABS: readonly NavItem[] = [
  { to: '/', labelKey: 'nav.today', icon: 'today', end: true },
  { to: '/hoc', labelKey: 'nav.study', icon: 'study' },
  { to: '/sotay', labelKey: 'nav.notebook', icon: 'notebook' },
  { to: '/thongke', labelKey: 'nav.stats', icon: 'stats' },
]

/** Nhóm phụ đặt dưới đường kẻ ngang --rule (mục 10). */
export const SECONDARY_NAV: readonly NavItem[] = [
  { to: '/mon-hoc', labelKey: 'nav.subjects', icon: 'book' },
  { to: '/tro-chuyen', labelKey: 'nav.chat', icon: 'chat' },
  { to: '/caidat', labelKey: 'nav.settings', icon: 'settings' },
]

/** Đích của phím N — trang "Ghi chú cuối ngày" (ghi chú hôm nay). */
export const DAILY_NOTE_PATH = '/ghichu'
