import { cn } from '@/components/ui/cn'

interface SubjectChipProps {
  /** Tên môn hiển thị (vd. "TOEIC", "Toán"). */
  name: string
  /** Màu môn (colorHex từ SUBJECT_PALETTE) — chấm màu phía trước tên. */
  colorHex?: string
  active?: boolean
  onClick?: () => void
  className?: string
}

/**
 * Chip môn học: bubble nhỏ oval kèm chấm màu môn (mục 5 design-system).
 * Không onClick → nhãn tĩnh; có onClick → nút bật/tắt (lọc, chọn môn).
 */
export default function SubjectChip({ name, colorHex, active = false, onClick, className }: SubjectChipProps) {
  const cls = cn('part-chip', active && 'part-chip--active', className)
  const dot = (
    <span
      aria-hidden="true"
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ background: colorHex ?? 'var(--muted)' }}
    />
  )

  if (!onClick) {
    return (
      <span className={cls}>
        {dot} {name}
      </span>
    )
  }
  return (
    <button type="button" className={cls} aria-pressed={active} onClick={onClick}>
      {dot} {name}
    </button>
  )
}
