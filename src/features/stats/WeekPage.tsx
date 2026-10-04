/*
 * /thongke/tuan — con của tab Thống kê (nhóm C11).
 *
 * Báo cáo tuần TỰ ĐỘNG: tổng giờ học, số từ mới, số lỗi sai, số buổi —
 * so với tuần liền trước, streak ngày học liên tiếp (icon flame --coral),
 * dải 7 bubble từng ngày trong tuần. Tuần bắt đầu THỨ HAI, ngày local.
 *
 * Tách 2 lớp:
 *  - Logic thuần: ./weekReport.ts + ./statsAgg.ts (có test vitest).
 *  - UI: nạp dữ liệu qua repos từ '@data' (KHÔNG import dexie/db),
 *    gọi buildWeekReport() với sessions/notes/mistakes của 2 tuần liền nhau.
 */
import { useEffect, useMemo, useState } from 'react'

import Icon from '@/components/ui/Icon'
import { cn } from '@/components/ui/cn'
import type { DailyNote, Mistake, Session } from '@core/types'
import { addDaysISO, repos, todayISO } from '@data/index'
import { useSettings } from '@data/useSettings'

import {
  computeStreak,
  formatHours,
  heatmapLevel,
  startOfWeekISO,
  WEEKDAY_LABELS_MON,
} from './statsAgg'
import { buildWeekReport } from './weekReport'
import { streakWindowFrom } from '@/features/today/todayLogic'

/** 1 hàng so sánh "so với tuần trước" — teal = tốt hơn, coral = kém hơn. */
function DeltaRow({ label, delta, unit, moreIsBetter }: { label: string; delta: number; unit: string; moreIsBetter: boolean }) {
  const zero = delta === 0
  const good = moreIsBetter ? delta > 0 : delta < 0
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="type-body text-muted">{label}</span>
      {zero ? (
        <span className="type-body text-muted">không đổi</span>
      ) : (
        <span className={cn('num type-body', good ? 'text-teal' : 'text-coral')}>
          {delta > 0 ? '+' : '−'}
          {Math.abs(delta)} {unit}
        </span>
      )}
    </div>
  )
}

function BigStat({ value, unit, label, caption }: { value: string; unit: string; label: string; caption: string }) {
  return (
    <div className="paper-card px-4 py-3">
      <p className="num text-[24px] leading-[30px] text-ink">
        {value} <span className="text-[12px] text-muted">{unit}</span>
      </p>
      <p className="type-caption mt-0.5 text-muted">{label}</p>
      <p className="num type-caption text-muted">{caption}</p>
    </div>
  )
}

/**
 * Trang Báo cáo tuần (thay stub): tổng hợp tuần hiện tại + so tuần trước + streak.
 * Có nút lùi/tiến tuần để xem lại các tuần trước.
 */
export default function WeekPage() {
  const { settings } = useSettings()
  const today = todayISO()
  const currentWeekStart = startOfWeekISO(today)

  const [weekStart, setWeekStart] = useState<string>(() => startOfWeekISO(todayISO()))
  const [sessions, setSessions] = useState<Session[]>([])
  const [streakSessions, setStreakSessions] = useState<Session[]>([])
  const [notes, setNotes] = useState<DailyNote[]>([])
  const [mistakes, setMistakes] = useState<Mistake[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  // Dữ liệu streak: nạp ĐỦ cửa sổ streak chung (streakWindowFrom) để khớp số với
  // Home và Thống kê (nạp 1 lần).
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const rows = await repos.sessions.listBetween(streakWindowFrom(today), today)
        if (!alive) return
        setStreakSessions(rows)
      } catch {
        if (alive) setLoadError(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [today])

  // Dữ liệu 2 tuần liền nhau (tuần đang xem + tuần trước): sessions + notes.
  useEffect(() => {
    let alive = true
    setLoading(true)
    void (async () => {
      try {
        const from = addDaysISO(weekStart, -7)
        const to = addDaysISO(weekStart, 6)
        const [ss, ns, ms] = await Promise.all([
          repos.sessions.listBetween(from, to),
          repos.notes.listBetween(from, to),
          repos.mistakes.list(),
        ])
        if (!alive) return
        setSessions(ss)
        setNotes(ns)
        setMistakes(ms)
      } catch {
        if (alive) setLoadError(true)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [weekStart])

  const goal = settings?.dailyGoalMinutes ?? 60
  const report = useMemo(
    () => buildWeekReport({ sessions, notes, mistakes, weekStart }),
    [sessions, notes, mistakes, weekStart],
  )
  const streak = useMemo(
    () => computeStreak(streakSessions.filter((s) => s.durationMin > 0).map((s) => s.date), today),
    [streakSessions, today],
  )

  const minutesByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sessions) {
      if (s.durationMin <= 0) continue
      map.set(s.date, (map.get(s.date) ?? 0) + s.durationMin)
    }
    return map
  }, [sessions])

  const isCurrentWeek = weekStart === currentWeekStart
  const canNext = weekStart < currentWeekStart
  const rangeLabel = isCurrentWeek
    ? 'tuần này'
    : `${report.range.start.slice(8, 10)}/${report.range.start.slice(5, 7)} – ${report.range.end.slice(8, 10)}/${report.range.end.slice(5, 7)}`

  const emptyWeek =
    !loading && report.totals.minutes === 0 && report.totals.newWords === 0 && report.totals.mistakeCount === 0

  if (loadError) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="type-display">Báo cáo tuần</h1>
        <div className="rounded-[10px] border border-dashed border-rule bg-card px-4 py-8 text-center">
          <p className="type-body text-muted">Không mở được sổ báo cáo. Bạn thử tải lại trang nhé!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="section-label">thống kê · tuần</p>
      <h1 className="type-display">Báo cáo tuần</h1>

      {/* Điều hướng tuần */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Tuần trước"
          onClick={() => setWeekStart(addDaysISO(weekStart, -7))}
          className="stepper-btn"
        >
          <Icon name="arrow-left" size={16} />
        </button>
        <p className="num text-[15px] text-ink">{rangeLabel}</p>
        <button
          type="button"
          aria-label="Tuần sau"
          disabled={!canNext}
          onClick={() => setWeekStart(addDaysISO(weekStart, 7))}
          className="stepper-btn disabled:opacity-40"
        >
          <Icon name="chevron-right" size={16} />
        </button>
      </div>

      {loading && <p className="type-body text-muted">đang tổng hợp sổ…</p>}

      {/* 4 số liệu lớn */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <BigStat
          value={formatHours(report.totals.minutes)}
          unit="giờ"
          label="tổng giờ học"
          caption={`tuần trước: ${formatHours(report.previous.minutes)}`}
        />
        <BigStat
          value={String(report.totals.newWords)}
          unit="từ"
          label="từ mới"
          caption={`tuần trước: ${report.previous.newWords}`}
        />
        <BigStat
          value={String(report.totals.mistakeCount)}
          unit="lỗi"
          label="lỗi sai"
          caption={`tuần trước: ${report.previous.mistakeCount}`}
        />
        <BigStat
          value={String(report.totals.sessionCount)}
          unit="buổi"
          label="buổi học"
          caption={`${report.totals.daysStudied}/7 ngày`}
        />
      </div>

      {/* So với tuần trước */}
      <section className="paper-card px-4 py-4">
        <p className="section-label">so với tuần trước</p>
        <div className="mt-2">
          <DeltaRow label="giờ học" delta={report.delta.minutes} unit="phút" moreIsBetter />
          <DeltaRow label="từ mới" delta={report.delta.newWords} unit="từ" moreIsBetter />
          <DeltaRow label="lỗi sai" delta={report.delta.mistakeCount} unit="lỗi" moreIsBetter={false} />
          <DeltaRow label="ngày có học" delta={report.delta.daysStudied} unit="ngày" moreIsBetter />
        </div>
        <hr className="dashed-rule my-3" />
        <p className="type-caption text-muted">
          báo cáo tự tổng hợp từ sổ buổi học, ghi chú cuối ngày và sổ lỗi sai của bạn
        </p>
        {emptyWeek && (
          <p className="type-body mt-2 text-muted">
            Tuần này chưa có dữ liệu — cứ học và ghi sổ, báo cáo sẽ tự đầy dần nhé!
          </p>
        )}
      </section>

      {/* Từng ngày trong tuần — 7 bubble */}
      <section className="paper-card px-4 py-4">
        <p className="section-label label-dot-lavender">từng ngày trong tuần</p>
        <p className="type-caption mt-0.5 text-muted">số phút mỗi ngày (bubble đầy = đạt mục tiêu)</p>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {WEEKDAY_LABELS_MON.map((w, i) => {
            const date = addDaysISO(weekStart, i)
            const minutes = minutesByDate.get(date) ?? 0
            const level = heatmapLevel(minutes, goal)
            const isToday = date === today
            return (
              <div key={date} className="flex flex-col items-center gap-1">
                <span className={cn('type-caption', isToday ? 'font-semibold text-ink' : 'text-muted')}>{w}</span>
                <div
                  className={cn('aspect-square w-full', level === 0 ? 'bubble' : 'bubble--filled')}
                  title={`${date}: ${minutes} phút`}
                  style={level > 0 ? { opacity: [1, 0.45, 0.7, 1][level] } : undefined}
                />
                <span className="num text-[10px] text-muted">{minutes > 0 ? minutes : '—'}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Streak */}
      <section className="paper-card flex items-center gap-4 px-4 py-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[1.5px] border-coral text-coral">
          <Icon name="flame" size={26} />
        </span>
        <div className="min-w-0">
          <p className="num text-[24px] leading-[30px] text-ink">
            {streak} <span className="text-[12px] text-muted">ngày</span>
          </p>
          <p className="type-caption text-muted">chuỗi ngày học liên tiếp (mục tiêu {goal} phút mỗi ngày)</p>
        </div>
      </section>
    </div>
  )
}
