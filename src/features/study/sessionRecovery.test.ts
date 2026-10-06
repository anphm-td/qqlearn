/*
 * Test lưu/khôi phục phiên bấm giờ (sessionRecovery — thuần, không React).
 * jsdom có sessionStorage sẵn — đúng môi trường trình duyệt cho tính năng này.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearSessionState,
  loadSessionState,
  saveSessionState,
} from './sessionRecovery'

const STATE = {
  date: '2026-10-04',
  phase: 'running' as const,
  timer: { running: true, startedAt: 1_759_500_000_000, accumulatedMs: 300_000 },
  targetMin: 25,
  subjectId: 2,
  activity: 'ngữ pháp',
  breakEndsAt: null,
  sessionStartAt: 1_759_498_200_000,
}

beforeEach(() => {
  clearSessionState()
})

describe('saveSessionState / loadSessionState', () => {
  it('lưu rồi đọc lại → đủ 9 trường, giữ nguyên timestamp', () => {
    saveSessionState(STATE)
    expect(loadSessionState('2026-10-04')).toEqual(STATE)
  })

  it('đọc khi chưa lưu gì → null', () => {
    expect(loadSessionState('2026-10-04')).toBeNull()
  })

  it('phiên của NGÀY KHÁC → bỏ (không khôi phục phiên qua đêm)', () => {
    saveSessionState(STATE)
    expect(loadSessionState('2026-10-05')).toBeNull()
    // key sai ngày bị dọn luôn — lần sau đọc không treo dữ liệu cũ
    expect(sessionStorage.getItem('qlearn.session.timer.v1')).toBeNull()
  })

  it('JSON hỏng trong sessionStorage → null, không ném', () => {
    sessionStorage.setItem('qlearn.session.timer.v1', '{không phải json')
    expect(loadSessionState('2026-10-04')).toBeNull()
  })

  it('phase lạ (sai schema) → null, không khôi phục', () => {
    sessionStorage.setItem(
      'qlearn.session.timer.v1',
      JSON.stringify({ ...STATE, phase: 'weird' }),
    )
    expect(loadSessionState('2026-10-04')).toBeNull()
  })

  it('clearSessionState xóa key', () => {
    saveSessionState(STATE)
    clearSessionState()
    expect(loadSessionState('2026-10-04')).toBeNull()
  })
})
