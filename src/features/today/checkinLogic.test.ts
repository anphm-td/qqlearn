/*
 * Test logic thuần check-in ("Hỏi giờ học khi mở app") — điều kiện 15 phút giữa
 * hai lần hỏi + đọc giá trị localStorage an toàn.
 */
import { describe, expect, it } from 'vitest'

import { CHECKIN_COOLDOWN_MIN, parseLastPromptAt, shouldPromptCheckin } from './checkinLogic'

const NOW = 1_800_000_000_000
const MIN = 60_000

describe('shouldPromptCheckin — điều kiện hiện lời hỏi khi mở app', () => {
  const base = { enabled: true, onboardingDone: true, now: NOW }

  it('chưa từng hỏi trên máy này (lastPromptAt null) → hỏi ngay', () => {
    expect(shouldPromptCheckin({ ...base, lastPromptAt: null })).toBe(true)
  })

  it('mới hỏi DƯỚI 15 phút → chưa hỏi lại', () => {
    expect(shouldPromptCheckin({ ...base, lastPromptAt: NOW - 14 * MIN })).toBe(false)
    expect(shouldPromptCheckin({ ...base, lastPromptAt: NOW - 1 * MIN })).toBe(false)
  })

  it('đủ 15 phút (biên) và quá 15 phút → hỏi lại', () => {
    expect(shouldPromptCheckin({ ...base, lastPromptAt: NOW - CHECKIN_COOLDOWN_MIN * MIN })).toBe(true)
    expect(shouldPromptCheckin({ ...base, lastPromptAt: NOW - 16 * MIN })).toBe(true)
  })

  it('tắt trong Cài đặt → không hỏi dù đã quá 15 phút', () => {
    expect(shouldPromptCheckin({ enabled: false, onboardingDone: true, lastPromptAt: null, now: NOW })).toBe(false)
  })

  it('chưa xong onboarding → không hỏi', () => {
    expect(shouldPromptCheckin({ enabled: true, onboardingDone: false, lastPromptAt: null, now: NOW })).toBe(false)
  })
})

describe('parseLastPromptAt — đọc epoch ms lần hỏi gần nhất', () => {
  it('không có giá trị / chuỗi rỗng → null', () => {
    expect(parseLastPromptAt(null)).toBeNull()
    expect(parseLastPromptAt('')).toBeNull()
  })

  it('giá trị hỏng hoặc không hợp lệ → null', () => {
    expect(parseLastPromptAt('không-phải-số')).toBeNull()
    expect(parseLastPromptAt('0')).toBeNull()
    expect(parseLastPromptAt('-5')).toBeNull()
    expect(parseLastPromptAt('NaN')).toBeNull()
  })

  it('epoch ms hợp lệ → trả số', () => {
    expect(parseLastPromptAt('1800000000000')).toBe(1_800_000_000_000)
    expect(parseLastPromptAt('123')).toBe(123)
  })
})
