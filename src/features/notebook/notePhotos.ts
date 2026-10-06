/*
 * Nghiệp vụ ảnh đính kèm ghi chú (B8) — logic thuần, KHÔNG import React/Dexie/window.
 *
 * Luồng (đúng đặt hàng): chọn ảnh bằng file input → lưu Blob vào bảng `photos`
 * (refType 'note', refId = ngày ISO của ghi chú) → gắn photo.id vào
 * dailyNotes.photoIds qua NoteRepo → xem lại bằng gallery trong ghi chú.
 * IO với repo nằm ở hook useNotePhotos.ts — file này chỉ giữ quy tắc thuần.
 */
import { t, type Lang } from '@core/i18n'

import type { DailyNote } from '@core/types'

/** Giới hạn dung lượng 1 ảnh (chặn phình IndexedDB). */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024

export function isImageMime(mime: string): boolean {
  return mime.startsWith('image/')
}

/**
 * Thông báo lỗi khi đính ảnh — null nếu ảnh đạt.
 * `lang` mặc định 'vi' (nguồn chuẩn) — UI truyền ngôn ngữ hiện tại để dịch.
 */
export function photoAttachError(mime: string, sizeBytes: number, lang: Lang = 'vi'): string | null {
  if (!isImageMime(mime)) return t(lang, 'notebook', 'photo.notImage')
  if (sizeBytes > MAX_PHOTO_BYTES) return t(lang, 'notebook', 'photo.tooLarge')
  return null
}

/** Ghi chú rỗng cho 1 ngày (NoteRepo.upsert tự gắn updatedAt). */
export function emptyNote(date: string): DailyNote {
  return {
    date,
    partStudied: [],
    newWords: 0,
    mistakesSummary: '',
    reflection: '',
    photoIds: [],
    autoDrafted: false,
    updatedAt: 0,
  }
}

/** Gắn thêm 1 photo id vào ghi chú (không trùng, giữ thứ tự cũ). */
export function appendPhotoId(note: DailyNote, photoId: number): DailyNote {
  if (note.photoIds.includes(photoId)) return note
  return { ...note, photoIds: [...note.photoIds, photoId] }
}

/** Gỡ 1 photo id khỏi ghi chú (các trường khác giữ nguyên). */
export function removePhotoId(note: DailyNote, photoId: number): DailyNote {
  return { ...note, photoIds: note.photoIds.filter((id) => id !== photoId) }
}
