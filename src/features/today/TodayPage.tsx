import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import EmptyState from '@/components/ui/EmptyState'
import Icon from '@/components/ui/Icon'
import BubbleCheck from '@/components/ui/BubbleCheck'
import SubjectChip from '@/components/ui/SubjectChip'
import ProgressBubble from '@/components/ui/ProgressBubble'
import SuggestionCard from '@/features/smart/SuggestionCard'
import DailyNoteForm from '@/features/today/DailyNoteForm'
import {
  buildWeek,
  computeStreak,
  formatDayShort,
  formatHHMM,
  greeting,
  percentOfDay,
  streakWindowFrom,
  summarizeDay,
} from '@/features/today/todayLogic'
import { getServerUrl, isServerMode, repos, todayISO } from '@data'
import { onDataChanged } from '@data/dataEvents'
import { useSettings } from '@data/useSettings'
import { useSubjects } from '@data/useSubjects'
import { useT } from '@data/useT'
import type { Session } from '@core/types'

/**
 * Home "Hôm nay" (A4) — vòng lặp học hằng ngày.
 * Mobile: layout dọc. ≥768px (mục 10): 2 cột tổng ~960px căn giữa (AppLayout đã bọc
 * max-w-[960px] mx-auto) — cột trái ProgressBubble + streak tuần 7 BubbleCheck +
 * nút "Bắt đầu học"; cột phải danh sách buổi học + SuggestionCard (điểm ghép chéo,
 * team smart sở hữu) + form ghi chú cuối ngày.
 * i18n: mọi chuỗi hiển thị qua useT('today'); các hàm thuần (greeting/formatDayShort/
 * buildWeek) nhận lang để dịch theo ngôn ngữ đã chọn trong Cài đặt.
 */
export default function TodayPage() {
  const { t, lang } = useT('today')
  const { settings } = useSettings()
  const { subjects } = useSubjects()
  const subjectById = (id: number) => (subjects ?? []).find((s) => s.id === id)
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  // F21 — banner nguồn dữ liệu: chỉ hiện khi Sổ đang đọc/ghi qua server PC.
  const serverMode = isServerMode()
  const serverUrl = getServerUrl()

  // Ngày hôm nay theo MÚI GIỜ LOCAL ('YYYY-MM-DD') — cấm toISOString (UTC lệch ngày).
  const today = todayISO()

  const reload = useCallback(() => {
    // Nạp ĐỦ cửa sổ streak chung (streakWindowFrom — STREAK_WINDOW_DAYS ngày) để
    // con số streak trên Home khớp Báo cáo tuần và Thống kê (1 truy vấn listBetween).
    const to = todayISO()
    repos.sessions
      .listBetween(streakWindowFrom(to), to)
      .then((rows) => {
        setSessions(rows)
        setLoadError(false)
      })
      .catch(() => setLoadError(true))
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  // Card Check-in nổi trên MỌI trang (gắn ở AppLayout): lưu buổi học xong nó phát
  // tín hiệu data-changed — trang đang mở nghe rồi nạp lại ngay, vòng tiến độ và
  // danh sách buổi cập nhật không phải đợi F5.
  useEffect(
    () =>
      onDataChanged((detail) => {
        if (detail.table === 'sessions') reload()
      }),
    [reload],
  )

  const todaySessions = useMemo(() => (sessions ?? []).filter((s) => s.date === today), [sessions, today])
  const summary = summarizeDay(todaySessions)
  const goalMinutes = settings?.dailyGoalMinutes ?? 90
  const percent = percentOfDay(summary.totalMinutes, goalMinutes)
  const week = useMemo(() => buildWeek(today, sessions ?? []), [today, sessions])
  const streak = useMemo(() => computeStreak(sessions ?? [], today), [sessions, today])

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="section-label">{formatDayShort(today, lang)}</p>
        <h1 className="type-display">{t('home.title')}</h1>
        <p className="type-caption text-muted">
          {t('home.goalCaption', { greeting: greeting(new Date().getHours(), lang), goal: goalMinutes })}
        </p>
      </header>

      {serverMode && (
        <p
          role="status"
          className="type-caption rounded-lg border border-lavender bg-lavender-soft px-3 py-2"
        >
          {t('home.serverBanner', { url: serverUrl })}
        </p>
      )}

      {settings && !settings.onboardingDone && (
        <section className="paper-card flex items-center gap-3 px-4 py-3">
          <Icon name="star" size={22} className="shrink-0 text-coral" />
          <p className="type-body flex-1">{t('home.onboardingPrompt')}</p>
          <Link to="/onboarding" className="btn btn-secondary type-body shrink-0">
            {t('home.onboardingSetup')}
          </Link>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_3fr] md:items-start md:gap-6">
        {/* Cột trái — tiến độ + streak + hành động */}
        <div className="flex flex-col gap-4">
          <section
            className="paper-card flex flex-col items-center gap-4 px-4 pt-4 pb-5"
            aria-label={t('progress.sectionAria')}
          >
            <p className="section-label self-start">{t('progress.label')}</p>

            <ProgressBubble
              percent={percent}
              caption={t('progress.caption', { done: summary.totalMinutes, goal: goalMinutes })}
            />

            <div>
              <p className="section-label label-dot-coral mb-2">{t('week.label')}</p>
              <div className="flex items-start justify-center gap-2">
                {week.map((d) => (
                  <div key={d.date} className="flex flex-col items-center gap-1">
                    <BubbleCheck
                      checked={d.done}
                      label={t('week.bubbleAria', { weekday: d.weekday, date: d.date, minutes: d.minutes })}
                      size={26}
                    />
                    <span className={`type-caption ${d.isToday ? 'text-ink' : 'text-muted'}`}>{d.weekday}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="num type-caption inline-flex items-center gap-1.5 text-coral">
              <Icon name="flame" size={16} /> {t('streak.label', { days: streak })}
            </p>

            <Link to="/hoc/buoi-hoc" className="btn btn-primary type-body w-full">
              <Icon name="study" size={18} /> {t('home.startStudy')}
            </Link>
          </section>
        </div>

        {/* Cột phải — buổi học hôm nay + gợi ý + ghi chú cuối ngày */}
        <div className="flex flex-col gap-4">
          <section className="paper-card px-4 pt-4 pb-4" aria-label={t('sessions.sectionAria')}>
            <div className="flex items-center justify-between gap-2">
              <p className="section-label">{t('sessions.label')}</p>
              <span className="num type-caption text-muted">
                {summary.sessionCount === 1 ? t('sessions.countOne') : t('sessions.count', { count: summary.sessionCount })}
              </span>
            </div>

            {sessions === null && !loadError && <p className="type-body mt-3 text-muted">{t('sessions.loading')}</p>}

            {loadError && (
              <EmptyState
                className="mt-3"
                message={t('sessions.loadError')}
                action={
                  <SecondaryRetry onClick={reload} />
                }
              />
            )}

            {sessions !== null && !loadError && todaySessions.length === 0 && (
              <EmptyState
                className="mt-3"
                message={t('sessions.empty')}
                action={
                  <Link to="/hoc/buoi-hoc" className="btn btn-primary type-body">
                    <Icon name="study" size={16} /> {t('sessions.start25')}
                  </Link>
                }
              />
            )}

            {sessions !== null && !loadError && todaySessions.length > 0 && (
              <ul className="mt-2 divide-y divide-dashed divide-rule">
                {todaySessions.map((s) => (
                  <li key={s.id} className="flex items-center gap-2.5 py-2.5">
                    <span className="num w-10 shrink-0 text-[15px] text-ink">{formatHHMM(s.startedAt)}</span>
                    <span className="num shrink-0 text-[13px] text-muted">
                      {t('sessions.minutesShort', { minutes: s.durationMin })}
                    </span>
                    {s.subjectId > 0 && (
                      <SubjectChip
                        name={subjectById(s.subjectId)?.name ?? t('sessions.subjectDeleted')}
                        colorHex={subjectById(s.subjectId)?.colorHex}
                      />
                    )}
                    <span className="type-caption min-w-0 flex-1 truncate text-muted">{s.activity}</span>
                    <span className="type-caption shrink-0 text-muted">
                      {s.source === 'timer' ? t('sessions.sourceTimer') : t('sessions.sourceManual')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ĐIỂM GHÉP CHÉO 1: card gợi ý do team smart sở hữu — chỉ render, không sửa */}
          <SuggestionCard />

          <DailyNoteForm date={today} todaySessions={todaySessions} />
        </div>
      </div>
    </div>
  )
}

function SecondaryRetry({ onClick }: { onClick: () => void }) {
  const { t } = useT('today')
  return (
    <button type="button" className="btn btn-secondary type-body" onClick={onClick}>
      {t('sessions.retry')}
    </button>
  )
}
