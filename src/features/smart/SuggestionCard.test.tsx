import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Mistake, Session, Settings, SrsCard } from '@core/types'

// Mock lớp data — card không được đụng Dexie/db trực tiếp, chỉ qua repos.
vi.mock('@data', () => ({
  repos: {
    settings: { get: vi.fn() },
    mistakes: { list: vi.fn() },
    srs: { listDue: vi.fn() },
    sessions: { listBetween: vi.fn() },
  },
}))

vi.mock('@/features/smart/ragClient', () => ({
  queryRag: vi.fn(),
  RAG_NOT_CONNECTED_MESSAGE: 'Chưa kết nối máy trợ lý — nhập địa chỉ máy trợ lý trong Cài đặt',
}))

import { repos } from '@data'
import { queryRag } from '@/features/smart/ragClient'
import SuggestionCard from './SuggestionCard'

const getSettings = vi.mocked(repos.settings.get)
const listMistakes = vi.mocked(repos.mistakes.list)
const listDue = vi.mocked(repos.srs.listDue)
const listBetween = vi.mocked(repos.sessions.listBetween)
const queryRagMock = vi.mocked(queryRag)

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

function makeMistake(overrides: Partial<Mistake> = {}): Mistake {
  return {
    id: 1,
    testNo: 0,
    part: 5,
    questionNo: 1,
    myAnswer: 'A',
    correctAnswer: 'B',
    cause: 'ngữ pháp',
    explanation: '',
    reviewed: false,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 1,
    date: '2026-10-03',
    startedAt: 0,
    endedAt: 0,
    durationMin: 25,
    part: 5,
    activity: 'ngữ pháp',
    source: 'timer',
    note: '',
    updatedAt: 0,
    ...overrides,
  }
}

function makeCard(overrides: Partial<SrsCard> = {}): SrsCard {
  return {
    id: 1,
    vocabId: 1,
    box: 1,
    dueDate: '2026-10-03',
    lastReviewed: null,
    correctCount: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function renderCard(): void {
  render(
    <MemoryRouter>
      <SuggestionCard />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getSettings.mockResolvedValue(makeSettings())
})

describe('SuggestionCard (D14) — card "Hôm nay nên học gì"', () => {
  it('giữ tiêu đề ghép chéo với Home: "Gợi ý hôm nay"', async () => {
    listMistakes.mockResolvedValue([])
    listDue.mockResolvedValue([])
    listBetween.mockResolvedValue([])

    renderCard()

    expect(screen.getByText('Gợi ý hôm nay')).toBeVisible()
  })

  it('ưu tiên 1: có lỗi sai chưa reviewed → gợi ý ôn lỗi sai', async () => {
    listMistakes.mockResolvedValue([makeMistake(), makeMistake({ reviewed: true }), makeMistake()])
    listDue.mockResolvedValue([makeCard(), makeCard()]) // bị lỗi sai che
    listBetween.mockResolvedValue([])

    renderCard()

    expect(await screen.findByText(/2 lỗi sai chưa ôn lại/)).toBeVisible()
  })

  it('ưu tiên 2: không có lỗi sai nhưng có thẻ đến hạn → gợi ý ôn từ vựng', async () => {
    listMistakes.mockResolvedValue([])
    listDue.mockResolvedValue([makeCard(), makeCard(), makeCard()])
    listBetween.mockResolvedValue([])

    renderCard()

    expect(await screen.findByText(/3 từ đến hạn ôn hôm nay/)).toBeVisible()
  })

  it('ưu tiên 3: 7 ngày qua có học nhưng còn part chưa chạm → gợi ý part đó', async () => {
    listMistakes.mockResolvedValue([])
    listDue.mockResolvedValue([])
    listBetween.mockResolvedValue([
      makeSession({ part: 3, durationMin: 90 }),
      makeSession({ part: 5, durationMin: 25 }),
    ])

    renderCard()

    // part chưa học = 0 phút → ít nhất; các buổi này đủ để tổng > 0
    expect(await screen.findByText(/chưa chạm Part 1/)).toBeVisible()
  })

  it('không có dữ liệu gì → empty state mời bắt đầu kèm nút tới trang Học', async () => {
    listMistakes.mockResolvedValue([])
    listDue.mockResolvedValue([])
    listBetween.mockResolvedValue([])

    renderCard()

    expect(await screen.findByText(/Chưa có dữ liệu để gợi ý/)).toBeVisible()
    const link = screen.getByRole('link', { name: 'Bắt đầu học' })
    expect(link).toHaveAttribute('href', '/hoc')
  })

  it('đọc dữ liệu lỗi → empty state, không làm Home chết', async () => {
    listMistakes.mockRejectedValue(new Error('IndexedDB unavailable'))

    renderCard()

    expect(await screen.findByText(/Chưa đọc được sổ tay/)).toBeVisible()
  })

  it('ragBaseUrl đã cấu hình → hỏi RAG và hiện thêm câu trả lời của trợ lý', async () => {
    getSettings.mockResolvedValue(makeSettings({ ragBaseUrl: 'http://127.0.0.1:8300' }))
    listMistakes.mockResolvedValue([])
    listDue.mockResolvedValue([makeCard()])
    listBetween.mockResolvedValue([])
    queryRagMock.mockResolvedValue({
      ok: true,
      answer: 'Ôn từ "commute" bằng 1 câu ví dụ.',
      citations: [],
    })

    renderCard()

    expect(await screen.findByText('Ôn từ "commute" bằng 1 câu ví dụ.')).toBeVisible()
    expect(screen.getByText('— từ trợ lý học tập')).toBeVisible()
    expect(queryRagMock).toHaveBeenCalledTimes(1)
    expect(queryRagMock.mock.calls[0][0]).toBe('http://127.0.0.1:8300')
  })

  it('ragBaseUrl rỗng → chỉ gợi ý tại chỗ, có dòng mời kết nối backend', async () => {
    listMistakes.mockResolvedValue([])
    listDue.mockResolvedValue([makeCard()])
    listBetween.mockResolvedValue([])

    renderCard()

    expect(await screen.findByText(/1 từ đến hạn ôn hôm nay/)).toBeVisible()
    expect(screen.getByText(/Kết nối máy trợ lý trong Cài đặt/)).toBeVisible()
    expect(queryRagMock).not.toHaveBeenCalled()
  })

  it('đọc settings lỗi nhưng card vẫn render (không unhandled rejection)', async () => {
    getSettings.mockRejectedValue(new Error('IndexedDB unavailable'))
    listMistakes.mockResolvedValue([])
    listDue.mockResolvedValue([])
    listBetween.mockResolvedValue([])

    renderCard()

    expect(await screen.findByText(/Chưa đọc được sổ tay/)).toBeVisible()
  })
})
