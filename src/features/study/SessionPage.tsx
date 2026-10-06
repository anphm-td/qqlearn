import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import HanddrawnCheck from '@/components/ui/HanddrawnCheck'
import Icon from '@/components/ui/Icon'
import SubjectChip from '@/components/ui/SubjectChip'
import ProgressBubble from '@/components/ui/ProgressBubble'
import { DangerButton, PrimaryButton, SecondaryButton } from '@/components/ui/buttons'
import { cn } from '@/components/ui/cn'
import DurationPicker, { OptionPill } from '@/features/today/DurationPicker'
import type { SessionSetup } from '@/features/study/StudyPage'
import { activityLabelKey } from '@/features/study/StudyPage'
import {
  advanceTimer,
  elapsedMs,
  emptyTimer,
  formatClock,
  pauseTimer,
  remainingMs,
  startTimer,
  type TimerState,
} from '@/features/today/timerLogic'
import { clampInt, formatHHMM, localEpoch, percentOfDay, summarizeDay } from '@/features/today/todayLogic'
import { clearSessionState, loadSessionState, saveSessionState } from '@/features/study/sessionRecovery'
import { repos, todayISO } from '@data'
import { onDataChanged } from '@data/dataEvents'
import { useT } from '@data/useT'
import { useSettings } from '@data/useSettings'
import { useSubjects } from '@data/useSubjects'
import { sessionInputSchema } from '@core/schemas'
import type { NewSession, Session } from '@core/types'

/*
 * /hoc/buoi-hoc (A2) — bấm giờ pomodoro:
 *   - mặc định 25/5 theo settings.pomodoro, NHƯNG thời lượng TỰ CHỈNH (mục 3):
 *     stepper ±5 + ô nhập số tự do; preset chỉ là gợi ý;
 *   - đếm bằng TIMESTAMP: interval 500ms chỉ vẽ lại màn hình, số phút tính từ
 *     epoch (elapsed = now − startedAt + accumulated) nên không drift;
 *   - chọn MÔN (đa môn) bằng SubjectChip; kết thúc buổi lưu session (date = todayISO() local);
 *   - bên dưới có form nhập tay buổi học (source: 'manual').
 * i18n: mọi chuỗi hiển thị qua useT('study') — dict ở src/core/i18n/dict/study.ts;
 * activity lưu DB giữ nguyên giá trị, hiển thị qua key dict (activityLabelKey).
 */

const ACTIVITIES = ['nghe', 'đọc', 'ngữ pháp', 'từ vựng', 'luyện đề'] as const

type Phase = 'setup' | 'running' | 'paused' | 'done'

const inputCls =
  'w-full rounded-[8px] border border-rule bg-card px-3 py-2 type-body text-ink outline-none transition-colors focus:border-teal placeholder:text-muted'

export default function SessionPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useT('study')
  const { settings } = useSettings()
  const { subjects } = useSubjects()
  const activeSubjects = (subjects ?? []).filter((s) => !s.archived)
  const setup = (location.state ?? null) as Partial<SessionSetup & { openManual?: boolean }> | null

  // Nhãn hiển thị của 1 activity — không có key (dữ liệu lạ) thì giữ nguyên giá trị.
  const activityDisplay = (a: string): string => {
    const key = activityLabelKey(a)
    return key ? t(key) : a
  }

  // ===== Bấm giờ (timestamp) =====
  const [phase, setPhase] = useState<Phase>('setup')
  const [timer, setTimer] = useState<TimerState>(emptyTimer)
  const [pickedTarget, setPickedTarget] = useState<number | null>(null) // null = chưa chỉnh → dùng mặc định
  const [subjectId, setSubjectId] = useState(() => clampInt(setup?.subjectId ?? 0, 0, Number.MAX_SAFE_INTEGER, 0))
  const [activity, setActivity] = useState(() => setup?.activity ?? 'nghe')
  const [breakEndsAt, setBreakEndsAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const sessionStartRef = useRef<number | null>(null)

  const defaultFocusMin = clampInt(setup?.focusMin ?? settings?.pomodoro.focusMin ?? 25, 5, 480, 25)
  const targetMin = pickedTarget ?? defaultFocusMin
  const breakMin = settings?.pomodoro.breakMin ?? 5
  const targetMs = targetMin * 60_000

  // ===== Chống mất buổi đang học (A2 "tự lưu") =====
  // Khôi phục phiên dở của HÔM NAY khi quay lại trang (đi qua tab khác/phím tắt
  // rồi trở lại — hoặc F5 với sessionStorage sống theo tab). Chạy TRƯỚC effect lưu.
  useEffect(() => {
    const saved = loadSessionState(todayISO())
    if (!saved) return
    setPhase(saved.phase)
    setTimer(saved.timer)
    setPickedTarget(saved.targetMin)
    setSubjectId(saved.subjectId)
    setActivity(saved.activity)
    setBreakEndsAt(saved.breakEndsAt)
    sessionStartRef.current = saved.sessionStartAt
    setNow(Date.now())
  }, [])

  // Lưu phiên mỗi khi state phiên đổi; về 'setup' là xoá (không còn phiên nào).
  useEffect(() => {
    if (phase === 'setup') {
      clearSessionState()
      return
    }
    saveSessionState({
      date: todayISO(),
      phase,
      timer,
      targetMin,
      subjectId,
      activity,
      breakEndsAt,
      sessionStartAt: sessionStartRef.current ?? Date.now(),
    })
  }, [phase, timer, targetMin, subjectId, activity, breakEndsAt])

  // Rời hẳn trang (F5/đóng tab) khi phiên chưa lưu → hỏi trước, không mất buổi.
  useEffect(() => {
    if (phase === 'setup') return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Chrome yêu cầu returnValue để hiện hộp thoại xác nhận.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [phase])

  const focusElapsed = Math.min(elapsedMs(now, timer), targetMs)
  const remaining = remainingMs(now, timer, targetMs)
  const durationMin = Math.round(focusElapsed / 60_000)

  // Interval CHỈ vẽ lại màn hình — số thời gian luôn từ timestamp nên không drift.
  const tick = useCallback(() => setNow(Date.now()), [])
  useEffect(() => {
    if (phase === 'setup' && breakEndsAt === null) return
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [phase, breakEndsAt, tick])

  // Đủ target khi đang chạy → tự dừng ĐÚNG target và chuyển pha (advanceTimer chốt số).
  useEffect(() => {
    if (phase !== 'running') return
    const res = advanceTimer(now, timer, targetMs)
    if (res.finished) {
      setTimer(res.state)
      setPhase('done')
    }
  }, [now, phase, timer, targetMs])

  const breakRemaining = breakEndsAt !== null ? Math.max(0, breakEndsAt - now) : null
  const breakDone = breakEndsAt !== null && breakRemaining === 0

  const handleStart = () => {
    const t = Date.now()
    sessionStartRef.current = t
    setTimer(startTimer(t, emptyTimer()))
    setPhase('running')
    setBreakEndsAt(null)
    setNow(t)
  }
  const handlePause = () => {
    setTimer(pauseTimer(Date.now(), timer, targetMs))
    setPhase('paused')
  }
  const handleResume = () => {
    setTimer(startTimer(Date.now(), timer))
    setPhase('running')
  }
  const handleExtend = () => {
    setPickedTarget(targetMin + 5)
    setTimer(startTimer(Date.now(), timer))
    setPhase('running')
    setBreakEndsAt(null)
  }
  const handleBreak = () => setBreakEndsAt(Date.now() + breakMin * 60_000)
  const handleNextCycle = () => {
    setPickedTarget(targetMin + defaultFocusMin)
    setTimer(startTimer(Date.now(), timer))
    setPhase('running')
    setBreakEndsAt(null)
  }
  // Huỷ buổi: xác nhận 2 bước (như xoá lỗi sai) — bấm nhầm không mất buổi.
  const handleCancel = () => {
    if (!confirmCancel) {
      setConfirmCancel(true)
      return
    }
    setConfirmCancel(false)
    setTimer(emptyTimer())
    setPhase('setup')
    setBreakEndsAt(null)
    sessionStartRef.current = null
    setNow(Date.now())
    setError('')
  }

  const handleSave = async () => {
    const start = sessionStartRef.current
    if (start === null) return
    if (durationMin < 1) {
      setError(t('error.tooShort'))
      return
    }
    const input: NewSession = {
      date: todayISO(), // ngày local 'YYYY-MM-DD' — cấm toISOString
      startedAt: start,
      endedAt: Date.now(),
      durationMin,
      subjectId,
      activity,
      source: 'timer',
      note: '',
    }
    const parsed = sessionInputSchema.safeParse(input)
    if (!parsed.success) {
      setError(t('error.invalid'))
      return
    }
    setSaving(true)
    setError('')
    try {
      await repos.sessions.create(parsed.data)
      clearSessionState() // buổi đã lưu — không khôi phục lại phiên cũ khi quay lại
      navigate('/', { replace: true }) // đóng vòng lặp: về Home thấy tiến độ cập nhật
    } catch {
      setSaving(false)
      setError(t('error.save'))
    }
  }

  // ===== Form nhập tay =====
  const [mDate, setMDate] = useState(() => todayISO())
  const [mTime, setMTime] = useState(() => formatHHMM(Date.now()))
  const [mDuration, setMDuration] = useState(25)
  const [mSubjectId, setMSubjectId] = useState(0)
  const [mActivity, setMActivity] = useState('nghe')
  const [mNote, setMNote] = useState('')
  const [mSaving, setMSaving] = useState(false)
  const [mSaved, setMSaved] = useState(false)
  const [mError, setMError] = useState('')

  const saveManual = async () => {
    const startedAt = localEpoch(mDate, mTime || '00:00')
    const input: NewSession = {
      date: mDate,
      startedAt,
      endedAt: startedAt + mDuration * 60_000,
      durationMin: mDuration,
      subjectId: mSubjectId,
      activity: mActivity,
      source: 'manual',
      note: mNote.trim(),
    }
    const parsed = sessionInputSchema.safeParse(input)
    if (!parsed.success) {
      setMSaved(false)
      setMError(t('manual.invalid'))
      return
    }
    setMSaving(true)
    setMError('')
    try {
      await repos.sessions.create(parsed.data)
      setMSaved(true)
    } catch {
      setMSaved(false)
      setMError(t('manual.saveError'))
    } finally {
      setMSaving(false)
    }
  }

  // ===== Dữ liệu "hôm nay" cho dòng mục tiêu =====
  const [todaySessions, setTodaySessions] = useState<Session[] | null>(null)
  const loadTodaySessions = useCallback(() => {
    repos.sessions
      .listByDate(todayISO())
      .then(setTodaySessions)
      .catch(() => setTodaySessions([]))
  }, [])
  useEffect(() => {
    loadTodaySessions()
  }, [loadTodaySessions])

  // Card Check-in nổi trên cả trang này: khi nó lưu buổi học (phát tín hiệu
  // data-changed) thì dòng "hôm nay: X/Y phút" nạp lại ngay, không phải đổi trang.
  useEffect(
    () =>
      onDataChanged((detail) => {
        if (detail.table === 'sessions') loadTodaySessions()
      }),
    [loadTodaySessions],
  )
  const todaySummary = summarizeDay(todaySessions ?? [])
  const goal = settings?.dailyGoalMinutes ?? 90

  const phaseLabel =
    phase === 'running' ? t('phase.running') : phase === 'paused' ? t('phase.paused') : t('phase.done')

  return (
    <div className="mx-auto w-full max-w-[600px]">
      <header className="flex items-center gap-3">
        <Link to="/hoc" aria-label={t('header.backAria')} className="bubble flex h-9 w-9 items-center justify-center text-muted">
          <Icon name="arrow-left" size={18} />
        </Link>
        <div>
          <p className="section-label">{t('header.label')}</p>
          <h1 className="type-h2">{t('header.title')}</h1>
        </div>
      </header>

      {phase === 'setup' ? (
        <section className="paper-card mt-4 px-4 py-5" aria-label={t('setup.aria')}>
          <DurationPicker
            value={targetMin}
            onChange={setPickedTarget}
            min={5}
            max={480}
            label={t('duration.label')}
            className="border-b border-dashed border-rule pb-5"
          />

          <div className="mt-6">
            <p className="section-label label-dot-lavender">{t('subject.label')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {activeSubjects.map((s) => (
                <SubjectChip
                  key={s.id}
                  name={s.name}
                  colorHex={s.colorHex}
                  active={subjectId === s.id}
                  onClick={() => setSubjectId((cur) => (cur === s.id ? 0 : s.id!))}
                />
              ))}
              <Link to="/mon-hoc" className="part-chip">
                {t('subject.addNew')}
              </Link>
            </div>
          </div>

          <div className="mt-6">
            <p className="section-label label-dot-lavender">{t('activity.label')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ACTIVITIES.map((a) => (
                <OptionPill
                  key={a}
                  selected={activity === a}
                  onClick={() => setActivity(a)}
                  ariaLabel={t('activity.aria', { name: activityDisplay(a) })}
                >
                  {activityDisplay(a)}
                </OptionPill>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center gap-4">
            <p className="num type-caption inline-flex items-center gap-2 rounded-full border border-rule bg-card px-4 py-1.5 text-muted">
              {t('goal.todayShort', {
                done: todaySummary.totalMinutes,
                total: goal,
                pct: percentOfDay(todaySummary.totalMinutes, goal),
              })}
            </p>
            <PrimaryButton className="w-full" onClick={handleStart}>
              <Icon name="study" size={18} /> {t('action.startNow')}
            </PrimaryButton>
            <p className="type-caption text-center text-muted">{t('hint.breakNote', { break: breakMin })}</p>
          </div>
        </section>
      ) : (
        <section className="paper-card mt-4 flex flex-col items-center gap-4 px-4 py-6" aria-label={t('running.aria')}>
          <p className="section-label">{phaseLabel}</p>

          <ProgressBubble
            percent={percentOfDay(focusElapsed / 60_000, targetMin)}
            caption={
              phase === 'done'
                ? t('progress.done', { minutes: durationMin })
                : t('progress.remaining', { time: formatClock(remaining) })
            }
          />
          <p className="num text-[40px] leading-[48px] text-ink" aria-label={t('clock.aria')}>
            {phase === 'done' ? formatClock(0) : formatClock(remaining)}
          </p>

          <div className="w-full">
            <p className="type-caption mb-1 text-muted">
              {t('live.activityLine', {
                activity: activityDisplay(activity),
                subject: (() => {
                  const s = activeSubjects.find((x) => x.id === subjectId)
                  return s ? t('live.subjectNamed', { name: s.name }) : t('live.noSubject')
                })(),
              })}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {activeSubjects.map((s) => (
                <SubjectChip
                  key={s.id}
                  name={s.name}
                  colorHex={s.colorHex}
                  active={subjectId === s.id}
                  onClick={() => setSubjectId((cur) => (cur === s.id ? 0 : s.id!))}
                />
              ))}
            </div>
          </div>

          {breakEndsAt !== null && (
            <div
              className={cn('w-full rounded-[10px] border px-4 py-3', breakDone ? 'border-rule bg-card' : 'border-teal bg-teal-soft')}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="num type-body">
                  {breakDone
                    ? t('break.done')
                    : t('break.remaining', { break: breakMin, time: formatClock(breakRemaining ?? 0) })}
                </p>
                {breakDone ? (
                  <PrimaryButton className="px-3 py-1.5 text-[13px]" onClick={handleNextCycle}>
                    {t('break.next')}
                  </PrimaryButton>
                ) : (
                  <SecondaryButton className="px-3 py-1.5 text-[13px]" onClick={() => setBreakEndsAt(null)}>
                    {t('break.skip')}
                  </SecondaryButton>
                )}
              </div>
            </div>
          )}

          <div className="flex w-full flex-wrap justify-center gap-2">
            {phase === 'running' && (
              <SecondaryButton onClick={handlePause}>
                <Icon name="bell" size={16} /> {t('action.pause')}
              </SecondaryButton>
            )}
            {phase === 'paused' && (
              <PrimaryButton onClick={handleResume}>
                <Icon name="study" size={16} /> {t('action.resume')}
              </PrimaryButton>
            )}
            {phase === 'done' && breakEndsAt === null && (
              <>
                <SecondaryButton onClick={handleExtend}>{t('action.extend')}</SecondaryButton>
                <SecondaryButton onClick={handleBreak}>{t('action.takeBreak', { break: breakMin })}</SecondaryButton>
              </>
            )}
          </div>

          <div className="flex w-full flex-wrap justify-center gap-2 border-t border-dashed border-rule pt-4">
            <PrimaryButton onClick={() => void handleSave()} disabled={saving || durationMin < 1}>
              <Icon name="book" size={16} /> {saving ? t('save.saving') : t('save.button')}
            </PrimaryButton>
            <DangerButton onClick={handleCancel}>{confirmCancel ? t('cancel.confirm') : t('cancel.button')}</DangerButton>
          </div>
          {durationMin < 1 && <p className="type-caption text-muted">{t('error.tooShortInline')}</p>}
          {error && (
            <p className="type-caption text-coral" role="alert">
              {error}
            </p>
          )}
        </section>
      )}

      {/* ===== Form nhập tay buổi học ===== */}
      <section className="paper-card mt-4 px-4 pt-4 pb-5" aria-label={t('manual.aria')}>
        <p className="section-label">{t('manual.label')}</p>
        <p className="type-caption mt-1 text-muted">{t('manual.hint')}</p>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="manual-date" className="type-caption mb-1 block text-muted">
              {t('manual.dateLabel')}
            </label>
            <input
              id="manual-date"
              type="date"
              className={cn(inputCls, 'num')}
              value={mDate}
              onChange={(e) => {
                setMDate(e.target.value)
                setMSaved(false)
              }}
            />
          </div>
          <div>
            <label htmlFor="manual-time" className="type-caption mb-1 block text-muted">
              {t('manual.timeLabel')}
            </label>
            <input
              id="manual-time"
              type="time"
              className={cn(inputCls, 'num')}
              value={mTime}
              onChange={(e) => {
                setMTime(e.target.value)
                setMSaved(false)
              }}
            />
          </div>
        </div>

        <div className="mt-4">
          <DurationPicker
            value={mDuration}
            onChange={(v) => {
              setMDuration(v)
              setMSaved(false)
            }}
            min={5}
            max={600}
            compact
            label={t('duration.label')}
          />
        </div>

        <div className="mt-4">
          <p className="type-caption mb-1 text-muted">{t('subject.labelShort')}</p>
          <div className="flex flex-wrap gap-1.5">
            {activeSubjects.map((s) => (
              <SubjectChip
                key={s.id}
                name={s.name}
                colorHex={s.colorHex}
                active={mSubjectId === s.id}
                onClick={() => {
                  setMSubjectId((cur) => (cur === s.id ? 0 : s.id!))
                  setMSaved(false)
                }}
              />
            ))}
            <Link to="/mon-hoc" className="part-chip">
              {t('subject.addNew')}
            </Link>
          </div>
        </div>

        <div className="mt-4">
          <p className="type-caption mb-1 text-muted">{t('activity.label')}</p>
          <div className="flex flex-wrap gap-2">
            {ACTIVITIES.map((a) => (
              <OptionPill
                key={a}
                selected={mActivity === a}
                onClick={() => {
                  setMActivity(a)
                  setMSaved(false)
                }}
                ariaLabel={t('activity.aria', { name: activityDisplay(a) })}
              >
                {activityDisplay(a)}
              </OptionPill>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="manual-note" className="type-caption mb-1 block text-muted">
            {t('manual.noteLabel')}
          </label>
          <input
            id="manual-note"
            className={inputCls}
            placeholder={t('manual.notePlaceholder')}
            value={mNote}
            onChange={(e) => {
              setMNote(e.target.value)
              setMSaved(false)
            }}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <PrimaryButton onClick={() => void saveManual()} disabled={mSaving}>
            <Icon name="plus" size={16} /> {mSaving ? t('save.saving') : t('manual.save')}
          </PrimaryButton>
          {mSaved && (
            <span className="type-caption inline-flex items-center gap-1 text-teal">
              <HanddrawnCheck size={14} /> {t('manual.savedPrefix')}{' '}
              <Link to="/" className="underline underline-offset-2">
                {t('manual.seeToday')}
              </Link>
            </span>
          )}
        </div>
        {mError && (
          <p className="type-caption mt-2 text-coral" role="alert">
            {mError}
          </p>
        )}
      </section>
    </div>
  )
}
