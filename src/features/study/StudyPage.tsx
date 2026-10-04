import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import Icon from '@/components/ui/Icon'
import PartChip from '@/components/ui/PartChip'
import { PrimaryButton, SecondaryButton } from '@/components/ui/buttons'
import DurationPicker, { OptionPill } from '@/features/today/DurationPicker'
import { percentOfDay, summarizeDay } from '@/features/today/todayLogic'
import { repos, todayISO } from '@data'
import { useSettings } from '@data/useSettings'
import type { Session } from '@core/types'

/*
 * /hoc — tab Học (A2): dựng buổi học trước khi bấm giờ.
 * Thời lượng TỰ CHỈNH (mục 3): stepper ±5 + ô nhập số tự do; preset 15/25/45/60
 * chỉ là gợi ý nhanh. Chọn Part 1–7 bằng PartChip → điều hướng /hoc/buoi-hoc
 * kèm cấu hình qua router state.
 */

const ACTIVITIES = ['nghe', 'đọc', 'ngữ pháp', 'từ vựng', 'luyện đề'] as const

export interface SessionSetup {
  focusMin: number
  part: number
  activity: string
}

export default function StudyPage() {
  const navigate = useNavigate()
  const { settings } = useSettings()

  const [focusMin, setFocusMin] = useState(25)
  const [part, setPart] = useState(0)
  const [activity, setActivity] = useState<string>('nghe')
  const [todaySessions, setTodaySessions] = useState<Session[] | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // Mặc định theo cấu hình pomodoro (25/5) — chỉ lần đầu, không ghi đè lựa chọn của người dùng.
  useEffect(() => {
    if (!hydrated && settings) {
      setFocusMin(settings.pomodoro.focusMin)
      setActivity('nghe')
      setHydrated(true)
    }
  }, [settings, hydrated])

  useEffect(() => {
    repos.sessions
      .listByDate(todayISO())
      .then(setTodaySessions)
      .catch(() => setTodaySessions([]))
  }, [])

  const summary = useMemo(() => summarizeDay(todaySessions ?? []), [todaySessions])
  const goal = settings?.dailyGoalMinutes ?? 90
  const percent = percentOfDay(summary.totalMinutes, goal)

  const goSession = (extra: Record<string, unknown> = {}) => {
    navigate('/hoc/buoi-hoc', {
      state: { focusMin, part, activity, ...extra } satisfies SessionSetup & Record<string, unknown>,
    })
  }

  return (
    <div className="mx-auto w-full max-w-[600px]">
      <header>
        <p className="section-label">bắt đầu buổi học</p>
        <h1 className="type-display">Học</h1>
      </header>

      <section className="paper-card mt-4 px-4 py-5" aria-label="Chuẩn bị buổi học">
        <DurationPicker
          value={focusMin}
          onChange={setFocusMin}
          min={5}
          max={480}
          label="thời lượng tự chỉnh"
          className="border-b border-dashed border-rule pb-5"
        />

        <div className="mt-6">
          <p className="section-label label-dot-lavender">chọn part</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <PartChip key={n} part={n} active={part === n} onClick={() => setPart((cur) => (cur === n ? 0 : n))} />
            ))}
          </div>
        </div>

        <div className="mt-6">
          <p className="section-label label-dot-lavender">hoạt động</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ACTIVITIES.map((a) => (
              <OptionPill key={a} selected={activity === a} onClick={() => setActivity(a)} ariaLabel={`Hoạt động ${a}`}>
                {a}
              </OptionPill>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-4">
          <p className="num type-caption inline-flex items-center gap-2 rounded-full border border-rule bg-card px-4 py-1.5 text-muted">
            <span className="inline-block h-2.5 w-4 rounded-full border border-rule bg-teal-soft" aria-hidden="true" />
            mục tiêu hôm nay: {summary.totalMinutes}/{goal} phút ({percent}%)
          </p>

          <PrimaryButton className="w-full" onClick={() => goSession()}>
            <Icon name="study" size={18} /> Vào buổi học
          </PrimaryButton>

          <SecondaryButton className="w-full" onClick={() => goSession({ openManual: true })}>
            <Icon name="pen" size={16} /> Nhập tay buổi học
          </SecondaryButton>

          <p className="type-caption text-center text-muted">
            Buổi học dùng bấm giờ theo thời lượng đã chọn, lưu vào sổ khi kết thúc.
          </p>
        </div>
      </section>
    </div>
  )
}
