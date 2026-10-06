import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Mistake, Session, Settings, Subject, Vocab } from '@core/types'

// Mock lớp data — dailyDraft chỉ được đụng dữ liệu qua repos (không Dexie/db trực tiếp).
vi.mock('@data', () => ({
  repos: {
    sessions: { listByDate: vi.fn() },
    vocab: { list: vi.fn() },
    mistakes: { list: vi.fn() },
    subjects: { list: vi.fn() },
    settings: { get: vi.fn() },
  },
}))

vi.mock('./ragClient', () => ({
  queryRag: vi.fn(),
}))

import { repos } from '@data'
import { queryRag } from './ragClient'
import { buildDailyDraft } from './dailyDraft'
import { dayRangeMs } from './draftCompose'

const listByDate = vi.mocked(repos.sessions.listByDate)
const listVocab = vi.mocked(repos.vocab.list)
const listMistakes = vi.mocked(repos.mistakes.list)
const listSubjects = vi.mocked(repos.subjects.list)
const getSettings = vi.mocked(repos.settings.get)
const queryRagMock = vi.mocked(queryRag)

const DATE = '2026-10-03'
const IN_DAY_MS = dayRangeMs(DATE).startMs + 60 * 60 * 1000 // 01:00 hôm đó

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    id: 1,
    dailyGoalMinutes: 60,
    targetScore: 700,
    examDate: '',
    reminderTime: '',
    ragBaseUrl: '',
    onboardingDone: true,
    checkinEnabled: true,
    pomodoro: { focusMin: 25, breakMin: 5 },
    syncMode: 'local',
    serverUrl: '',
    language: 'vi',
    updatedAt: 0,
    ...overrides,
  }
}

function makeSubject(overrides: Partial<Subject> = {}): Subject {
  return {
    id: 2,
    name: 'Toán',
    colorHex: '#BFAEE3',
    goalMinutesPerDay: 0,
    archived: false,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

const SUBJECTS: Subject[] = [
  makeSubject({ id: 1, name: 'TOEIC', colorHex: '#FFD273' }),
  makeSubject(),
  makeSubject({ id: 3, name: 'Tiếng Nhật', colorHex: '#FEC5E6' }),
]

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 1,
    date: DATE,
    startedAt: IN_DAY_MS,
    endedAt: IN_DAY_MS + 45 * 60 * 1000,
    durationMin: 45,
    subjectId: 2,
    activity: 'luyện bài',
    source: 'timer',
    note: '',
    updatedAt: 0,
    ...overrides,
  }
}

function makeVocab(overrides: Partial<Vocab> = {}): Vocab {
  return {
    id: 1,
    word: 'định lí',
    meaning: 'mệnh đề đúng đã được chứng minh',
    example: 'Định lí Pytago.',
    subjectId: 2,
    sourceTest: '',
    createdAt: IN_DAY_MS,
    updatedAt: 0,
    ...overrides,
  }
}

function makeMistake(overrides: Partial<Mistake> = {}): Mistake {
  return {
    id: 1,
    testNo: 2,
    subjectId: 2,
    questionNo: 4,
    myAnswer: 'A',
    correctAnswer: 'B',
    cause: 'quên đổi đơn vị',
    explanation: '',
    reviewed: false,
    createdAt: IN_DAY_MS,
    updatedAt: 0,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  listSubjects.mockResolvedValue(SUBJECTS)
})

describe('buildDailyDraft (D15) — soạn nháp từ dữ liệu hôm nay', () => {
  it('gom sessions/vocab/mistakes tạo hôm nay thành nháp; tên môn được ghép vào; autoDrafted = true', async () => {
    listByDate.mockResolvedValue([
      makeSession({ subjectId: 2, durationMin: 30 }),
      makeSession({ subjectId: 3, durationMin: 15 }),
    ])
    listVocab.mockResolvedValue([
      makeVocab({ word: 'định lí Pytago', createdAt: IN_DAY_MS }),
      makeVocab({ word: 'tam giác vuông', createdAt: IN_DAY_MS }),
      // từ tạo HÔM QUA — không được tính vào nháp của hôm nay
      makeVocab({ word: 'tuần-trước', createdAt: dayRangeMs(DATE).startMs - 1000 }),
    ])
    listMistakes.mockResolvedValue([
      makeMistake({ subjectId: 2 }),
      makeMistake({ subjectId: 2, questionNo: 5 }),
      // lỗi tạo trước hôm nay — không tính
      makeMistake({ subjectId: 1, createdAt: dayRangeMs(DATE).startMs - 5000 }),
    ])
    getSettings.mockResolvedValue(makeSettings())

    const draft = await buildDailyDraft({ date: DATE })

    expect(listByDate).toHaveBeenCalledWith(DATE)
    expect(draft.autoDrafted).toBe(true)
    expect(draft.text).toContain('45 phút')
    expect(draft.text).toContain('Toán, Tiếng Nhật')
    expect(draft.text).toContain('Từ mới: định lí Pytago, tam giác vuông.')
    expect(draft.text).not.toContain('tuần-trước')
    expect(draft.text).toContain('2 lỗi sai')
    expect(draft.text).toContain('Cảm nhận hôm nay:')
    // ragBaseUrl rỗng → không gọi RAG
    expect(queryRagMock).not.toHaveBeenCalled()
  })

  it('chưa có dữ liệu gì → nháp mời bắt đầu, autoDrafted = false', async () => {
    listByDate.mockResolvedValue([])
    listVocab.mockResolvedValue([])
    listMistakes.mockResolvedValue([])
    getSettings.mockResolvedValue(makeSettings())

    const draft = await buildDailyDraft({ date: DATE })

    expect(draft.autoDrafted).toBe(false)
    expect(draft.text).toContain('chưa có dữ liệu để soạn nháp')
  })

  it('buổi chưa phân môn (subjectId 0) vẫn được tính — nháp ghi "chưa phân môn", không bỏ sót', async () => {
    listByDate.mockResolvedValue([makeSession({ subjectId: 0, durationMin: 1, activity: 'nghe' })])
    listVocab.mockResolvedValue([])
    listMistakes.mockResolvedValue([])
    getSettings.mockResolvedValue(makeSettings())

    const draft = await buildDailyDraft({ date: DATE })

    expect(draft.autoDrafted).toBe(true)
    expect(draft.text).toContain('1 phút')
    expect(draft.text).toContain('chưa phân môn')
    expect(draft.text).not.toContain('chưa ghi buổi học nào')
  })

  it('ragBaseUrl đã cấu hình → hỏi RAG với prompt có TÊN môn và dùng câu trả lời', async () => {
    listByDate.mockResolvedValue([makeSession({ subjectId: 2, durationMin: 45 })])
    listVocab.mockResolvedValue([])
    listMistakes.mockResolvedValue([])
    getSettings.mockResolvedValue(makeSettings({ ragBaseUrl: 'http://127.0.0.1:8300' }))
    queryRagMock.mockResolvedValue({
      ok: true,
      answer: 'Nháp do RAG soạn: hôm nay 45 phút Toán.',
      citations: ['sgk_toan_8'],
    })

    const draft = await buildDailyDraft({ date: DATE })

    expect(queryRagMock).toHaveBeenCalledTimes(1)
    const [baseUrl, prompt] = queryRagMock.mock.calls[0]
    expect(baseUrl).toBe('http://127.0.0.1:8300')
    expect(prompt).toContain('45 phút — Toán')
    expect(prompt).toContain('trợ lý học tập đa môn')
    expect(draft.text).toBe('Nháp do RAG soạn: hôm nay 45 phút Toán.')
    expect(draft.autoDrafted).toBe(true)
  })

  it('RAG lỗi (ok: false) → im lặng fallback soạn tại chỗ, không chết', async () => {
    listByDate.mockResolvedValue([makeSession({ subjectId: 2, durationMin: 45 })])
    listVocab.mockResolvedValue([])
    listMistakes.mockResolvedValue([])
    getSettings.mockResolvedValue(makeSettings({ ragBaseUrl: 'http://127.0.0.1:8300' }))
    queryRagMock.mockResolvedValue({
      ok: false,
      reason: 'network',
      message: 'Không kết nối được máy trợ lý.',
    })

    const draft = await buildDailyDraft({ date: DATE })

    expect(draft.autoDrafted).toBe(true)
    expect(draft.text).toContain('45 phút — Toán')
  })

  it('số liệu caller truyền sẵn (minutesStudied/subjectIds/newWords/mistakesSummary) được ghi đè', async () => {
    listByDate.mockResolvedValue([])
    listVocab.mockResolvedValue([])
    listMistakes.mockResolvedValue([])
    getSettings.mockResolvedValue(makeSettings())

    const draft = await buildDailyDraft({
      date: DATE,
      minutesStudied: 30,
      subjectIds: [3, 0, 2], // môn 0 (chưa phân môn) bị loại, sắp lại tăng dần
      newWords: 2,
      mistakesSummary: '2 lỗi Toán vì quên đổi đơn vị',
    })

    expect(draft.autoDrafted).toBe(true)
    expect(draft.text).toContain('30 phút — Toán, Tiếng Nhật')
    expect(draft.text).toContain('Từ mới: 2 từ.')
    expect(draft.text).toContain('2 lỗi Toán vì quên đổi đơn vị')
  })

  it('language "en" trong settings → nháp soạn tiếng Anh, tên môn user giữ nguyên', async () => {
    listByDate.mockResolvedValue([makeSession({ subjectId: 0, durationMin: 1 })])
    listVocab.mockResolvedValue([])
    listMistakes.mockResolvedValue([])
    getSettings.mockResolvedValue(makeSettings({ language: 'en' }))

    const draft = await buildDailyDraft({ date: DATE })

    expect(draft.autoDrafted).toBe(true)
    expect(draft.text).toContain('Studied 1 minute today — unassigned.')
    expect(draft.text).not.toContain('Hôm nay học 1 phút')
  })

  it('lỗi đọc dữ liệu (IndexedDB hỏng) → trả nháp thay thế, không throw', async () => {
    // Settings cũng đọc lỗi → lang rớt về 'vi' mặc định (mock test trước không được lọt vào).
    getSettings.mockRejectedValue(new Error('IndexedDB unavailable'))
    listByDate.mockRejectedValue(new Error('IndexedDB unavailable'))

    const draft = await buildDailyDraft({ date: DATE })

    expect(draft.autoDrafted).toBe(false)
    expect(draft.text).toContain('chưa có dữ liệu để soạn nháp')
  })
})
