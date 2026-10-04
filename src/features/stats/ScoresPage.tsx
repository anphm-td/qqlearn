/*
 * /thongke/diem — con của tab Thống kê (nhóm C10).
 *
 * Nhập điểm luyện đề (listening, reading — total tự tính = listening + reading),
 * validate bằng scoreInputSchema từ '@core/schemas', lưu qua repos.scores.create().
 * Đồ thị đường SVG TỰ VẼ: đường tiến bộ total theo thời gian (nét mực --ink,
 * điểm bubble tô --teal) so với đường mục tiêu (nét đứt --coral) lấy từ
 * settings.targetScore qua useSettings(). Logic thuần dùng từ ./statsAgg.ts.
 */
import { useEffect, useMemo, useState } from 'react'

import EmptyState from '@/components/ui/EmptyState'
import { PrimaryButton } from '@/components/ui/buttons'
import { cn } from '@/components/ui/cn'
import { scoreInputSchema } from '@core/schemas'
import type { Score } from '@core/types'
import { repos, todayISO } from '@data/index'
import { useSettings } from '@data/useSettings'

import { shortDate } from './statsAgg'

const MIN_PART = 5
const MAX_PART = 495
const MAX_POINTS = 24 // vẽ tối đa 24 lần luyện đề gần nhất cho đồ thị gọn

interface Point {
  date: string
  total: number
}

/** Đồ thị đường tiến bộ — SVG tự vẽ: lưới/trục --muted, đường --ink, điểm bubble --teal. */
function ScoreLineChart({ points, target }: { points: Point[]; target: number | null }) {
  const W = 320
  const H = 190
  const padL = 38
  const padR = 10
  const padT = 20
  const padB = 26
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const totals = points.map((p) => p.total)
  const values = target != null ? [...totals, target] : totals
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  let lo = Math.max(0, Math.floor((minV - 30) / 50) * 50)
  let hi = Math.min(990, Math.ceil((maxV + 30) / 50) * 50)
  if (hi - lo < 100) hi = Math.min(990, lo + 100)

  const xOf = (i: number) => (points.length === 1 ? padL + plotW / 2 : padL + (plotW * i) / (points.length - 1))
  const yOf = (v: number) => padT + plotH - ((v - lo) / (hi - lo)) * plotH
  const gridVals = [lo, (lo + hi) / 2, hi]
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i)},${yOf(p.total)}`).join(' ')
  const lastIdx = points.length - 1

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-auto w-full" role="img" aria-label="Đồ thị tiến bộ điểm luyện đề">
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
            {v}
          </text>
        </g>
      ))}

      {/* trục --muted */}
      <line x1={padL} x2={padL} y1={padT} y2={padT + plotH} stroke="var(--muted)" strokeWidth="1" />
      <line x1={padL} x2={W - padR} y1={padT + plotH} y2={padT + plotH} stroke="var(--muted)" strokeWidth="1" />

      {/* đường mục tiêu (nét đứt --coral) */}
      {target != null && target >= lo && target <= hi && (
        <g>
          <line
            x1={padL}
            x2={W - padR}
            y1={yOf(target)}
            y2={yOf(target)}
            stroke="var(--coral)"
            strokeWidth="1.5"
            strokeDasharray="6 4"
          />
          <text x={W - padR} y={yOf(target) - 5} textAnchor="end" fontSize="10" className="num" fill="var(--coral)">
            mục tiêu {target}
          </text>
        </g>
      )}

      {/* đường tiến bộ: nét mực --ink, điểm bubble tô --teal */}
      {points.length > 1 && (
        <path d={path} fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {points.map((p, i) => (
        <g key={`${p.date}-${i}`}>
          <circle
            cx={xOf(i)}
            cy={yOf(p.total)}
            r={i === lastIdx ? 4.5 : 3.5}
            fill="var(--teal)"
            stroke="var(--card)"
            strokeWidth="1.5"
          />
          {i === lastIdx && (
            <text x={xOf(i)} y={yOf(p.total) - 9} textAnchor="middle" fontSize="11" className="num" fill="var(--ink)">
              {p.total}
            </text>
          )}
          <title>{`${shortDate(p.date)} · ${p.total} điểm`}</title>
        </g>
      ))}

      {/* nhãn ngày đầu/cuối trên trục x */}
      <text
        x={xOf(0)}
        y={H - 6}
        textAnchor={points.length === 1 ? 'middle' : 'start'}
        fontSize="9"
        className="num"
        fill="var(--muted)"
      >
        {shortDate(points[0].date)}
      </text>
      {points.length > 1 && (
        <text x={xOf(lastIdx)} y={H - 6} textAnchor="end" fontSize="9" className="num" fill="var(--muted)">
          {shortDate(points[lastIdx].date)}
        </text>
      )}
    </svg>
  )
}

interface FieldProps {
  label: string
  children: React.ReactNode
}

function Field({ label, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="type-caption text-muted">{label}</span>
      {children}
    </label>
  )
}

/** Ô điểm listening/reading: stepper −/+ 5 điểm (quy tắc thời gian tự chỉnh mục 3) + nhập tự do. */
function ScoreStepper({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  function bump(dir: 1 | -1) {
    const parsed = Number(value)
    const base = value.trim() !== '' && Number.isFinite(parsed) ? parsed : 250
    const next = Math.min(MAX_PART, Math.max(MIN_PART, base + dir * 5))
    onChange(String(next))
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Giảm 5 điểm" className="stepper-btn" onClick={() => bump(-1)}>
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={MIN_PART}
        max={MAX_PART}
        step={5}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="num w-full rounded-[10px] border border-rule bg-card px-3 py-2 text-center text-[16px] text-ink outline-none focus:border-teal"
      />
      <button type="button" aria-label="Tăng 5 điểm" className="stepper-btn" onClick={() => bump(1)}>
        +
      </button>
    </div>
  )
}

/** Lỗi Zod → câu tiếng Việt thân thiện. */
function scoreErrorMessage(field: string): string {
  switch (field) {
    case 'listening':
      return 'Điểm Listening nằm trong khoảng 5–495.'
    case 'reading':
      return 'Điểm Reading nằm trong khoảng 5–495.'
    case 'total':
      return 'Tổng điểm phải bằng Listening + Reading.'
    case 'testLabel':
      return 'Nhãn đề không được để trống.'
    case 'date':
      return 'Ngày làm đề không hợp lệ.'
    default:
      return 'Thông tin chưa hợp lệ, bạn kiểm tra lại nhé.'
  }
}

/**
 * Trang Điểm luyện đề (thay stub): form nhập điểm + đồ thị tiến bộ + sổ điểm.
 */
export default function ScoresPage() {
  const { settings } = useSettings()
  const [scores, setScores] = useState<Score[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState<string>(() => todayISO())
  const [testLabel, setTestLabel] = useState('')
  const [listening, setListening] = useState('')
  const [reading, setReading] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const rows = await repos.scores.list()
        if (!alive) return
        setScores(rows)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const target = settings?.targetScore ?? null

  const points = useMemo<Point[]>(
    () =>
      [...scores]
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
        .slice(-MAX_POINTS)
        .map((s) => ({ date: s.date, total: s.total })),
    [scores],
  )
  const latest = points.length > 0 ? points[points.length - 1] : null

  const l = Number(listening)
  const r = Number(reading)
  const totalPreview =
    listening.trim() !== '' && reading.trim() !== '' && Number.isFinite(l) && Number.isFinite(r) ? l + r : null

  async function reloadScores(): Promise<void> {
    setScores(await repos.scores.list())
  }

  async function handleSave(): Promise<void> {
    if (!Number.isFinite(l) || !Number.isFinite(r)) {
      setError('Bạn nhập đủ điểm Listening và Reading đã nhé.')
      return
    }
    const payload = {
      date,
      testLabel: testLabel.trim() || 'Luyện đề',
      listening: l,
      reading: r,
      total: l + r,
    }
    const parsed = scoreInputSchema.safeParse(payload)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      const field = firstIssue && firstIssue.path.length > 0 ? String(firstIssue.path[0]) : ''
      setError(scoreErrorMessage(field))
      return
    }

    setError(null)
    setSaving(true)
    try {
      await repos.scores.create(parsed.data)
      await reloadScores()
      setTestLabel('')
      setListening('')
      setReading('')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(id: number): Promise<void> {
    if (!window.confirm('Xóa lần luyện đề này khỏi sổ điểm?')) return
    await repos.scores.remove(id)
    await reloadScores()
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="section-label">thống kê · điểm</p>
      <h1 className="type-display">Điểm luyện đề</h1>

      {/* Form nhập điểm */}
      <section className="paper-card px-4 py-4">
        <p className="section-label">nhập đề vừa làm</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="ngày làm đề">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="num w-full rounded-[10px] border border-rule bg-card px-3 py-2 text-[14px] text-ink outline-none focus:border-teal"
            />
          </Field>
          <Field label="nhãn đề">
            <input
              type="text"
              value={testLabel}
              placeholder="vd. ETS 2023 · Đề 2"
              onChange={(e) => setTestLabel(e.target.value)}
              className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 text-[14px] text-ink outline-none placeholder:text-muted focus:border-teal"
            />
          </Field>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="listening (5–495)">
            <ScoreStepper value={listening} onChange={setListening} placeholder="38" />
          </Field>
          <Field label="reading (5–495)">
            <ScoreStepper value={reading} onChange={setReading} placeholder="42" />
          </Field>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="type-caption text-muted">tổng điểm (tự cộng)</p>
            <p className="num text-[28px] leading-[34px] text-ink">
              {totalPreview ?? '—'} <span className="text-[12px] text-muted">điểm</span>
            </p>
          </div>
          <PrimaryButton onClick={() => void handleSave()} disabled={saving || totalPreview === null}>
            Lưu vào sổ điểm
          </PrimaryButton>
        </div>
        {error && <p className="type-caption mt-2 text-coral">{error}</p>}
      </section>

      {/* Đồ thị tiến bộ so với mục tiêu */}
      <section className="paper-card px-4 py-4">
        <p className="section-label label-dot-butter">tiến bộ điểm số</p>
        <p className="type-caption mt-0.5 text-muted">
          tổng điểm theo từng lần luyện đề{target != null ? '' : ' · chưa đặt điểm mục tiêu trong Cài đặt'}
        </p>
        {loading ? (
          <p className="type-body mt-3 text-muted">đang mở sổ…</p>
        ) : points.length === 0 ? (
          <EmptyState message="Chưa có điểm nào để vẽ đồ thị. Nhập đề đầu tiên ở trên nhé!" />
        ) : (
          <ScoreLineChart points={points} target={target} />
        )}
        {latest && target != null && (
          <p className="type-caption mt-2 text-muted">
            lần gần nhất: <span className="num text-ink">{latest.total}</span> điểm ·{' '}
            {latest.total >= target ? (
              <span className="text-teal">đã đạt mục tiêu {target} — giỏi lắm!</span>
            ) : (
              <>
                còn <span className="num text-coral">{target - latest.total}</span> điểm tới mục tiêu {target}
              </>
            )}
          </p>
        )}
      </section>

      {/* Sổ điểm */}
      <section className="paper-card px-4 py-4">
        <p className="section-label">sổ điểm</p>
        {loading ? (
          <p className="type-body mt-3 text-muted">đang mở sổ…</p>
        ) : scores.length === 0 ? (
          <EmptyState message="Sổ điểm còn trang trắng. Lần luyện đề đầu tiên sẽ mở đầu cho đường tiến bộ đó!" />
        ) : (
          <ul className="mt-2">
            {scores.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 border-b border-dashed border-rule py-2.5 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="type-body truncate font-medium">{s.testLabel}</p>
                  <p className="num type-caption text-muted">
                    {shortDate(s.date)} · nghe {s.listening} · đọc {s.reading}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="num text-[18px] text-ink">
                    {s.total} <span className="text-[11px] text-muted">điểm</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleRemove(s.id!)}
                    className={cn('type-caption text-coral underline underline-offset-2')}
                  >
                    xóa
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
