/*
 * Test BUG "Home không tự tải lại sau khi Lưu check-in": TodayPage nạp sessions
 * 1 lần lúc mount — sau khi một khối UI khác (card Check-in) ghi buổi học và phát
 * tín hiệu data-changed, trang phải NẠP LẠI ngay (không phải F5).
 * Mock '@data' ở tầng repo; useSettings/useSubjects thật đọc qua repos mock này.
 */
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Session, Settings } from '@core/types'

vi.mock('@data', () => ({
  repos: {
    sessions: { listBetween: vi.fn(), listByDate: vi.fn() },
    subjects: { list: vi.fn() },
    settings: { get: vi.fn() },
    notes: { get: vi.fn(), upsert: vi.fn() },
    vocab: { list: vi.fn() },
    mistakes: { list: vi.fn() },
    srs: { listDue: vi.fn() },
  },
  todayISO: () => '2026-10-05',
  isServerMode: () => false,
  getServerUrl: () => '',
}))

import { repos } from '@data'
import { emitDataChanged } from '@data/dataEvents'
import TodayPage from './TodayPage'

const listBetween = vi.mocked(repos.sessions.listBetween)

const TODAY = '2026-10-05'

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 1,
    date: TODAY,
    startedAt: new Date(2026, 9, 5, 7, 30).getTime(),
    endedAt: new Date(2026, 9, 5, 8, 0).getTime(),
    durationMin: 30,
    subjectId: 2,
    activity: 'nghe',
    source: 'timer',
    note: '',
    updatedAt: 0,
    ...overrides,
  }
}

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

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={['/']}>
      <TodayPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  listBetween.mockResolvedValue([])
  vi.mocked(repos.subjects.list).mockResolvedValue([])
  vi.mocked(repos.settings.get).mockResolvedValue(makeSettings())
  vi.mocked(repos.notes.get).mockResolvedValue(undefined)
  vi.mocked(repos.vocab.list).mockResolvedValue([])
  vi.mocked(repos.mistakes.list).mockResolvedValue([])
  vi.mocked(repos.srs.listDue).mockResolvedValue([])
})

describe('TodayPage — nạp lại khi nhận tín hiệu data-changed', () => {
  it('Check-in lưu buổi xong phát tín hiệu sessions → Home nạp lại: vòng tiến độ + danh sách cập nhật', async () => {
    listBetween.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText(/chưa có buổi học nào/)).toBeVisible()

    // Card Check-in lưu 1 buổi 30 phút rồi phát tín hiệu (cùng cơ chế emitDataChanged).
    listBetween.mockResolvedValue([makeSession({ activity: 'Check-in', source: 'manual' })])
    await act(async () => {
      emitDataChanged('sessions')
    })

    expect(await screen.findByText('1 buổi')).toBeVisible()
    expect(screen.getByText('Check-in')).toBeVisible()
    expect(screen.queryByText(/chưa có buổi học nào/)).toBeNull()
    // Vòng tiến độ cũng cập nhật: 30/60 phút.
    expect(screen.getByText('30/60 phút')).toBeVisible()
  })

  it('tín hiệu của bảng khác (notes) không làm Home nạp lại phần sessions', async () => {
    renderPage()
    expect(await screen.findByText(/chưa có buổi học nào/)).toBeVisible()
    const callsBefore = listBetween.mock.calls.length

    await act(async () => {
      emitDataChanged('notes')
    })

    expect(listBetween.mock.calls.length).toBe(callsBefore)
  })
})
