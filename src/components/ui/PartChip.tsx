import { cn } from '@/components/ui/cn'

interface PartChipProps {
  /** Part 1–7 (chỉ dùng numbering khi đúng là thứ tự — mục 2 design-system.md). */
  part: number
  active?: boolean
  onClick?: () => void
  className?: string
}

/** Chip Part 1–7: bubble nhỏ oval — pill CHỈ dành cho chip Part (mục 5). */
export default function PartChip({ part, active = false, onClick, className }: PartChipProps) {
  const cls = cn('part-chip', active && 'part-chip--active', className)

  if (!onClick) {
    return <span className={cls}>Part {part}</span>
  }
  return (
    <button type="button" className={cls} aria-pressed={active} onClick={onClick}>
      Part {part}
    </button>
  )
}
