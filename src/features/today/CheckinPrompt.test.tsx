/*
 * Test Check-in "Hỏi giờ học khi mở app" — phần phát tín hiệu data-changed:
 * cả Lưu (tạo buổi học manual) lẫn Bỏ qua (đóng card) phải phát để các trang
 * đang mở (Home…) tự nạp lại. BUG: Home không tự thấy buổi vừa lưu, phải F5.
 * Nghe qua onDataChanged THẬT (không mock) để bọc trọn vòng phát → nhận.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Session, Settings } from '@core/types'

// Mock lớp data — CheckinPrompt chỉ được đụng dữ liệu qua repos (không Dexie trực tiếp).
vi.mock('@data', () => ({
  repos: {
    sessions: { create: vi.fn() },
    settings: { get: vi.fn() },
  },
  todayISO: () => '2026-10-05',
}))

import { repos } from '@data'
import { onDataChanged } from '@data/dataEvents'
import CheckinPrompt from './CheckinPrompt'

const createSession = vi.mocked(repos.sessions.create)
const getSettings = vi.mocked(repos.settings.get)

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

/** Buổi Check-in mà repo trả về sau khi create thành công. */
function makeSavedSession(): Session {
  return {
    id: 1,
    date: '2026-10-05',
    startedAt: 0,
    endedAt: 60_000,
    durationMin: 1,
    subjectId: 0,
    activity: 'Check-in',
    source: 'manual',
    note: '',
    updatedAt: 0,
  }
}

function renderPrompt(): void {
  render(
    <MemoryRouter>
      <CheckinPrompt />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  getSettings.mockResolvedValue(makeSettings())
  createSession.mockResolvedValue(makeSavedSession())
})

describe('CheckinPrompt — phát tín hiệu data-changed cho các trang đang mở', () => {
  it('Lưu vào sổ: tạo buổi manual (subjectId 0) thành công và phát tín hiệu sessions', async () => {
    const seen: Array<{ table: string }> = []
    const off = onDataChanged((detail) => seen.push(detail))
    renderPrompt()

    fireEvent.click(await screen.findByRole('button', { name: 'Lưu vào sổ' }))

    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1))
    expect(createSession.mock.calls[0][0]).toMatchObject({
      subjectId: 0,
      source: 'manual',
      activity: 'Check-in',
    })
    await waitFor(() => expect(seen).toEqual([{ table: 'sessions' }]))
    off()
  })

  it('Lỗi lưu (create throw) → KHÔNG phát tín hiệu, hiện lỗi cho người thử lại', async () => {
    const handler = vi.fn()
    const off = onDataChanged(handler)
    createSession.mockRejectedValue(new Error('IndexedDB unavailable'))
    renderPrompt()

    fireEvent.click(await screen.findByRole('button', { name: 'Lưu vào sổ' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeVisible())
    expect(handler).not.toHaveBeenCalled()
    off()
  })

  it('Bỏ qua: không tạo buổi nhưng vẫn phát tín hiệu rồi đóng card', async () => {
    const handler = vi.fn()
    const off = onDataChanged(handler)
    renderPrompt()

    fireEvent.click(await screen.findByRole('button', { name: 'Bỏ qua' }))

    await waitFor(() => expect(handler).toHaveBeenCalledWith({ table: 'sessions' }))
    expect(createSession).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
    off()
  })
})
