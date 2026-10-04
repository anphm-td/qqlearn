/*
 * /thongke — tab 4 "Thống kê" (nhóm C9).
 *
 * Biểu đồ SVG TỰ VẼ (không thư viện chart), đúng aesthetic note giấy pastel:
 * nét mực --ink, trục --muted, cột/điểm bubble tô --teal.
 *  - Cột: giờ học theo ngày (7 ngày) / tuần (8 tuần) / tháng (6 tháng).
 *  - Phân bổ theo Part: thanh ngang SVG (track --rule + cột --teal, nhãn nét mực).
 *  - Heatmap bubble theo tháng cho toàn bộ dữ liệu học (phút + ghi chú cuối ngày).
 *  - Card báo cáo tuần (tổng hợp từ weekReport.ts, dùng chung logic với /thongke/tuan).
 * Desktop ≥768px: 2 biểu đồ xếp lưới 2 cột; heatmap + báo cáo tuần full-width (mục 10).
 *
 * Logic thuần tách ở ./statsAgg.ts và ./weekReport.ts (có test vitest).
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import EmptyState from '@/components/ui/EmptyState'
import Icon from '@/components/ui/Icon'
import { cn } from '@/components/ui/cn'
import type { DailyNote, Mistake, Session } from '@core/types'
import { addDaysISO, repos, todayISO } from '@data/index'
import { useSettings } from '@data/useSettings'

import {
  aggregateBuckets,
  allocateByPart,
  buildMonthHeatmap,
  computeStreak,
  firstOfMonthISO,
  formatAxisHours,
  formatHours,
  startOfWeekISO,
  WEEKDAY_LABELS_MON,
  type Granularity,
  type HeatCell,
  type PartSlice,
  type StatBucket,
} from './statsAgg'
import { buildWeekReport, describeDelta } from './weekReport'
import { streakWindowFrom } from '@/features/today/todayLogic'

const GRANS: Array<{ key: Granularity; caption: string }> = [
  { key: 'day', caption: '7 ngày gần nhất' },
  { key: 'week', caption: '8 tuần gần nhất' },
  { key: 'month', caption: '6 tháng gần nhất' },
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
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-auto w-full" role="img" aria-label="Biểu đồ giờ học">
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

/** Phân bổ theo Part — thanh ngang SVG: track --rule, cột --teal, nhãn nét mực. */
function PartBarsChart({ slices }: { slices: PartSlice[] }) {
  const W = 320
  const rowH = 30
  const labelW = 58
  const valueW = 62
  const barX = labelW
  const barW = W - labelW - valueW - 8
  const H = slices.length * rowH + 4
  const max = Math.max(...slices.map((s) => s.minutes))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-auto w-full" role="img" aria-label="Phân bổ giờ học theo Part">
      {slices.map((s, i) => {
        const cy = i * rowH + rowH / 2
        const filled = Math.max(6, (s.minutes / max) * barW)
        return (
          <g key={s.part}>
            <text x={0} y={cy + 4} fontSize="11" className="num" fill="var(--ink)">
              {s.part === 0 ? 'chưa rõ' : `Part ${s.part}`}
            </text>
            <rect x={barX} y={cy - 5} width={barW} height={10} rx={5} fill="var(--rule)" />
            <rect x={barX} y={cy - 5} width={filled} height={10} rx={5} fill="var(--teal)" />
            <text x={W} y={cy + 4} textAnchor="end" fontSize="11" className="num" fill="var(--ink)">
              {formatHours(s.minutes)} giờ
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** 1 ô bubble của heatmap — rỗng nét đứt hoặc tô chì teal theo mức. */
function HeatBubble({ cell }: { cell: HeatCell }) {
  const dayNum = Number(cell.date.slice(8, 10))
  const title = cell.level === 0 ? `${cell.date}: chưa học` : `${cell.date}: ${cell.minutes} phút`
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
 * Trang Thống kê (thay stub): biểu đồ giờ học + phân bổ Part (lưới 2 cột ≥768px),
 * heatmap tháng + báo cáo tuần full-width, 2 thẻ dẫn tới /thongke/diem và /thongke/tuan.
 */
export default function StatsPage() {
  const { settings } = useSettings()
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
  const target = settings?.targetScore ?? null

  const today = todayISO()
  const buckets = useMemo(() => aggregateBuckets(sessions, gran, today), [gran, sessions, today])
  const partSlices = useMemo(() => allocateByPart(sessions), [sessions])

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
        <h1 className="type-display">Thống kê</h1>
        <EmptyState message="Không mở được sổ thống kê. Bạn thử tải lại trang nhé!" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="section-label">thống kê</p>
      <div>
        <h1 className="type-display">Thống kê</h1>
        <p className="type-body mt-1 text-muted">
          tuần này <span className="num text-ink">{formatHours(report.totals.minutes)}</span>/{formatHours(goal * 7)} giờ
        </p>
      </div>

      {/* Hai trang con của tab Thống kê */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          to="/thongke/diem"
          className="paper-card px-4 py-3 no-underline transition-transform active:translate-y-px"
        >
          <span className="section-label label-dot-butter">điểm luyện đề</span>
          <p className="type-caption mt-1.5 text-muted">
            {target != null ? (
              <>
                mục tiêu <span className="num text-ink">{target}</span> điểm
              </>
            ) : (
              'chưa đặt điểm mục tiêu'
            )}
          </p>
        </Link>
        <Link
          to="/thongke/tuan"
          className="paper-card px-4 py-3 no-underline transition-transform active:translate-y-px"
        >
          <span className="section-label label-dot-coral">báo cáo tuần</span>
          <p className="type-caption mt-1.5 text-muted">
            streak <span className="num text-ink">{streak}</span> ngày
          </p>
        </Link>
      </div>

      {/* ≥768px: 2 biểu đồ xếp lưới 2 cột (giờ học | phân bổ Part) — mục 10 */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="paper-card px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="section-label">giờ học</p>
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
                  {g.key === 'day' ? 'ngày' : g.key === 'week' ? 'tuần' : 'tháng'}
                </button>
              ))}
            </div>
          </div>
          <p className="type-caption mt-0.5 text-muted">
            đơn vị: giờ · {GRANS.find((g) => g.key === gran)?.caption}
          </p>
          {loading ? (
            <p className="type-body mt-3 text-muted">đang mở sổ…</p>
          ) : sessions.length === 0 ? (
            <EmptyState message="Chưa có buổi học nào để vẽ biểu đồ. Bắt đầu một buổi 25 phút nhé?" />
          ) : (
            <HoursBarChart buckets={buckets} />
          )}
        </section>

        <section className="paper-card px-4 py-4">
          <p className="section-label label-dot-lavender">mỗi Part học bao lâu</p>
          <p className="type-caption mt-0.5 text-muted">phân bổ giờ học theo Part 1–7</p>
          {loading ? (
            <p className="type-body mt-3 text-muted">đang mở sổ…</p>
          ) : partSlices.length === 0 ? (
            <EmptyState message="Chưa có dữ liệu Part. Chọn Part cho buổi học để thấy phân bổ nhé!" />
          ) : (
            <PartBarsChart slices={partSlices} />
          )}
        </section>
      </div>

      {/* Heatmap bubble theo tháng — full-width mọi kích thước */}
      <section className="paper-card px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <p className="section-label">lịch học theo tháng</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Tháng trước"
              disabled={!canPrevMonth}
              onClick={() => setHeatMonth(firstOfMonthISO(heatMonth, -1))}
              className="stepper-btn disabled:opacity-40"
            >
              <Icon name="arrow-left" size={16} />
            </button>
            <span className="num text-[13px] text-ink">
              tháng {Number(heatFirst.slice(5, 7))}/{heatFirst.slice(0, 4)}
            </span>
            <button
              type="button"
              aria-label="Tháng sau"
              disabled={!canNextMonth}
              onClick={() => setHeatMonth(firstOfMonthISO(heatMonth, 1))}
              className="stepper-btn disabled:opacity-40"
            >
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {WEEKDAY_LABELS_MON.map((w) => (
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
            <span className="type-caption text-muted">ít</span>
            {[0, 1, 2, 3].map((lvl) => (
              <span
                key={lvl}
                className={cn('inline-block h-3.5 w-3.5 rounded-full', lvl === 0 ? 'bubble' : 'bubble--filled')}
                style={lvl > 0 ? { opacity: HEAT_OPACITY[lvl] } : undefined}
              />
            ))}
            <span className="type-caption text-muted">nhiều</span>
          </div>
          <span className="type-caption text-muted">mục tiêu {goal} phút mỗi ngày</span>
        </div>
      </section>

      {/* Báo cáo tuần (tóm tắt) — full-width mọi kích thước */}
      <section className="paper-card px-4 py-4">
        <p className="section-label label-dot-coral">báo cáo tuần này</p>
        <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCell
            value={formatHours(report.totals.minutes)}
            unit="giờ"
            label="giờ học"
            caption={`tuần trước: ${formatHours(report.previous.minutes)}`}
          />
          <StatCell
            value={String(report.totals.newWords)}
            unit="từ"
            label="từ mới"
            caption={`tuần trước: ${report.previous.newWords}`}
          />
          <StatCell
            value={String(report.totals.mistakeCount)}
            unit="lỗi"
            label="lỗi sai"
            caption={`tuần trước: ${report.previous.mistakeCount}`}
          />
          <StatCell value={String(streak)} unit="ngày" label="học liên tiếp" caption="tính đến hôm nay" />
        </div>
        <hr className="dashed-rule my-3" />
        <p className="type-caption text-muted">{describeDelta(report.delta)}</p>
      </section>
    </div>
  )
}
