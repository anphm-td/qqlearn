import type { IconName } from '@/components/ui/Icon'

/**
 * NGUỒN DỮ LIỆU MENU DÙNG CHUNG cho TabBar (mobile <768px) và Sidebar (desktop ≥768px)
 * — design-system.md mục 10 ("4 mục chính… nhóm phụ… cùng nguồn dữ liệu menu").
 * KHÔNG khai báo menu trùng lặp ở chỗ khác.
 */
export interface NavItem {
  to: string
  label: string
  icon: IconName
  /** true với tab "/" để tránh active sai do prefix match. */
  end?: boolean
}

/** 4 tab chính — phím tắt 1–4 tương ứng thứ tự này. */
export const MAIN_TABS: readonly NavItem[] = [
  { to: '/', label: 'Hôm nay', icon: 'today', end: true },
  { to: '/hoc', label: 'Học', icon: 'study' },
  { to: '/sotay', label: 'Sổ tay', icon: 'notebook' },
  { to: '/thongke', label: 'Thống kê', icon: 'stats' },
]

/** Nhóm phụ đặt dưới đường kẻ ngang --rule (mục 10). */
export const SECONDARY_NAV: readonly NavItem[] = [
  { to: '/tro-chuyen', label: 'Trò chuyện', icon: 'chat' },
  { to: '/caidat', label: 'Cài đặt', icon: 'settings' },
]

/** Đích của phím N — trang "Ghi chú cuối ngày" (ghi chú hôm nay). */
export const DAILY_NOTE_PATH = '/ghichu'
