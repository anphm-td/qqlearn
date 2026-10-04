import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Link } from 'react-router-dom'

import { DangerButton, SecondaryButton } from '@/components/ui/buttons'
import EmptyState from '@/components/ui/EmptyState'
import Icon from '@/components/ui/Icon'
import NoteCard from '@/components/ui/NoteCard'
import PartChip from '@/components/ui/PartChip'
import { cn } from '@/components/ui/cn'
import { repos } from '@data/index'
import type { DailyNote, Photo } from '@core/types'

import { PartPicker, SearchBox } from './bits'
import { formatDateVN, preview } from './display'
import { filterNotes } from './filters'
import { useNotePhotos } from './useNotePhotos'

/**
 * /sotay — Sổ tay (B7 + B8): kho ghi chú cuối ngày, tìm kiếm nhanh + chip Part,
 * xem lại ghi chú kèm ảnh trang sách/đề (ảnh lưu bảng photos, id gắn vào
 * dailyNotes.photoIds qua useNotePhotos). ≥768px master–detail (mục 10);
 * <768px danh sách → chi tiết trong trang (không đổi route).
 */
export default function NotebookPage() {
  const [notes, setNotes] = useState<DailyNote[] | null>(null)
  const [query, setQuery] = useState('')
  const [part, setPart] = useState(0)
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
    () => filterNotes(notes ?? [], { query, part }),
    [notes, query, part],
  )
  const selected = useMemo(
    () => notes?.find((n) => n.date === selectedDate) ?? null,
    [notes, selectedDate],
  )
  const paneOpen = selected != null

  return (
    <div className="flex flex-col gap-4">
      <p className="section-label">sổ tay</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-display">Sổ tay</h1>
        <div className="flex flex-wrap gap-2">
          <Link to="/sotay/tu-vung" className="btn btn-secondary type-body">
            <Icon name="book" size={18} /> Từ vựng
          </Link>
          <Link to="/sotay/loi-sai" className="btn btn-secondary type-body">
            <Icon name="pen" size={18} /> Lỗi sai
          </Link>
        </div>
      </div>

      {/* B7 — tìm kiếm nhanh + chip Part cho ghi chú */}
      <section className="paper-card flex flex-col gap-2.5 px-4 py-3" aria-label="Tìm và lọc ghi chú">
        <SearchBox value={query} onChange={setQuery} placeholder="Tìm trong ghi chú theo nội dung hoặc ngày…" />
        <PartPicker value={part} onChange={setPart} zeroLabel="Tất cả" />
      </section>

      <div className="grid gap-4 md:grid-cols-[340px_1fr] md:gap-6">
        {/* Danh sách note — mobile ẩn khi mở chi tiết */}
        <div className={cn('flex-col gap-3 md:flex', paneOpen ? 'hidden' : 'flex')}>
          {notes === null ? (
            <p className="type-body text-muted">Đang mở sổ…</p>
          ) : filtered.length === 0 ? (
            notes.length === 0 ? (
              <EmptyState
                message="Chưa có ghi chú nào trong sổ. Kết thúc một buổi học rồi viết ghi chú cuối ngày nhé."
                action={
                  <Link to="/ghichu" className="btn btn-primary type-body">
                    Viết ghi chú hôm nay
                  </Link>
                }
              />
            ) : (
              <p className="type-body text-muted">Không có ghi chú nào khớp. Thử từ khoá khác hoặc bỏ chip Part.</p>
            )
          ) : (
            filtered.map((n) => (
              <NoteCard
                key={n.date}
                washi="toeic"
                subject="TOEIC"
                title={formatDateVN(n.date)}
                tag={n.newWords > 0 ? `${n.newWords} từ mới` : undefined}
                time={n.photoIds.length > 0 ? `${n.photoIds.length} ảnh` : undefined}
                onClick={() => setSelectedDate(n.date)}
                className={cn('text-left', n.date === selectedDate && 'border-teal')}
              >
                {preview(n.reflection || n.mistakesSummary || 'Ghi chú ngày này chưa có nội dung.', 90)}
              </NoteCard>
            ))
          )}
        </div>

        {/* Chi tiết ghi chú + ảnh đính kèm — desktop luôn hiển thị, mobile chỉ khi mở */}
        <div className={cn('flex-col gap-3 md:flex', paneOpen ? 'flex' : 'hidden')}>
          {selected ? (
            <NoteDetail note={selected} onBack={() => setSelectedDate(null)} onPhotosChanged={reload} />
          ) : (
            <EmptyState message="Chọn một ngày ở danh sách bên trái để xem lại ghi chú và ảnh trang sách/đề." />
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
    <section className="paper-card flex flex-col gap-3 px-4 py-4" aria-label="Chi tiết ghi chú">
      <div className="md:hidden">
        <SecondaryButton onClick={onBack}>
          <Icon name="arrow-left" size={18} /> Danh sách
        </SecondaryButton>
      </div>

      <h2 className="type-h2">{formatDateVN(note.date)}</h2>

      {note.partStudied.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {[...note.partStudied].sort((a, b) => a - b).map((p) => (
            <PartChip key={p} part={p} />
          ))}
        </div>
      )}

      {note.newWords > 0 && (
        <p className="type-body">
          Ghi mới <span className="num">{note.newWords}</span> từ vào sổ từ vựng.
        </p>
      )}

      {note.mistakesSummary && (
        <div className="flex flex-col gap-1">
          <p className="section-label label-dot-coral">lỗi sai hôm nay</p>
          <p className="type-body whitespace-pre-wrap">{note.mistakesSummary}</p>
        </div>
      )}

      {note.reflection && (
        <div className="flex flex-col gap-1">
          <p className="section-label">bạn vừa học được gì</p>
          <p className="type-body whitespace-pre-wrap">{note.reflection}</p>
        </div>
      )}

      {!note.partStudied.length && !note.newWords && !note.mistakesSummary && !note.reflection && (
        <p className="type-body text-muted">Ngày này chưa có nội dung gì.</p>
      )}

      <hr className="dashed-rule" />

      {/* B8 — đính kèm ảnh trang sách/đề */}
      <div className="flex flex-col gap-2">
        <p className="section-label">ảnh trang sách / đề</p>

        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setOpenPhotoId(p.id!)}
                className="aspect-square overflow-hidden rounded-[8px] border border-rule bg-card transition-colors hover:border-teal"
                aria-label="Xem ảnh đính kèm"
              >
                <img src={urls[p.id!]} alt="Ảnh trang sách/đề" className="h-full w-full object-cover" />
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
            {busy ? 'Đang lưu ảnh…' : photos.length === 0 ? 'Đính kèm ảnh' : 'Thêm ảnh'}
          </SecondaryButton>
        </div>
        {error && <p className="type-caption text-coral">{error}</p>}
      </div>

      {/* Xem lại ảnh — phóng to + gỡ khỏi ghi chú */}
      {openPhoto && (
        <div
          className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-ink/85 px-4"
          role="dialog"
          aria-label="Xem ảnh đính kèm"
          onClick={() => setOpenPhotoId(null)}
        >
          <img
            src={urls[openPhoto.id!]}
            alt="Ảnh trang sách/đề phóng to"
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
              Gỡ khỏi ghi chú
            </DangerButton>
            <SecondaryButton onClick={() => setOpenPhotoId(null)}>Đóng</SecondaryButton>
          </div>
        </div>
      )}
    </section>
  )
}
