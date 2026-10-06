import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import SubjectChip from '@/components/ui/SubjectChip'
import Icon from '@/components/ui/Icon'
import { PrimaryButton, SecondaryButton } from '@/components/ui/buttons'
import DurationPicker from '@/features/today/DurationPicker'
import { clampInt } from '@/features/today/todayLogic'
import { nextSubjectColor } from '@/features/subjects/subjectView'
import { repos } from '@data'
import { useSubjects } from '@data/useSubjects'
import { useSettings } from '@data/useSettings'
import { cn } from '@/components/ui/cn'

/*
 * Onboarding (A1) — màn lần đầu chạy app, NẰM NGOÀI AppLayout (không TabBar/Sidebar).
 * 2 bước: mục tiêu hằng ngày (thời gian TỰ CHỈNH mục 3) → chọn/tạo môn đang học
 * (đa môn — khung "điểm mục tiêu 700 + ngày thi TOEIC" cũ đã bỏ). Lưu qua
 * useSettings().updateSettings({ ..., onboardingDone: true }) rồi điều hướng về '/'.
 * ≥768px: cột giữa hẹp 480px căn giữa (mục 10).
 */

const GOAL_PRESETS = [
  { minutes: 30, caption: 'duy trì' },
  { minutes: 60, caption: 'ổn định' },
  { minutes: 90, caption: 'hiệu quả' },
  { minutes: 120, caption: 'tiến bộ' },
] as const

const STEP_TITLES = ['mục tiêu ngày', 'môn đang học'] as const

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { settings, updateSettings, loading } = useSettings()
  const { subjects, reload } = useSubjects()

  const [step, setStep] = useState(0)
  const [goalMinutes, setGoalMinutes] = useState(90)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [newSubjectName, setNewSubjectName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const activeSubjects = (subjects ?? []).filter((s) => !s.archived)

  // Lấy giá trị đã lưu (lần chỉnh sau) một lần khi settings tải xong.
  useEffect(() => {
    if (!hydrated && settings) {
      setGoalMinutes(settings.dailyGoalMinutes)
      setHydrated(true)
    }
  }, [settings, hydrated])

  const toggleSubject = (id: number) => {
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  const createSubject = async () => {
    const name = newSubjectName.trim()
    if (!name || creating) return
    setCreating(true)
    setCreateError('')
    try {
      await repos.subjects.create({
        name,
        colorHex: nextSubjectColor(subjects ?? []),
        goalMinutesPerDay: 0,
        archived: false,
      })
      setNewSubjectName('')
      await reload()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Không tạo được môn — thử lại nhé.')
    } finally {
      setCreating(false)
    }
  }

  const finish = async () => {
    setSaving(true)
    setError('')
    try {
      await updateSettings({
        dailyGoalMinutes: clampInt(goalMinutes, 5, 1440, 90),
        onboardingDone: true,
      })
      navigate('/', { replace: true })
    } catch {
      setError('Không lưu được thiết lập — thử lại nhé.')
      setSaving(false)
    }
  }

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

          <div className="flex gap-2.5" aria-label={`Bước ${step + 1}/2: ${STEP_TITLES[step]}`}>
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
              bước {step + 1}/2: {STEP_TITLES[step]}
            </p>
            {step === 0 && (
              <h1 className="type-display mt-2">
                Bạn muốn học <span className="bg-butter px-1">bao nhiêu</span> mỗi ngày?
              </h1>
            )}
            {step === 1 && <h1 className="type-display mt-2">Bạn đang học môn nào?</h1>}
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
            <div className="flex flex-col gap-5">
              <div className="paper-card flex flex-col gap-3 px-4 py-4">
                <div className="flex flex-wrap gap-2">
                  {activeSubjects.map((s) => (
                    <SubjectChip
                      key={s.id}
                      name={s.name}
                      colorHex={s.colorHex}
                      active={selectedIds.includes(s.id!)}
                      onClick={() => toggleSubject(s.id!)}
                    />
                  ))}
                </div>
                <p className="type-caption text-muted">
                  Chọn nhiều môn nếu bạn học song song — có thể thêm/bỏ bất cứ lúc nào
                  trong trang Môn học.
                </p>
                <div className="flex items-center gap-2 border-t border-dashed border-rule pt-3">
                  <input
                    className="w-full rounded-[8px] border border-rule bg-bg px-3 py-2 text-[15px] text-ink outline-none focus:border-teal"
                    placeholder="hoặc tạo môn mới — vd. Vật lí"
                    aria-label="Tên môn mới"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void createSubject()
                      }
                    }}
                  />
                  <SecondaryButton className="shrink-0 px-3 py-2" onClick={() => void createSubject()} disabled={creating}>
                    <Icon name="plus" size={16} /> {creating ? 'Đang tạo…' : 'Tạo môn'}
                  </SecondaryButton>
                </div>
                {createError && (
                  <p className="type-caption text-coral" role="alert">
                    {createError}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="mt-auto flex flex-col gap-3 pb-4">
            {error && (
              <p className="type-caption text-coral" role="alert">
                {error}
              </p>
            )}
            {step < 1 ? (
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
