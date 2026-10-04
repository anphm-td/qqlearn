import { useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/components/ui/cn'
import { clampInt } from '@/features/today/todayLogic'

/*
 * Bộ chọn thời lượng TỰ CHỈNH (design-system.md mục 3 — bắt buộc):
 *   - stepper −/+ đổi 5 phút, GIỮ nút để nhảy nhanh;
 *   - ô nhập số trực tiếp (chạm vào số lớn để gõ bất kỳ giá trị nào);
 *   - preset chỉ là gợi ý nhanh, luôn kèm đường tự chỉnh ở trên.
 * Dùng cho: thời lượng buổi học, mục tiêu hằng ngày (mục tiêu điểm cũng tái dùng
 * với unit='điểm').
 */

/** Pill lựa chọn dùng chung (preset thời lượng, hoạt động học…) — KHÔNG dùng part-chip. */
export function OptionPill({
  selected,
  onClick,
  children,
  className,
  ariaLabel,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  className?: string
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        'num inline-flex items-center justify-center rounded-full border px-3.5 py-1.5 text-[13px] leading-[18px] transition-colors',
        selected ? 'border-teal bg-teal text-white' : 'border-rule bg-card text-muted hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  )
}

interface DurationPickerProps {
  /** Giá trị hiện tại (phút). */
  value: number
  onChange: (next: number) => void
  /** Gợi ý nhanh — truyền [] để ẩn (khi đã tự render preset riêng). */
  presets?: number[]
  min?: number
  max?: number
  /** Bước stepper — mặc định ±5 (mục 3). */
  step?: number
  /** Đơn vị — 'phút' (mặc định) hoặc 'điểm'… */
  unit?: string
  /** Nhãn nhỏ phía trên (chữ thường + chấm màu). */
  label?: string
  /** Dáng gọn cho form nhập tay. */
  compact?: boolean
  className?: string
}

export default function DurationPicker({
  value,
  onChange,
  presets = [15, 25, 45, 60],
  min = 5,
  max = 1440,
  step = 5,
  unit = 'phút',
  label,
  compact = false,
  className,
}: DurationPickerProps) {
  // Ref cho giá trị/onChange mới nhất — interval "giữ để nhảy nhanh" cần giá trị tươi.
  const valueRef = useRef(value)
  valueRef.current = value
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Ô nhập tự do: cho phép xóa trắng khi đang gõ, chốt giá trị khi rời ô.
  const [text, setText] = useState(String(value))
  useEffect(() => {
    if (text.trim() !== '' && Number.parseInt(text, 10) !== value) setText(String(value))
    // Chỉ đồng bộ khi giá trị ngoài đổi (preset/stepper) — không phụ thuộc text để không cản người dùng đang gõ.
  }, [value])

  const stepBy = (delta: number) => {
    onChangeRef.current(clampInt(valueRef.current + delta, min, max))
  }

  // Giữ để nhảy nhanh (mục 3): sau 450ms lặp 120ms; lần click sau giữ bị bỏ qua.
  const holdRef = useRef<{ timer: number; interval: number } | null>(null)
  const heldRef = useRef(false)
  const stopHold = () => {
    if (holdRef.current) {
      window.clearTimeout(holdRef.current.timer)
      window.clearInterval(holdRef.current.interval)
      holdRef.current = null
    }
  }
  useEffect(() => stopHold, [])
  const beginHold = (delta: number) => {
    stopHold()
    heldRef.current = false
    const timer = window.setTimeout(() => {
      heldRef.current = true
      stepBy(delta)
      const interval = window.setInterval(() => stepBy(delta), 120)
      holdRef.current = { timer: 0, interval }
    }, 450)
    holdRef.current = { timer, interval: 0 }
  }
  const clickStep = (delta: number) => {
    if (heldRef.current) {
      heldRef.current = false
      return
    }
    stepBy(delta)
  }

  const commitText = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4)
    setText(digits)
    if (digits !== '') onChangeRef.current(clampInt(digits, min, max))
  }

  const numSize = compact ? 'text-[21px] leading-[28px]' : 'text-[32px] leading-[40px]'

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      {label && <p className="section-label">{label}</p>}

      <div className="flex items-center gap-6">
        <button
          type="button"
          className="stepper-btn"
          aria-label={`Bớt ${step} ${unit}`}
          onPointerDown={() => beginHold(-step)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onClick={() => clickStep(-step)}
        >
          −
        </button>

        <div className="flex flex-col items-center">
          <input
            className={cn('num w-20 bg-transparent text-center text-ink outline-none', numSize)}
            inputMode="numeric"
            autoComplete="off"
            aria-label={`Nhập số ${unit}`}
            value={text}
            onChange={(e) => commitText(e.target.value)}
            onBlur={() => setText(String(value))}
          />
          <span className="type-caption text-muted">{unit}</span>
        </div>

        <button
          type="button"
          className="stepper-btn"
          aria-label={`Thêm ${step} ${unit}`}
          onPointerDown={() => beginHold(step)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onClick={() => clickStep(step)}
        >
          +
        </button>
      </div>

      {presets.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="type-caption text-muted">gợi ý nhanh:</span>
          {presets.map((p) => (
            <OptionPill
              key={p}
              selected={value === p}
              onClick={() => onChangeRef.current(clampInt(p, min, max))}
              ariaLabel={`Chọn ${p} ${unit}`}
            >
              {p}
            </OptionPill>
          ))}
        </div>
      )}

      {!compact && <p className="type-caption text-muted">Bạn có thể tự chỉnh con số này bất cứ lúc nào.</p>}
    </div>
  )
}
