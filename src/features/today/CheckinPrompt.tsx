import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { PrimaryButton } from '@/components/ui/buttons'
import DurationPicker from '@/features/today/DurationPicker'
import { CHECKIN_PROMPT_KEY, parseLastPromptAt, shouldPromptCheckin } from '@/features/today/checkinLogic'
import { repos, todayISO } from '@data'
import { useSettings } from '@data/useSettings'

/**
 * "Hỏi giờ học khi mở app" (check-in) — gắn MỘT LẦN ở AppLayout, hiện nổi trên
 * mọi trang ngay khi mở Sổ (không chặn UI, không chặn điều hướng):
 *  - Điều kiện hiện: bật trong Cài đặt (checkinEnabled) + đã xong onboarding +
 *    đã quá 15 phút kể từ lần hỏi gần nhất (localStorage — checkinLogic.ts).
 *  - Trả lời "Bạn vừa học được bao nhiêu phút?" → lưu thành một buổi học thủ công
 *    (source 'manual', part 0, hoạt động 'Check-in') — tự cộng vào tiến độ hôm nay
 *    và thống kê như mọi buổi học khác.
 *  - Lẫn Bỏ qua LẪN Lưu đều ghi dấu thời điểm hỏi — không hỏi lại trong 15 phút.
 *  - Đổi trang (bấm tab khác) là card tự đóng; nav đi tiếp bình thường.
 * Giao diện: card giấy đường đôi (paper-card), số liệu Quicksand (DurationPicker),
 * nút chính --teal; hiệu ứng vào (anim-note-enter) tự tắt khi prefers-reduced-motion.
 */
export default function CheckinPrompt() {
  const { settings } = useSettings()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [minutes, setMinutes] = useState(25)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Quyết định "có hỏi ngay khi mở app" CHẠY MỘT LẦN mỗi lần mở Sổ — settings
  // đọc xong (khác null) mới đủ điều kiện xét; sau đó không mở lại dù settings đổi.
  const decidedRef = useRef(false)
  // Đóng khi điều hướng trang: nhớ pathname lúc gắn, đổi là đóng.
  const pathnameRef = useRef(pathname)

  useEffect(() => {
    if (pathnameRef.current !== pathname) {
      pathnameRef.current = pathname
      setOpen(false)
      setError(null)
    }
  }, [pathname])

  useEffect(() => {
    if (decidedRef.current || settings === null) return
    decidedRef.current = true
    let lastPromptAt: number | null = null
    try {
      lastPromptAt = parseLastPromptAt(window.localStorage.getItem(CHECKIN_PROMPT_KEY))
    } catch {
      // localStorage không dùng được (che cookie…) — coi như chưa từng hỏi.
    }
    if (
      shouldPromptCheckin({
        enabled: settings.checkinEnabled,
        onboardingDone: settings.onboardingDone,
        lastPromptAt,
        now: Date.now(),
      })
    ) {
      setOpen(true)
    }
  }, [settings])

  /** Ghi dấu thời điểm hỏi — cả Lưu lẫn Bỏ qua đều gọi. */
  const markPrompted = () => {
    try {
      window.localStorage.setItem(CHECKIN_PROMPT_KEY, String(Date.now()))
    } catch {
      // Không ghi được thì lần mở sau vẫn hỏi — chấp nhận được.
    }
  }

  const close = () => {
    setOpen(false)
    setError(null)
  }

  const handleSkip = () => {
    markPrompted()
    close()
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      // Buổi học thủ công: bắt đầu lùi lại `minutes` từ bây giờ, kết thúc bây giờ —
      // cộng thẳng vào tiến độ hôm nay + thống kê (date luôn theo múi giờ local).
      const endedAt = Date.now()
      await repos.sessions.create({
        date: todayISO(),
        startedAt: endedAt - minutes * 60_000,
        endedAt,
        durationMin: minutes,
        part: 0,
        source: 'manual',
        activity: 'Check-in',
        note: '',
      })
      markPrompted()
      close()
    } catch {
      setError('Chưa lưu được vào sổ — thử lại nhé.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-x-4 bottom-[68px] z-30 mx-auto max-w-[430px] md:inset-x-auto md:bottom-6 md:right-6"
      role="dialog"
      aria-label="Hỏi giờ học khi mở app"
    >
      <section className="paper-card anim-note-enter px-4 pt-3 pb-4">
        <p className="section-label">hỏi giờ học</p>
        <p className="type-body mt-2 font-semibold">Bạn vừa học được bao nhiêu phút?</p>
        <div className="mt-3">
          <DurationPicker
            value={minutes}
            onChange={setMinutes}
            presets={[15, 25, 45]}
            min={5}
            max={1440}
            step={5}
            unit="phút"
            compact
          />
        </div>
        {error && (
          <p role="alert" className="type-caption mt-3 rounded-lg border border-coral bg-pink-soft px-3 py-2">
            {error}
          </p>
        )}
        <div className="mt-3 flex items-center gap-3">
          <PrimaryButton className="flex-1" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Đang lưu…' : 'Lưu vào sổ'}
          </PrimaryButton>
          <button
            type="button"
            className="type-caption text-muted shrink-0 underline"
            onClick={handleSkip}
            disabled={saving}
          >
            Bỏ qua
          </button>
        </div>
      </section>
    </div>
  )
}
