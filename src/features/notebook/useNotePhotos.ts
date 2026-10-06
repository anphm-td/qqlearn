/*
 * Hook đính kèm ảnh cho ghi chú cuối ngày (B8) — nhóm Sổ tay.
 * IO đi QUA repos (photos + notes) — KHÔNG import dexie/db trực tiếp.
 * Quy tắc thuần nằm ở notePhotos.ts; hook này chỉ lo tải/lưu + vòng đời objectURL.
 */
import { useCallback, useEffect, useState } from 'react'

import { dailyNoteSchema } from '@core/schemas'
import type { DailyNote, Photo } from '@core/types'
import { repos } from '@data/index'
import { useT } from '@data/useT'

import { appendPhotoId, emptyNote, photoAttachError, removePhotoId } from './notePhotos'

export interface UseNotePhotosResult {
  /** Ảnh của ghi chú theo đúng photoIds trong dailyNotes. */
  photos: Photo[]
  /** objectURL theo photo id — <img src={urls[id]} />. */
  urls: Record<number, string>
  /** Thông báo lỗi validate (mime/dung lượng/lưu). */
  error: string
  /** true khi đang lưu ảnh. */
  busy: boolean
  addPhoto: (file: File) => Promise<void>
  removePhoto: (photoId: number) => Promise<void>
}

/**
 * Ảnh đính kèm của 1 ghi chú theo ngày ('YYYY-MM-DD').
 * `date = ''` → trạng thái rỗng (chưa chọn ghi chú nào).
 */
export function useNotePhotos(date: string): UseNotePhotosResult {
  const { t, lang } = useT('notebook')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [urls, setUrls] = useState<Record<number, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!date) {
      setPhotos([])
      return
    }
    try {
      const note = await repos.notes.get(date)
      const ids = note?.photoIds ?? []
      // Đọc TUẦN TỰ từng ảnh: một ảnh lỗi không làm rơi cả gallery.
      const rows: Photo[] = []
      for (const id of ids) {
        try {
          const p = await repos.photos.get(id)
          if (p) rows.push(p)
        } catch {
          // Ảnh không đọc được (mất kết nối server / hàng lỗi) — bỏ qua ảnh đó.
        }
      }
      setPhotos(rows)
      setError('')
    } catch {
      // Ghi chú/ảnh không đọc được (server PC ngắt, IndexedDB lỗi) — hiện thông
      // báo qua error thay vì treo gallery, tránh unhandled rejection.
      setPhotos([])
      setError(t('photo.loadError'))
    }
  }, [date, t])

  useEffect(() => {
    void load()
  }, [load])

  // objectURL: tạo theo danh sách ảnh, thu hồi khi đổi/unmount (không rò rỉ bộ nhớ)
  useEffect(() => {
    const map: Record<number, string> = {}
    for (const p of photos) {
      if (p.id != null) map[p.id] = URL.createObjectURL(p.blob)
    }
    setUrls(map)
    return () => {
      for (const url of Object.values(map)) URL.revokeObjectURL(url)
    }
  }, [photos])

  const saveNote = useCallback(async (next: DailyNote) => {
    const parsed = dailyNoteSchema.safeParse(next)
    if (!parsed.success) {
      setError(t('photo.noteSaveError'))
      return false
    }
    await repos.notes.upsert(parsed.data)
    return true
  }, [t])

  /** Chọn 1 ảnh (từ file input) → lưu Blob → gắn id vào dailyNotes.photoIds. */
  const addPhoto = useCallback(
    async (file: File) => {
      if (!date) return
      setError('')
      const invalid = photoAttachError(file.type, file.size, lang)
      if (invalid) {
        setError(invalid)
        return
      }
      setBusy(true)
      try {
        const saved = await repos.photos.save({
          blob: file,
          mime: file.type,
          refType: 'note',
          refId: date,
        })
        if (saved.id == null) {
          setError(t('photo.saveError'))
          return
        }
        const note = (await repos.notes.get(date)) ?? emptyNote(date)
        const ok = await saveNote(appendPhotoId(note, saved.id))
        if (ok) await load()
      } catch {
        setError(t('photo.saveError'))
      } finally {
        setBusy(false)
      }
    },
    [date, lang, load, saveNote, t],
  )

  /** Gỡ ảnh: xoá hàng photos + bỏ id khỏi dailyNotes.photoIds. */
  const removePhoto = useCallback(
    async (photoId: number) => {
      if (!date) return
      setError('')
      try {
        await repos.photos.remove(photoId)
        const note = (await repos.notes.get(date)) ?? emptyNote(date)
        const ok = await saveNote(removePhotoId(note, photoId))
        if (ok) await load()
      } catch {
        setError(t('photo.removeError'))
      }
    },
    [date, load, saveNote, t],
  )

  return { photos, urls, error, busy, addPhoto, removePhoto }
}
