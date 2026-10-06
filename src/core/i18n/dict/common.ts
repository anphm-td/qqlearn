import type { NamespaceDict } from '../index'

/*
 * Nhãn DÙNG CHUNG toàn app (nhóm sở hữu: scaffold/i18n — KHÔNG thêm key cho màn
 * hình feature vào đây; feature folders có namespace riêng: today/notebook/…):
 *  - nav.*: menu điều hướng — nguồn dữ liệu duy nhất ở src/components/layout/nav.ts,
 *    render qua t() ở TabBar (mobile) và Sidebar (desktop).
 *  - banner.*: khung AppLayout (banner nhắc lịch).
 *  - progress.*: bubble tiến độ (ProgressBubble).
 * Quy tắc dịch (design-system.md mục 2/8/12): tự nhiên kiểu sổ tay, không tech-speak,
 * giữ nguyên "qqlearn", số liệu, tên môn user, TOEIC/SRS.
 */
export const dict: NamespaceDict = {
  vi: {
    appTitle: 'qqlearn — sổ học tập',
    'nav.today': 'Hôm nay',
    'nav.study': 'Học',
    'nav.notebook': 'Sổ tay',
    'nav.stats': 'Thống kê',
    'nav.subjects': 'Môn học',
    'nav.chat': 'Trò chuyện',
    'nav.settings': 'Cài đặt',
    'nav.mainAria': 'Điều hướng chính',
    'nav.secondaryAria': 'Nhóm phụ',
    'nav.hotkeysHint': 'Phím tắt: 1–4 đổi tab · N ghi chú hôm nay',
    'banner.dismiss': 'Đã hiểu',
    'progress.aria': 'Tiến độ hôm nay: {percent}% mục tiêu hằng ngày',
  },
  en: {
    appTitle: 'qqlearn — study journal',
    'nav.today': 'Today',
    'nav.study': 'Study',
    'nav.notebook': 'Notebook',
    'nav.stats': 'Stats',
    'nav.subjects': 'Subjects',
    'nav.chat': 'Chat',
    'nav.settings': 'Settings',
    'nav.mainAria': 'Main navigation',
    'nav.secondaryAria': 'More pages',
    'nav.hotkeysHint': "Shortcuts: 1–4 switch tabs · N for today's note",
    'banner.dismiss': 'Got it',
    'progress.aria': "Today's progress: {percent}% of the daily goal",
  },
}
