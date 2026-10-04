import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import EmptyState from '@/components/ui/EmptyState'
import Icon from '@/components/ui/Icon'
import BubbleCheck from '@/components/ui/BubbleCheck'
import PartChip from '@/components/ui/PartChip'
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
import { useSettings } from '@data/useSettings'
import type { Session } from '@core/types'

/**
 * Home "Hôm nay" (A4) — vòng lặp học hằng ngày.
 * Mobile: layout dọc. ≥768px (mục 10): 2 cột tổng ~960px căn giữa (AppLayout đã bọc
 * max-w-[960px] mx-auto) — cột trái ProgressBubble + streak tuần 7 BubbleCheck +
 * nút "Bắt đầu học"; cột phải danh sách buổi học + SuggestionCard (điểm ghép chéo,
 * team smart sở hữu) + form ghi chú cuối ngày.
 */
export default function TodayPage() {
  const { settings } = useSettings()
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

  const todaySessions = useMemo(() => (sessions ?? []).filter((s) => s.date === today), [sessions, today])
  const summary = summarizeDay(todaySessions)
  const goalMinutes = settings?.dailyGoalMinutes ?? 90
  const percent = percentOfDay(summary.totalMinutes, goalMinutes)
  const week = useMemo(() => buildWeek(today, sessions ?? []), [today, sessions])
  const streak = useMemo(() => computeStreak(sessions ?? [], today), [sessions, today])

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="section-label">{formatDayShort(today)}</p>
        <h1 className="type-display">Hôm nay</h1>
        <p className="type-caption text-muted">
          {greeting(new Date().getHours())} — mục tiêu {goalMinutes} phút mỗi ngày.
        </p>
      </header>

      {serverMode && (
        <p
          role="status"
          className="type-caption rounded-lg border border-lavender bg-lavender-soft px-3 py-2"
        >
          Dữ liệu qua server PC — {serverUrl}
        </p>
      )}

      {settings && !settings.onboardingDone && (
        <section className="paper-card flex items-center gap-3 px-4 py-3">
          <Icon name="star" size={22} className="shrink-0 text-coral" />
          <p className="type-body flex-1">Đặt mục tiêu học mỗi ngày để theo dõi tiến độ nhé.</p>
          <Link to="/onboarding" className="btn btn-secondary type-body shrink-0">
            Thiết lập
          </Link>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_3fr] md:items-start md:gap-6">
        {/* Cột trái — tiến độ + streak + hành động */}
        <div className="flex flex-col gap-4">
          <section className="paper-card flex flex-col items-center gap-4 px-4 pt-4 pb-5" aria-label="Tiến độ hôm nay">
            <p className="section-label self-start">tiến độ hôm nay</p>

            <ProgressBubble percent={percent} caption={`${summary.totalMinutes}/${goalMinutes} phút`} />

            <div>
              <p className="section-label label-dot-coral mb-2">tuần này</p>
              <div className="flex items-start justify-center gap-2">
                {week.map((d) => (
                  <div key={d.date} className="flex flex-col items-center gap-1">
                    <BubbleCheck checked={d.done} label={`${d.weekday} ${d.date}: ${d.minutes} phút`} size={26} />
                    <span className={`type-caption ${d.isToday ? 'text-ink' : 'text-muted'}`}>{d.weekday}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="num type-caption inline-flex items-center gap-1.5 text-coral">
              <Icon name="flame" size={16} /> streak {streak} ngày
            </p>

            <Link to="/hoc/buoi-hoc" className="btn btn-primary type-body w-full">
              <Icon name="study" size={18} /> Bắt đầu học
            </Link>
          </section>
        </div>

        {/* Cột phải — buổi học hôm nay + gợi ý + ghi chú cuối ngày */}
        <div className="flex flex-col gap-4">
          <section className="paper-card px-4 pt-4 pb-4" aria-label="Buổi học hôm nay">
            <div className="flex items-center justify-between gap-2">
              <p className="section-label">buổi học hôm nay</p>
              <span className="num type-caption text-muted">{summary.sessionCount} buổi</span>
            </div>

            {sessions === null && !loadError && <p className="type-body mt-3 text-muted">Đang mở sổ…</p>}

            {loadError && (
              <EmptyState
                className="mt-3"
                message="Chưa mở được dữ liệu cục bộ. Thử tải lại trang nhé."
                action={
                  <SecondaryRetry onClick={reload} />
                }
              />
            )}

            {sessions !== null && !loadError && todaySessions.length === 0 && (
              <EmptyState
                className="mt-3"
                message="Hôm nay chưa có buổi học nào. Vài chục phút là mở được một mục mới đấy."
                action={
                  <Link to="/hoc/buoi-hoc" className="btn btn-primary type-body">
                    <Icon name="study" size={16} /> Học 25 phút
                  </Link>
                }
              />
            )}

            {sessions !== null && !loadError && todaySessions.length > 0 && (
              <ul className="mt-2 divide-y divide-dashed divide-rule">
                {todaySessions.map((s) => (
                  <li key={s.id} className="flex items-center gap-2.5 py-2.5">
                    <span className="num w-10 shrink-0 text-[15px] text-ink">{formatHHMM(s.startedAt)}</span>
                    <span className="num shrink-0 text-[13px] text-muted">{s.durationMin} phút</span>
                    {s.part > 0 && <PartChip part={s.part} />}
                    <span className="type-caption min-w-0 flex-1 truncate text-muted">{s.activity}</span>
                    <span className="type-caption shrink-0 text-muted">{s.source === 'timer' ? 'bấm giờ' : 'nhập tay'}</span>
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
  return (
    <button type="button" className="btn btn-secondary type-body" onClick={onClick}>
      Tải lại
    </button>
  )
}
