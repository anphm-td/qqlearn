import { describe, expect, it } from 'vitest'

import {
  buildWeek,
  clampInt,
  computeStreak,
  daysUntil,
  formatDayShort,
  formatHHMM,
  greeting,
  lastNDays,
  localEpoch,
  percentOfDay,
  summarizeDay,
  weekdayShort,
} from './todayLogic'

describe('summarizeDay — tổng hợp buổi học trong ngày', () => {
  it('cộng durationMin, đếm buổi, gộp môn (bỏ môn 0), lấy bắt đầu sớm nhất', () => {
    const sessions = [
      { durationMin: 25, subjectId: 3, startedAt: 100 },
      { durationMin: 30, subjectId: 0, startedAt: 50 },
      { durationMin: 5, subjectId: 3, startedAt: 200 },
    ]
    expect(summarizeDay(sessions)).toEqual({
      totalMinutes: 60,
      sessionCount: 3,
      subjectsStudied: [3],
      firstStartedAt: 50,
    })
  })

  it('mảng rỗng → tổng 0, không buổi, không môn', () => {
    expect(summarizeDay([])).toEqual({ totalMinutes: 0, sessionCount: 0, subjectsStudied: [], firstStartedAt: null })
  })
})

describe('percentOfDay — % hoàn thành mục tiêu ngày', () => {
  it('tính đúng và làm tròn', () => {
    expect(percentOfDay(45, 90)).toBe(50)
    expect(percentOfDay(52, 90)).toBe(58)
  })
  it('chặn 0–100', () => {
    expect(percentOfDay(100, 90)).toBe(100)
    expect(percentOfDay(0, 90)).toBe(0)
  })
  it('mục tiêu ≤ 0 → 0', () => {
    expect(percentOfDay(30, 0)).toBe(0)
    expect(percentOfDay(30, -5)).toBe(0)
  })
})

describe('lastNDays — 7 ngày kết thúc hôm nay (vượt ranh tháng)', () => {
  it('trả 7 ngày tăng dần, phần tử cuối = hôm nay', () => {
    expect(lastNDays('2026-10-03', 7)).toEqual([
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ])
  })
})

describe('weekdayShort / formatDayShort — nhãn thứ theo ngày local', () => {
  it('2026-10-03 là thứ Bảy, 2026-10-04 là CN', () => {
    expect(weekdayShort('2026-10-03')).toBe('T7')
    expect(weekdayShort('2026-10-04')).toBe('CN')
  })
  it('formatDayShort ghép thứ + d/m', () => {
    expect(formatDayShort('2026-10-03')).toBe('T7 · 3/10')
  })
})

describe('buildWeek — tuần 7 BubbleCheck', () => {
  it('đánh dấu done khi ngày có học (phút > 0), isToday đúng hôm nay', () => {
    const sessions = [
      { date: '2026-09-28', durationMin: 25 },
      { date: '2026-10-02', durationMin: 40 },
      { date: '2026-10-03', durationMin: 0 }, // buổi 0 phút — không tính
    ]
    const week = buildWeek('2026-10-03', sessions)
    expect(week).toHaveLength(7)
    expect(week[0].date).toBe('2026-09-27')
    expect(week[0].done).toBe(false)
    expect(week[1]).toMatchObject({ date: '2026-09-28', minutes: 25, done: true, isToday: false })
    expect(week[5]).toMatchObject({ date: '2026-10-02', minutes: 40, done: true })
    expect(week[6]).toMatchObject({ date: '2026-10-03', minutes: 0, done: false, isToday: true })
  })

  it('cộng nhiều buổi cùng ngày', () => {
    const week = buildWeek('2026-10-03', [
      { date: '2026-10-03', durationMin: 25 },
      { date: '2026-10-03', durationMin: 30 },
    ])
    expect(week[6]).toMatchObject({ minutes: 55, done: true })
  })
})

describe('computeStreak — chuỗi ngày học liên tiếp', () => {
  it('đếm lùi từ hôm nay', () => {
    const sessions = [
      { date: '2026-10-01', durationMin: 25 },
      { date: '2026-10-02', durationMin: 25 },
      { date: '2026-10-03', durationMin: 25 },
    ]
    expect(computeStreak(sessions, '2026-10-03')).toBe(3)
  })

  it('hôm nay chưa học → streak được bảo toàn, đếm từ hôm qua', () => {
    const sessions = [
      { date: '2026-10-01', durationMin: 25 },
      { date: '2026-10-02', durationMin: 25 },
    ]
    expect(computeStreak(sessions, '2026-10-03')).toBe(2)
  })

  it('hôm nay học nhưng hôm qua trống → streak = 1', () => {
    const sessions = [
      { date: '2026-09-30', durationMin: 25 },
      { date: '2026-10-03', durationMin: 25 },
    ]
    expect(computeStreak(sessions, '2026-10-03')).toBe(1)
  })

  it('chưa học ngày nào → 0', () => {
    expect(computeStreak([{ date: '2026-10-03', durationMin: 0 }], '2026-10-03')).toBe(0)
    expect(computeStreak([], '2026-10-03')).toBe(0)
  })
})

describe('clampInt — chốt số nguyên cho ô nhập tự do (mục 3)', () => {
  it('ép vào khoảng [min, max] và làm tròn', () => {
    expect(clampInt('95', 5, 1440)).toBe(95)
    expect(clampInt(2, 5, 100)).toBe(5)
    expect(clampInt(9999, 5, 100)).toBe(100)
    expect(clampInt(7.6, 5, 100)).toBe(8)
  })
  it('không hiểu được → fallback', () => {
    expect(clampInt('abc', 5, 100, 90)).toBe(90)
    expect(clampInt('', 5, 100, 12)).toBe(12)
  })
})

describe('daysUntil — đếm ngày tới ngày thi', () => {
  it('dương khi chưa tới, âm khi đã qua, 0 khi trùng', () => {
    expect(daysUntil('2026-10-03', '2026-12-15')).toBe(73)
    expect(daysUntil('2026-12-15', '2026-10-03')).toBe(-73)
    expect(daysUntil('2026-10-03', '2026-10-03')).toBe(0)
  })
})

describe('greeting — lời chào theo giờ', () => {
  it('sáng / chiều / tối', () => {
    expect(greeting(8)).toBe('Chào buổi sáng')
    expect(greeting(11)).toBe('Chào buổi sáng')
    expect(greeting(14)).toBe('Chào buổi chiều')
    expect(greeting(17)).toBe('Chào buổi chiều')
    expect(greeting(21)).toBe('Chào buổi tối')
    expect(greeting(3)).toBe('Chào buổi tối')
  })
})

describe('formatHHMM / localEpoch — giờ nhập tay buổi học', () => {
  it('formatHHMM trả HH:mm local', () => {
    expect(formatHHMM(new Date(2026, 9, 3, 8, 5).getTime())).toBe('08:05')
    expect(formatHHMM(new Date(2026, 9, 3, 21, 47).getTime())).toBe('21:47')
  })
  it('localEpoch khớp Date local tương ứng', () => {
    expect(localEpoch('2026-10-03', '08:05')).toBe(new Date(2026, 9, 3, 8, 5).getTime())
    expect(localEpoch('2026-10-03', '00:00')).toBe(new Date(2026, 9, 3).getTime())
  })
})
