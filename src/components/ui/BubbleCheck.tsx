import HanddrawnCheck from '@/components/ui/HanddrawnCheck'
import { cn } from '@/components/ui/cn'

interface BubbleCheckProps {
  checked: boolean
  onChange?: (next: boolean) => void
  /** Nhãn accessibility (vd. "Thứ Hai"). */
  label: string
  /** Cạnh px — bubble là oval nên truyền width/height riêng nếu muốn dẹt. */
  size?: number
  className?: string
}

/**
 * Checkbox = bubble nhỏ (mục 4/7): rỗng = nét đứt 1.5px --muted,
 * đã chọn = texture nét chì teal + check vẽ tay màu --teal.
 */
export default function BubbleCheck({ checked, onChange, label, size = 28, className }: BubbleCheckProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'bubble relative shrink-0 cursor-pointer transition-colors',
        checked ? 'bubble--filled' : 'bubble--dashed',
        className,
      )}
      style={{ width: size, height: size * 0.82 }}
    >
      {checked && (
        <span className="absolute inset-0 flex items-center justify-center">
          <HanddrawnCheck size={size * 0.62} />
        </span>
      )}
    </button>
  )
}
