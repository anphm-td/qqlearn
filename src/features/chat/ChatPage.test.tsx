import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChatMessage, Settings } from '@core/types'

// Mock lớp data + client RAG — trang chat không đụng Dexie/db trực tiếp.
vi.mock('@data', () => ({
  repos: {
    chat: {
      listBySession: vi.fn(),
      append: vi.fn(),
      removeSession: vi.fn(),
    },
    settings: { get: vi.fn() },
  },
}))

vi.mock('@/features/smart/ragClient', () => ({
  queryRag: vi.fn(),
  RAG_NOT_CONNECTED_MESSAGE: 'Chưa kết nối máy trợ lý — nhập địa chỉ máy trợ lý trong Cài đặt',
}))

import { repos } from '@data'
import { queryRag } from '@/features/smart/ragClient'
import ChatPage, { CHAT_SESSION_STORAGE_KEY } from './ChatPage'

const listBySession = vi.mocked(repos.chat.listBySession)
const append = vi.mocked(repos.chat.append)
const getSettings = vi.mocked(repos.settings.get)
const queryRagMock = vi.mocked(queryRag)

const SESSION_ID = 'session-test'

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    id: 1,
    dailyGoalMinutes: 60,
    targetScore: 700,
    examDate: '',
    reminderTime: '',
    ragBaseUrl: 'http://127.0.0.1:8300',
    onboardingDone: true,
    checkinEnabled: true,
    pomodoro: { focusMin: 25, breakMin: 5 },
    syncMode: 'local',
    serverUrl: '',
    updatedAt: 0,
    ...overrides,
  }
}

function mockAppendEcho(): void {
  append.mockImplementation(async (sessionId, role, content) => {
    const now = Date.now()
    const message: ChatMessage = {
      id: now % 100000,
      sessionId,
      role,
      content,
      createdAt: now,
      updatedAt: now,
    }
    return message
  })
}

function renderPage(): void {
  render(
    <MemoryRouter>
      <ChatPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  window.localStorage.setItem(CHAT_SESSION_STORAGE_KEY, SESSION_ID)
  listBySession.mockResolvedValue([])
  getSettings.mockResolvedValue(makeSettings())
  mockAppendEcho()
})

describe('ChatPage (D13) — /tro-chuyên', () => {
  it('ragBaseUrl rỗng → trạng thái rõ ràng với thông điệp chuẩn + link Cài đặt, không hiện ô nhập', async () => {
    getSettings.mockResolvedValue(makeSettings({ ragBaseUrl: '' }))

    renderPage()

    expect(
      await screen.findByText('Chưa kết nối máy trợ lý — nhập địa chỉ máy trợ lý trong Cài đặt'),
    ).toBeVisible()
    expect(screen.getByText(/Máy trợ lý chạy trên máy tính của bạn/)).toBeVisible()
    const link = screen.getByRole('link', { name: 'Mở Cài đặt' })
    expect(link).toHaveAttribute('href', '/caidat')
    expect(screen.queryByRole('button', { name: 'Gửi' })).toBeNull()
  })

  it('đã cấu hình + lịch trống → empty state mời hỏi', async () => {
    renderPage()

    expect(await screen.findByText(/Hỏi bất cứ điều gì/)).toBeVisible()
  })

  it('gửi câu hỏi → lưu 2 tin nhắn (user + assistant) vào chatMessages và hiện bong bóng', async () => {
    queryRagMock.mockResolvedValue({ ok: true, answer: 'Câu 134 chọn B vì …', citations: [] })

    renderPage()

    // khung soạn tin chỉ hiện sau khi tải xong lịch + settings
    const composer = await screen.findByLabelText('Câu hỏi cho trợ lý')
    fireEvent.change(composer, {
      target: { value: 'Giải thích câu 134' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi' }))

    expect(await screen.findByText('Câu 134 chọn B vì …')).toBeVisible()
    expect(screen.getByText('Giải thích câu 134')).toBeVisible()
    expect(append).toHaveBeenCalledWith(SESSION_ID, 'user', 'Giải thích câu 134')
    expect(append).toHaveBeenCalledWith(SESSION_ID, 'assistant', 'Câu 134 chọn B vì …')
    expect(queryRagMock).toHaveBeenCalledTimes(1)
    expect(queryRagMock.mock.calls[0][0]).toBe('http://127.0.0.1:8300')
    expect(queryRagMock.mock.calls[0][1]).toBe('Giải thích câu 134')
  })

  it('fetch lỗi → hiển thị cảnh báo thân thiện, ô nhập vẫn usable (UI không chết)', async () => {
    queryRagMock.mockResolvedValue({
      ok: false,
      reason: 'network',
      message: 'Không kết nối được máy trợ lý. Kiểm tra máy trợ lý đã mở chưa rồi thử lại nhé.',
    })

    renderPage()

    const composer = await screen.findByLabelText('Câu hỏi cho trợ lý')
    fireEvent.change(composer, {
      target: { value: 'Hỏi lúc backend chưa chạy' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi' }))

    expect(await screen.findByRole('alert')).toBeVisible()
    expect(screen.getByText(/Không kết nối được máy trợ lý/)).toBeVisible()
    // tin nhắn user vẫn giữ nguyên trong hội thoại
    expect(screen.getByText('Hỏi lúc backend chưa chạy')).toBeVisible()
    // có thể gửi tiếp được
    expect(screen.getByLabelText('Câu hỏi cho trợ lý')).toBeEnabled()
  })

  it('tải lại trang → lịch của phiên được đọc từ chatMessages', async () => {
    const now = Date.now()
    listBySession.mockResolvedValue([
      { id: 1, sessionId: SESSION_ID, role: 'user', content: 'câu hỏi cũ', createdAt: now - 1000, updatedAt: now - 1000 },
      { id: 2, sessionId: SESSION_ID, role: 'assistant', content: 'câu trả lời cũ', createdAt: now, updatedAt: now },
    ])

    renderPage()

    expect(await screen.findByText('câu hỏi cũ')).toBeVisible()
    expect(screen.getByText('câu trả lời cũ')).toBeVisible()
    expect(listBySession).toHaveBeenCalledWith(SESSION_ID)
  })

  it('bắt đầu trò chuyện mới → đổi sessionId, dọn khung chat', async () => {
    const now = Date.now()
    listBySession.mockResolvedValue([
      { id: 1, sessionId: SESSION_ID, role: 'user', content: 'câu hỏi cũ', createdAt: now, updatedAt: now },
    ])

    renderPage()
    await screen.findByText('câu hỏi cũ')

    fireEvent.click(screen.getByRole('button', { name: 'bắt đầu trò chuyện mới' }))

    expect(screen.queryByText('câu hỏi cũ')).toBeNull()
    expect(window.localStorage.getItem(CHAT_SESSION_STORAGE_KEY)).not.toBe(SESSION_ID)
  })
})
