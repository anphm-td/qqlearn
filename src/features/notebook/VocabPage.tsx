import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { DangerButton, PrimaryButton, SecondaryButton } from '@/components/ui/buttons'
import EmptyState from '@/components/ui/EmptyState'
import Icon from '@/components/ui/Icon'
import PartChip from '@/components/ui/PartChip'
import { cn } from '@/components/ui/cn'
import { repos, todayISO } from '@data/index'
import { vocabInputSchema } from '@core/schemas'
import type { Vocab } from '@core/types'

import { inputCls, labelCls, PartPicker, SearchBox, textareaCls } from './bits'
import { preview } from './display'
import { filterVocab } from './filters'

/**
 * /sotay/tu-vung — Sổ từ vựng (B5 + B7): CRUD (word, meaning, example, part,
 * sourceTest) + tìm kiếm nhanh + chip Part; tạo từ tự tạo thẻ SRS hộp 1.
 * ≥768px master–detail (danh sách 340px trái + chi tiết phải — mục 10);
 * <768px điều hướng danh sách → chi tiết ngay trong trang (không đổi route).
 */
export default function VocabPage() {
  const [vocabs, setVocabs] = useState<Vocab[] | null>(null)
  const [query, setQuery] = useState('')
  const [part, setPart] = useState(0)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editing, setEditing] = useState<'new' | Vocab | null>(null)
  const [dueCount, setDueCount] = useState(0)
  const [loadError, setLoadError] = useState(false)

  const reload = useCallback(async () => {
    try {
      const [rows, due] = await Promise.all([
        repos.vocab.list(),
        repos.srs.listDue(todayISO()),
      ])
      setVocabs(rows)
      setDueCount(due.length)
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
    () => filterVocab(vocabs ?? [], { query, part }),
    [vocabs, query, part],
  )
  const selected = useMemo(
    () => vocabs?.find((v) => v.id === selectedId) ?? null,
    [vocabs, selectedId],
  )
  const paneOpen = editing != null || selected != null

  const saved = useCallback(
    async (id: number) => {
      setEditing(null)
      setSelectedId(id)
      await reload()
    },
    [reload],
  )

  const deleted = useCallback(async () => {
    setSelectedId(null)
    setEditing(null)
    await reload()
  }, [reload])

  return (
    <div className="flex flex-col gap-4">
      <p className="section-label">sổ tay · từ vựng</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-display">Từ vựng</h1>
        <Link to="/sotay/tu-vung/on-tap" className="btn btn-primary type-body">
          <Icon name="book" size={18} />
          Ôn tập · <span className="num">{dueCount}</span> thẻ
        </Link>
      </div>

      {/* B7 — tìm kiếm nhanh + chip Part */}
      <section className="paper-card flex flex-col gap-2.5 px-4 py-3" aria-label="Tìm và lọc từ">
        <SearchBox value={query} onChange={setQuery} placeholder="Tìm từ, nghĩa, ví dụ, đề…" />
        <PartPicker value={part} onChange={setPart} zeroLabel="Tất cả" />
      </section>

      <div className="grid gap-4 md:grid-cols-[340px_1fr] md:gap-6">
        {/* Danh sách — mobile ẩn khi mở chi tiết */}
        <div className={cn('flex-col gap-3 md:flex', paneOpen ? 'hidden' : 'flex')}>
          <PrimaryButton onClick={() => setEditing('new')}>
            <Icon name="plus" size={18} /> Thêm từ mới
          </PrimaryButton>

          {vocabs === null && !loadError && <p className="type-body text-muted">Đang mở sổ…</p>}

          {loadError && (
            <EmptyState
              message="Chưa mở được dữ liệu từ vựng — có thể server PC chưa chạy hoặc máy chưa đọc được sổ cục bộ."
              action={
                <PrimaryButton onClick={() => void reload()}>
                  <Icon name="study" size={16} /> Tải lại
                </PrimaryButton>
              }
            />
          )}

          {vocabs !== null && !loadError && filtered.length === 0 && vocabs.length === 0 && (
            <EmptyState
              message="Sổ từ vựng còn trống. Thêm từ đầu tiên — ví dụ “commute (v) — đi làm hằng ngày”."
              action={
                <PrimaryButton onClick={() => setEditing('new')}>
                  <Icon name="plus" size={18} /> Thêm từ
                </PrimaryButton>
              }
            />
          )}

          {vocabs !== null && !loadError && filtered.length === 0 && vocabs.length > 0 && (
            <p className="type-body text-muted">
              Không có từ nào khớp. Thử từ khoá khác hoặc bỏ chip Part.
            </p>
          )}

          {vocabs !== null &&
            !loadError &&
            filtered.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setSelectedId(v.id!)
                  setEditing(null)
                }}
                className={cn(
                  'paper-card w-full px-4 py-3 text-left transition-colors hover:border-teal',
                  v.id === selectedId && editing == null && 'border-teal',
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="type-h2">{v.word}</span>
                  {v.part > 0 && <PartChip part={v.part} />}
                </div>
                <p className="type-body text-muted">{preview(v.meaning || v.example, 70)}</p>
                {v.sourceTest && (
                  <p className="type-caption mt-1 text-muted">Nguồn: {v.sourceTest}</p>
                )}
              </button>
            ))}
        </div>

        {/* Chi tiết / form — desktop luôn hiển thị, mobile chỉ khi mở */}
        <div className={cn('flex-col gap-3 md:flex', paneOpen ? 'flex' : 'hidden')}>
          {editing != null ? (
            <VocabForm initial={editing === 'new' ? null : editing} onSaved={saved} onCancel={() => setEditing(null)} />
          ) : selected ? (
            <VocabDetail vocab={selected} onEdit={() => setEditing(selected)} onDeleted={deleted} onBack={() => setSelectedId(null)} />
          ) : (
            <EmptyState message="Chọn một từ ở danh sách bên trái để xem nghĩa, ví dụ và thẻ ôn tập." />
          )}
        </div>
      </div>
    </div>
  )
}

// ===== Form thêm/sửa từ (validate vocabInputSchema; tạo từ → tạo thẻ SRS) =====

interface VocabFormProps {
  initial: Vocab | null
  onSaved: (id: number) => Promise<void> | void
  onCancel: () => void
}

function VocabForm({ initial, onSaved, onCancel }: VocabFormProps) {
  const [word, setWord] = useState(initial?.word ?? '')
  const [meaning, setMeaning] = useState(initial?.meaning ?? '')
  const [example, setExample] = useState(initial?.example ?? '')
  const [part, setPart] = useState(initial?.part ?? 0)
  const [sourceTest, setSourceTest] = useState(initial?.sourceTest ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setError('')
    const parsed = vocabInputSchema.safeParse({
      word: word.trim(),
      meaning: meaning.trim(),
      example: example.trim(),
      part,
      sourceTest: sourceTest.trim(),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dữ liệu chưa hợp lệ.')
      return
    }
    setSaving(true)
    try {
      if (initial?.id != null) {
        await repos.vocab.update(initial.id, parsed.data)
        await onSaved(initial.id)
      } else {
        const created = await repos.vocab.create(parsed.data)
        // B5: mỗi từ mới có thẻ SRS hộp 1 — vào lịch ôn giãn cách ngay hôm nay
        await repos.srs.createForVocab(created.id!, todayISO())
        await onSaved(created.id!)
      }
    } catch {
      // Lỗi ghi (server PC ngắt / IndexedDB đầy…) — hiện thông báo, không nuốt im lặng.
      setError('Không lưu được từ — thử lại nhé.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="paper-card flex flex-col gap-3 px-4 py-4" aria-label="Thông tin từ">
      <div className="md:hidden">
        <SecondaryButton onClick={onCancel}>
          <Icon name="arrow-left" size={18} /> Danh sách
        </SecondaryButton>
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelCls} htmlFor="vocab-word">Từ</label>
        <input
          id="vocab-word"
          className={inputCls}
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="commute (v)"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelCls} htmlFor="vocab-meaning">Nghĩa</label>
        <input
          id="vocab-meaning"
          className={inputCls}
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          placeholder="đi làm hằng ngày"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelCls} htmlFor="vocab-example">Câu ví dụ</label>
        <textarea
          id="vocab-example"
          className={textareaCls}
          value={example}
          onChange={(e) => setExample(e.target.value)}
          placeholder="I commute to work by bike."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelCls}>Part liên quan</span>
        <PartPicker value={part} onChange={setPart} zeroLabel="không rõ" />
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelCls} htmlFor="vocab-source">Nguồn (đề nào)</label>
        <input
          id="vocab-source"
          className={inputCls}
          value={sourceTest}
          onChange={(e) => setSourceTest(e.target.value)}
          placeholder="ETS 2023 · Đề 2"
        />
      </div>

      {error && <p className="type-caption text-coral">{error}</p>}

      <div className="flex gap-2">
        <PrimaryButton onClick={() => void submit()} disabled={saving}>
          {saving ? 'Đang lưu…' : initial ? 'Lưu thay đổi' : 'Lưu vào sổ'}
        </PrimaryButton>
        <SecondaryButton onClick={onCancel}>Bỏ qua</SecondaryButton>
      </div>
    </section>
  )
}

// ===== Chi tiết 1 từ + trạng thái thẻ ôn + xoá (2 bước) =====

interface VocabDetailProps {
  vocab: Vocab
  onEdit: () => void
  onDeleted: () => Promise<void> | void
  onBack: () => void
}

function VocabDetail({ vocab, onEdit, onDeleted, onBack }: VocabDetailProps) {
  const [card, setCard] = useState<{ box: number; dueDate: string } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [removeError, setRemoveError] = useState('')

  useEffect(() => {
    setConfirming(false)
    if (vocab.id == null) return
    let alive = true
    repos.srs
      .getByVocab(vocab.id)
      .then((c) => {
        if (alive) setCard(c ? { box: c.box, dueDate: c.dueDate } : null)
      })
      .catch(() => {
        // Không đọc được thẻ — coi như chưa có, không treo chi tiết từ.
        if (alive) setCard(null)
      })
    return () => {
      alive = false
    }
  }, [vocab.id])

  const remove = async () => {
    if (vocab.id == null) return
    if (!confirming) {
      setConfirming(true)
      return
    }
    setRemoveError('')
    try {
      await repos.vocab.remove(vocab.id)
      // Xoá luôn thẻ SRS của từ — nếu không, thẻ mồ côi vẫn vào listDue làm
      // badge "Ôn tập" và card gợi ý đếm sai (thẻ mà không còn từ để ôn).
      await repos.srs.removeByVocab(vocab.id)
      await onDeleted()
    } catch {
      setConfirming(false)
      setRemoveError('Không xoá được từ — thử lại nhé.')
    }
  }

  return (
    <section className="paper-card flex flex-col gap-3 px-4 py-4" aria-label="Chi tiết từ">
      <div className="md:hidden">
        <SecondaryButton onClick={onBack}>
          <Icon name="arrow-left" size={18} /> Danh sách
        </SecondaryButton>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="type-h2">{vocab.word}</h2>
        {vocab.part > 0 && <PartChip part={vocab.part} />}
      </div>

      <p className="type-body">{vocab.meaning || <span className="text-muted">Chưa ghi nghĩa.</span>}</p>

      {vocab.example && (
        <p className="type-body text-muted">“{vocab.example}”</p>
      )}
      {vocab.sourceTest && (
        <p className="type-caption text-muted">Nguồn: {vocab.sourceTest}</p>
      )}

      <p className="type-caption text-muted">
        {card ? (
          <>
            Thẻ ôn tập: hộp <span className="num">{card.box}</span>/5 · đến hạn{' '}
            <span className="num">{card.dueDate}</span>
          </>
        ) : (
          'Chưa có thẻ ôn cho từ này — vào trang Ôn tập để tạo.'
        )}
      </p>

      <div className="flex gap-2">
        <SecondaryButton onClick={onEdit}>
          <Icon name="pen" size={18} /> Sửa
        </SecondaryButton>
        <DangerButton onClick={() => void remove()}>
          {confirming ? 'Chắc chắn xoá?' : 'Xoá từ'}
        </DangerButton>
      </div>
      {removeError && (
        <p className="type-caption text-coral" role="alert">
          {removeError}
        </p>
      )}
    </section>
  )
}
