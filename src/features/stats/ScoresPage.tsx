/*
 * /thongke/diem — con của tab Thống kê (nhóm C10).
 *
 * Nhập điểm kiểm tra/đề của TỪNG MÔN (một số điểm duy nhất + nhãn + ghi chú),
 * validate bằng scoreInputSchema từ '@core/schemas', lưu qua repos.scores.create().
 * Đồ thị đường SVG TỰ VẼ: đường tiến bộ điểm theo thời gian (nét mực --ink,
 * điểm bubble tô --teal). Logic thuần dùng từ ./statsAgg.ts.
 * i18n: mọi chuỗi hiển thị qua useT('stats') — dict ở src/core/i18n/dict/stats.ts.
 */
import { useEffect, useMemo, useState } from 'react'

import EmptyState from '@/components/ui/EmptyState'
import SubjectChip from '@/components/ui/SubjectChip'
import { PrimaryButton } from '@/components/ui/buttons'
import { cn } from '@/components/ui/cn'
import { t, type Lang } from '@core/i18n'
import { scoreInputSchema } from '@core/schemas'
import type { Score } from '@core/types'
import { repos, todayISO } from '@data/index'
import { useT } from '@data/useT'
import { useSubjects } from '@data/useSubjects'

import { shortDate } from './statsAgg'

const MAX_POINTS = 24 // vẽ tối đa 24 lần kiểm tra gần nhất cho đồ thị gọn

interface Point {
  date: string
  score: number
}

/** Đồ thị đường tiến bộ — SVG tự vẽ: lưới/trục --muted, đường --ink, điểm bubble --teal. */
function ScoreLineChart({ points }: { points: Point[] }) {
  const { t } = useT('stats')
  const W = 320
  const H = 190
  const padL = 38
  const padR = 10
  const padT = 20
  const padB = 26
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const totals = points.map((p) => p.score)
  const minV = Math.min(...totals)
  const maxV = Math.max(...totals)
  const span = Math.max(10, maxV - minV)
  const lo = Math.max(0, Math.floor((minV - span * 0.15) / 10) * 10)
  const hi = Math.ceil((maxV + span * 0.15) / 10) * 10

  const xOf = (i: number) => (points.length === 1 ? padL + plotW / 2 : padL + (plotW * i) / (points.length - 1))
  const yOf = (v: number) => padT + plotH - ((v - lo) / (hi - lo)) * plotH
  const gridVals = [lo, (lo + hi) / 2, hi]
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i)},${yOf(p.score)}`).join(' ')
  const lastIdx = points.length - 1

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-auto w-full" role="img" aria-label={t('scores.chartAria')}>
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
            {Math.round(v * 10) / 10}
          </text>
        </g>
      ))}

      {/* trục --muted */}
      <line x1={padL} x2={padL} y1={padT} y2={padT + plotH} stroke="var(--muted)" strokeWidth="1" />
      <line x1={padL} x2={W - padR} y1={padT + plotH} y2={padT + plotH} stroke="var(--muted)" strokeWidth="1" />

      {/* đường tiến bộ: nét mực --ink, điểm bubble --teal */}
      {points.length > 1 && (
        <path d={path} fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {points.map((p, i) => (
        <g key={`${p.date}-${i}`}>
          <circle
            cx={xOf(i)}
            cy={yOf(p.score)}
            r={i === lastIdx ? 4.5 : 3.5}
            fill="var(--teal)"
            stroke="var(--card)"
            strokeWidth="1.5"
          />
          {i === lastIdx && (
            <text x={xOf(i)} y={yOf(p.score) - 9} textAnchor="middle" fontSize="11" className="num" fill="var(--ink)">
              {p.score}
            </text>
          )}
          <title>{t('scores.pointTitle', { date: shortDate(p.date), score: p.score })}</title>
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

/** Ô điểm: stepper −/+ (quy tắc "thời gian tự chỉnh" mục 3, áp dụng cho số) + nhập tự do. */
function ScoreStepper({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const { t } = useT('stats')
  function bump(dir: 1 | -1) {
    const parsed = Number(value)
    const base = value.trim() !== '' && Number.isFinite(parsed) ? parsed : 0
    const next = Math.max(0, base + dir * 1)
    onChange(String(next))
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label={t('scores.stepperDownAria')} className="stepper-btn" onClick={() => bump(-1)}>
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={1000}
        step={1}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="num w-full rounded-[10px] border border-rule bg-card px-3 py-2 text-center text-[16px] text-ink outline-none focus:border-teal"
      />
      <button type="button" aria-label={t('scores.stepperUpAria')} className="stepper-btn" onClick={() => bump(1)}>
        +
      </button>
    </div>
  )
}

/** Lỗi Zod → câu thân thiện theo ngôn ngữ đã chọn (dict 'stats', nhóm error.*). */
function scoreErrorMessage(field: string, lang: Lang = 'vi'): string {
  switch (field) {
    case 'score':
      return t(lang, 'stats', 'error.scoreRange')
    case 'label':
      return t(lang, 'stats', 'error.labelEmpty')
    case 'date':
      return t(lang, 'stats', 'error.dateInvalid')
    default:
      return t(lang, 'stats', 'error.generic')
  }
}

/**
 * Trang Sổ điểm (thay stub): form nhập điểm theo môn + đồ thị tiến bộ + sổ điểm.
 */
export default function ScoresPage() {
  const { t, lang } = useT('stats')
  const { subjects } = useSubjects()
  const activeSubjects = (subjects ?? []).filter((s) => !s.archived)
  const subjectById = (id: number) => (subjects ?? []).find((s) => s.id === id)
  const [scores, setScores] = useState<Score[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState<string>(() => todayISO())
  const [subjectId, setSubjectId] = useState(0)
  const [label, setLabel] = useState('')
  const [score, setScore] = useState('')
  const [note, setNote] = useState('')
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

  const points = useMemo<Point[]>(
    () =>
      [...scores]
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
        .slice(-MAX_POINTS)
        .map((s) => ({ date: s.date, score: s.score })),
    [scores],
  )
  const latest = points.length > 0 ? points[points.length - 1] : null

  const parsedScore = Number(score)
  const scorePreview = score.trim() !== '' && Number.isFinite(parsedScore) ? parsedScore : null

  async function reloadScores(): Promise<void> {
    setScores(await repos.scores.list())
  }

  async function handleSave(): Promise<void> {
    if (!Number.isFinite(parsedScore)) {
      setError(t('error.enterScore'))
      return
    }
    const payload = {
      date,
      subjectId,
      label: label.trim() || t('scores.defaultLabel'),
      score: parsedScore,
      note: note.trim(),
    }
    const parsed = scoreInputSchema.safeParse(payload)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      const field = firstIssue && firstIssue.path.length > 0 ? String(firstIssue.path[0]) : ''
      setError(scoreErrorMessage(field, lang))
      return
    }

    setError(null)
    setSaving(true)
    try {
      await repos.scores.create(parsed.data)
      await reloadScores()
      setLabel('')
      setScore('')
      setNote('')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(id: number): Promise<void> {
    if (!window.confirm(t('scores.removeConfirm'))) return
    await repos.scores.remove(id)
    await reloadScores()
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="section-label">{t('scores.pageLabel')}</p>
      <h1 className="type-display">{t('scores.title')}</h1>

      {/* Form nhập điểm */}
      <section className="paper-card px-4 py-4">
        <p className="section-label">{t('scores.formLabel')}</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label={t('scores.dateLabel')}>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="num w-full rounded-[10px] border border-rule bg-card px-3 py-2 text-[14px] text-ink outline-none focus:border-teal"
            />
          </Field>
          <Field label={t('scores.linkLabel')}>
            <input
              type="text"
              value={label}
              placeholder={t('scores.labelPlaceholder')}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 text-[14px] text-ink outline-none placeholder:text-muted focus:border-teal"
            />
          </Field>
        </div>

        <div className="mt-3">
          <span className="type-caption text-muted">{t('scores.subjectLabel')}</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
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

        <div className="mt-3 grid grid-cols-2 items-end gap-3">
          <Field label={t('scores.scoreLabel')}>
            <ScoreStepper value={score} onChange={setScore} placeholder="8" />
          </Field>
          <Field label={t('scores.noteLabel')}>
            <input
              type="text"
              value={note}
              placeholder={t('scores.notePlaceholder')}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 text-[14px] text-ink outline-none placeholder:text-muted focus:border-teal"
            />
          </Field>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="type-caption text-muted">{t('scores.savedCaption')}</p>
            <p className="num text-[28px] leading-[34px] text-ink">
              {scorePreview ?? '—'} <span className="text-[12px] text-muted">{t('unit.points')}</span>
            </p>
          </div>
          <PrimaryButton onClick={() => void handleSave()} disabled={saving || scorePreview === null}>
            {t('scores.saveButton')}
          </PrimaryButton>
        </div>
        {error && <p className="type-caption mt-2 text-coral">{error}</p>}
      </section>

      {/* Đồ thị tiến bộ */}
      <section className="paper-card px-4 py-4">
        <p className="section-label label-dot-butter">{t('scores.progressLabel')}</p>
        <p className="type-caption mt-0.5 text-muted">{t('scores.progressCaption')}</p>
        {loading ? (
          <p className="type-body mt-3 text-muted">{t('chart.loading')}</p>
        ) : points.length === 0 ? (
          <EmptyState message={t('scores.chartEmpty')} />
        ) : (
          <ScoreLineChart points={points} />
        )}
        {latest && (
          <p className="type-caption mt-2 text-muted">{t('scores.latestCaption', { score: latest.score, date: shortDate(latest.date) })}</p>
        )}
      </section>

      {/* Sổ điểm */}
      <section className="paper-card px-4 py-4">
        <p className="section-label">{t('scores.title')}</p>
        {loading ? (
          <p className="type-body mt-3 text-muted">{t('chart.loading')}</p>
        ) : scores.length === 0 ? (
          <EmptyState message={t('scores.listEmpty')} />
        ) : (
          <ul className="mt-2">
            {scores.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 border-b border-dashed border-rule py-2.5 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="type-body flex items-center gap-1.5 truncate font-medium">
                    {s.subjectId > 0 && (
                      <SubjectChip
                        name={subjectById(s.subjectId)?.name ?? t('subject.deleted')}
                        colorHex={subjectById(s.subjectId)?.colorHex}
                      />
                    )}
                    {s.label}
                  </p>
                  <p className="num type-caption text-muted">
                    {shortDate(s.date)}
                    {s.note ? ` · ${s.note}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="num text-[18px] text-ink">
                    {s.score} <span className="text-[11px] text-muted">{t('unit.points')}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleRemove(s.id!)}
                    className={cn('type-caption text-coral underline underline-offset-2')}
                  >
                    {t('scores.removeButton')}
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
