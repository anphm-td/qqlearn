import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import Icon from '@/components/ui/Icon'
import { PrimaryButton, SecondaryButton } from '@/components/ui/buttons'
import DurationPicker, { OptionPill } from '@/features/today/DurationPicker'
import { clampInt, daysUntil, formatDayShort } from '@/features/today/todayLogic'
import { todayISO } from '@data'
import { useSettings } from '@data/useSettings'
import { cn } from '@/components/ui/cn'

/*
 * Onboarding (A1) — màn lần đầu chạy app, NẰM NGOÀI AppLayout (không TabBar/Sidebar).
 * 3 bước theo mẫu design 04: mục tiêu hằng ngày (thời gian TỰ CHỈNH mục 3) →
 * điểm mục tiêu → ngày thi. Lưu qua useSettings().updateSettings({ ..., onboardingDone: true })
 * rồi điều hướng về '/'. ≥768px: cột giữa hẹp 480px căn giữa (mục 10).
 */

const GOAL_PRESETS = [
  { minutes: 30, caption: 'duy trì' },
  { minutes: 60, caption: 'ổn định' },
  { minutes: 90, caption: 'hiệu quả' },
  { minutes: 120, caption: 'tiến bộ' },
] as const

const SCORE_PRESETS = [550, 650, 700, 800] as const

const STEP_TITLES = ['mục tiêu ngày', 'điểm mục tiêu', 'ngày thi'] as const

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { settings, updateSettings, loading } = useSettings()

  const [step, setStep] = useState(0)
  const [goalMinutes, setGoalMinutes] = useState(90)
  const [targetScore, setTargetScore] = useState(700)
  const [examDate, setExamDate] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Lấy giá trị đã lưu (lần chỉnh sau) một lần khi settings tải xong.
  useEffect(() => {
    if (!hydrated && settings) {
      setGoalMinutes(settings.dailyGoalMinutes)
      setTargetScore(settings.targetScore)
      setExamDate(settings.examDate)
      setHydrated(true)
    }
  }, [settings, hydrated])

  const finish = async () => {
    setSaving(true)
    setError('')
    try {
      await updateSettings({
        dailyGoalMinutes: clampInt(goalMinutes, 5, 1440, 90),
        targetScore: clampInt(targetScore, 10, 990, 700),
        examDate,
        onboardingDone: true,
      })
      navigate('/', { replace: true })
    } catch {
      setError('Không lưu được thiết lập — thử lại nhé.')
      setSaving(false)
    }
  }

  const remainDays = examDate ? daysUntil(todayISO(), examDate) : null

  return (
    <div className="flex min-h-dvh flex-col items-center bg-bg px-4 py-8">
      <div className="flex w-full max-w-[480px] flex-1 flex-col">
        <header className="flex items-center justify-between">
          {step > 0 ? (
            <button
              type="button"
              aria-label="Bước trước"
              className="bubble flex h-9 w-9 items-center justify-center text-muted"
              onClick={() => setStep((s) => s - 1)}
            >
              <Icon name="arrow-left" size={18} />
            </button>
          ) : (
            <span className="h-9 w-9" />
          )}

          <div className="flex gap-2.5" aria-label={`Bước ${step + 1}/3: ${STEP_TITLES[step]}`}>
            {STEP_TITLES.map((t, i) => (
              <span
                key={t}
                className={cn(
                  'h-3 w-3 rounded-full border-[1.5px]',
                  i <= step ? 'border-teal bg-teal' : 'border-rule bg-card',
                )}
              />
            ))}
          </div>

          <span className="h-9 w-9" />
        </header>

        <main className="mt-8 flex flex-1 flex-col gap-6">
          <div>
            <p className="section-label">
              bước {step + 1}/3: {STEP_TITLES[step]}
            </p>
            {step === 0 && (
              <h1 className="type-display mt-2">
                Bạn muốn học <span className="bg-butter px-1">bao nhiêu</span> mỗi ngày?
              </h1>
            )}
            {step === 1 && <h1 className="type-display mt-2">Điểm TOEIC bạn nhắm tới?</h1>}
            {step === 2 && <h1 className="type-display mt-2">Khi nào ngày thi?</h1>}
          </div>

          {step === 0 && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-3">
                {GOAL_PRESETS.map((p) => {
                  const active = goalMinutes === p.minutes
                  return (
                    <button
                      key={p.minutes}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setGoalMinutes(p.minutes)}
                      className={cn(
                        'rounded-[12px] border-2 px-4 py-4 text-center transition-colors',
                        active ? 'border-teal bg-teal-soft' : 'border-dashed border-rule bg-card',
                      )}
                    >
                      <span className={cn('num block text-[17px] leading-[24px]', active && 'text-teal')}>
                        {p.minutes} phút
                      </span>
                      <span className={cn('type-caption block', active ? 'text-teal' : 'text-muted')}>{p.caption}</span>
                    </button>
                  )
                })}
              </div>
              <DurationPicker
                value={goalMinutes}
                onChange={setGoalMinutes}
                presets={[]}
                min={5}
                max={1440}
                label="nhập số phút khác"
                className="paper-card px-4 py-6"
              />
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap justify-center gap-2">
                {SCORE_PRESETS.map((p) => (
                  <OptionPill key={p} selected={targetScore === p} onClick={() => setTargetScore(p)} ariaLabel={`Đặt ${p} điểm`}>
                    {p} điểm
                  </OptionPill>
                ))}
              </div>
              <DurationPicker
                value={targetScore}
                onChange={setTargetScore}
                presets={[]}
                min={10}
                max={990}
                step={10}
                unit="điểm"
                label="nhập điểm khác"
                className="paper-card px-4 py-6"
              />
            </div>
          )}

          {step === 2 && (
            <div className="paper-card flex flex-col gap-3 px-4 py-6">
              <label htmlFor="onboarding-exam-date" className="type-body font-medium">
                Ngày thi dự kiến
              </label>
              <input
                id="onboarding-exam-date"
                type="date"
                className="num w-full rounded-[8px] border border-rule bg-card px-3 py-2 text-[15px] text-ink outline-none focus:border-teal"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
              />
              <SecondaryButton onClick={() => setExamDate('')}>Chưa biết ngày thi</SecondaryButton>
              <p className="num type-caption text-muted">
                {remainDays === null
                  ? 'Đặt ngày thi để xem tiến độ mỗi ngày.'
                  : remainDays >= 0
                    ? `Còn ${remainDays} ngày từ ${formatDayShort(todayISO())}.`
                    : 'Ngày thi đã qua — chọn ngày khác nhé.'}
              </p>
            </div>
          )}

          <div className="mt-auto flex flex-col gap-3 pb-4">
            {error && (
              <p className="type-caption text-coral" role="alert">
                {error}
              </p>
            )}
            {step < 2 ? (
              <PrimaryButton className="w-full" onClick={() => setStep((s) => s + 1)}>
                Tiếp tục
              </PrimaryButton>
            ) : (
              <PrimaryButton className="w-full" onClick={() => void finish()} disabled={saving || loading}>
                {saving ? 'Đang lưu…' : 'Bắt đầu thôi'}
              </PrimaryButton>
            )}
            <p className="type-caption text-center text-muted">Mọi mục tiêu đều chỉnh lại được trong Cài đặt.</p>
          </div>
        </main>
      </div>
    </div>
  )
}
