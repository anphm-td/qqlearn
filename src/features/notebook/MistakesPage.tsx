import { useCallback, useEffect, useMemo, useState } from 'react'

import { DangerButton, PrimaryButton, SecondaryButton } from '@/components/ui/buttons'
import BubbleCheck from '@/components/ui/BubbleCheck'
import EmptyState from '@/components/ui/EmptyState'
import Icon from '@/components/ui/Icon'
import PartChip from '@/components/ui/PartChip'
import { cn } from '@/components/ui/cn'
import { repos } from '@data/index'
import { mistakeInputSchema } from '@core/schemas'
import type { Mistake } from '@core/types'

import { inputCls, labelCls, numOrZero, PartPicker, textareaCls } from './bits'
import { countUnreviewed, filterMistakes, type ReviewedFilter } from './filters'

/**
 * /sotay/loi-sai — Sổ lỗi sai luyện đề (B6): thêm lỗi (testNo, part, questionNo,
 * myAnswer, correctAnswer, cause, explanation), lọc chưa reviewed + Part, và
 * "màn xem lại" đánh dấu đã ôn (repos.mistakes.setReviewed).
 * ≥768px master–detail 340px + chi tiết (mục 10); <768px danh sách → chi tiết.
 */
type Mode = 'list' | 'review'

const CAUSES = ['từ vựng', 'ngữ pháp', 'đọc hiểu', 'chăm chú']

export default function MistakesPage() {
  const [mistakes, setMistakes] = useState<Mistake[] | null>(null)
  const [part, setPart] = useState(0)
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
    () => filterMistakes(mistakes ?? [], { part, reviewed }),
    [mistakes, part, reviewed],
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
      <p className="section-label">sổ tay · lỗi sai</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-display">Lỗi sai</h1>
        {mode === 'list' && (
          <PrimaryButton
            onClick={() => setMode('review')}
            disabled={unreviewedCount === 0}
            title={unreviewedCount === 0 ? 'Hết lỗi cần ôn rồi' : undefined}
          >
            <Icon name="book" size={18} /> Xem lại · còn <span className="num">{unreviewedCount}</span> lỗi
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
          {/* B6 — lọc chưa reviewed + Part */}
          <section className="paper-card flex flex-col gap-2.5 px-4 py-3" aria-label="Lọc lỗi sai">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Trạng thái ôn lại">
              {(
                [
                  ['all', 'Tất cả'],
                  ['unreviewed', 'Chưa ôn'],
                  ['reviewed', 'Đã ôn'],
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
            <PartPicker value={part} onChange={setPart} zeroLabel="Tất cả" />
          </section>

          <div className="grid gap-4 md:grid-cols-[340px_1fr] md:gap-6">
            {/* Danh sách — mobile ẩn khi mở chi tiết */}
            <div className={cn('flex-col gap-3 md:flex', paneOpen ? 'hidden' : 'flex')}>
              <PrimaryButton onClick={() => setAdding(true)}>
                <Icon name="plus" size={18} /> Ghi lỗi mới
              </PrimaryButton>

              {mistakes === null && !loadError && (
                <p className="type-body text-muted">Đang mở sổ…</p>
              )}

              {loadError && (
                <EmptyState
                  message="Chưa mở được dữ liệu lỗi sai — có thể server PC chưa chạy hoặc máy chưa đọc được sổ cục bộ."
                  action={
                    <PrimaryButton onClick={() => void reload()}>
                      <Icon name="study" size={16} /> Tải lại
                    </PrimaryButton>
                  }
                />
              )}

              {mistakes !== null && !loadError && filtered.length === 0 && (
                mistakes.length === 0 ? (
                  <EmptyState
                    message="Sổ lỗi sai còn trống. Sau mỗi đề, ghi lại câu sai kèm nguyên nhân để mai ôn lại."
                    action={
                      <PrimaryButton onClick={() => setAdding(true)}>
                        <Icon name="plus" size={18} /> Ghi lỗi đầu tiên
                      </PrimaryButton>
                    }
                  />
                ) : (
                  <p className="type-body text-muted">
                    Không có lỗi nào khớp bộ lọc. Thử bỏ chip Part hoặc đổi trạng thái ôn lại.
                  </p>
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
                        Đề {m.testNo} · Câu {m.questionNo}
                      </span>
                      <span className={cn('type-caption', m.reviewed ? 'text-muted' : 'text-coral')}>
                        {m.reviewed ? 'đã ôn' : 'chưa ôn'}
                      </span>
                    </div>
                    <p className="type-body">
                      {m.myAnswer || '—'} → {m.correctAnswer || '—'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {m.part > 0 && <PartChip part={m.part} />}
                      {m.cause && <span className="type-caption text-muted">{m.cause}</span>}
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
                <EmptyState message="Chọn một lỗi ở danh sách bên trái để xem đáp án và nguyên nhân." />
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
  const [testNo, setTestNo] = useState(initial ? String(initial.testNo) : '')
  const [part, setPart] = useState(initial?.part ?? 0)
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
      part,
      questionNo: numOrZero(questionNo),
      myAnswer: myAnswer.trim(),
      correctAnswer: correctAnswer.trim(),
      cause: cause.trim(),
      explanation: explanation.trim(),
      reviewed: initial?.reviewed ?? false,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dữ liệu chưa hợp lệ.')
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
    <section className="paper-card flex flex-col gap-3 px-4 py-4" aria-label={editing ? 'Sửa lỗi sai' : 'Ghi lỗi sai'}>
      <div className="md:hidden">
        <SecondaryButton onClick={onCancel}>
          <Icon name="arrow-left" size={18} /> Danh sách
        </SecondaryButton>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelCls} htmlFor="mk-test">Số đề</label>
          <input
            id="mk-test"
            className={inputCls}
            type="number"
            inputMode="numeric"
            min={0}
            value={testNo}
            onChange={(e) => setTestNo(e.target.value)}
            placeholder="0 — không rõ"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls} htmlFor="mk-q">Câu số</label>
          <input
            id="mk-q"
            className={inputCls}
            type="number"
            inputMode="numeric"
            min={0}
            value={questionNo}
            onChange={(e) => setQuestionNo(e.target.value)}
            placeholder="vd. 87"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelCls}>Part</span>
        <PartPicker value={part} onChange={setPart} zeroLabel="không rõ" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelCls} htmlFor="mk-my">Bạn chọn</label>
          <input
            id="mk-my"
            className={inputCls}
            value={myAnswer}
            onChange={(e) => setMyAnswer(e.target.value)}
            placeholder="B"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls} htmlFor="mk-correct">Đáp án đúng</label>
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
        <span className={labelCls}>Nguyên nhân</span>
        <div className="flex flex-wrap gap-1.5">
          {CAUSES.map((c) => (
            <button
              key={c}
              type="button"
              className={cn('part-chip', cause === c && 'part-chip--active')}
              aria-pressed={cause === c}
              onClick={() => setCause(cause === c ? '' : c)}
            >
              {c}
            </button>
          ))}
        </div>
        <input
          className={inputCls}
          value={cause}
          onChange={(e) => setCause(e.target.value)}
          placeholder="hoặc ghi nguyên nhân khác"
          aria-label="Nguyên nhân khác"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelCls} htmlFor="mk-expl">Giải thích ngắn</label>
        <textarea
          id="mk-expl"
          className={textareaCls}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Sai vì nhầm “although” với “despite”…"
        />
      </div>

      {error && <p className="type-caption text-coral">{error}</p>}

      <div className="flex gap-2">
        <PrimaryButton onClick={() => void submit()} disabled={saving}>
          {saving ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Lưu vào sổ'}
        </PrimaryButton>
        <SecondaryButton onClick={onCancel}>Bỏ qua</SecondaryButton>
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
    <section className="paper-card flex flex-col gap-3 px-4 py-4" aria-label="Chi tiết lỗi sai">
      <div className="md:hidden">
        <SecondaryButton onClick={onBack}>
          <Icon name="arrow-left" size={18} /> Danh sách
        </SecondaryButton>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="num">
          Đề {mistake.testNo} · Câu {mistake.questionNo}
        </p>
        {mistake.part > 0 && <PartChip part={mistake.part} />}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <p className="type-body text-coral">
          Bạn chọn: <span className="num">{mistake.myAnswer || '—'}</span>
        </p>
        <p className="type-body text-teal">
          Đáp án đúng: <span className="num">{mistake.correctAnswer || '—'}</span>
        </p>
      </div>

      {mistake.cause && <p className="type-body">Nguyên nhân: {mistake.cause}</p>}
      {mistake.explanation && <p className="type-body text-muted">{mistake.explanation}</p>}

      <div className="flex items-center gap-3">
        <BubbleCheck
          checked={mistake.reviewed}
          onChange={onToggleReviewed}
          label="Đã ôn lại lỗi này"
        />
        <span className="type-body">{mistake.reviewed ? 'Đã ôn lại' : 'Chưa ôn lại'}</span>
      </div>

      <div className="flex gap-2">
        {mistake.id != null && (
          <SecondaryButton onClick={() => setEditing(true)}>
            <Icon name="pen" size={16} /> Sửa lỗi
          </SecondaryButton>
        )}
        <DangerButton onClick={() => void remove()}>
          {confirming ? 'Chắc chắn xoá?' : 'Xoá lỗi'}
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
  // Chốt danh sách lúc vào màn — khi đánh dấu "đã ôn", lỗi rời queue của parent
  // nhưng trình tự xem lại không bị dịch (không bỏ sót lỗi).
  const [items] = useState<Mistake[]>(queue)
  const [idx, setIdx] = useState(0)
  const done = idx >= items.length
  const current = items[idx]

  const advance = () => setIdx((i) => i + 1)

  return (
    <section className="flex flex-col gap-4" aria-label="Xem lại lỗi sai">
      {!done && (
        <p className="type-caption text-muted">
          lỗi <span className="num">{idx + 1}</span>/<span className="num">{items.length}</span>
        </p>
      )}

      {done ? (
        <div className="paper-card flex flex-col items-center gap-2 px-4 py-6 text-center">
          <p className="type-h2">Hết lỗi cần ôn rồi!</p>
          <p className="type-body text-muted">Giữ nhịp này nhé — mai quay lại ôn tiếp.</p>
          <PrimaryButton onClick={onExit} className="mt-2">
            Về danh sách
          </PrimaryButton>
        </div>
      ) : (
        current && (
          <div className="paper-card flex flex-col gap-3 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="num">
                Đề {current.testNo} · Câu {current.questionNo}
              </p>
              {current.part > 0 && <PartChip part={current.part} />}
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <p className="type-body text-coral">
                Bạn chọn: <span className="num">{current.myAnswer || '—'}</span>
              </p>
              <p className="type-body text-teal">
                Đáp án đúng: <span className="num">{current.correctAnswer || '—'}</span>
              </p>
            </div>

            {current.cause && <p className="type-body">Nguyên nhân: {current.cause}</p>}
            {current.explanation && <p className="type-body text-muted">{current.explanation}</p>}

            <div className="flex flex-wrap gap-2">
              <PrimaryButton
                onClick={() => {
                  onReviewed(current)
                  advance()
                }}
              >
                Đã ôn lại — lỗi kế
              </PrimaryButton>
              <SecondaryButton onClick={advance}>Bỏ qua</SecondaryButton>
              <SecondaryButton onClick={onExit}>Thoát</SecondaryButton>
            </div>
          </div>
        )
      )}
    </section>
  )
}
