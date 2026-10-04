import { useEffect, useId, useRef, useState } from 'react'

import { cn } from '@/components/ui/cn'

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Đếm số chạy lên 600ms ease-out; reduced-motion → hiện số cuối ngay. */
function useCountUp(target: number, durationMs = 600): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0))
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (prefersReducedMotion() || durationMs <= 0) {
      setValue(target)
      return
    }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1)
      const eased = 1 - (1 - t) * (1 - t) // ease-out
      setValue(Math.round(target * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [target, durationMs])

  return value
}

interface ProgressBubbleProps {
  /** 0–100. Phần trăm mục tiêu hằng ngày đã đạt. */
  percent: number
  /** Dòng dưới số, LUÔN kèm đơn vị (mục 6): "62/90 phút", "còn 38 phút". */
  caption?: string
  /** Chiều ngang px (Home desktop dùng bản gọn ~96px — mục 10). */
  width?: number
  className?: string
}

/**
 * SIGNATURE (mục 4/7 design-system.md): bubble oval trống nét đứt, phần đã học
 * tô TEXTURE NÉT CHÌ TEAL quét dần 600ms ease-out khi mở Home, số % ở giữa
 * font Data Quicksand 700.
 */
export default function ProgressBubble({ percent, caption, width = 208, className }: ProgressBubbleProps) {
  const uid = useId()
  const patternId = `hatch-${uid}`
  const maskId = `reveal-${uid}`
  const clipId = `clip-${uid}`
  const shown = useCountUp(percent)

  const clamped = Math.max(0, Math.min(100, percent))
  const VB_W = 200
  const VB_H = 124
  const fillY = VB_H * (1 - clamped / 100)
  const fillH = VB_H - fillY

  return (
    <div className={cn('flex flex-col items-center', className)} style={{ width }}>
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Tiến độ hôm nay: ${percent}% mục tiêu hằng ngày`}
        >
          <defs>
            {/* Nét chì teal tô bên trong bubble (mục 4: "tô texture nét chì teal") */}
            <pattern id={patternId} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="7" stroke="var(--teal)" strokeWidth="2" opacity="0.5" />
            </pattern>
            <clipPath id={clipId}>
              <ellipse cx="100" cy="62" rx="94" ry="56" />
            </clipPath>
            {/* Lớp che: chỉ hiện phần dưới của bubble theo % — sweep 600ms từ dưới lên */}
            <mask id={maskId}>
              <rect
                x="0"
                y={fillY}
                width={VB_W}
                height={fillH}
                fill="#fff"
                className="anim-pencil-sweep"
              />
            </mask>
          </defs>

          {/* Phần chưa đạt: oval trống nét đứt 1.5px --muted */}
          <ellipse cx="100" cy="62" rx="94" ry="56" fill="none" stroke="var(--muted)"
            strokeWidth="1.5" strokeDasharray="6 5" />

          {/* Phần đã tô chì teal, cắt theo hình oval */}
          <g clipPath={`url(#${clipId})`} mask={`url(#${maskId})`}>
            <rect x="0" y="0" width={VB_W} height={VB_H} fill={`url(#${patternId})`} />
          </g>
          {/* Viền phần đã đạt: nét đặc 1.5px --teal */}
          <ellipse cx="100" cy="62" rx="94" ry="56" fill="none" stroke="var(--teal)"
            strokeWidth="1.5" opacity={clamped > 0 ? 1 : 0} />
        </svg>

        {/* Số % — font Data Quicksand 700 (.num), đè giữa bubble */}
        <p
          className="num absolute inset-0 flex items-center justify-center text-[32px] leading-[40px] text-ink"
          aria-hidden="true"
        >
          {shown}
          <span className="text-[21px] leading-[28px]">%</span>
        </p>
      </div>

      {caption && <p className="num mt-1 text-[12px] leading-[16px] text-muted">{caption}</p>}
    </div>
  )
}
