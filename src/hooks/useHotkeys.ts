import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { DAILY_NOTE_PATH, MAIN_TABS } from '@/components/layout/nav'

const TAB_KEYS = ['1', '2', '3', '4'] as const

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  )
}

/**
 * Phím tắt dùng chung (design-system.md mục 10):
 *   - `1`–`4` đổi 4 tab chính (thứ tự trong nav.ts MAIN_TABS),
 *   - `N` mở ghi chú hôm nay (/ghichu).
 * Tự bỏ qua khi focus nằm trong input/textarea/contenteditable, và khi bấm kèm
 * Ctrl/Meta/Alt. KHÔNG thêm phím tắt khác ở phiên bản đầu.
 * Gắn 1 lần trong AppLayout — mọi trang con đều hưởng.
 */
export function useHotkeys(): void {
  const navigate = useNavigate()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return

      if (TAB_KEYS.includes(e.key as (typeof TAB_KEYS)[number])) {
        const tab = MAIN_TABS[Number(e.key) - 1]
        if (tab) {
          e.preventDefault()
          navigate(tab.to)
        }
        return
      }

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        navigate(DAILY_NOTE_PATH)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate])
}
