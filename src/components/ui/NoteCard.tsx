import type { ReactNode } from 'react'

import { cn } from '@/components/ui/cn'

/**
 * Màu dải washi = màu môn (design-system.md mục 5, dòng "Màu môn") — KHÔNG thêm màu ngoài bảng.
 * 'neutral' = --rule cho note chưa gắn môn.
 */
export type WashiColor =
  | 'neutral'
  | 'toeic'
  | 'toan'
  | 'tieng-nhat'
  | 'lap-trinh'
  | 'mon-them-1'
  | 'mon-them-2'

const WASHI_VAR: Record<WashiColor, string> = {
  neutral: 'var(--rule)',
  toeic: 'var(--subject-toeic)',
  toan: 'var(--subject-toan)',
  'tieng-nhat': 'var(--subject-tieng-nhat)',
  'lap-trinh': 'var(--subject-lap-trinh)',
  'mon-them-1': 'var(--subject-mon-them-1)',
  'mon-them-2': 'var(--subject-mon-them-2)',
}

interface NoteCardProps {
  /** Tên môn hiển thị ở chân note (vd. "TOEIC"); bỏ nếu note tự do. */
  subject?: string
  /** Màu dải washi trên mép card — mặc định neutral. */
  washi?: WashiColor
  title?: string
  /** 2–3 dòng nội dung note. */
  children?: ReactNode
  /** Tag loại note (vd. "từ mới", "tổng kết"). */
  tag?: string
  /** Thời điểm (vd. "07:45", "hôm nay") — chân note, font Data Quicksand nhỏ (mục 4). */
  time?: string
  /** true với note vừa tạo → hiệu ứng scale 0.96→1 (mục 7; tự tắt khi reduced-motion). */
  enter?: boolean
  className?: string
  onClick?: () => void
}

/**
 * NoteCard — ĐƠN VỊ NGUYÊN TỬ của giao diện note-first (mục 4):
 * card đường đôi 3px trên đầu + dải washi màu môn 8px lệch 1.5°, tiêu đề đậm,
 * 2–3 dòng nội dung, hàng chân note (tag + giờ, Quicksand nhỏ).
 */
export default function NoteCard({
  subject,
  washi = 'neutral',
  title,
  children,
  tag,
  time,
  enter = false,
  className,
  onClick,
}: NoteCardProps) {
  const interactive = typeof onClick === 'function'

  return (
    <article
      className={cn('paper-card px-4 pt-4 pb-3', enter && 'anim-note-enter', className)}
      onClick={onClick}
      {...(interactive
        ? { role: 'button' as const, tabIndex: 0 }
        : {})}
    >
      <span className="washi" style={{ background: WASHI_VAR[washi] }} aria-hidden="true" />

      {title && <h3 className="type-h2 mb-1">{title}</h3>}
      {children && <div className="type-body">{children}</div>}

      {(subject || tag || time) && (
        <footer className="num mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] leading-[16px] text-muted">
          {subject && <span>{subject}</span>}
          {tag && <span>{tag}</span>}
          {time && <span>{time}</span>}
        </footer>
      )}
    </article>
  )
}
