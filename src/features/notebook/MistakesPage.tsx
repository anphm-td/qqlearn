import { useCallback, useEffect, useMemo, useState } from 'react'

import { DangerButton, PrimaryButton, SecondaryButton } from '@/components/ui/buttons'
import BubbleCheck from '@/components/ui/BubbleCheck'
import EmptyState from '@/components/ui/EmptyState'
import Icon from '@/components/ui/Icon'
import SubjectChip from '@/components/ui/SubjectChip'
import { cn } from '@/components/ui/cn'
import { repos } from '@data/index'
import { useSubjects } from '@data/useSubjects'
import { useT, type UseTResult } from '@data/useT'
import { mistakeInputSchema } from '@core/schemas'
import type { Mistake } from '@core/types'

import { inputCls, labelCls, numOrZero, SubjectPicker, textareaCls } from './bits'
import { countUnreviewed, filterMistakes, type ReviewedFilter } from './filters'

/**
 * /sotay/loi-sai — Sổ lỗi sai (B6): thêm lỗi (testNo, môn, questionNo,
 * myAnswer, correctAnswer, cause, explanation), lọc chưa reviewed + môn, và
 * "màn xem lại" đánh dấu đã ôn (repos.mistakes.setReviewed).
 * ≥768px master–detail 340px + chi tiết (mục 10); <768px danh sách → chi tiết.
 * i18n: mọi chuỗi hiển thị qua useT('notebook') — dict ở src/core/i18n/dict/notebook.ts.
 */
type Mode = 'list' | 'review'

/**
 * Nguyên nhân lỗi đặt sẵn: `value` là dữ liệu LƯU DB (giữ nguyên vi — không dịch
 * dữ liệu), `key` là key hiển thị đã dịch theo ngôn ngữ hiện tại.
 */
const CAUSES: ReadonlyArray<{ value: string; key: string }> = [
  { value: 'từ vựng', key: 'cause.vocab' },
  { value: 'ngữ pháp', key: 'cause.grammar' },
  { value: 'đọc hiểu', key: 'cause.reading' },
  { value: 'chăm chú', key: 'cause.focus' },
]

/** Nhãn hiển thị của 1 nguyên nhân: đặt sẵn → dịch; người dùng tự ghi → nguyên văn. */
function causeLabel(t: UseTResult['t'], cause: string): string {
  const hit = CAUSES.find((c) => c.value === cause)
  return hit ? t(hit.key) : cause
}

export default function MistakesPage() {
  const { t } = useT('notebook')
  const { subjects } = useSubjects()
  const activeSubjects = (subjects ?? []).filter((s) => !s.archived)
  const subjectById = (id: number) => (subjects ?? []).find((s) => s.id === id)
  const [mistakes, setMistakes] = useState<Mistake[] | null>(null)
  const [subjectId, setSubjectId] = useState(0)
  const [reviewed, setReviewed] = useState<ReviewedFilter>('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [mode, setMode] = useState<Mode>('list')
  const [loadError, setLoadError] = useState(false)

  const reload = useCallback(async () => {
    try {
      setMistakes(await repos.mistakes.list())
      setLoadError(false)
    } catch {
      // Server PC không trạm được / IndexedDB lỗi — không treo "Đang mở sổ…" vĩnh viễn.
      setLoadError(true)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const filtered = useMemo(
    () => filterMistakes(mistakes ?? [], { subjectId, reviewed }),
    [mistakes, subjectId, reviewed],
  )
  const selected = useMemo(
    () => mistakes?.find((m) => m.id === selectedId) ?? null,
    [mistakes, selectedId],
  )
  const unreviewedCount = useMemo(() => countUnreviewed(mistakes ?? []), [mistakes])
  const paneOpen = adding || selected != null || mode === 'review'

  const created = useCallback(
    async (id: number) => {
      setAdding(false)
      setSelectedId(id)
      await reload()
    },
    [reload],
  )

  const deleted = useCallback(async () => {
    setSelectedId(null)
    setAdding(false)
    await reload()
  }, [reload])

  const toggleReviewed = useCallback(
    async (m: Mistake, next: boolean) => {
      if (m.id == null) return
      await repos.mistakes.setReviewed(m.id, next)
      setMistakes((rows) => rows?.map((r) => (r.id === m.id ? { ...r, reviewed: next } : r)) ?? rows)
    },
    [],
  )

  return (
    <div className="flex flex-col gap-4">
      <p className="section-label">{t('section.mistakes')}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-display">{t('mistakes.title')}</h1>
        {mode === 'list' && (
          <PrimaryButton
            onClick={() => setMode('review')}
            disabled={unreviewedCount === 0}
            title={unreviewedCount === 0 ? t('mistakes.allReviewedTitle') : undefined}
          >
            <Icon name="book" size={18} /> {t('mistakes.reviewButton', { count: unreviewedCount })}
          </PrimaryButton>
        )}
      </div>

      {mode === 'review' ? (
        <ReviewSession
          queue={filtered.filter((m) => !m.reviewed)}
          onReviewed={(m) => void toggleReviewed(m, true)}
          onExit={() => setMode('list')}
        />
      ) : (
        <>
          {/* B6 — lọc chưa reviewed + môn */}
          <section className="paper-card flex flex-col gap-2.5 px-4 py-3" aria-label={t('mistakes.filterAria')}>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('mistakes.statusAria')}>
              {(
                [
                  ['all', t('filter.all')],
                  ['unreviewed', t('filter.unreviewed')],
                  ['reviewed', t('filter.reviewed')],
                ] as const
              ).map(([value, lbl]) => (
                <button
                  key={value}
                  type="button"
                  className={cn('part-chip', reviewed === value && 'part-chip--active')}
                  aria-pressed={reviewed === value}
                  onClick={() => setReviewed(value)}
                >
                  {lbl}
                </button>
              ))}
            </div>
            <SubjectPicker subjects={activeSubjects} value={subjectId} onChange={setSubjectId} zeroLabel={t('filter.all')} />
          </section>

          <div className="grid gap-4 md:grid-cols-[340px_1fr] md:gap-6">
            {/* Danh sách — mobile ẩn khi mở chi tiết */}
            <div className={cn('flex-col gap-3 md:flex', paneOpen ? 'hidden' : 'flex')}>
              <PrimaryButton onClick={() => setAdding(true)}>
                <Icon name="plus" size={18} /> {t('mistakes.addNew')}
              </PrimaryButton>

              {mistakes === null && !loadError && (
                <p className="type-body text-muted">{t('common.opening')}</p>
              )}

              {loadError && (
                <EmptyState
                  message={t('mistakes.loadError')}
                  action={
                    <PrimaryButton onClick={() => void reload()}>
                      <Icon name="study" size={16} /> {t('common.reload')}
                    </PrimaryButton>
                  }
                />
              )}

              {mistakes !== null && !loadError && filtered.length === 0 && (
                mistakes.length === 0 ? (
                  <EmptyState
                    message={t('mistakes.empty')}
                    action={
                      <PrimaryButton onClick={() => setAdding(true)}>
                        <Icon name="plus" size={18} /> {t('mistakes.addFirst')}
                      </PrimaryButton>
                    }
                  />
                ) : (
                  <p className="type-body text-muted">{t('mistakes.noMatch')}</p>
                )
              )}

              {mistakes !== null && !loadError && filtered.length > 0 && (
                filtered.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(m.id!)
                      setAdding(false)
                    }}
                    className={cn(
                      'paper-card w-full px-4 py-3 text-left transition-colors hover:border-teal',
                      m.id === selectedId && !adding && 'border-teal',
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="num">
                        {t('mistakes.testQuestion', { testNo: m.testNo, questionNo: m.questionNo })}
                      </span>
                      <span className={cn('type-caption', m.reviewed ? 'text-muted' : 'text-coral')}>
                        {m.reviewed ? t('mistakes.badge.reviewed') : t('mistakes.badge.unreviewed')}
                      </span>
                    </div>
                    <p className="type-body">
                      {m.myAnswer || '—'} → {m.correctAnswer || '—'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {m.subjectId > 0 && (
                        <SubjectChip
                          name={subjectById(m.subjectId)?.name ?? t('common.deletedSubject')}
                          colorHex={subjectById(m.subjectId)?.colorHex}
                        />
                      )}
                      {m.cause && <span className="type-caption text-muted">{causeLabel(t, m.cause)}</span>}
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Chi tiết / form — desktop luôn hiển thị, mobile chỉ khi mở */}
            <div className={cn('flex-col gap-3 md:flex', paneOpen ? 'flex' : 'hidden')}>
              {adding ? (
                <MistakeForm onSaved={created} onCancel={() => setAdding(false)} />
              ) : selected ? (
                <MistakeDetail
                  mistake={selected}
                  onToggleReviewed={(next) => void toggleReviewed(selected, next)}
                  onDeleted={deleted}
                  onUpdated={reload}
                  onBack={() => setSelectedId(null)}
                />
              ) : (
                <EmptyState message={t('mistakes.pickPrompt')} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ===== Form ghi/sửa lỗi (validate mistakeInputSchema) =====

interface MistakeFormProps {
  /** Có sẵn → sửa lỗi này (repos.mistakes.update); không có → ghi lỗi mới. */
  initial?: Mistake
  onSaved: (id: number) => Promise<void> | void
  onCancel: () => void
}

function MistakeForm({ initial, onSaved, onCancel }: MistakeFormProps) {
  const { t } = useT('notebook')
  const { subjects } = useSubjects()
  const activeSubjects = (subjects ?? []).filter((s) => !s.archived)
  const [testNo, setTestNo] = useState(initial ? String(initial.testNo) : '')
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? 0)
  const [questionNo, setQuestionNo] = useState(initial ? String(initial.questionNo) : '')
  const [myAnswer, setMyAnswer] = useState(initial?.myAnswer ?? '')
  const [correctAnswer, setCorrectAnswer] = useState(initial?.correctAnswer ?? '')
  const [cause, setCause] = useState(initial?.cause ?? '')
  const [explanation, setExplanation] = useState(initial?.explanation ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setError('')
    const parsed = mistakeInputSchema.safeParse({
      testNo: numOrZero(testNo),
      subjectId,
      questionNo: numOrZero(questionNo),
      myAnswer: myAnswer.trim(),
      correctAnswer: correctAnswer.trim(),
      cause: cause.trim(),
      explanation: explanation.trim(),
      reviewed: initial?.reviewed ?? false,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('common.invalidData'))
      return
    }
    setSaving(true)
    try {
      if (initial?.id != null) {
        await repos.mistakes.update(initial.id, parsed.data)
        await onSaved(initial.id)
      } else {
        const createdRow = await repos.mistakes.create(parsed.data)
        await onSaved(createdRow.id!)
      }
    } finally {
      setSaving(false)
    }
  }

  const editing = initial?.id != null

  return (
    <section className="paper-card flex flex-col gap-3 px-4 py-4" aria-label={editing ? t('mistakes.formEditAria') : t('mistakes.formAddAria')}>
      <div className="md:hidden">
        <SecondaryButton onClick={onCancel}>
          <Icon name="arrow-left" size={18} /> {t('common.toList')}
        </SecondaryButton>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelCls} htmlFor="mk-test">{t('mistakes.field.testNo')}</label>
          <input
            id="mk-test"
            className={inputCls}
            type="number"
            inputMode="numeric"
            min={0}
            value={testNo}
            onChange={(e) => setTestNo(e.target.value)}
            placeholder={t('mistakes.placeholder.testNo')}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls} htmlFor="mk-q">{t('mistakes.field.questionNo')}</label>
          <input
            id="mk-q"
            className={inputCls}
            type="number"
            inputMode="numeric"
            min={0}
            value={questionNo}
            onChange={(e) => setQuestionNo(e.target.value)}
            placeholder={t('mistakes.placeholder.questionNo')}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelCls}>{t('form.subject')}</span>
        <SubjectPicker subjects={activeSubjects} value={subjectId} onChange={setSubjectId} zeroLabel={t('form.unassigned')} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelCls} htmlFor="mk-my">{t('mistakes.field.myAnswer')}</label>
          <input
            id="mk-my"
            className={inputCls}
            value={myAnswer}
            onChange={(e) => setMyAnswer(e.target.value)}
            placeholder="B"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls} htmlFor="mk-correct">{t('mistakes.field.correctAnswer')}</label>
          <input
            id="mk-correct"
            className={inputCls}
            value={correctAnswer}
            onChange={(e) => setCorrectAnswer(e.target.value)}
            placeholder="D"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelCls}>{t('mistakes.field.cause')}</span>
        <div className="flex flex-wrap gap-1.5">
          {CAUSES.map((c) => (
            <button
              key={c.value}
              type="button"
              className={cn('part-chip', cause === c.value && 'part-chip--active')}
              aria-pressed={cause === c.value}
              onClick={() => setCause(cause === c.value ? '' : c.value)}
            >
              {t(c.key)}
            </button>
          ))}
        </div>
        <input
          className={inputCls}
          value={cause}
          onChange={(e) => setCause(e.target.value)}
          placeholder={t('mistakes.placeholder.causeOther')}
          aria-label={t('mistakes.causeOtherAria')}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelCls} htmlFor="mk-expl">{t('mistakes.field.explanation')}</label>
        <textarea
          id="mk-expl"
          className={textareaCls}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder={t('mistakes.placeholder.explanation')}
        />
      </div>

      {error && <p className="type-caption text-coral">{error}</p>}

      <div className="flex gap-2">
        <PrimaryButton onClick={() => void submit()} disabled={saving}>
          {saving ? t('common.saving') : editing ? t('common.saveChanges') : t('common.saveToNotebook')}
        </PrimaryButton>
        <SecondaryButton onClick={onCancel}>{t('common.cancel')}</SecondaryButton>
      </div>
    </section>
  )
}

// ===== Chi tiết 1 lỗi: sửa nội dung + đánh dấu đã ôn (BubbleCheck) + xoá 2 bước =====

interface MistakeDetailProps {
  mistake: Mistake
  onToggleReviewed: (next: boolean) => void
  onDeleted: () => Promise<void> | void
  /** Gọi sau khi lưu thay đổi nội dung để danh sách nạp lại. */
  onUpdated: () => Promise<void> | void
  onBack: () => void
}

function MistakeDetail({ mistake, onToggleReviewed, onDeleted, onUpdated, onBack }: MistakeDetailProps) {
  const { t } = useT('notebook')
  const { subjects } = useSubjects()
  const subject = (subjects ?? []).find((s) => s.id === mistake.subjectId)
  const [confirming, setConfirming] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setConfirming(false)
    setEditing(false)
  }, [mistake.id])

  if (editing && mistake.id != null) {
    return (
      <MistakeForm
        initial={mistake}
        onSaved={async () => {
          setEditing(false)
          await onUpdated()
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  const remove = async () => {
    if (mistake.id == null) return
    if (!confirming) {
      setConfirming(true)
      return
    }
    await repos.mistakes.remove(mistake.id)
    await onDeleted()
  }

  return (
    <section className="paper-card flex flex-col gap-3 px-4 py-4" aria-label={t('mistakes.detailAria')}>
      <div className="md:hidden">
        <SecondaryButton onClick={onBack}>
          <Icon name="arrow-left" size={18} /> {t('common.toList')}
        </SecondaryButton>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="num">
          {t('mistakes.testQuestion', { testNo: mistake.testNo, questionNo: mistake.questionNo })}
        </p>
        {mistake.subjectId > 0 && (
          <SubjectChip name={subject?.name ?? t('common.deletedSubject')} colorHex={subject?.colorHex} />
        )}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <p className="type-body text-coral">
          {t('mistakes.myAnswerLine', { answer: mistake.myAnswer || '—' })}
        </p>
        <p className="type-body text-teal">
          {t('mistakes.correctAnswerLine', { answer: mistake.correctAnswer || '—' })}
        </p>
      </div>

      {mistake.cause && <p className="type-body">{t('mistakes.causeLine', { cause: causeLabel(t, mistake.cause) })}</p>}
      {mistake.explanation && <p className="type-body text-muted">{mistake.explanation}</p>}

      <div className="flex items-center gap-3">
        <BubbleCheck
          checked={mistake.reviewed}
          onChange={onToggleReviewed}
          label={t('mistakes.reviewedCheckbox')}
        />
        <span className="type-body">
          {mistake.reviewed ? t('mistakes.state.reviewed') : t('mistakes.state.unreviewed')}
        </span>
      </div>

      <div className="flex gap-2">
        {mistake.id != null && (
          <SecondaryButton onClick={() => setEditing(true)}>
            <Icon name="pen" size={16} /> {t('mistakes.edit')}
          </SecondaryButton>
        )}
        <DangerButton onClick={() => void remove()}>
          {confirming ? t('common.confirmDelete') : t('mistakes.delete')}
        </DangerButton>
      </div>
    </section>
  )
}

// ===== Màn xem lại: lướt qua các lỗi chưa ôn, đánh dấu sau mỗi lỗi =====

interface ReviewSessionProps {
  queue: Mistake[]
  onReviewed: (m: Mistake) => void
  onExit: () => void
}

function ReviewSession({ queue, onReviewed, onExit }: ReviewSessionProps) {
  const { t } = useT('notebook')
  const { subjects } = useSubjects()
  const subjectById = (id: number) => (subjects ?? []).find((s) => s.id === id)
  // Chốt danh sách lúc vào màn — khi đánh dấu "đã ôn", lỗi rời queue của parent
  // nhưng trình tự xem lại không bị dịch (không bỏ sót lỗi).
  const [items] = useState<Mistake[]>(queue)
  const [idx, setIdx] = useState(0)
  const done = idx >= items.length
  const current = items[idx]

  const advance = () => setIdx((i) => i + 1)

  return (
    <section className="flex flex-col gap-4" aria-label={t('mistakes.reviewSessionAria')}>
      {!done && (
        <p className="type-caption text-muted">
          {t('mistakes.reviewCounter', { current: idx + 1, total: items.length })}
        </p>
      )}

      {done ? (
        <div className="paper-card flex flex-col items-center gap-2 px-4 py-6 text-center">
          <p className="type-h2">{t('mistakes.done.title')}</p>
          <p className="type-body text-muted">{t('mistakes.done.body')}</p>
          <PrimaryButton onClick={onExit} className="mt-2">
            {t('mistakes.backToList')}
          </PrimaryButton>
        </div>
      ) : (
        current && (
          <div className="paper-card flex flex-col gap-3 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="num">
                {t('mistakes.testQuestion', { testNo: current.testNo, questionNo: current.questionNo })}
              </p>
              {current.subjectId > 0 && (
                <SubjectChip
                  name={subjectById(current.subjectId)?.name ?? t('common.deletedSubject')}
                  colorHex={subjectById(current.subjectId)?.colorHex}
                />
              )}
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <p className="type-body text-coral">
                {t('mistakes.myAnswerLine', { answer: current.myAnswer || '—' })}
              </p>
              <p className="type-body text-teal">
                {t('mistakes.correctAnswerLine', { answer: current.correctAnswer || '—' })}
              </p>
            </div>

            {current.cause && <p className="type-body">{t('mistakes.causeLine', { cause: causeLabel(t, current.cause) })}</p>}
            {current.explanation && <p className="type-body text-muted">{current.explanation}</p>}

            <div className="flex flex-wrap gap-2">
              <PrimaryButton
                onClick={() => {
                  onReviewed(current)
                  advance()
                }}
              >
                {t('mistakes.markReviewedNext')}
              </PrimaryButton>
              <SecondaryButton onClick={advance}>{t('common.skip')}</SecondaryButton>
              <SecondaryButton onClick={onExit}>{t('common.exit')}</SecondaryButton>
            </div>
          </div>
        )
      )}
    </section>
  )
}
