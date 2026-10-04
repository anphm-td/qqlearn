interface HanddrawnCheckProps {
  size?: number
  /** Mặc định --teal (màu hành động — nét tích của app); truyền màu khác khi cần ngữ cảnh riêng. */
  color?: string
  className?: string
}

/**
 * Dấu check vẽ tay màu --teal — stroke-dasharray, nét vẽ 300ms khi hoàn thành
 * (design-system.md mục 4/7: bubble là hình ngữ pháp cho lựa chọn/checkbox).
 */
export default function HanddrawnCheck({ size = 24, color = 'var(--teal)', className }: HanddrawnCheckProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M4.5 13.5C6.5 15.5 7.8 17 9.3 18.8 12 13.6 15.6 8.2 19.8 4.6"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={40}
        strokeDasharray={40}
        strokeDashoffset={0}
        className="anim-check-draw"
      />
    </svg>
  )
}
