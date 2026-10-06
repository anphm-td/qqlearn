import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Link } from 'react-router-dom'

import { DangerButton, SecondaryButton } from '@/components/ui/buttons'
import EmptyState from '@/components/ui/EmptyState'
import Icon from '@/components/ui/Icon'
import NoteCard from '@/components/ui/NoteCard'
import SubjectChip from '@/components/ui/SubjectChip'
import { cn } from '@/components/ui/cn'
import { repos } from '@data/index'
import { useSubjects } from '@data/useSubjects'
import { useT } from '@data/useT'
import type { DailyNote, Photo } from '@core/types'

import { SubjectPicker, SearchBox } from './bits'
import { formatDateVN, preview } from './display'
import { filterNotes } from './filters'
import { useNotePhotos } from './useNotePhotos'

/**
 * /sotay — Sổ tay (B7 + B8): kho ghi chú cuối ngày, tìm kiếm nhanh + lọc theo môn,
 * xem lại ghi chú kèm ảnh trang sách/đề (ảnh lưu bảng photos, id gắn vào
 * dailyNotes.photoIds qua useNotePhotos). ≥768px master–detail (mục 10);
 * <768px danh sách → chi tiết trong trang (không đổi route).
 * i18n: mọi chuỗi hiển thị qua useT('notebook') — dict ở src/core/i18n/dict/notebook.ts.
 */
export default function NotebookPage() {
  const { t, lang } = useT('notebook')
  const { subjects } = useSubjects()
  const activeSubjects = (subjects ?? []).filter((s) => !s.archived)
  const subjectById = (id: number) => (subjects ?? []).find((s) => s.id === id)
  const [notes, setNotes] = useState<DailyNote[] | null>(null)
  const [query, setQuery] = useState('')
  const [subjectId, setSubjectId] = useState(0)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const reload = useCallback(async () => {
    // NoteRepo không có listAll — lấy toàn bộ kho bằng khoảng ngày phủ hết
    const rows = await repos.notes.listBetween('0000-01-01', '9999-12-31')
    rows.sort((a, b) => b.date.localeCompare(a.date))
    setNotes(rows)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const filtered = useMemo(
    () => filterNotes(notes ?? [], { query, subjectId }),
    [notes, query, subjectId],
  )
  const selected = useMemo(
    () => notes?.find((n) => n.date === selectedDate) ?? null,
    [notes, selectedDate],
  )
  const paneOpen = selected != null

  return (
    <div className="flex flex-col gap-4">
      <p className="section-label">{t('section.notebook')}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-display">{t('notebook.title')}</h1>
        <div className="flex flex-wrap gap-2">
          <Link to="/sotay/tu-vung" className="btn btn-secondary type-body">
            <Icon name="book" size={18} /> {t('vocab.title')}
          </Link>
          <Link to="/sotay/loi-sai" className="btn btn-secondary type-body">
            <Icon name="pen" size={18} /> {t('mistakes.title')}
          </Link>
          <Link to="/mon-hoc" className="btn btn-secondary type-body">
            <Icon name="star" size={18} /> {t('notebook.link.subjects')}
          </Link>
        </div>
      </div>

      {/* B7 — tìm kiếm nhanh + lọc theo môn cho ghi chú */}
      <section className="paper-card flex flex-col gap-2.5 px-4 py-3" aria-label={t('notes.filterAria')}>
        <SearchBox value={query} onChange={setQuery} placeholder={t('notes.searchPlaceholder')} />
        <SubjectPicker subjects={activeSubjects} value={subjectId} onChange={setSubjectId} zeroLabel={t('filter.all')} />
      </section>

      <div className="grid gap-4 md:grid-cols-[340px_1fr] md:gap-6">
        {/* Danh sách note — mobile ẩn khi mở chi tiết */}
        <div className={cn('flex-col gap-3 md:flex', paneOpen ? 'hidden' : 'flex')}>
          {notes === null ? (
            <p className="type-body text-muted">{t('common.opening')}</p>
          ) : filtered.length === 0 ? (
            notes.length === 0 ? (
              <EmptyState
                message={t('notes.empty')}
                action={
                  <Link to="/ghichu" className="btn btn-primary type-body">
                    {t('notes.writeToday')}
                  </Link>
                }
              />
            ) : (
              <p className="type-body text-muted">{t('notes.noMatch')}</p>
            )
          ) : (
            filtered.map((n) => {
              const firstSubject = n.partStudied.length > 0 ? subjectById(n.partStudied[0]!) : undefined
              return (
                <NoteCard
                  key={n.date}
                  washiHex={firstSubject?.colorHex}
                  subject={firstSubject?.name ?? (n.partStudied.length > 0 ? t('common.deletedSubject') : undefined)}
                  title={formatDateVN(n.date, undefined, lang)}
                  tag={n.newWords > 0 ? t('notes.tagNewWords', { count: n.newWords }) : undefined}
                  time={n.photoIds.length > 0 ? t('notes.tagPhotos', { count: n.photoIds.length }) : undefined}
                  onClick={() => setSelectedDate(n.date)}
                  className={cn('text-left', n.date === selectedDate && 'border-teal')}
                >
                  {preview(n.reflection || n.mistakesSummary || t('notes.emptyPreview'), 90)}
                </NoteCard>
              )
            })
          )}
        </div>

        {/* Chi tiết ghi chú + ảnh đính kèm — desktop luôn hiển thị, mobile chỉ khi mở */}
        <div className={cn('flex-col gap-3 md:flex', paneOpen ? 'flex' : 'hidden')}>
          {selected ? (
            <NoteDetail note={selected} onBack={() => setSelectedDate(null)} onPhotosChanged={reload} />
          ) : (
            <EmptyState message={t('notes.pickPrompt')} />
          )}
        </div>
      </div>
    </div>
  )
}

// ===== Chi tiết 1 ghi chú: nội dung + đính kèm/xem lại ảnh (B8) =====

interface NoteDetailProps {
  note: DailyNote
  onBack: () => void
  onPhotosChanged: () => Promise<void> | void
}

function NoteDetail({ note, onBack, onPhotosChanged }: NoteDetailProps) {
  const { t, lang } = useT('notebook')
  const { subjects } = useSubjects()
  const subjectById = (id: number) => (subjects ?? []).find((s) => s.id === id)
  const { photos, urls, error, busy, addPhoto, removePhoto } = useNotePhotos(note.date)
  const [openPhotoId, setOpenPhotoId] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    void (async () => {
      for (const f of files) await addPhoto(f)
      await onPhotosChanged() // làm mới nhãn "N ảnh" ở danh sách
    })()
  }

  const openPhoto: Photo | null =
    openPhotoId != null ? (photos.find((p) => p.id === openPhotoId) ?? null) : null

  return (
    <section className="paper-card flex flex-col gap-3 px-4 py-4" aria-label={t('notes.detailAria')}>
      <div className="md:hidden">
        <SecondaryButton onClick={onBack}>
          <Icon name="arrow-left" size={18} /> {t('common.toList')}
        </SecondaryButton>
      </div>

      <h2 className="type-h2">{formatDateVN(note.date, undefined, lang)}</h2>

      {note.partStudied.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {[...note.partStudied].sort((a, b) => a - b).map((id) => {
            const s = subjectById(id)
            return <SubjectChip key={id} name={s?.name ?? t('common.deletedSubject')} colorHex={s?.colorHex} />
          })}
        </div>
      )}

      {note.newWords > 0 && (
        <p className="type-body">{t('notes.newWordsLine', { count: note.newWords })}</p>
      )}

      {note.mistakesSummary && (
        <div className="flex flex-col gap-1">
          <p className="section-label label-dot-coral">{t('notes.mistakesToday')}</p>
          <p className="type-body whitespace-pre-wrap">{note.mistakesSummary}</p>
        </div>
      )}

      {note.reflection && (
        <div className="flex flex-col gap-1">
          <p className="section-label">{t('notes.reflectionLabel')}</p>
          <p className="type-body whitespace-pre-wrap">{note.reflection}</p>
        </div>
      )}

      {!note.partStudied.length && !note.newWords && !note.mistakesSummary && !note.reflection && (
        <p className="type-body text-muted">{t('notes.emptyDay')}</p>
      )}

      <hr className="dashed-rule" />

      {/* B8 — đính kèm ảnh trang sách/đề */}
      <div className="flex flex-col gap-2">
        <p className="section-label">{t('notes.photosLabel')}</p>

        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setOpenPhotoId(p.id!)}
                className="aspect-square overflow-hidden rounded-[8px] border border-rule bg-card transition-colors hover:border-teal"
                aria-label={t('notes.viewPhotoAria')}
              >
                <img src={urls[p.id!]} alt={t('notes.photoAlt')} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onFiles}
        />
        <div>
          <SecondaryButton onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? t('notes.savingPhoto') : photos.length === 0 ? t('notes.attachPhoto') : t('notes.addPhoto')}
          </SecondaryButton>
        </div>
        {error && <p className="type-caption text-coral">{error}</p>}
      </div>

      {/* Xem lại ảnh — phóng to + gỡ khỏi ghi chú */}
      {openPhoto && (
        <div
          className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-ink/85 px-4"
          role="dialog"
          aria-label={t('notes.viewPhotoAria')}
          onClick={() => setOpenPhotoId(null)}
        >
          <img
            src={urls[openPhoto.id!]}
            alt={t('notes.photoZoomAlt')}
            className="max-h-[75vh] max-w-full rounded-[10px] border border-rule bg-card"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <DangerButton
              onClick={() => {
                void (async () => {
                  await removePhoto(openPhoto.id!)
                  setOpenPhotoId(null)
                  await onPhotosChanged()
                })()
              }}
            >
              {t('notes.removePhoto')}
            </DangerButton>
            <SecondaryButton onClick={() => setOpenPhotoId(null)}>{t('common.close')}</SecondaryButton>
          </div>
        </div>
      )}
    </section>
  )
}
