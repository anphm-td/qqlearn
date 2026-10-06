import { describe, expect, it } from 'vitest'

import {
  buildSuggestionPrompt,
  pickSuggestion,
  sumMinutesBySubject,
  weakestSubject,
  weekWindowISO,
  type SubjectLite,
} from './suggestion'

const SUBJECTS: SubjectLite[] = [
  { id: 1, name: 'TOEIC' },
  { id: 2, name: 'Toán' },
  { id: 3, name: 'Tiếng Nhật' },
]

describe('sumMinutesBySubject — cộng phút theo môn', () => {
  it('gộp các buổi cùng môn và giữ nguyên môn 0 (chưa phân môn)', () => {
    const bySubject = sumMinutesBySubject([
      { subjectId: 2, durationMin: 20 },
      { subjectId: 2, durationMin: 25 },
      { subjectId: 3, durationMin: 10 },
      { subjectId: 0, durationMin: 5 },
    ])
    expect(bySubject).toEqual({ 0: 5, 2: 45, 3: 10 })
  })

  it('trả rỗng khi không có buổi học', () => {
    expect(sumMinutesBySubject([])).toEqual({})
  })
})

describe('weekWindowISO — cửa sổ 7 ngày tính cả hôm nay', () => {
  it('lùi đúng 6 ngày', () => {
    expect(weekWindowISO('2026-10-03')).toEqual({ from: '2026-09-27', to: '2026-10-03' })
  })
})

describe('weakestSubject — môn có số giờ ít nhất', () => {
  it('môn chưa học (= 0 phút) được coi là ít nhất', () => {
    expect(weakestSubject({ 2: 120, 3: 45 }, SUBJECTS)).toBe(1) // TOEIC chưa chạm → 0 phút
  })

  it('hoà 0 phút thì chọn môn đứng trước trong danh sách', () => {
    expect(weakestSubject({ 2: 30 }, SUBJECTS)).toBe(1)
  })

  it('chọn môn có phút thấp nhất khi mọi môn đều đã học', () => {
    expect(weakestSubject({ 1: 30, 2: 40, 3: 10 }, SUBJECTS)).toBe(3)
  })

  it('danh sách môn rỗng → null (không có môn để gợi ý)', () => {
    expect(weakestSubject({ 1: 30 }, [])).toBeNull()
  })
})

describe('pickSuggestion — thứ tự ưu tiên D14', () => {
  it('ưu tiên 1: lỗi sai chưa reviewed đè lên mọi gợi ý khác', () => {
    const suggestion = pickSuggestion({
      unreviewedMistakes: 2,
      dueCards: 5,
      minutesBySubject: { 2: 60 },
      subjects: SUBJECTS,
    })
    expect(suggestion.kind).toBe('mistakes')
    expect(suggestion.count).toBe(2)
    expect(suggestion.unit).toBe('lỗi sai')
    expect(suggestion.body).toContain('2 lỗi sai chưa ôn lại')
  })

  it('lỗi sai 1 câu → câu số ít', () => {
    const suggestion = pickSuggestion({
      unreviewedMistakes: 1,
      dueCards: 0,
      minutesBySubject: {},
      subjects: SUBJECTS,
    })
    expect(suggestion.body).toContain('còn 1 lỗi sai')
  })

  it('ưu tiên 2: thẻ SRS đến hạn khi không còn lỗi sai', () => {
    const suggestion = pickSuggestion({
      unreviewedMistakes: 0,
      dueCards: 3,
      minutesBySubject: { 2: 60 },
      subjects: SUBJECTS,
    })
    expect(suggestion.kind).toBe('srs')
    expect(suggestion.count).toBe(3)
    expect(suggestion.unit).toBe('từ')
  })

  it('ưu tiên 3: môn có số giờ ít nhất trong 7 ngày qua', () => {
    const suggestion = pickSuggestion({
      unreviewedMistakes: 0,
      dueCards: 0,
      minutesBySubject: { 2: 120, 3: 45 },
      subjects: SUBJECTS,
    })
    expect(suggestion.kind).toBe('subject')
    expect(suggestion.subjectId).toBe(1) // TOEIC chưa học = 0 phút
    expect(suggestion.subjectName).toBe('TOEIC')
    expect(suggestion.count).toBe(0)
    expect(suggestion.body).toContain('chưa chạm môn TOEIC')
  })

  it('ưu tiên 3b: môn đã học nhưng ít phút nhất → gợi ý kèm số phút', () => {
    const suggestion = pickSuggestion({
      unreviewedMistakes: 0,
      dueCards: 0,
      minutesBySubject: { 1: 30, 2: 40, 3: 10 },
      subjects: SUBJECTS,
    })
    expect(suggestion.kind).toBe('subject')
    expect(suggestion.subjectId).toBe(3)
    expect(suggestion.count).toBe(10)
    expect(suggestion.unit).toBe('phút')
    expect(suggestion.body).toContain('10 phút')
  })

  it('ưu tiên 4: chưa có dữ liệu gì → mời bắt đầu', () => {
    const suggestion = pickSuggestion({
      unreviewedMistakes: 0,
      dueCards: 0,
      minutesBySubject: {},
      subjects: SUBJECTS,
    })
    expect(suggestion.kind).toBe('start')
    expect(suggestion.count).toBe(0)
    expect(suggestion.unit).toBe('')
  })
})

describe('pickSuggestion — lang "en" (i18n)', () => {
  it('title/body/unit dịch tiếng Anh, tên môn user giữ nguyên', () => {
    const suggestion = pickSuggestion(
      { unreviewedMistakes: 0, dueCards: 0, minutesBySubject: { 2: 120, 3: 45 }, subjects: SUBJECTS },
      'en',
    )
    expect(suggestion.kind).toBe('subject')
    expect(suggestion.title).toBe('Reopen TOEIC')
    expect(suggestion.body).toBe("You haven't touched TOEIC in 7 days — try a short session today.")
    expect(suggestion.unit).toBe('minutes')
  })
})

describe('buildSuggestionPrompt — prompt cho RAG (trợ lý học tập đa môn)', () => {
  it('mô tả đủ dữ liệu hôm nay', () => {
    const prompt = buildSuggestionPrompt(
      { unreviewedMistakes: 4, dueCards: 2, minutesBySubject: { 2: 30 }, subjects: SUBJECTS },
      '2026-10-03',
    )
    expect(prompt).toContain('4 câu')
    expect(prompt).toContain('2 từ')
    expect(prompt).toContain('Môn Toán: 30 phút')
    expect(prompt).toContain('2026-10-03')
    expect(prompt).toContain('trợ lý học tập đa môn')
  })
})
