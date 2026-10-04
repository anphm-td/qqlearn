import type { ReactNode } from 'react'

/**
 * Icon line 1.5px tự vẽ SVG — màu qua currentColor, KHÔNG emoji (design-system.md mục 2:
 * chỉ icon đời thường — sách, bút, lá, lửa, sao, tách trà, chuông; không icon công nghệ).
 * Dùng: <Icon name="today" /> hoặc đặt className để chỉnh size/màu.
 */
export type IconName =
  | 'today'
  | 'study'
  | 'notebook'
  | 'stats'
  | 'settings'
  | 'chat'
  | 'chevron-right'
  | 'arrow-left'
  | 'plus'
  | 'flame'
  | 'bell'
  | 'star'
  | 'book'
  | 'pen'

const PATHS: Record<IconName, ReactNode> = {
  // "Hôm nay" — bubble đáp án có dấu check
  today: (
    <>
      <ellipse cx="12" cy="12" rx="8.5" ry="6.5" />
      <path d="M8.5 12.2l2.4 2.3 4.6-5" />
    </>
  ),
  // "Học" — đồng hồ bấm giờ
  study: (
    <>
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 13.5V9.8M10 3.5h4M12 3.5v3" />
    </>
  ),
  // "Sổ tay" — quyển sổ + dòng kẻ
  notebook: (
    <>
      <path d="M6 5.5A1.5 1.5 0 0 1 7.5 4H18v16H7.5A1.5 1.5 0 0 1 6 18.5z" />
      <path d="M9.5 8h5M9.5 11.5h5M9.5 15h3" />
    </>
  ),
  // "Thống kê" — cột biểu đồ
  stats: <path d="M5 20v-6.5M12 20V6.5M19 20v-9.5" />,
  // "Cài đặt" — thanh trượt
  settings: (
    <>
      <path d="M4 8h7.5M16.5 8H20M4 16h3.5M12.5 16H20" />
      <circle cx="14" cy="8" r="2.25" />
      <circle cx="10" cy="16" r="2.25" />
    </>
  ),
  // "Trò chuyện" — bong bóng hội thoại
  chat: (
    <path d="M4 7A2.5 2.5 0 0 1 6.5 4.5h11A2.5 2.5 0 0 1 20 7v6a2.5 2.5 0 0 1-2.5 2.5H10.5L6 19v-3.5h.5A2.5 2.5 0 0 1 4 13z" />
  ),
  'chevron-right': <path d="M9.5 5.5l6.5 6.5-6.5 6.5" />,
  'arrow-left': <path d="M19 12H5M11.5 5.5L5 12l6.5 6.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  // streak — ngọn lửa
  flame: (
    <path d="M12 3.5c2.8 2.6 5.5 5.4 5.5 9a5.5 5.5 0 0 1-11 0c0-1.7.6-3.2 1.5-4.6.5 1.1 1.2 2 2.2 2.5C10 8.2 10.9 5.6 12 3.5z" />
  ),
  // nhắc học — chiếc chuông
  bell: (
    <>
      <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2.5h-15L6 16z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  // mục tiêu — ngôi sao
  star: (
    <path d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8L12 4z" />
  ),
  // sách mở
  book: (
    <>
      <path d="M12 6.5C10 5 7.5 4.5 5 4.5v13c2.5 0 5 .5 7 2 2-1.5 4.5-2 7-2v-13c-2.5 0-5 .5-7 2z" />
      <path d="M12 6.5v13" />
    </>
  ),
  // cây bút
  pen: (
    <>
      <path d="M14.5 5.5l4 4L9 19H5v-4l9.5-9.5z" />
      <path d="M12.5 7.5l4 4" />
    </>
  ),
}

interface IconProps {
  name: IconName
  /** Kích thước px, mặc định 24. */
  size?: number
  className?: string
}

export default function Icon({ name, size = 24, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`icon-line ${className ?? ''}`}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
