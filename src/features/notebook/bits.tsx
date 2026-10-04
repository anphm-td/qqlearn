/*
 * Nguyên liệu UI nhỏ dùng chung trong nhóm Sổ tay (B5–B8) — atoms bám tokens
 * design-system.md mục 5–7: không màu mới, không font mới, không emoji.
 */
import PartChip from '@/components/ui/PartChip'
import { cn } from '@/components/ui/cn'

/** Ô input bám token: viền --rule, focus --teal, chữ --ink. */
export const inputCls =
  'w-full rounded-[8px] border border-rule bg-card px-3 py-2.5 type-body text-ink placeholder:text-muted outline-none transition-colors focus:border-teal'

export const textareaCls = `${inputCls} min-h-[72px] resize-y`

export const labelCls = 'type-caption text-muted'

interface PartPickerProps {
  /** Giá trị hiện tại; 0 = chip "Tất cả"/"không rõ". */
  value: number
  onChange: (part: number) => void
  /** Nhãn của chip 0 — "Tất cả" (bộ lọc) hoặc "không rõ" (form). */
  zeroLabel?: string
}

/** Hàng chip Part 1–7 + chip 0 (B7: lọc part cho ghi chú/từ vựng/lỗi sai). */
export function PartPicker({ value, onChange, zeroLabel = 'Tất cả' }: PartPickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Chọn Part">
      <button
        type="button"
        className={cn('part-chip', value === 0 && 'part-chip--active')}
        aria-pressed={value === 0}
        onClick={() => onChange(0)}
      >
        {zeroLabel}
      </button>
      {[1, 2, 3, 4, 5, 6, 7].map((p) => (
        <PartChip key={p} part={p} active={value === p} onClick={() => onChange(p)} />
      ))}
    </div>
  )
}

interface SearchBoxProps {
  value: string
  onChange: (next: string) => void
  placeholder: string
}

/** Ô tìm kiếm nhanh (B7) cho từ vựng và ghi chú. */
export function SearchBox({ value, onChange, placeholder }: SearchBoxProps) {
  return (
    <input
      type="search"
      className={inputCls}
      value={value}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/** Đọc số từ ô nhập (rỗng/không hợp lệ → 0, chặn âm — khớp schema min 0). */
export function numOrZero(raw: string): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.floor(n))
}
