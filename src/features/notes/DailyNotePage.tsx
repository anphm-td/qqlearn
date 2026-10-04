import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

import { DangerButton, SecondaryButton } from '@/components/ui/buttons'
import Icon from '@/components/ui/Icon'
import { repos, todayISO } from '@data'
import type { Photo, Session } from '@core/types'

import DailyNoteForm from '@/features/today/DailyNoteForm'
import { useNotePhotos } from '@/features/notebook/useNotePhotos'

/**
 * /ghichu — "Ghi chú cuối ngày" (đích của phím N, A3).
 * Form thật tái dùng src/features/today/DailyNoteForm (cùng form trên Home) +
 * đính kèm/xem lại ảnh trang sách-đề của ngày (B8, qua useNotePhotos — cùng bảng
 * photos/dailyNotes.photoIds với Sổ tay).
 *
 * ĐIỂM GHÉP CHÉO 2: nút "Soạn nháp" nằm trong DailyNoteForm và gọi
 * buildDailyDraft() (team smart sở hữu src/features/smart/dailyDraft.ts).
 */
export default function DailyNotePage() {
  const today = todayISO()
  const [todaySessions, setTodaySessions] = useState<Session[]>([])
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const rows = await repos.sessions.listByDate(today)
        if (alive) setTodaySessions(rows)
      } catch {
        if (alive) setLoadFailed(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [today])

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-4">
      <p className="section-label">ghi chú cuối ngày</p>
      <h1 className="type-display">Ghi chú cuối ngày</h1>

      {loadFailed && (
        <p className="type-caption rounded-lg border border-coral bg-pink-soft px-3 py-2">
          Chưa đọc được dữ liệu hôm nay — thử tải lại trang nhé.
        </p>
      )}

      <DailyNoteForm date={today} todaySessions={todaySessions} />

      <PhotoAttach date={today} />
    </div>
  )
}

// ===== B8 — ảnh trang sách/đề gắn với ghi chú hôm nay =====

function PhotoAttach({ date }: { date: string }) {
  const { photos, urls, error, busy, addPhoto, removePhoto } = useNotePhotos(date)
  const [openPhotoId, setOpenPhotoId] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    void (async () => {
      for (const f of files) await addPhoto(f)
    })()
  }

  const openPhoto: Photo | null =
    openPhotoId != null ? (photos.find((p) => p.id === openPhotoId) ?? null) : null

  const closePhoto = useCallback(() => setOpenPhotoId(null), [])

  return (
    <section className="paper-card flex flex-col gap-2 px-4 py-4" aria-label="Ảnh trang sách và đề">
      <p className="section-label">ảnh trang sách / đề</p>
      <p className="type-caption text-muted">
        Chụp lại trang đề vừa làm — xem lại trong ghi chú này và ở Sổ tay.
      </p>

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

      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
      <div>
        <SecondaryButton onClick={() => fileRef.current?.click()} disabled={busy}>
          <Icon name="plus" size={16} />
          {busy ? 'Đang lưu ảnh…' : photos.length === 0 ? 'Đính kèm ảnh' : 'Thêm ảnh'}
        </SecondaryButton>
      </div>
      {error && <p className="type-caption text-coral">{error}</p>}

      {openPhoto && (
        <div
          className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-ink/85 px-4"
          role="dialog"
          aria-label="Xem ảnh đính kèm"
          onClick={closePhoto}
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
                })()
              }}
            >
              Gỡ khỏi ghi chú
            </DangerButton>
            <SecondaryButton onClick={closePhoto}>Đóng</SecondaryButton>
          </div>
        </div>
      )}
    </section>
  )
}
