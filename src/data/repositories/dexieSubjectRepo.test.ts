/*
 * Test DexieSubjectRepo — seed 4 môn khi bảng trống (DB mới), chặn tên trùng,
 * chặn xoá môn CÒN dữ liệu (kể cả ghi chú cuối ngày nhắc tới môn — LOW 9),
 * cho xoá môn trống. fake-indexeddb cài trong vitest setup.
 * Lỗi ném ra có `code` ('duplicate_subject' / 'subject_in_use') — UI tự dịch
 * theo ngôn ngữ (dict 'subjects'), test assert CODE chứ không assert message.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { repos } from '../index'
import { DexieSubjectRepo, DuplicateSubjectError, SubjectInUseError } from './dexieSubjectRepo'

beforeEach(async () => {
  // Mở DB + nạp danh sách môn (tự seed 4 môn khi bảng trống).
  await new DexieSubjectRepo().list()
  // Dọn dữ liệu các bảng có thể dính từ test khác (trừ subjects — seed giữ lại).
  await repos.restore.restoreAll({
    settings: {
      dailyGoalMinutes: 90,
      targetScore: 700,
      examDate: '',
      reminderTime: '',
      ragBaseUrl: '',
      onboardingDone: false,
      pomodoro: { focusMin: 25, breakMin: 5 },
    },
    subjects: [],
    sessions: [],
    vocab: [],
    srsCards: [],
    mistakes: [],
    scores: [],
    dailyNotes: [],
    chat: [],
    photos: [],
  })
})

describe('DexieSubjectRepo', () => {
  it('list() tự seed 4 môn khi bảng trống (DB mới không qua Dexie upgrade)', async () => {
    const subjects = await new DexieSubjectRepo().list()
    expect(subjects.map((s) => s.name)).toEqual(['TOEIC', 'Toán', 'Tiếng Nhật', 'Lập trình'])
    expect(subjects[0]).toMatchObject({ colorHex: '#FFD273', archived: false })
  })

  it('create + tên trùng (không phân biệt hoa thường) → lỗi code "duplicate_subject"', async () => {
    const repo = new DexieSubjectRepo()
    const created = await repo.create({ name: 'Vật lí', colorHex: '#FBC193', goalMinutesPerDay: 30, archived: false })
    expect(created.id).toBeGreaterThan(0)
    const dup = await repo.create({ name: 'vật lí', colorHex: '#FAE0C7', goalMinutesPerDay: 0, archived: false }).catch(
      (err: unknown) => err,
    )
    expect(dup).toBeInstanceOf(DuplicateSubjectError)
    expect((dup as DuplicateSubjectError).code).toBe('duplicate_subject')
    // Tên bị trùng nằm trên lỗi để UI nội suy vào thông điệp dịch (biến {name}).
    expect((dup as DuplicateSubjectError).subjectName).toBe('vật lí')
  })

  it('xóa môn còn dữ liệu → lỗi code "subject_in_use"; xóa môn trống → ok', async () => {
    const repo = new DexieSubjectRepo()
    const subjects = await repo.list()
    const toan = subjects.find((s) => s.name === 'Toán')!
    const toeic = subjects.find((s) => s.name === 'TOEIC')!

    await repos.sessions.create({ date: '2026-10-03', startedAt: 0, endedAt: 1, durationMin: 25, subjectId: toan.id!, activity: 'giải bài', source: 'manual', note: '' })
    const blocked = await repo.remove(toan.id!).catch((err: unknown) => err)
    expect(blocked).toBeInstanceOf(SubjectInUseError)
    expect((blocked as SubjectInUseError).code).toBe('subject_in_use')
    // Môn vẫn còn sau khi bị chặn xoá (hành vi chặn giữ nguyên).
    expect((await repo.list()).some((s) => s.id === toan.id)).toBe(true)

    await repos.notes.upsert({
      date: '2026-10-03',
      partStudied: [toeic.id!],
      newWords: 0,
      mistakesSummary: '',
      reflection: 'ôn TOEIC',
      photoIds: [],
      autoDrafted: false,
      updatedAt: Date.now(),
    })
    const blockedNote = await repo.remove(toeic.id!).catch((err: unknown) => err)
    expect((blockedNote as SubjectInUseError).code).toBe('subject_in_use')
    expect(blockedNote).toBeInstanceOf(SubjectInUseError)

    // Môn vừa tạo, chưa có dữ liệu nào → xoá được.
    const empty = await repo.create({ name: 'Môn trống', colorHex: '#FAE0C7', goalMinutesPerDay: 0, archived: false })
    await repo.remove(empty.id!)
    expect((await repo.list()).some((s) => s.id === empty.id)).toBe(false)
  })
})
