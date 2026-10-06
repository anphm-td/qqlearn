/*
 * Test DexieRestoreRepo — khôi phục bản sao lưu ALL-OR-NOTHING trên IndexedDB giả
 * (fake-indexeddb cài trong vitest setup). Kiểm chứng: clear-trước-ghi (không nhân
 * đôi khi chạy lại), ánh xạ chỉ mục → id mới cho thẻ SRS/ảnh, giữ syncMode/serverUrl.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { repos } from '../index'
import { DexieRestoreRepo } from './dexieRestoreRepo'
import type { RestorePayload } from '@core/ports'

const PAYLOAD: RestorePayload = {
  settings: {
    dailyGoalMinutes: 60,
    targetScore: 800,
    examDate: '2026-12-01',
    reminderTime: '20:00',
    ragBaseUrl: '',
    onboardingDone: true,
    pomodoro: { focusMin: 30, breakMin: 5 },
  },
  // Id môn CŨ trong bản sao lưu (20/21) — restore phải ánh xạ sang id mới.
  subjects: [
    { id: 20, name: 'Toán', colorHex: '#BFAEE3', goalMinutesPerDay: 30, archived: false },
    { id: 21, name: 'Tiếng Nhật', colorHex: '#FEC5E6', goalMinutesPerDay: 0, archived: false },
  ],
  sessions: [
    { date: '2026-10-01', startedAt: 1, endedAt: 2, durationMin: 25, subjectId: 20, activity: 'nghe', source: 'timer', note: '' },
    { date: '2026-10-02', startedAt: 3, endedAt: 4, durationMin: 45, subjectId: 21, activity: 'đọc', source: 'manual', note: '' },
  ],
  vocab: [
    { word: 'commute', meaning: 'đi làm', example: 'I commute.', subjectId: 21, sourceTest: '' },
    { word: 'deliberate', meaning: 'cố ý', example: 'a deliberate mistake', subjectId: 20, sourceTest: '' },
  ],
  srsCards: [{ vocabKey: 1, box: 3, dueDate: '2026-10-05', lastReviewed: 1, correctCount: 4 }],
  mistakes: [
    { testNo: 2, subjectId: 21, questionNo: 14, myAnswer: 'A', correctAnswer: 'B', cause: 'từ vựng', explanation: '', reviewed: false },
  ],
  scores: [{ date: '2026-10-01', subjectId: 20, label: 'Toán — Định lí Pytago', score: 8, note: 'sai bài 4' }],
  dailyNotes: [
    {
      date: '2026-10-02',
      partStudied: [20, 0],
      newWords: 2,
      mistakesSummary: '',
      reflection: 'Học ổn',
      photoIds: [],
      autoDrafted: false,
      updatedAt: 0,
    },
  ],
  chat: [{ sessionId: 's1', role: 'user', content: 'xin chào' }],
  photos: [
    { refType: 'session', refKey: '0', mime: 'image/png', bytes: new Uint8Array([1, 2, 3]) },
    { refType: 'note', refKey: '2026-10-02', mime: 'image/png', bytes: new Uint8Array([9]) },
  ],
}

beforeEach(async () => {
  await Promise.all([
    repos.sessions.listBetween('0000-01-01', '9999-12-31'), // mở DB
  ])
  await dbClearAll()
})

async function dbClearAll(): Promise<void> {
  // Xoá sạch qua repos.restore chính nó cũng được — nhưng để test độc lập, dùng 1 restore rỗng.
  await new DexieRestoreRepo().restoreAll({
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
}

describe('DexieRestoreRepo.restoreAll', () => {
  it('xoá sạch dữ liệu cũ rồi ghi payload; ánh xạ chỉ mục → id mới đúng', async () => {
    // Dữ liệu "bẩn": 3 buổi + 1 từ + thẻ
    await repos.sessions.create({ date: '2026-09-30', startedAt: 0, endedAt: 1, durationMin: 10, subjectId: 1, activity: 'nghe', source: 'manual', note: 'bẩn' })
    await repos.sessions.create({ date: '2026-09-30', startedAt: 0, endedAt: 1, durationMin: 10, subjectId: 1, activity: 'nghe', source: 'manual', note: 'bẩn 2' })
    const dirtyVocab = await repos.vocab.create({ word: 'dirty', meaning: '', example: '', subjectId: 0, sourceTest: '' })
    if (dirtyVocab.id != null) await repos.srs.createForVocab(dirtyVocab.id, '2026-10-01')

    await new DexieRestoreRepo().restoreAll(PAYLOAD)

    const sessions = await repos.sessions.listBetween('0000-01-01', '9999-12-31')
    expect(sessions).toHaveLength(2) // dữ liệu bẩn đã bị thay
    expect(sessions.map((s) => s.date).sort()).toEqual(['2026-10-01', '2026-10-02'])

    const vocab = await repos.vocab.list()
    expect(vocab.map((v) => v.word).sort()).toEqual(['commute', 'deliberate'])

    // Thẻ SRS: vocabKey 1 → 'deliberate' (id mới), giữ nguyên hộp/hạn/correctCount
    const deliberate = vocab.find((v) => v.word === 'deliberate')!
    const card = await repos.srs.getByVocab(deliberate.id!)
    expect(card?.box).toBe(3)
    expect(card?.dueDate).toBe('2026-10-05')
    expect(card?.correctCount).toBe(4)

    // Thẻ của từ "dirty" đã biến mất cùng dữ liệu bẩn
    expect(await repos.srs.listDue('9999-12-31')).toHaveLength(1)

    // Ảnh 'session' refKey '0' → gắn vào buổi MỚI tại chỉ mục 0 (2026-10-01)
    const sessionOrdered = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
    const sessionPhotos = await repos.photos.listByRef('session', String(sessionOrdered[0].id))
    expect(sessionPhotos).toHaveLength(1)
    // Blob round-trip qua fake-indexeddb trong jsdom không giữ nguyên prototype
    // (trình duyệt thật là Blob gốc) — chỉ khẳng định nội dung metadata ở đây.
    expect(sessionPhotos[0].mime).toBe('image/png')

    // Ảnh 'note' giữ refKey là ngày
    const notePhotos = await repos.photos.listByRef('note', '2026-10-02')
    expect(notePhotos).toHaveLength(1)

    const notes = await repos.notes.listBetween('0000-01-01', '9999-12-31')
    expect(notes).toHaveLength(1)
    expect(notes[0].reflection).toBe('Học ổn')

    const settings = await repos.settings.get()
    expect(settings.dailyGoalMinutes).toBe(60)
    expect(settings.targetScore).toBe(800)

    // Subjects: ghi lại từ payload với id MỚI; subjectId các hàng remap theo ánh xạ.
    const subjects = await repos.subjects.list()
    const toan = subjects.find((x) => x.name === 'Toán')!
    const tiengNhat = subjects.find((x) => x.name === 'Tiếng Nhật')!
    expect(toan).toBeDefined()
    expect(tiengNhat).toBeDefined()
    expect(toan.id).not.toBe(20) // id mới được sinh, không tái sử dụng id cũ
    expect(toan.goalMinutesPerDay).toBe(30)
    expect(sessions.find((x) => x.date === '2026-10-01')?.subjectId).toBe(toan.id)
    expect(sessions.find((x) => x.date === '2026-10-02')?.subjectId).toBe(tiengNhat.id)
    expect(vocab.find((x) => x.word === 'commute')?.subjectId).toBe(tiengNhat.id)
    expect(vocab.find((x) => x.word === 'deliberate')?.subjectId).toBe(toan.id)
    const scoreRows = await repos.scores.list()
    expect(scoreRows[0].subjectId).toBe(toan.id)
    expect(notes[0].partStudied).toEqual([toan.id, 0])
  })

  it('chạy lại 2 lần → không nhân đôi', async () => {
    const repo = new DexieRestoreRepo()
    await repo.restoreAll(PAYLOAD)
    await repo.restoreAll(PAYLOAD)
    const sessions = await repos.sessions.listBetween('0000-01-01', '9999-12-31')
    expect(sessions).toHaveLength(2)
    expect(await repos.photos.listByRef('note', '2026-10-02')).toHaveLength(1)
  })

  it('giữ nguyên syncMode/serverUrl của máy (không nằm trong payload)', async () => {
    await repos.settings.update({ syncMode: 'server', serverUrl: 'http://192.168.1.9:5178' })
    await new DexieRestoreRepo().restoreAll(PAYLOAD)
    const settings = await repos.settings.get()
    expect(settings.syncMode).toBe('server')
    expect(settings.serverUrl).toBe('http://192.168.1.9:5178')
    expect(settings.dailyGoalMinutes).toBe(60) // các trường của payload thì ghi
  })
})
