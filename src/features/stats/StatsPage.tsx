/*
 * /thongke — tab 4 "Thống kê" (nhóm C9).
 *
 * Biểu đồ SVG TỰ VẼ (không thư viện chart), đúng aesthetic note giấy pastel:
 * nét mực --ink, trục --muted, cột/điểm bubble tô --teal.
 *  - Cột: giờ học theo ngày (7 ngày) / tuần (8 tuần) / tháng (6 tháng).
 *  - Phân bổ theo môn: thanh ngang SVG (track --rule + cột tô màu riêng của từng
 *    môn từ SUBJECT_PALETTE, nhãn nét mực).
 *  - Heatmap bubble theo tháng cho toàn bộ dữ liệu học (phút + ghi chú cuối ngày).
 *  - Card báo cáo tuần (tổng hợp từ weekReport.ts, dùng chung logic với /thongke/tuan).
 * Desktop ≥768px: 2 biểu đồ xếp lưới 2 cột; heatmap + báo cáo tuần full-width (mục 10).
 *
 * Logic thuần tách ở ./statsAgg.ts và ./weekReport.ts (có test vitest).
 * i18n: mọi chuỗi hiển thị qua useT('stats') — dict ở src/core/i18n/dict/stats.ts;
 * các hàm thuần (aggregateBuckets/weekdayLabelsMon/describeDelta) nhận `lang`.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import EmptyState from '@/components/ui/EmptyState'
import Icon from '@/components/ui/Icon'
import { cn } from '@/components/ui/cn'
import type { DailyNote, Mistake, Session } from '@core/types'
import { addDaysISO, repos, todayISO } from '@data/index'
import { useT } from '@data/useT'
import { useSettings } from '@data/useSettings'
import { useSubjects } from '@data/useSubjects'

import {
  aggregateBuckets,
  allocateBySubject,
  buildMonthHeatmap,
  computeStreak,
  firstOfMonthISO,
  formatAxisHours,
  formatHours,
  startOfWeekISO,
  weekdayLabelsMon,
  type Granularity,
  type HeatCell,
  type StatBucket,
  type SubjectSlice,
} from './statsAgg'
import { buildWeekReport, describeDelta } from './weekReport'
import { streakWindowFrom } from '@/features/today/todayLogic'

const GRANS: Array<{ key: Granularity; captionKey: string }> = [
  { key: 'day', captionKey: 'gran.dayCaption' },
  { key: 'week', captionKey: 'gran.weekCaption' },
  { key: 'month', captionKey: 'gran.monthCaption' },
]

const HEAT_OPACITY = [1, 0.45, 0.7, 1] as const

/** Đường chữ nhật bo tròn 2 góc TRÊN (kiểu rounded-t-full của mockup). */
function roundedTopRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h))
  return [
    `M${x},${y + h}`,
    `L${x},${y + rr}`,
    `Q${x},${y} ${x + rr},${y}`,
    `L${x + w - rr},${y}`,
    `Q${x + w},${y} ${x + w},${y + rr}`,
    `L${x + w},${y + h}`,
    'Z',
  ].join(' ')
}

/** Biểu đồ cột giờ học — SVG tự vẽ: trục --muted, lưới nét đứt --rule, cột --teal. */
function HoursBarChart({ buckets }: { buckets: StatBucket[] }) {
  const { t } = useT('stats')
  const W = 320
  const H = 176
  const padL = 30
  const padR = 6
  const padT = 20
  const padB = 24
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const maxMin = Math.max(30, ...buckets.map((b) => b.minutes))
  const niceMax =
    maxMin <= 120
      ? Math.ceil(maxMin / 30) * 30
      : maxMin <= 360
        ? Math.ceil(maxMin / 60) * 60
        : Math.ceil(maxMin / 120) * 120
  const gridStep = niceMax <= 120 ? 30 : niceMax <= 360 ? 60 : 120
  const gridVals: number[] = []
  for (let v = gridStep; v <= niceMax; v += gridStep) gridVals.push(v)

  const yOf = (m: number) => padT + plotH - (m / niceMax) * plotH
  const slot = plotW / buckets.length

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-auto w-full" role="img" aria-label={t('chart.aria')}>
      {gridVals.map((v) => (
        <g key={v}>
          <line
            x1={padL}
            x2={W - padR}
            y1={yOf(v)}
            y2={yOf(v)}
            stroke="var(--rule)"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
          <text x={padL - 6} y={yOf(v) + 3} textAnchor="end" fontSize="9" className="num" fill="var(--muted)">
            {formatAxisHours(v)}
          </text>
        </g>
      ))}

      {buckets.map((b, i) => {
        const cx = padL + slot * i + slot / 2
        const bw = Math.min(26, slot * 0.55)
        const barH = (b.minutes / niceMax) * plotH
        const hasBar = b.minutes > 0 && barH >= 2
        const top = yOf(b.minutes)
        return (
          <g key={`${b.from}-${b.to}`}>
            {hasBar ? (
              <path
                d={roundedTopRect(cx - bw / 2, top, bw, padT + plotH - top, Math.min(9, bw / 2))}
                fill="var(--teal)"
              />
            ) : (
              <line
                x1={cx - 8}
                x2={cx + 8}
                y1={padT + plotH - 1}
                y2={padT + plotH - 1}
                stroke="var(--muted)"
                strokeWidth="1.5"
                strokeDasharray="2 3"
                opacity="0.7"
              />
            )}
            <text
              x={cx}
              y={(hasBar ? top : padT + plotH) - 6}
              textAnchor="middle"
              fontSize="10"
              className="num"
              fill={b.isCurrent ? 'var(--ink)' : 'var(--muted)'}
              fontWeight={b.isCurrent ? 700 : 600}
            >
              {b.minutes > 0 ? formatHours(b.minutes) : '—'}
            </text>
            <text
              x={cx}
              y={H - 6}
              textAnchor="middle"
              fontSize="10"
              fill={b.isCurrent ? 'var(--ink)' : 'var(--muted)'}
              fontWeight={b.isCurrent ? 700 : 500}
            >
              {b.label}
            </text>
          </g>
        )
      })}

      <line x1={padL} x2={W - padR} y1={padT + plotH} y2={padT + plotH} stroke="var(--muted)" strokeWidth="1" />
    </svg>
  )
}

/** Phân bổ theo môn — thanh ngang SVG: track --rule, cột tô màu riêng từng môn. */
function SubjectBarsChart({
  slices,
  nameOf,
  colorOf,
}: {
  slices: SubjectSlice[]
  /** Tên môn hiển thị (subjectId → tên; 0 → "chưa phân môn"). */
  nameOf: (subjectId: number) => string
  /** Màu cột theo môn (colorHex của SUBJECT_PALETTE). */
  colorOf: (subjectId: number) => string
}) {
  const { t } = useT('stats')
  const W = 320
  const rowH = 30
  const labelW = 58
  const valueW = 62
  const barX = labelW
  const barW = W - labelW - valueW - 8
  const H = slices.length * rowH + 4
  const max = Math.max(...slices.map((s) => s.minutes))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-auto w-full" role="img" aria-label={t('subject.aria')}>
      {slices.map((s, i) => {
        const cy = i * rowH + rowH / 2
        const filled = Math.max(6, (s.minutes / max) * barW)
        return (
          <g key={s.subjectId}>
            <text x={0} y={cy + 4} fontSize="11" className="num" fill="var(--ink)">
              {nameOf(s.subjectId)}
            </text>
            <rect x={barX} y={cy - 5} width={barW} height={10} rx={5} fill="var(--rule)" />
            <rect x={barX} y={cy - 5} width={filled} height={10} rx={5} fill={colorOf(s.subjectId)} />
            <text x={W} y={cy + 4} textAnchor="end" fontSize="11" className="num" fill="var(--ink)">
              {t('subject.hoursSuffix', { hours: formatHours(s.minutes) })}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** 1 ô bubble của heatmap — rỗng nét đứt hoặc tô chì teal theo mức. */
function HeatBubble({ cell }: { cell: HeatCell }) {
  const { t } = useT('stats')
  const dayNum = Number(cell.date.slice(8, 10))
  const title =
    cell.level === 0 ? t('bubble.empty', { date: cell.date }) : t('bubble.minutes', { date: cell.date, minutes: cell.minutes })
  return (
    <div className="relative aspect-square w-full" title={title}>
      <div
        className={cn('absolute inset-0', cell.level === 0 ? 'bubble' : 'bubble--filled')}
        style={cell.level > 0 ? { opacity: HEAT_OPACITY[cell.level] } : undefined}
      />
      <span
        className={cn(
          'num absolute inset-0 flex items-center justify-center text-[10px]',
          cell.inMonth ? 'text-ink' : 'text-muted opacity-40',
        )}
      >
        {dayNum}
      </span>
    </div>
  )
}

function StatCell({ value, unit, label, caption }: { value: string; unit: string; label: string; caption?: string }) {
  return (
    <div>
      <p className="num text-[24px] leading-[30px] text-ink">
        {value} <span className="text-[12px] text-muted">{unit}</span>
      </p>
      <p className="type-caption text-muted">
        {label}
        {caption ? ` · ${caption}` : ''}
      </p>
    </div>
  )
}

/**
 * Trang Thống kê (thay stub): biểu đồ giờ học + phân bổ môn (lưới 2 cột ≥768px),
 * heatmap tháng + báo cáo tuần full-width, 2 thẻ dẫn tới /thongke/diem và /thongke/tuan.
 */
export default function StatsPage() {
  const { t, lang } = useT('stats')
  const { settings } = useSettings()
  const { subjects } = useSubjects()
  const subjectById = (id: number) => (subjects ?? []).find((s) => s.id === id)
  const [sessions, setSessions] = useState<Session[]>([])
  const [notes, setNotes] = useState<DailyNote[]>([])
  const [mistakes, setMistakes] = useState<Mistake[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [gran, setGran] = useState<Granularity>('day')
  const [heatMonth, setHeatMonth] = useState<string>(() => todayISO())

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const t = todayISO()
        const from = addDaysISO(t, -730)
        const [ss, ns, ms] = await Promise.all([
          repos.sessions.listBetween(from, t),
          repos.notes.listBetween(from, t),
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
  }, [])

  const goal = settings?.dailyGoalMinutes ?? 60

  const today = todayISO()
  const buckets = useMemo(() => aggregateBuckets(sessions, gran, today, {}, lang), [gran, lang, sessions, today])
  const subjectSlices = useMemo(() => allocateBySubject(sessions), [sessions])
  const nameOfSubject = (id: number): string =>
    id === 0 ? t('subject.uncategorized') : (subjectById(id)?.name ?? t('subject.deleted'))
  const colorOfSubject = (id: number): string => subjectById(id)?.colorHex ?? 'var(--muted)'

  const dayMap = useMemo(() => {
    const map = new Map<string, { minutes: number; hasNote: boolean }>()
    for (const s of sessions) {
      const prev = map.get(s.date)
      map.set(s.date, { minutes: (prev?.minutes ?? 0) + Math.max(0, s.durationMin), hasNote: prev?.hasNote ?? false })
    }
    for (const n of notes) {
      const prev = map.get(n.date)
      map.set(n.date, { minutes: prev?.minutes ?? 0, hasNote: true })
    }
    return map
  }, [sessions, notes])

  const heatCells = useMemo(() => buildMonthHeatmap(dayMap, heatMonth, goal), [dayMap, heatMonth, goal])

  const weekStart = startOfWeekISO(today)
  const report = useMemo(
    () => buildWeekReport({ sessions, notes, mistakes, weekStart }),
    [sessions, notes, mistakes, weekStart],
  )
  // Streak tính trên CÙNG cửa sổ chung với Home/Báo cáo tuần (streakWindowFrom) —
  // trang nạp 730 ngày cho heatmap, nhưng streak chỉ tính trên 400 ngày gần nhất
  // để ba nơi luôn ra một con số.
  const streak = useMemo(() => {
    const from = streakWindowFrom(today)
    return computeStreak(
      sessions.filter((s) => s.durationMin > 0 && s.date >= from).map((s) => s.date),
      today,
    )
  }, [sessions, today])

  const heatFirst = firstOfMonthISO(heatMonth, 0)
  const minMonth = firstOfMonthISO(today, -11)
  const canPrevMonth = heatFirst > minMonth
  const canNextMonth = heatFirst < firstOfMonthISO(today, 0)

  if (loadError) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="type-display">{t('page.title')}</h1>
        <EmptyState message={t('page.loadError')} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="section-label">{t('page.label')}</p>
      <div>
        <h1 className="type-display">{t('page.title')}</h1>
        <p className="type-body mt-1 text-muted">
          {t('range.thisWeek')} <span className="num text-ink">{formatHours(report.totals.minutes)}</span>/
          {formatHours(goal * 7)} {t('unit.hours')}
        </p>
      </div>

      {/* Hai trang con của tab Thống kê */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          to="/thongke/diem"
          className="paper-card px-4 py-3 no-underline transition-transform active:translate-y-px"
        >
          <span className="section-label label-dot-butter">{t('link.scoresLabel')}</span>
          <p className="type-caption mt-1.5 text-muted">{t('link.scoresCaption')}</p>
        </Link>
        <Link
          to="/thongke/tuan"
          className="paper-card px-4 py-3 no-underline transition-transform active:translate-y-px"
        >
          <span className="section-label label-dot-coral">{t('link.weekLabel')}</span>
          <p className="type-caption mt-1.5 text-muted">
            {streak === 1 ? t('link.weekStreakOne') : t('link.weekStreak', { days: streak })}
          </p>
        </Link>
      </div>

      {/* ≥768px: 2 biểu đồ xếp lưới 2 cột (giờ học | phân bổ môn) — mục 10 */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="paper-card px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="section-label">{t('chart.label')}</p>
            <div className="inline-flex overflow-hidden rounded-full border-[1.5px] border-ink">
              {GRANS.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setGran(g.key)}
                  aria-pressed={gran === g.key}
                  className={cn(
                    'px-3 py-1 text-[12px] leading-[16px] font-semibold',
                    gran === g.key ? 'bg-teal text-white' : 'bg-card text-muted',
                  )}
                >
                  {t(`gran.${g.key}`)}
                </button>
              ))}
            </div>
          </div>
          <p className="type-caption mt-0.5 text-muted">
            {t('chart.unitCaption', { range: t(GRANS.find((g) => g.key === gran)?.captionKey ?? 'gran.dayCaption') })}
          </p>
          {loading ? (
            <p className="type-body mt-3 text-muted">{t('chart.loading')}</p>
          ) : sessions.length === 0 ? (
            <EmptyState message={t('chart.empty')} />
          ) : (
            <HoursBarChart buckets={buckets} />
          )}
        </section>

        <section className="paper-card px-4 py-4">
          <p className="section-label label-dot-lavender">{t('subject.chartLabel')}</p>
          <p className="type-caption mt-0.5 text-muted">{t('subject.caption')}</p>
          {loading ? (
            <p className="type-body mt-3 text-muted">{t('chart.loading')}</p>
          ) : subjectSlices.length === 0 ? (
            <EmptyState message={t('subject.empty')} />
          ) : (
            <SubjectBarsChart slices={subjectSlices} nameOf={nameOfSubject} colorOf={colorOfSubject} />
          )}
        </section>
      </div>

      {/* Heatmap bubble theo tháng — full-width mọi kích thước */}
      <section className="paper-card px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <p className="section-label">{t('heat.label')}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={t('heat.prevAria')}
              disabled={!canPrevMonth}
              onClick={() => setHeatMonth(firstOfMonthISO(heatMonth, -1))}
              className="stepper-btn disabled:opacity-40"
            >
              <Icon name="arrow-left" size={16} />
            </button>
            <span className="num text-[13px] text-ink">
              {t('heat.monthCaption', { month: Number(heatFirst.slice(5, 7)), year: heatFirst.slice(0, 4) })}
            </span>
            <button
              type="button"
              aria-label={t('heat.nextAria')}
              disabled={!canNextMonth}
              onClick={() => setHeatMonth(firstOfMonthISO(heatMonth, 1))}
              className="stepper-btn disabled:opacity-40"
            >
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {weekdayLabelsMon(lang).map((w) => (
            <span key={w} className="type-caption text-center text-muted">
              {w}
            </span>
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-7 gap-1.5">
          {heatCells.map((c) => (
            <HeatBubble key={c.date} cell={c} />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="type-caption text-muted">{t('heat.less')}</span>
            {[0, 1, 2, 3].map((lvl) => (
              <span
                key={lvl}
                className={cn('inline-block h-3.5 w-3.5 rounded-full', lvl === 0 ? 'bubble' : 'bubble--filled')}
                style={lvl > 0 ? { opacity: HEAT_OPACITY[lvl] } : undefined}
              />
            ))}
            <span className="type-caption text-muted">{t('heat.more')}</span>
          </div>
          <span className="type-caption text-muted">{t('heat.goal', { goal })}</span>
        </div>
      </section>

      {/* Báo cáo tuần (tóm tắt) — full-width mọi kích thước */}
      <section className="paper-card px-4 py-4">
        <p className="section-label label-dot-coral">{t('report.label')}</p>
        <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCell
            value={formatHours(report.totals.minutes)}
            unit={t('unit.hours')}
            label={t('label.hours')}
            caption={t('stat.prevHours', { hours: formatHours(report.previous.minutes) })}
          />
          <StatCell
            value={String(report.totals.newWords)}
            unit={t('unit.words')}
            label={t('label.newWords')}
            caption={t('stat.prevWords', { count: report.previous.newWords })}
          />
          <StatCell
            value={String(report.totals.mistakeCount)}
            unit={t('unit.mistakes')}
            label={t('label.mistakes')}
            caption={t('stat.prevMistakes', { count: report.previous.mistakeCount })}
          />
          <StatCell value={String(streak)} unit={t('unit.days')} label={t('label.streakDays')} caption={t('stat.asOfToday')} />
        </div>
        <hr className="dashed-rule my-3" />
        <p className="type-caption text-muted">{describeDelta(report.delta, lang)}</p>
      </section>
    </div>
  )
}
