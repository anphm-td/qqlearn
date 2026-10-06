import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import Icon from '@/components/ui/Icon'
import SubjectChip from '@/components/ui/SubjectChip'
import { PrimaryButton, SecondaryButton } from '@/components/ui/buttons'
import DurationPicker, { OptionPill } from '@/features/today/DurationPicker'
import { percentOfDay, summarizeDay } from '@/features/today/todayLogic'
import { repos, todayISO } from '@data'
import { useT } from '@data/useT'
import { useSettings } from '@data/useSettings'
import { useSubjects } from '@data/useSubjects'
import type { Session } from '@core/types'

/*
 * /hoc — tab Học (A2): dựng buổi học trước khi bấm giờ.
 * Thời lượng TỰ CHỈNH (mục 3): stepper ±5 + ô nhập số tự do; preset 15/25/45/60
 * chỉ là gợi ý nhanh. Chọn MÔN (đa môn) bằng SubjectChip → điều hướng /hoc/buoi-hoc
 * kèm cấu hình qua router state. Nút "＋ môn mới" dẫn tới trang Môn học (/mon-hoc).
 * i18n: mọi chuỗi hiển thị qua useT('study') — dict ở src/core/i18n/dict/study.ts.
 * Giá trị activity ('nghe'…) là DỮ LIỆU lưu DB — key dict chỉ để hiển thị.
 */

const ACTIVITIES = ['nghe', 'đọc', 'ngữ pháp', 'từ vựng', 'luyện đề'] as const

/** activity (giá trị lưu DB) → key hiển thị trong dict 'study'. */
const ACTIVITY_LABEL_KEYS: Record<(typeof ACTIVITIES)[number], string> = {
  nghe: 'activity.listening',
  đọc: 'activity.reading',
  'ngữ pháp': 'activity.grammar',
  'từ vựng': 'activity.vocabulary',
  'luyện đề': 'activity.practice',
}

/** Key dict hiển thị cho 1 activity; giá trị lạ (dữ liệu cũ) → undefined — hiển thị nguyên văn. */
export function activityLabelKey(activity: string): string | undefined {
  return (ACTIVITY_LABEL_KEYS as Record<string, string | undefined>)[activity]
}

export interface SessionSetup {
  focusMin: number
  subjectId: number
  activity: string
}

export default function StudyPage() {
  const navigate = useNavigate()
  const { t } = useT('study')
  const { settings } = useSettings()
  const { subjects } = useSubjects()

  const [focusMin, setFocusMin] = useState(25)
  const [subjectId, setSubjectId] = useState(0)
  const [activity, setActivity] = useState<string>('nghe')
  const [todaySessions, setTodaySessions] = useState<Session[] | null>(null)
  const [hydrated, setHydrated] = useState(false)

  const activeSubjects = useMemo(() => (subjects ?? []).filter((s) => !s.archived), [subjects])

  // Nhãn hiển thị của 1 activity — không có key (dữ liệu lạ) thì giữ nguyên giá trị.
  const activityDisplay = (a: string): string => {
    const key = activityLabelKey(a)
    return key ? t(key) : a
  }

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
      state: { focusMin, subjectId, activity, ...extra } satisfies SessionSetup & Record<string, unknown>,
    })
  }

  return (
    <div className="mx-auto w-full max-w-[600px]">
      <header>
        <p className="section-label">{t('page.label')}</p>
        <h1 className="type-display">{t('page.title')}</h1>
      </header>

      <section className="paper-card mt-4 px-4 py-5" aria-label={t('setup.aria')}>
        <DurationPicker
          value={focusMin}
          onChange={setFocusMin}
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
            <span className="inline-block h-2.5 w-4 rounded-full border border-rule bg-teal-soft" aria-hidden="true" />
            {t('goal.today', { done: summary.totalMinutes, total: goal, pct: percent })}
          </p>

          <PrimaryButton className="w-full" onClick={() => goSession()}>
            <Icon name="study" size={18} /> {t('action.start')}
          </PrimaryButton>

          <SecondaryButton className="w-full" onClick={() => goSession({ openManual: true })}>
            <Icon name="pen" size={16} /> {t('action.manual')}
          </SecondaryButton>

          <p className="type-caption text-center text-muted">{t('hint.timerNote')}</p>
        </div>
      </section>
    </div>
  )
}
