import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Mistake, Session, Settings, Vocab } from '@core/types'

// Mock lớp data — dailyDraft chỉ được đụng dữ liệu qua repos (không Dexie/db trực tiếp).
vi.mock('@data', () => ({
  repos: {
    sessions: { listByDate: vi.fn() },
    vocab: { list: vi.fn() },
    mistakes: { list: vi.fn() },
    settings: { get: vi.fn() },
  },
}))

vi.mock('./ragClient', () => ({
  queryRag: vi.fn(),
  RAG_NOT_CONNECTED_MESSAGE: 'Chưa kết nối máy trợ lý — nhập địa chỉ máy trợ lý trong Cài đặt',
}))

import { repos } from '@data'
import { queryRag } from './ragClient'
import { buildDailyDraft } from './dailyDraft'
import { dayRangeMs } from './draftCompose'

const listByDate = vi.mocked(repos.sessions.listByDate)
const listVocab = vi.mocked(repos.vocab.list)
const listMistakes = vi.mocked(repos.mistakes.list)
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
    updatedAt: 0,
    ...overrides,
  }
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 1,
    date: DATE,
    startedAt: IN_DAY_MS,
    endedAt: IN_DAY_MS + 45 * 60 * 1000,
    durationMin: 45,
    part: 5,
    activity: 'luyện đề',
    source: 'timer',
    note: '',
    updatedAt: 0,
    ...overrides,
  }
}

function makeVocab(overrides: Partial<Vocab> = {}): Vocab {
  return {
    id: 1,
    word: 'commute',
    meaning: 'đi làm hằng ngày',
    example: 'I commute by train.',
    part: 5,
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
    part: 5,
    questionNo: 134,
    myAnswer: 'A',
    correctAnswer: 'B',
    cause: 'ngữ pháp',
    explanation: '',
    reviewed: false,
    createdAt: IN_DAY_MS,
    updatedAt: 0,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('buildDailyDraft (D15) — soạn nháp từ dữ liệu hôm nay', () => {
  it('gom sessions/vocab/mistakes tạo hôm nay thành nháp; autoDrafted = true', async () => {
    listByDate.mockResolvedValue([
      makeSession({ part: 5, durationMin: 30 }),
      makeSession({ part: 7, durationMin: 15 }),
    ])
    listVocab.mockResolvedValue([
      makeVocab({ word: 'commute', createdAt: IN_DAY_MS }),
      makeVocab({ word: 'deliberate', createdAt: IN_DAY_MS }),
      // từ tạo HÔM QUA — không được tính vào nháp của hôm nay
      makeVocab({ word: 'tuần-trước', createdAt: dayRangeMs(DATE).startMs - 1000 }),
    ])
    listMistakes.mockResolvedValue([
      makeMistake({ part: 5 }),
      makeMistake({ part: 5, questionNo: 135 }),
      // lỗi tạo trước hôm nay — không tính
      makeMistake({ part: 3, createdAt: dayRangeMs(DATE).startMs - 5000 }),
    ])
    getSettings.mockResolvedValue(makeSettings())

    const draft = await buildDailyDraft({ date: DATE })

    expect(listByDate).toHaveBeenCalledWith(DATE)
    expect(draft.autoDrafted).toBe(true)
    expect(draft.text).toContain('45 phút')
    expect(draft.text).toContain('Part 5, Part 7')
    expect(draft.text).toContain('Từ mới: commute, deliberate.')
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

  it('ragBaseUrl đã cấu hình → hỏi RAG và dùng câu trả lời; autoDrafted = true', async () => {
    listByDate.mockResolvedValue([makeSession({ part: 5, durationMin: 45 })])
    listVocab.mockResolvedValue([])
    listMistakes.mockResolvedValue([])
    getSettings.mockResolvedValue(makeSettings({ ragBaseUrl: 'http://127.0.0.1:8300' }))
    queryRagMock.mockResolvedValue({
      ok: true,
      answer: 'Nháp do RAG soạn: hôm nay 45 phút Part 5.',
      citations: ['ets2023_t2'],
    })

    const draft = await buildDailyDraft({ date: DATE })

    expect(queryRagMock).toHaveBeenCalledTimes(1)
    const [baseUrl, prompt] = queryRagMock.mock.calls[0]
    expect(baseUrl).toBe('http://127.0.0.1:8300')
    expect(prompt).toContain('45 phút — Part 5')
    expect(draft.text).toBe('Nháp do RAG soạn: hôm nay 45 phút Part 5.')
    expect(draft.autoDrafted).toBe(true)
  })

  it('RAG lỗi (ok: false) → im lặng fallback soạn tại chỗ, không chết', async () => {
    listByDate.mockResolvedValue([makeSession({ part: 5, durationMin: 45 })])
    listVocab.mockResolvedValue([])
    listMistakes.mockResolvedValue([])
    getSettings.mockResolvedValue(makeSettings({ ragBaseUrl: 'http://127.0.0.1:8300' }))
    queryRagMock.mockResolvedValue({
      ok: false,
      reason: 'network',
      message: 'Không kết nối được backend RAG.',
    })

    const draft = await buildDailyDraft({ date: DATE })

    expect(draft.autoDrafted).toBe(true)
    expect(draft.text).toContain('45 phút — Part 5')
  })

  it('số liệu caller truyền sẵn (minutesStudied/partStudied/newWords/mistakesSummary) được ghi đè', async () => {
    listByDate.mockResolvedValue([])
    listVocab.mockResolvedValue([])
    listMistakes.mockResolvedValue([])
    getSettings.mockResolvedValue(makeSettings())

    const draft = await buildDailyDraft({
      date: DATE,
      minutesStudied: 30,
      partStudied: [7, 0, 5], // part 0 bị loại, sắp lại tăng dần
      newWords: 2,
      mistakesSummary: '2 lỗi Part 5 vì quên đổi đơn vị',
    })

    expect(draft.autoDrafted).toBe(true)
    expect(draft.text).toContain('30 phút — Part 5, Part 7')
    expect(draft.text).toContain('Từ mới: 2 từ.')
    expect(draft.text).toContain('2 lỗi Part 5 vì quên đổi đơn vị')
  })

  it('lỗi đọc dữ liệu (IndexedDB hỏng) → trả nháp thay thế, không throw', async () => {
    listByDate.mockRejectedValue(new Error('IndexedDB unavailable'))

    const draft = await buildDailyDraft({ date: DATE })

    expect(draft.autoDrafted).toBe(false)
    expect(draft.text).toContain('chưa có dữ liệu để soạn nháp')
  })
})
