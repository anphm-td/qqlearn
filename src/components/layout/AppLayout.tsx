import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { useSettings } from '@data/useSettings'
import Sidebar from '@/components/layout/Sidebar'
import TabBar from '@/components/ui/TabBar'
import CheckinPrompt from '@/features/today/CheckinPrompt'
import { useHotkeys } from '@/hooks/useHotkeys'
import {
  NOTE_TIME_EVENT,
  loadNoteReminderTime,
  useReminders,
} from '@/features/system/useReminders'

/**
 * Khung ứng dụng (design-system.md mục 1–10):
 *  - <768px: bố cục 1 cột, gutter 16px, TabBar đáy màn.
 *  - ≥768px: Sidebar trái ~220px + nội dung max ~960px căn giữa (Home 2 cột khi làm thật).
 * Gắn useHotkeys một lần cho toàn bộ trang con.
 *
 * Nhắc lịch (C12) mount MỘT LẦN tại đây: banner fallback hiện trên MỌI trang
 * (trang Cài đặt chỉ quản quyền thông báo qua useNotificationPermission).
 * Check-in "Hỏi giờ học khi mở app" cũng mount MỘT LẦN tại đây — card nổi tự đóng
 * khi điều hướng, không chặn UI.
 */
export default function AppLayout() {
  const { pathname } = useLocation()
  const { settings } = useSettings()
  const [noteTime, setNoteTime] = useState<string>(() => loadNoteReminderTime())
  const { banner, dismissBanner } = useReminders(settings?.reminderTime ?? '', noteTime)

  useHotkeys()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  // Đổi giờ nhắc ghi chú ở Cài đặt → lên lịch lại ngay.
  useEffect(() => {
    const onNoteTime = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail
      if (typeof detail === 'string') setNoteTime(detail)
    }
    window.addEventListener(NOTE_TIME_EVENT, onNoteTime)
    return () => window.removeEventListener(NOTE_TIME_EVENT, onNoteTime)
  }, [])

  return (
    <div className="min-h-dvh bg-bg text-ink md:flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[960px] px-4 pt-6 pb-28 md:pb-10">
          {banner && (
            <div
              className="anim-note-enter mb-4 rounded-[10px] border-[1.5px] border-coral bg-pink-soft px-4 py-3"
              role="alert"
            >
              <p className="type-body font-semibold">{banner.title}</p>
              <p className="type-caption mt-0.5">{banner.body}</p>
              <button type="button" className="type-caption mt-1 underline" onClick={dismissBanner}>
                Đã hiểu
              </button>
            </div>
          )}
          <Outlet />
        </div>
      </div>
      <TabBar />
      <CheckinPrompt />
    </div>
  )
}
