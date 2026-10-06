import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { DangerButton, PrimaryButton, SecondaryButton } from '@/components/ui/buttons'
import EmptyState from '@/components/ui/EmptyState'
import Icon from '@/components/ui/Icon'
import SubjectChip from '@/components/ui/SubjectChip'
import { cn } from '@/components/ui/cn'
import { repos, todayISO } from '@data/index'
import { useSubjects } from '@data/useSubjects'
import { useT } from '@data/useT'
import { vocabInputSchema } from '@core/schemas'
import type { Vocab } from '@core/types'

import { inputCls, labelCls, SubjectPicker, SearchBox, textareaCls } from './bits'
import { preview } from './display'
import { filterVocab } from './filters'

/**
 * /sotay/tu-vung — Sổ từ vựng (B5 + B7): CRUD (word, meaning, example, môn,
 * sourceTest) + tìm kiếm nhanh + chip môn; tạo từ tự tạo thẻ SRS hộp 1.
 * ≥768px master–detail (danh sách 340px trái + chi tiết phải — mục 10);
 * <768px điều hướng danh sách → chi tiết ngay trong trang (không đổi route).
 * i18n: mọi chuỗi hiển thị qua useT('notebook') — dict ở src/core/i18n/dict/notebook.ts.
 */
export default function VocabPage() {
  const { t } = useT('notebook')
  const { subjects } = useSubjects()
  const activeSubjects = (subjects ?? []).filter((s) => !s.archived)
  const subjectById = (id: number) => (subjects ?? []).find((s) => s.id === id)
  const [vocabs, setVocabs] = useState<Vocab[] | null>(null)
  const [query, setQuery] = useState('')
  const [subjectId, setSubjectId] = useState(0)
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
    () => filterVocab(vocabs ?? [], { query, subjectId }),
    [vocabs, query, subjectId],
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
      <p className="section-label">{t('section.vocab')}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-display">{t('vocab.title')}</h1>
        <Link to="/sotay/tu-vung/on-tap" className="btn btn-primary type-body">
          <Icon name="book" size={18} />
          {t('vocab.reviewLink', { count: dueCount })}
        </Link>
      </div>

      {/* B7 — tìm kiếm nhanh + chip môn */}
      <section className="paper-card flex flex-col gap-2.5 px-4 py-3" aria-label={t('vocab.filterAria')}>
        <SearchBox value={query} onChange={setQuery} placeholder={t('vocab.searchPlaceholder')} />
        <SubjectPicker subjects={activeSubjects} value={subjectId} onChange={setSubjectId} zeroLabel={t('filter.all')} />
      </section>

      <div className="grid gap-4 md:grid-cols-[340px_1fr] md:gap-6">
        {/* Danh sách — mobile ẩn khi mở chi tiết */}
        <div className={cn('flex-col gap-3 md:flex', paneOpen ? 'hidden' : 'flex')}>
          <PrimaryButton onClick={() => setEditing('new')}>
            <Icon name="plus" size={18} /> {t('vocab.addNew')}
          </PrimaryButton>

          {vocabs === null && !loadError && <p className="type-body text-muted">{t('common.opening')}</p>}

          {loadError && (
            <EmptyState
              message={t('vocab.loadError')}
              action={
                <PrimaryButton onClick={() => void reload()}>
                  <Icon name="study" size={16} /> {t('common.reload')}
                </PrimaryButton>
              }
            />
          )}

          {vocabs !== null && !loadError && filtered.length === 0 && vocabs.length === 0 && (
            <EmptyState
              message={t('vocab.empty')}
              action={
                <PrimaryButton onClick={() => setEditing('new')}>
                  <Icon name="plus" size={18} /> {t('vocab.addOne')}
                </PrimaryButton>
              }
            />
          )}

          {vocabs !== null && !loadError && filtered.length === 0 && vocabs.length > 0 && (
            <p className="type-body text-muted">{t('vocab.noMatch')}</p>
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
                  {v.subjectId > 0 && subjects && (
                    <SubjectChip
                      name={subjectById(v.subjectId)?.name ?? t('common.deletedSubject')}
                      colorHex={subjectById(v.subjectId)?.colorHex}
                    />
                  )}
                </div>
                <p className="type-body text-muted">{preview(v.meaning || v.example, 70)}</p>
                {v.sourceTest && (
                  <p className="type-caption mt-1 text-muted">{t('vocab.source', { source: v.sourceTest })}</p>
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
            <EmptyState message={t('vocab.pickPrompt')} />
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
  const { t } = useT('notebook')
  const { subjects } = useSubjects()
  const activeSubjects = (subjects ?? []).filter((s) => !s.archived)
  const [word, setWord] = useState(initial?.word ?? '')
  const [meaning, setMeaning] = useState(initial?.meaning ?? '')
  const [example, setExample] = useState(initial?.example ?? '')
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? 0)
  const [sourceTest, setSourceTest] = useState(initial?.sourceTest ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setError('')
    const parsed = vocabInputSchema.safeParse({
      word: word.trim(),
      meaning: meaning.trim(),
      example: example.trim(),
      subjectId,
      sourceTest: sourceTest.trim(),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('common.invalidData'))
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
      setError(t('vocab.saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="paper-card flex flex-col gap-3 px-4 py-4" aria-label={t('vocab.formAria')}>
      <div className="md:hidden">
        <SecondaryButton onClick={onCancel}>
          <Icon name="arrow-left" size={18} /> {t('common.toList')}
        </SecondaryButton>
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelCls} htmlFor="vocab-word">{t('vocab.field.word')}</label>
        <input
          id="vocab-word"
          className={inputCls}
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder={t('vocab.placeholder.word')}
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelCls} htmlFor="vocab-meaning">{t('vocab.field.meaning')}</label>
        <input
          id="vocab-meaning"
          className={inputCls}
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          placeholder={t('vocab.placeholder.meaning')}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelCls} htmlFor="vocab-example">{t('vocab.field.example')}</label>
        <textarea
          id="vocab-example"
          className={textareaCls}
          value={example}
          onChange={(e) => setExample(e.target.value)}
          placeholder={t('vocab.placeholder.example')}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelCls}>{t('form.subject')}</span>
        <SubjectPicker subjects={activeSubjects} value={subjectId} onChange={setSubjectId} zeroLabel={t('form.unassigned')} />
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelCls} htmlFor="vocab-source">{t('vocab.field.source')}</label>
        <input
          id="vocab-source"
          className={inputCls}
          value={sourceTest}
          onChange={(e) => setSourceTest(e.target.value)}
          placeholder={t('vocab.placeholder.source')}
        />
      </div>

      {error && <p className="type-caption text-coral">{error}</p>}

      <div className="flex gap-2">
        <PrimaryButton onClick={() => void submit()} disabled={saving}>
          {saving ? t('common.saving') : initial ? t('common.saveChanges') : t('common.saveToNotebook')}
        </PrimaryButton>
        <SecondaryButton onClick={onCancel}>{t('common.cancel')}</SecondaryButton>
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
  const { t } = useT('notebook')
  const { subjects } = useSubjects()
  const subject = (subjects ?? []).find((s) => s.id === vocab.subjectId)
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
      setRemoveError(t('vocab.deleteError'))
    }
  }

  return (
    <section className="paper-card flex flex-col gap-3 px-4 py-4" aria-label={t('vocab.detailAria')}>
      <div className="md:hidden">
        <SecondaryButton onClick={onBack}>
          <Icon name="arrow-left" size={18} /> {t('common.toList')}
        </SecondaryButton>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="type-h2">{vocab.word}</h2>
        {vocab.subjectId > 0 && (
          <SubjectChip name={subject?.name ?? t('common.deletedSubject')} colorHex={subject?.colorHex} />
        )}
      </div>

      <p className="type-body">{vocab.meaning || <span className="text-muted">{t('vocab.noMeaning')}</span>}</p>

      {vocab.example && (
        <p className="type-body text-muted">“{vocab.example}”</p>
      )}
      {vocab.sourceTest && (
        <p className="type-caption text-muted">{t('vocab.source', { source: vocab.sourceTest })}</p>
      )}

      <p className="type-caption text-muted">
        {card
          ? t('vocab.cardStatus', { box: card.box, due: card.dueDate })
          : t('vocab.noCard')}
      </p>

      <div className="flex gap-2">
        <SecondaryButton onClick={onEdit}>
          <Icon name="pen" size={18} /> {t('common.edit')}
        </SecondaryButton>
        <DangerButton onClick={() => void remove()}>
          {confirming ? t('common.confirmDelete') : t('vocab.deleteWord')}
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
