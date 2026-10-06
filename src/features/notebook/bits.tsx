/*
 * Nguyên liệu UI nhỏ dùng chung trong nhóm Sổ tay (B5–B8) — atoms bám tokens
 * design-system.md mục 5–7: không màu mới, không font mới, không emoji.
 */
import SubjectChip from '@/components/ui/SubjectChip'
import { cn } from '@/components/ui/cn'
import type { Subject } from '@core/types'
import { useT } from '@data/useT'

/** Ô input bám token: viền --rule, focus --teal, chữ --ink. */
export const inputCls =
  'w-full rounded-[8px] border border-rule bg-card px-3 py-2.5 type-body text-ink placeholder:text-muted outline-none transition-colors focus:border-teal'

export const textareaCls = `${inputCls} min-h-[72px] resize-y`

export const labelCls = 'type-caption text-muted'

interface SubjectPickerProps {
  /** Danh sách môn (đã lọc archived ở phía gọi nếu chỉ cho chọn môn đang học). */
  subjects: Subject[]
  /** Giá trị hiện tại; 0 = chip "Tất cả"/"chưa phân môn". */
  value: number
  onChange: (subjectId: number) => void
  /**
   * Nhãn của chip 0 — truyền chuỗi ĐÃ DỊCH qua t() (t('filter.all') cho bộ lọc,
   * t('form.unassigned') cho form); bỏ trống → mặc định "Tất cả" đã dịch.
   */
  zeroLabel?: string
}

/** Hàng chip môn + chip 0 (lọc/chọn môn cho ghi chú/từ vựng/lỗi sai — đa môn). */
export function SubjectPicker({ subjects, value, onChange, zeroLabel }: SubjectPickerProps) {
  const { t } = useT('notebook')
  const zero = zeroLabel ?? t('filter.all')
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('picker.subjectAria')}>
      <button
        type="button"
        className={cn('part-chip', value === 0 && 'part-chip--active')}
        aria-pressed={value === 0}
        onClick={() => onChange(0)}
      >
        {zero}
      </button>
      {subjects.map((s) => (
        <SubjectChip
          key={s.id}
          name={s.name}
          colorHex={s.colorHex}
          active={value === s.id}
          onClick={() => onChange(s.id!)}
        />
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
