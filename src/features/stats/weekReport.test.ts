/*
 * Test logic thuần báo cáo tuần (weekReport.ts) — tuần mẫu bắt đầu thứ Hai 2026-09-28.
 */
import { describe, expect, it } from 'vitest'

import { epochOfDayStartISO } from './statsAgg'
import { buildWeekReport, describeDelta, summarizeWeek, weekRangeOf } from './weekReport'

/** Epoch ms tại giờ h:h của ngày ISO (local) — để tạo createdAt cho mistakes. */
const at = (iso: string, h = 10) => epochOfDayStartISO(iso) + h * 3_600_000

describe('weekRangeOf', () => {
  it('tuần 28/9 → 4/10', () => {
    expect(weekRangeOf('2026-09-28')).toEqual({ start: '2026-09-28', end: '2026-10-04' })
  })
  it('tuần sau 5/10 → 11/10', () => {
    expect(weekRangeOf('2026-10-05')).toEqual({ start: '2026-10-05', end: '2026-10-11' })
  })
})

describe('summarizeWeek — lọc đúng khoảng tuần', () => {
  const input = {
    weekStart: '2026-09-28',
    range: weekRangeOf('2026-09-28'),
    sessions: [
      { date: '2026-09-29', durationMin: 30 }, // trong tuần
      { date: '2026-09-29', durationMin: 15 }, // cùng ngày, buổi thứ 2
      { date: '2026-10-03', durationMin: 45 }, // trong tuần
      { date: '2026-10-05', durationMin: 60 }, // tuần sau — loại
      { date: '2026-09-22', durationMin: 120 }, // tuần trước — loại
      { date: '2026-10-01', durationMin: 0 }, // 0 phút — không đếm
    ],
    notes: [
      { date: '2026-09-29', newWords: 5 },
      { date: '2026-10-03', newWords: 3 },
      { date: '2026-09-23', newWords: 10 }, // tuần trước — loại
      { date: '2026-10-06', newWords: 7 }, // tuần sau — loại
    ],
    mistakes: [{ createdAt: at('2026-09-30') }, { createdAt: at('2026-10-02') }, { createdAt: at('2026-09-23') }, { createdAt: at('2026-10-06') }],
  }

  it('gom đủ: phút, buổi, ngày học, từ mới, lỗi sai', () => {
    expect(summarizeWeek(input)).toEqual({
      minutes: 90,
      sessionCount: 3,
      daysStudied: 2,
      newWords: 8,
      mistakeCount: 2,
    })
  })

  it('mistakes createdAt đúng ranh giới: đầu tuần tính, đầu tuần sau không tính', () => {
    const edge = summarizeWeek({
      ...input,
      mistakes: [{ createdAt: epochOfDayStartISO('2026-09-28') }, { createdAt: at('2026-10-04', 23) }],
    })
    expect(edge.mistakeCount).toBe(2)

    const outside = summarizeWeek({ ...input, mistakes: [{ createdAt: epochOfDayStartISO('2026-10-05') }] })
    expect(outside.mistakeCount).toBe(0)
  })
})

describe('buildWeekReport — so với tuần liền trước', () => {
  const report = buildWeekReport({
    weekStart: '2026-09-28',
    sessions: [
      { date: '2026-09-29', durationMin: 30 },
      { date: '2026-09-29', durationMin: 15 },
      { date: '2026-10-03', durationMin: 45 },
      { date: '2026-09-22', durationMin: 120 },
    ],
    notes: [
      { date: '2026-09-29', newWords: 5 },
      { date: '2026-10-03', newWords: 3 },
      { date: '2026-09-23', newWords: 10 },
    ],
    mistakes: [{ createdAt: at('2026-09-30') }, { createdAt: at('2026-10-02') }, { createdAt: at('2026-09-23') }],
  })

  it('tuần hiện tại 90 phút / 3 buổi / 8 từ mới / 2 lỗi', () => {
    expect(report.totals).toEqual({
      minutes: 90,
      sessionCount: 3,
      daysStudied: 2,
      newWords: 8,
      mistakeCount: 2,
    })
  })

  it('tuần trước 120 phút / 1 buổi / 10 từ mới / 1 lỗi', () => {
    expect(report.previous).toEqual({
      minutes: 120,
      sessionCount: 1,
      daysStudied: 1,
      newWords: 10,
      mistakeCount: 1,
    })
  })

  it('delta = hiện tại − tuần trước', () => {
    expect(report.delta).toEqual({
      minutes: -30,
      sessionCount: 2,
      daysStudied: 1,
      newWords: -2,
      mistakeCount: 1,
    })
  })

  it('tuần không có dữ liệu → toàn 0, không lỗi', () => {
    const empty = buildWeekReport({ weekStart: '2026-09-28', sessions: [], notes: [], mistakes: [] })
    expect(empty.totals.minutes).toBe(0)
    expect(empty.previous.mistakeCount).toBe(0)
    expect(empty.delta.minutes).toBe(0)
  })
})

describe('describeDelta — câu so sánh thân thiện', () => {
  it('giảm giờ, bớt từ, nhiều lỗi', () => {
    expect(describeDelta({ minutes: -30, sessionCount: 2, daysStudied: 1, newWords: -2, mistakeCount: 1 })).toBe(
      'so với tuần trước: học kém hơn 30 phút · bớt 2 từ mới · nhiều hơn 1 lỗi',
    )
  })
  it('tăng giờ, thêm từ, ít lỗi', () => {
    expect(describeDelta({ minutes: 45, sessionCount: 1, daysStudied: 2, newWords: 6, mistakeCount: -3 })).toBe(
      'so với tuần trước: học nhiều hơn 45 phút · thêm 6 từ mới · ít hơn 3 lỗi',
    )
  })
  it('không đổi', () => {
    expect(describeDelta({ minutes: 0, sessionCount: 0, daysStudied: 0, newWords: 0, mistakeCount: 0 })).toBe(
      'so với tuần trước: giờ học giữ nguyên · từ mới giữ nguyên · lỗi sai giữ nguyên',
    )
  })

  it('mặc định lang="vi" giữ nguyên văn; lang="en" dịch tự nhiên', () => {
    const delta = { minutes: 45, sessionCount: 1, daysStudied: 2, newWords: 6, mistakeCount: -3 }
    expect(describeDelta(delta)).toBe(
      'so với tuần trước: học nhiều hơn 45 phút · thêm 6 từ mới · ít hơn 3 lỗi',
    )
    expect(describeDelta(delta, 'en')).toBe('vs last week: 45 more minutes studied · 6 more new words · 3 fewer mistakes')
    expect(describeDelta({ minutes: -30, sessionCount: 0, daysStudied: 0, newWords: -2, mistakeCount: 1 }, 'en')).toBe(
      'vs last week: 30 fewer minutes studied · 2 fewer new words · 1 more mistake',
    )
    expect(
      describeDelta({ minutes: 0, sessionCount: 0, daysStudied: 0, newWords: 0, mistakeCount: 0 }, 'en'),
    ).toBe('vs last week: study hours unchanged · new words unchanged · mistakes unchanged')
  })
})
