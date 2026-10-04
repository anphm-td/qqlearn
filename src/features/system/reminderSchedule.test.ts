/*
 * Test logic thuần tính toán thời điểm nhắc lịch (C12 — nhóm D).
 * Chạy: npx vitest run src/features/system
 */
import { describe, expect, it } from 'vitest'

import {
  catchUpNeeded,
  minutesToTime,
  nextOccurrence,
  occurrenceAt,
  parseTimeHM,
  stepTime,
  timeToMinutes,
} from './reminderSchedule'

const d = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m, 0, 0)

describe('parseTimeHM', () => {
  it('đọc đúng định dạng H:mm / HH:mm', () => {
    expect(parseTimeHM('19:00')).toEqual({ h: 19, m: 0 })
    expect(parseTimeHM('7:05')).toEqual({ h: 7, m: 5 })
    expect(parseTimeHM(' 21:30 ')).toEqual({ h: 21, m: 30 })
  })

  it('từ chối giá trị sai', () => {
    expect(parseTimeHM('24:00')).toBeNull()
    expect(parseTimeHM('19:60')).toBeNull()
    expect(parseTimeHM('19:5')).toBeNull()
    expect(parseTimeHM('19h00')).toBeNull()
    expect(parseTimeHM('')).toBeNull()
  })
})

describe('timeToMinutes / minutesToTime', () => {
  it('đổi qua lại', () => {
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('23:59')).toBe(1439)
    expect(timeToMinutes('06:30')).toBe(390)
    expect(minutesToTime(0)).toBe('00:00')
    expect(minutesToTime(1439)).toBe('23:59')
    expect(minutesToTime(725)).toBe('12:05')
  })

  it('wrap qua nửa đêm, kể cả số âm', () => {
    expect(minutesToTime(1445)).toBe('00:05')
    expect(minutesToTime(-15)).toBe('23:45')
    expect(minutesToTime(-1440)).toBe('00:00')
  })
})

describe('stepTime (stepper −/+ cho giờ nhắc)', () => {
  it('bước 15 phút và wrap qua nửa đêm', () => {
    expect(stepTime('19:00', 15)).toBe('19:15')
    expect(stepTime('19:00', -15)).toBe('18:45')
    expect(stepTime('23:50', 15)).toBe('00:05')
    expect(stepTime('00:05', -15)).toBe('23:50')
  })

  it('giờ sai → giữ nguyên', () => {
    expect(stepTime('rác', 15)).toBe('rác')
    expect(stepTime('', 15)).toBe('')
  })
})

describe('occurrenceAt', () => {
  it('mốc cùng ngày theo giờ địa phương', () => {
    expect(occurrenceAt(d(3, 10), '19:00')).toBe(d(3, 19, 0).getTime())
  })

  it('giờ sai → null', () => {
    expect(occurrenceAt(d(3, 10), '99:00')).toBeNull()
  })
})

describe('nextOccurrence', () => {
  it('chưa tới giờ hôm nay → hôm nay', () => {
    expect(nextOccurrence(d(3, 18), '19:00')).toBe(d(3, 19).getTime())
  })

  it('đã qua giờ hôm nay → mai', () => {
    expect(nextOccurrence(d(3, 19, 30), '19:00')).toBe(d(4, 19).getTime())
  })

  it('đúng bằng mốc → tính là đã lỡ, hẹn sang mai', () => {
    expect(nextOccurrence(d(3, 19), '19:00')).toBe(d(4, 19).getTime())
  })

  it('giờ sai → null', () => {
    expect(nextOccurrence(d(3, 10), '')).toBeNull()
  })
})

describe('catchUpNeeded (bù lời nhắc khi mở lại app)', () => {
  const GRACE = 90

  it('mới lỡ trong khoảng grace → nhắc bù', () => {
    expect(catchUpNeeded(d(3, 19, 30), '19:00', GRACE)).toBe(true)
    expect(catchUpNeeded(d(3, 20, 29), '19:00', GRACE)).toBe(true)
  })

  it('đúng ngay mốc → nhắc bù (timer sẽ đặt cho ngày mai)', () => {
    expect(catchUpNeeded(d(3, 19), '19:00', GRACE)).toBe(true)
  })

  it('lỡ quá lâu / chưa tới giờ → không bù', () => {
    expect(catchUpNeeded(d(3, 21), '19:00', GRACE)).toBe(false)
    expect(catchUpNeeded(d(3, 18), '19:00', GRACE)).toBe(false)
  })

  it('grace 0 → không bù nữa', () => {
    expect(catchUpNeeded(d(3, 19, 30), '19:00', 0)).toBe(false)
  })

  it('giờ sai → không bù', () => {
    expect(catchUpNeeded(d(3, 19, 30), '', GRACE)).toBe(false)
  })
})
