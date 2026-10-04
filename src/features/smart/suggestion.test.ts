import { describe, expect, it } from 'vitest'

import {
  buildSuggestionPrompt,
  pickSuggestion,
  sumMinutesByPart,
  weakestPart,
  weekWindowISO,
} from './suggestion'

describe('sumMinutesByPart — cộng phút theo Part', () => {
  it('gộp các buổi cùng Part và giữ nguyên part 0 (không rõ)', () => {
    const byPart = sumMinutesByPart([
      { part: 5, durationMin: 20 },
      { part: 5, durationMin: 25 },
      { part: 7, durationMin: 10 },
      { part: 0, durationMin: 5 },
    ])
    expect(byPart).toEqual({ 0: 5, 5: 45, 7: 10 })
  })

  it('trả rỗng khi không có buổi học', () => {
    expect(sumMinutesByPart([])).toEqual({})
  })
})

describe('weekWindowISO — cửa sổ 7 ngày tính cả hôm nay', () => {
  it('lùi đúng 6 ngày', () => {
    expect(weekWindowISO('2026-10-03')).toEqual({ from: '2026-09-27', to: '2026-10-03' })
  })
})

describe('weakestPart — Part có số giờ ít nhất', () => {
  it('part chưa học (= 0 phút) được coi là ít nhất', () => {
    expect(weakestPart({ 3: 120, 5: 45 })).toBe(1) // Part 1 chưa chạm → 0 phút
  })

  it('hoà 0 phút thì chọn Part số nhỏ hơn', () => {
    expect(weakestPart({ 2: 30 })).toBe(1)
  })

  it('chọn part có phút thấp nhất khi mọi part đều đã học', () => {
    expect(weakestPart({ 1: 30, 2: 40, 3: 10, 4: 25, 5: 50, 6: 60, 7: 45 })).toBe(3)
  })
})

describe('pickSuggestion — thứ tự ưu tiên D14', () => {
  it('ưu tiên 1: lỗi sai chưa reviewed đè lên mọi gợi ý khác', () => {
    const suggestion = pickSuggestion({
      unreviewedMistakes: 2,
      dueCards: 5,
      minutesByPart: { 5: 60 },
    })
    expect(suggestion.kind).toBe('mistakes')
    expect(suggestion.count).toBe(2)
    expect(suggestion.unit).toBe('lỗi sai')
    expect(suggestion.body).toContain('2 lỗi sai chưa ôn lại')
  })

  it('lỗi sai 1 câu → câu số ít', () => {
    const suggestion = pickSuggestion({ unreviewedMistakes: 1, dueCards: 0, minutesByPart: {} })
    expect(suggestion.body).toContain('còn 1 lỗi sai')
  })

  it('ưu tiên 2: thẻ SRS đến hạn khi không còn lỗi sai', () => {
    const suggestion = pickSuggestion({
      unreviewedMistakes: 0,
      dueCards: 3,
      minutesByPart: { 5: 60 },
    })
    expect(suggestion.kind).toBe('srs')
    expect(suggestion.count).toBe(3)
    expect(suggestion.unit).toBe('từ')
  })

  it('ưu tiên 3: Part có số giờ ít nhất trong 7 ngày qua', () => {
    const suggestion = pickSuggestion({
      unreviewedMistakes: 0,
      dueCards: 0,
      minutesByPart: { 3: 120, 5: 45 },
    })
    expect(suggestion.kind).toBe('part')
    expect(suggestion.part).toBe(1) // các part chưa học = 0 phút, hoà chọn số nhỏ
    expect(suggestion.count).toBe(0)
    expect(suggestion.body).toContain('chưa chạm Part 1')
  })

  it('ưu tiên 3b: part đã học nhưng ít phút nhất → gợi ý kèm số phút', () => {
    const suggestion = pickSuggestion({
      unreviewedMistakes: 0,
      dueCards: 0,
      minutesByPart: { 1: 30, 2: 40, 3: 10, 4: 25, 5: 50, 6: 60, 7: 45 },
    })
    expect(suggestion.kind).toBe('part')
    expect(suggestion.part).toBe(3)
    expect(suggestion.count).toBe(10)
    expect(suggestion.unit).toBe('phút')
    expect(suggestion.body).toContain('10 phút')
  })

  it('ưu tiên 4: chưa có dữ liệu gì → mời bắt đầu', () => {
    const suggestion = pickSuggestion({
      unreviewedMistakes: 0,
      dueCards: 0,
      minutesByPart: {},
    })
    expect(suggestion.kind).toBe('start')
    expect(suggestion.count).toBe(0)
    expect(suggestion.unit).toBe('')
  })
})

describe('buildSuggestionPrompt — prompt cho RAG', () => {
  it('mô tả đủ dữ liệu hôm nay', () => {
    const prompt = buildSuggestionPrompt(
      { unreviewedMistakes: 4, dueCards: 2, minutesByPart: { 5: 30 } },
      '2026-10-03',
    )
    expect(prompt).toContain('4 câu')
    expect(prompt).toContain('2 từ')
    expect(prompt).toContain('Part 5: 30 phút')
    expect(prompt).toContain('2026-10-03')
  })
})
