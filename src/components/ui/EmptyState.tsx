import type { ReactNode } from 'react'

import Icon from '@/components/ui/Icon'

interface EmptyStateProps {
  /** Lời mời hành động — thân thiện, chủ động (mục 8): "Chưa có ghi chú nào hôm nay. Bắt đầu bằng một buổi học 25 phút." */
  message: string
  /** Nút/link hành động (tuỳ chọn). */
  action?: ReactNode
  className?: string
}

/** Empty state = lời mời hành động, viền nét đứt kiểu separator --rule. */
export default function EmptyState({ message, action, className }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-[10px] border border-dashed border-rule bg-card px-4 py-8 text-center ${className ?? ''}`}
    >
      <span className="text-muted">
        <Icon name="today" size={32} />
      </span>
      <p className="type-body max-w-[28ch] text-muted">{message}</p>
      {action}
    </div>
  )
}
