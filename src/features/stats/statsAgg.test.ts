/*
 * Test logic thuần thống kê (statsAgg.ts) — ngày mẫu cố định:
 * 2026-10-03 = thứ Bảy · thứ Hai của tuần đó = 2026-09-28.
 */
import { describe, expect, it } from 'vitest'

import {
  aggregateBuckets,
  allocateBySubject,
  buildMonthHeatmap,
  computeStreak,
  endOfWeekISO,
  epochOfDayStartISO,
  firstOfMonthISO,
  formatAxisHours,
  formatHours,
  heatmapLevel,
  lastDayOfMonthISO,
  monthShort,
  shortDate,
  startOfWeekISO,
  weekdayLabelsMon,
} from './statsAgg'

const row = (date: string, durationMin: number, subjectId = 1) => ({ date, durationMin, subjectId })

describe('tuần bắt đầu thứ Hai', () => {
  it('startOfWeekISO: thứ Bảy lùi về thứ Hai', () => {
    expect(startOfWeekISO('2026-10-03')).toBe('2026-09-28')
  })

  it('startOfWeekISO: Chủ Nhật vẫn thuộc tuần bắt đầu thứ Hai trước đó', () => {
    expect(startOfWeekISO('2026-10-04')).toBe('2026-09-28')
  })

  it('startOfWeekISO: thứ Hai là chính nó', () => {
    expect(startOfWeekISO('2026-10-05')).toBe('2026-10-05')
  })

  it('startOfWeekISO: đầu năm (thứ Năm 01/01/2026) lùi về 29/12/2025', () => {
    expect(startOfWeekISO('2026-01-01')).toBe('2025-12-29')
  })

  it('endOfWeekISO: tuần 28/9 kết thúc Chủ Nhật 4/10', () => {
    expect(endOfWeekISO('2026-09-28')).toBe('2026-10-04')
  })
})

describe('ranh giới tháng', () => {
  it('firstOfMonthISO lùi/tiến tháng, không tràn ngày', () => {
    expect(firstOfMonthISO('2026-10-03', 0)).toBe('2026-10-01')
    expect(firstOfMonthISO('2026-10-03', -5)).toBe('2026-05-01')
    expect(firstOfMonthISO('2026-10-03', 3)).toBe('2027-01-01')
  })

  it('lastDayOfMonthISO: tháng thường, tháng nhuận', () => {
    expect(lastDayOfMonthISO('2026-10-03')).toBe('2026-10-31')
    expect(lastDayOfMonthISO('2026-02-01')).toBe('2026-02-28')
    expect(lastDayOfMonthISO('2024-02-01')).toBe('2024-02-29')
  })
})

describe('định dạng số', () => {
  it('formatHours: 1 chữ số thập phân', () => {
    expect(formatHours(60)).toBe('1.0')
    expect(formatHours(90)).toBe('1.5')
    expect(formatHours(45)).toBe('0.8')
    expect(formatHours(0)).toBe('0.0')
  })

  it('formatAxisHours: bỏ số 0 cuối cho nhãn trục', () => {
    expect(formatAxisHours(60)).toBe('1')
    expect(formatAxisHours(90)).toBe('1.5')
    expect(formatAxisHours(180)).toBe('3')
  })

  it('shortDate: d/m không số 0 thừa', () => {
    expect(shortDate('2026-09-28')).toBe('28/9')
    expect(shortDate('2026-10-03')).toBe('3/10')
  })
})

describe('aggregateBuckets — giờ học theo ngày/tuần/tháng', () => {
  const rows = [row('2026-09-28', 90), row('2026-10-03', 45)]

  it('granularity "day": 7 ngày cuối, label theo thứ, bucket cuối là hôm nay', () => {
    const buckets = aggregateBuckets(rows, 'day', '2026-10-03')
    expect(buckets).toHaveLength(7)
    expect(buckets[0]).toMatchObject({ from: '2026-09-27', label: 'CN', minutes: 0, isCurrent: false })
    expect(buckets[1]).toMatchObject({ from: '2026-09-28', label: 'T2', minutes: 90 })
    expect(buckets[6]).toMatchObject({ from: '2026-10-03', label: 'T7', minutes: 45, isCurrent: true })
  })

  it('granularity "day": custom count', () => {
    expect(aggregateBuckets(rows, 'day', '2026-10-03', { count: 3 })).toHaveLength(3)
  })

  it('granularity "week": 8 tuần, gom cả tuần 28/9→4/10 = 135 phút', () => {
    const buckets = aggregateBuckets(rows, 'week', '2026-10-03')
    expect(buckets).toHaveLength(8)
    expect(buckets[7]).toMatchObject({
      from: '2026-09-28',
      to: '2026-10-04',
      label: '28/9',
      minutes: 135,
      isCurrent: true,
    })
    expect(buckets[6]).toMatchObject({ from: '2026-09-21', to: '2026-09-27', minutes: 0 })
  })

  it('granularity "month": 6 tháng, tháng hiện tại T10', () => {
    const buckets = aggregateBuckets(rows, 'month', '2026-10-03')
    expect(buckets).toHaveLength(6)
    expect(buckets[0]).toMatchObject({ from: '2026-05-01', to: '2026-05-31', label: 'T5', minutes: 0 })
    expect(buckets[5]).toMatchObject({ from: '2026-10-01', to: '2026-10-31', label: 'T10', minutes: 45, isCurrent: true })
  })

  it('buổi âm/nonsense không làm âm tổng', () => {
    const buckets = aggregateBuckets([row('2026-10-03', -20)], 'day', '2026-10-03', { count: 1 })
    expect(buckets[0].minutes).toBe(0)
  })

  it('mặc định lang="vi" (CN/T2…, T10); lang="en" dịch nhãn thứ/tháng', () => {
    const vi = aggregateBuckets(rows, 'day', '2026-10-03')
    expect(vi[0].label).toBe('CN')
    expect(vi[6].label).toBe('T7')

    const en = aggregateBuckets(rows, 'day', '2026-10-03', {}, 'en')
    expect(en[0].label).toBe('Sun')
    expect(en[6].label).toBe('Sat')
    expect(aggregateBuckets(rows, 'month', '2026-10-03', {}, 'en')[5].label).toBe('Oct')

    // Nhãn thứ theo tuần bắt đầu thứ Hai — vi và en.
    expect(weekdayLabelsMon()).toEqual(['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'])
    expect(weekdayLabelsMon('en')).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(monthShort(10, 'en')).toBe('Oct')
  })
})

describe('allocateBySubject — phân bổ theo môn', () => {
  it('gom theo môn, sắp giảm dần, môn 0 ("chưa phân môn") xếp cuối', () => {
    const slices = allocateBySubject([
      row('2026-10-01', 30, 1),
      row('2026-10-02', 20, 1),
      row('2026-10-02', 45, 3),
      row('2026-10-03', 10, 2),
      row('2026-10-03', 15, 0),
    ])
    expect(slices).toEqual([
      { subjectId: 1, minutes: 50 },
      { subjectId: 3, minutes: 45 },
      { subjectId: 2, minutes: 10 },
      { subjectId: 0, minutes: 15 },
    ])
  })

  it('môn có 0 phút bị bỏ qua', () => {
    expect(allocateBySubject([row('2026-10-03', 25, 2), row('2026-10-03', 0, 5)])).toEqual([
      { subjectId: 2, minutes: 25 },
    ])
  })
})

describe('heatmapLevel + buildMonthHeatmap', () => {
  it('heatmapLevel theo mục tiêu 60 phút/ngày', () => {
    expect(heatmapLevel(0, 60)).toBe(0)
    expect(heatmapLevel(0, 60, true)).toBe(1) // có ghi chú dù chưa học
    expect(heatmapLevel(10, 60)).toBe(1)
    expect(heatmapLevel(30, 60)).toBe(2)
    expect(heatmapLevel(60, 60)).toBe(3)
    expect(heatmapLevel(120, 60)).toBe(3)
    expect(heatmapLevel(10, 0)).toBe(1) // goal 0 → fallback 60
    expect(heatmapLevel(30, 0)).toBe(2) // 30 ≥ 60/2
  })

  it('tháng 10/2026: lưới 35 ô, 28/9 → 1/11, tô đúng mức', () => {
    const days = new Map([
      ['2026-10-03', { minutes: 60 }],
      ['2026-10-05', { minutes: 10, hasNote: true }],
    ])
    const cells = buildMonthHeatmap(days, '2026-10-03', 60)

    expect(cells).toHaveLength(35)
    expect(cells[0]).toMatchObject({ date: '2026-09-28', level: 0, inMonth: false })
    expect(cells[5]).toMatchObject({ date: '2026-10-03', minutes: 60, level: 3, inMonth: true })
    expect(cells[7]).toMatchObject({ date: '2026-10-05', minutes: 10, level: 1, inMonth: true })
    expect(cells[34]).toMatchObject({ date: '2026-11-01', inMonth: false })
  })

  it('tháng 8/2026 (đầu tháng thứ Bảy): lưới tràn 6 tuần = 42 ô', () => {
    const cells = buildMonthHeatmap(new Map(), '2026-08-15', 60)
    expect(cells).toHaveLength(42)
    expect(cells[0].date).toBe('2026-07-27')
    expect(cells[41].date).toBe('2026-09-06')
  })
})

describe('computeStreak — chuỗi ngày liên tiếp', () => {
  const dates = ['2026-10-01', '2026-10-02', '2026-10-03']

  it('đếm liên tiếp về quá khứ khi hôm nay đã học', () => {
    expect(computeStreak(dates, '2026-10-03')).toBe(3)
  })

  it('hôm nay chưa học vẫn giữ streak (grace về hôm qua)', () => {
    expect(computeStreak(dates, '2026-10-04')).toBe(3)
  })

  it('bỏ học 1 ngày là gãy', () => {
    expect(computeStreak(dates, '2026-10-05')).toBe(0)
    expect(computeStreak(['2026-10-03', '2026-10-01'], '2026-10-03')).toBe(1)
  })

  it('chưa học ngày nào → 0', () => {
    expect(computeStreak([], '2026-10-03')).toBe(0)
  })
})

describe('epochOfDayStartISO', () => {
  it('epoch đầu ngày LOCAL', () => {
    expect(epochOfDayStartISO('2026-09-28')).toBe(new Date(2026, 8, 28).getTime())
  })
})
