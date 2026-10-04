import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/components/ui/cn'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

/** Nút chính — nền --teal, chữ trắng (mục 5: --teal là màu hành động DUY NHẤT). */
export function PrimaryButton({ className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={cn('btn btn-primary type-body', className)} {...rest} />
}

/** Nút phụ: outline 1.5px --ink trên nền card. */
export function SecondaryButton({ className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={cn('btn btn-secondary type-body', className)} {...rest} />
}

/** Nút nguy hiểm/hủy: outline --coral (accent cần chú ý). */
export function DangerButton({ className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={cn('btn btn-danger type-body', className)} {...rest} />
}
