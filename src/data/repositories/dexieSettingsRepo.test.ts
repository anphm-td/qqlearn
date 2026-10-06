/*
 * Test DexieSettingsRepo — đường client của Settings.language (i18n, mục 12):
 *  - get() khi chưa có hàng → tạo mặc định language 'vi';
 *  - update({ language: 'en' }) ghi đúng và giữ nguyên các trường khác;
 *  - update MỘT trường khác KHÔNG reset language (spread giữ giá trị đã lưu —
 *    bài học syncMode: patch một phần không được bung default làm mất lựa chọn).
 * fake-indexeddb cài trong vitest setup (src/test/setup.ts).
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '../db'
import { DexieSettingsRepo } from './dexieSettingsRepo'

const repo = new DexieSettingsRepo()

beforeEach(async () => {
  // Đưa bảng settings về mặc định giữa các test (ghi đè hàng id = 1).
  await repo.update({ dailyGoalMinutes: 90, language: 'vi', syncMode: 'local', serverUrl: '' })
})

describe('DexieSettingsRepo — language (i18n)', () => {
  it('get() khi chưa có hàng → tự tạo với language mặc định vi', async () => {
    // Xoá hàng để đi qua nhánh tự tạo của get() (DEFAULT_SETTINGS.language = 'vi');
    // language không nằm trong Dexie index nên không cần bump version.
    await db.settings.delete(1)
    const created = await repo.get()
    expect(created.id).toBe(1)
    expect(created.language).toBe('vi')
    expect(created.dailyGoalMinutes).toBe(90)
  })

  it('update({ language: "en" }) → get trả en, giữ nguyên các trường khác', async () => {
    const next = await repo.update({ language: 'en' })
    expect(next.language).toBe('en')
    expect(next.dailyGoalMinutes).toBe(90)
    expect(next.syncMode).toBe('local')

    const reread = await repo.get()
    expect(reread.language).toBe('en')
    expect(reread.updatedAt).toBeGreaterThan(0)
  })

  it('update MỘT trường khác KHÔNG reset language (không bung default)', async () => {
    await repo.update({ language: 'en' })
    const next = await repo.update({ dailyGoalMinutes: 45 })
    expect(next.dailyGoalMinutes).toBe(45)
    expect(next.language).toBe('en')
  })
})
