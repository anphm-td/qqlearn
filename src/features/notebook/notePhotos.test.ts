/*
 * Test quy tắc thuần của ảnh đính kèm ghi chú (B8) + hiển thị ngày (display).
 */
import { describe, expect, it } from 'vitest'

import { formatDateVN, preview } from './display'
import {
  MAX_PHOTO_BYTES,
  appendPhotoId,
  emptyNote,
  isImageMime,
  photoAttachError,
  removePhotoId,
} from './notePhotos'

describe('quy tắc đính ảnh (B8)', () => {
  it('chỉ nhận mime ảnh', () => {
    expect(isImageMime('image/png')).toBe(true)
    expect(isImageMime('image/jpeg')).toBe(true)
    expect(isImageMime('application/pdf')).toBe(false)
    expect(isImageMime('')).toBe(false)

    expect(photoAttachError('image/png', 100)).toBeNull()
    expect(photoAttachError('application/pdf', 100)).toBe('Chỉ đính kèm được file ảnh.')
    expect(photoAttachError('', 100)).toBe('Chỉ đính kèm được file ảnh.')
  })

  it('chặn ảnh vượt giới hạn dung lượng', () => {
    expect(photoAttachError('image/png', MAX_PHOTO_BYTES + 1)).toBe(
      'Ảnh quá lớn — chọn ảnh dưới 10 MB.',
    )
    expect(photoAttachError('image/png', MAX_PHOTO_BYTES)).toBeNull()
  })
})

describe('photoIds trên dailyNotes (B8)', () => {
  it('emptyNote đủ trường schema', () => {
    expect(emptyNote('2026-10-03')).toEqual({
      date: '2026-10-03',
      partStudied: [],
      newWords: 0,
      mistakesSummary: '',
      reflection: '',
      photoIds: [],
      autoDrafted: false,
      updatedAt: 0,
    })
  })

  it('appendPhotoId gắn id mới, không trùng, giữ trường khác', () => {
    const base = { ...emptyNote('2026-10-03'), reflection: 'học tốt' }
    const with1 = appendPhotoId(base, 7)
    expect(with1.photoIds).toEqual([7])
    expect(with1.reflection).toBe('học tốt')
    expect(appendPhotoId(with1, 7).photoIds).toEqual([7])
    expect(appendPhotoId(with1, 9).photoIds).toEqual([7, 9])
    expect(base.photoIds).toEqual([]) // không mutate bản gốc
  })

  it('removePhotoId gỡ đúng id', () => {
    const note = appendPhotoId(appendPhotoId(emptyNote('2026-10-03'), 7), 9)
    expect(removePhotoId(note, 7).photoIds).toEqual([9])
    expect(removePhotoId(note, 100).photoIds).toEqual([7, 9])
  })
})

describe('formatDateVN + preview (hiển thị)', () => {
  it('hôm nay / hôm qua / thứ · ngày', () => {
    expect(formatDateVN('2026-10-03', '2026-10-03')).toBe('hôm nay')
    expect(formatDateVN('2026-10-02', '2026-10-03')).toBe('hôm qua')
    // 03–04/10/2026 là thứ bảy / chủ nhật; today phải cách xa để không rơi vào 'hôm qua'
    expect(formatDateVN('2026-10-03', '2026-10-05')).toBe('thứ bảy · 03/10')
    expect(formatDateVN('2026-10-04', '2026-10-10')).toBe('chủ nhật · 04/10')
  })

  it('preview gộp khoảng trắng và cắt có dấu …', () => {
    expect(preview('  học   từ mới  ', 90)).toBe('học từ mới')
    const long = 'a'.repeat(120)
    expect(preview(long, 90).length).toBe(90)
    expect(preview(long, 90).endsWith('…')).toBe(true)
  })
})
