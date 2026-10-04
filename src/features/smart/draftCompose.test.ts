import { describe, expect, it } from 'vitest'

import {
  buildDraftPrompt,
  composeDraftText,
  composeEmptyDraftText,
  composeMistakesSummary,
  dayRangeMs,
  formatDayMonth,
  hasMeaningfulData,
  summarizeDay,
} from './draftCompose'

describe('dayRangeMs — ranh giới ngày local', () => {
  it('trả khoảng nửa mở [00:00, 00:00 hôm sau) theo múi giờ local', () => {
    const { startMs, endMs } = dayRangeMs('2026-10-03')
    const start = new Date(startMs)
    expect([start.getFullYear(), start.getMonth() + 1, start.getDate()]).toEqual([2026, 10, 3])
    expect(start.getHours()).toBe(0)
    expect(endMs).toBe(new Date(2026, 9, 4).getTime())
  })
})

describe('formatDayMonth', () => {
  it('đổi yyyy-mm-dd → dd/mm', () => {
    expect(formatDayMonth('2026-10-03')).toBe('03/10')
  })
})

describe('summarizeDay', () => {
  it('gộp buổi học, part tăng dần, bỏ part 0', () => {
    const summary = summarizeDay({
      sessions: [
        { part: 7, durationMin: 10 },
        { part: 5, durationMin: 20 },
        { part: 5, durationMin: 25 },
        { part: 0, durationMin: 30 },
      ],
      vocab: [],
      mistakes: [],
    })
    expect(summary.partStudied).toEqual([5, 7])
    expect(summary.minutes).toBe(85)
    expect(summary.hasAnything).toBe(true)
  })

  it('đếm từ mới đầy đủ nhưng chỉ liệt kê tối đa 5 từ', () => {
    const summary = summarizeDay({
      sessions: [],
      vocab: [
        { word: 'w1' },
        { word: 'w2' },
        { word: 'w3' },
        { word: 'w4' },
        { word: 'w5' },
        { word: 'w6' },
        { word: 'w7' },
      ],
      mistakes: [],
    })
    expect(summary.newWords).toBe(7)
    expect(summary.words).toEqual(['w1', 'w2', 'w3', 'w4', 'w5'])
  })

  it('xếp mistakesByPart theo số lỗi giảm dần, hoà thì part nhỏ trước', () => {
    const summary = summarizeDay({
      sessions: [],
      vocab: [],
      mistakes: [
        { part: 7, cause: 'đọc hiểu' },
        { part: 5, cause: 'ngữ pháp' },
        { part: 5, cause: 'từ vựng' },
        { part: 3, cause: 'nghe' },
        { part: 3, cause: 'nghe' },
      ],
    })
    expect(summary.mistakeCount).toBe(5)
    expect(summary.mistakesByPart).toEqual([
      { part: 3, count: 2 },
      { part: 5, count: 2 },
      { part: 7, count: 1 },
    ])
  })

  it('không có gì → hasAnything false', () => {
    const summary = summarizeDay({ sessions: [], vocab: [], mistakes: [] })
    expect(summary.hasAnything).toBe(false)
  })
})

describe('hasMeaningfulData — tính cả số liệu ghi đè', () => {
  it('ngày rỗng nhưng caller truyền số liệu → true', () => {
    const empty = summarizeDay({ sessions: [], vocab: [], mistakes: [] })
    expect(hasMeaningfulData(empty)).toBe(false)
    expect(hasMeaningfulData({ ...empty, minutes: 25 })).toBe(true)
    expect(hasMeaningfulData({ ...empty, partStudied: [5] })).toBe(true)
    expect(hasMeaningfulData({ ...empty, newWords: 3 })).toBe(true)
    expect(hasMeaningfulData({ ...empty, mistakesNote: '2 lỗi Part 5' })).toBe(true)
  })
})

describe('composeMistakesSummary', () => {
  it('tóm tắt 1 dòng kèm part nhiều lỗi nhất', () => {
    const summary = summarizeDay({
      sessions: [],
      vocab: [],
      mistakes: [
        { part: 5, cause: 'ngữ pháp' },
        { part: 5, cause: 'từ vựng' },
        { part: 7, cause: 'đọc hiểu' },
      ],
    })
    expect(composeMistakesSummary(summary)).toBe(
      '3 lỗi sai — nhiều nhất ở Part 5 (2 câu) · Part 7 (1 câu)',
    )
  })

  it('dùng mistakesNote khi caller truyền sẵn', () => {
    const summary = summarizeDay({ sessions: [], vocab: [], mistakes: [] })
    summary.mistakesNote = 'Chăm chú thiếu ở Part 2'
    expect(composeMistakesSummary(summary)).toBe('Chăm chú thiếu ở Part 2')
  })

  it('không có lỗi → chuỗi rỗng', () => {
    expect(composeMistakesSummary(summarizeDay({ sessions: [], vocab: [], mistakes: [] }))).toBe('')
  })
})

describe('composeDraftText — nháp ghi chú cuối ngày', () => {
  it('ghép buổi học + từ mới + lỗi sai', () => {
    const summary = summarizeDay({
      sessions: [
        { part: 5, durationMin: 20 },
        { part: 5, durationMin: 25 },
        { part: 7, durationMin: 10 },
      ],
      vocab: [{ word: 'commute' }, { word: 'deliberate' }],
      mistakes: [
        { part: 5, cause: 'ngữ pháp' },
        { part: 5, cause: 'từ vựng' },
      ],
    })
    const text = composeDraftText(summary)
    expect(text).toContain('Hôm nay học 55 phút — Part 5, Part 7.')
    expect(text).toContain('Từ mới: commute, deliberate.')
    expect(text).toContain('2 lỗi sai — nhiều nhất ở Part 5 (2 câu).')
    expect(text).toContain('Cảm nhận hôm nay:')
  })

  it('từ mới vượt 5 từ → liệt kê 5 và "và N từ khác"', () => {
    const summary = summarizeDay({
      sessions: [],
      vocab: [{ word: 'w1' }, { word: 'w2' }, { word: 'w3' }, { word: 'w4' }, { word: 'w5' }, { word: 'w6' }, { word: 'w7' }],
      mistakes: [],
    })
    const text = composeDraftText(summary)
    expect(text).toContain('Từ mới: w1, w2, w3, w4, w5 và 2 từ khác.')
  })

  it('caller truyền count nhưng không có danh sách từ → "N từ"', () => {
    const summary = summarizeDay({ sessions: [], vocab: [], mistakes: [] })
    summary.newWords = 4
    const text = composeDraftText(summary)
    expect(text).toContain('Từ mới: 4 từ.')
  })

  it('ngày không có buổi học → dòng thẳng thắn', () => {
    const summary = summarizeDay({
      sessions: [],
      vocab: [{ word: 'commute' }],
      mistakes: [],
    })
    expect(composeDraftText(summary)).toContain('Hôm nay chưa ghi buổi học nào.')
  })
})

describe('composeEmptyDraftText', () => {
  it('mời bắt đầu nhưng vẫn chừa chỗ cảm nhận', () => {
    const text = composeEmptyDraftText()
    expect(text).toContain('chưa có dữ liệu để soạn nháp')
    expect(text).toContain('Cảm nhận hôm nay:')
  })
})

describe('buildDraftPrompt — prompt soạn nháp cho RAG', () => {
  it('chứa ngày, phút, part, từ mới và lỗi sai', () => {
    const summary = summarizeDay({
      sessions: [{ part: 5, durationMin: 45 }],
      vocab: [{ word: 'commute' }],
      mistakes: [{ part: 5, cause: 'ngữ pháp' }],
    })
    const prompt = buildDraftPrompt(summary, '2026-10-03')
    expect(prompt).toContain('03/10')
    expect(prompt).toContain('45 phút — Part 5')
    expect(prompt).toContain('commute')
    expect(prompt).toContain('1 lỗi sai')
    expect(prompt).toContain('Cảm nhận hôm nay')
  })
})
