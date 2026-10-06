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
  type SubjectLite,
} from './draftCompose'

const SUBJECTS: SubjectLite[] = [
  { id: 1, name: 'TOEIC' },
  { id: 2, name: 'Toán' },
  { id: 3, name: 'Tiếng Nhật' },
]

const FACTS_BASE = { subjects: SUBJECTS }

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
  it('gộp buổi học, môn tăng dần, bỏ môn 0 (chưa phân môn)', () => {
    const summary = summarizeDay({
      ...FACTS_BASE,
      sessions: [
        { subjectId: 3, durationMin: 10 },
        { subjectId: 2, durationMin: 20 },
        { subjectId: 2, durationMin: 25 },
        { subjectId: 0, durationMin: 30 },
      ],
      vocab: [],
      mistakes: [],
    })
    expect(summary.subjectIdsStudied).toEqual([2, 3])
    expect(summary.unassignedMinutes).toBe(30)
    expect(summary.minutes).toBe(85)
    expect(summary.hasAnything).toBe(true)
  })

  it('buổi chưa phân môn (subjectId 0) được tính vào unassignedMinutes, không mất tích', () => {
    const summary = summarizeDay({
      ...FACTS_BASE,
      sessions: [{ subjectId: 0, durationMin: 1 }],
      vocab: [],
      mistakes: [],
    })
    expect(summary.subjectIdsStudied).toEqual([])
    expect(summary.unassignedMinutes).toBe(1)
    expect(summary.minutes).toBe(1)
    expect(summary.hasAnything).toBe(true)
  })

  it('đếm từ mới đầy đủ nhưng chỉ liệt kê tối đa 5 từ', () => {
    const summary = summarizeDay({
      ...FACTS_BASE,
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

  it('xếp mistakesBySubject theo số lỗi giảm dần, hoà thì môn nhỏ trước; tên môn từ danh sách', () => {
    const summary = summarizeDay({
      ...FACTS_BASE,
      sessions: [],
      vocab: [],
      mistakes: [
        { subjectId: 3, cause: 'đọc hiểu' },
        { subjectId: 2, cause: 'ngữ pháp' },
        { subjectId: 2, cause: 'từ vựng' },
        { subjectId: 1, cause: 'nghe' },
        { subjectId: 1, cause: 'nghe' },
      ],
    })
    expect(summary.mistakeCount).toBe(5)
    expect(summary.mistakesBySubject).toEqual([
      { subjectId: 1, name: 'TOEIC', count: 2 },
      { subjectId: 2, name: 'Toán', count: 2 },
      { subjectId: 3, name: 'Tiếng Nhật', count: 1 },
    ])
  })

  it('không có gì → hasAnything false', () => {
    const summary = summarizeDay({ ...FACTS_BASE, sessions: [], vocab: [], mistakes: [] })
    expect(summary.hasAnything).toBe(false)
  })
})

describe('hasMeaningfulData — tính cả số liệu ghi đè', () => {
  it('ngày rỗng nhưng caller truyền số liệu → true', () => {
    const empty = summarizeDay({ ...FACTS_BASE, sessions: [], vocab: [], mistakes: [] })
    expect(hasMeaningfulData(empty)).toBe(false)
    expect(hasMeaningfulData({ ...empty, minutes: 25 })).toBe(true)
    expect(hasMeaningfulData({ ...empty, subjectIdsStudied: [2] })).toBe(true)
    expect(hasMeaningfulData({ ...empty, newWords: 3 })).toBe(true)
    expect(hasMeaningfulData({ ...empty, mistakesNote: '2 lỗi ở bài 4' })).toBe(true)
  })
})

describe('composeMistakesSummary', () => {
  it('tóm tắt 1 dòng kèm môn nhiều lỗi nhất (golden: tên môn từ design-system mục 8)', () => {
    const summary = summarizeDay({
      ...FACTS_BASE,
      sessions: [],
      vocab: [],
      mistakes: [
        { subjectId: 2, cause: 'ngữ pháp' },
        { subjectId: 2, cause: 'từ vựng' },
        { subjectId: 3, cause: 'đọc hiểu' },
      ],
    })
    expect(composeMistakesSummary(summary)).toBe(
      '3 lỗi sai — nhiều nhất ở Toán (2 câu) · Tiếng Nhật (1 câu)',
    )
  })

  it('dùng mistakesNote khi caller truyền sẵn', () => {
    const summary = summarizeDay({ ...FACTS_BASE, sessions: [], vocab: [], mistakes: [] })
    summary.mistakesNote = 'Chăm chú thiếu ở bài 2'
    expect(composeMistakesSummary(summary)).toBe('Chăm chú thiếu ở bài 2')
  })

  it('không có lỗi → chuỗi rỗng', () => {
    expect(composeMistakesSummary(summarizeDay({ ...FACTS_BASE, sessions: [], vocab: [], mistakes: [] }))).toBe('')
  })
})

describe('composeDraftText — nháp ghi chú cuối ngày', () => {
  it('ghép buổi học (tên môn) + từ mới + lỗi sai', () => {
    const summary = summarizeDay({
      ...FACTS_BASE,
      sessions: [
        { subjectId: 2, durationMin: 20 },
        { subjectId: 2, durationMin: 25 },
        { subjectId: 3, durationMin: 10 },
      ],
      vocab: [{ word: 'commute' }, { word: 'deliberate' }],
      mistakes: [
        { subjectId: 2, cause: 'ngữ pháp' },
        { subjectId: 2, cause: 'từ vựng' },
      ],
    })
    const names = new Map(SUBJECTS.map((s) => [s.id, s.name]))
    const text = composeDraftText(summary, names)
    expect(text).toContain('Hôm nay học 55 phút — Toán, Tiếng Nhật.')
    expect(text).toContain('Từ mới: commute, deliberate.')
    expect(text).toContain('2 lỗi sai — nhiều nhất ở Toán (2 câu).')
    expect(text).toContain('Cảm nhận hôm nay:')
  })

  it('từ mới vượt 5 từ → liệt kê 5 và "và N từ khác"', () => {
    const summary = summarizeDay({
      ...FACTS_BASE,
      sessions: [],
      vocab: [{ word: 'w1' }, { word: 'w2' }, { word: 'w3' }, { word: 'w4' }, { word: 'w5' }, { word: 'w6' }, { word: 'w7' }],
      mistakes: [],
    })
    const text = composeDraftText(summary, new Map(SUBJECTS.map((s) => [s.id, s.name])))
    expect(text).toContain('Từ mới: w1, w2, w3, w4, w5 và 2 từ khác.')
  })

  it('caller truyền count nhưng không có danh sách từ → "N từ"', () => {
    const summary = summarizeDay({ ...FACTS_BASE, sessions: [], vocab: [], mistakes: [] })
    summary.newWords = 4
    const text = composeDraftText(summary)
    expect(text).toContain('Từ mới: 4 từ.')
  })

  it('ngày không có buổi học → dòng thẳng thắn', () => {
    const summary = summarizeDay({
      ...FACTS_BASE,
      sessions: [],
      vocab: [{ word: 'commute' }],
      mistakes: [],
    })
    expect(composeDraftText(summary)).toContain('Hôm nay chưa ghi buổi học nào.')
  })

  it('chỉ có buổi chưa phân môn (subjectId 0) → nháp vẫn ghi buổi học "chưa phân môn" (BUG bỏ sót)', () => {
    const summary = summarizeDay({
      ...FACTS_BASE,
      sessions: [{ subjectId: 0, durationMin: 1 }],
      vocab: [],
      mistakes: [],
    })
    const text = composeDraftText(summary)
    expect(text).toContain('Hôm nay học 1 phút — chưa phân môn.')
    expect(text).not.toContain('chưa ghi buổi học nào')
  })

  it('học cả môn lẫn buổi chưa phân môn → liệt kê thêm "chưa phân môn" ở cuối danh sách', () => {
    const summary = summarizeDay({
      ...FACTS_BASE,
      sessions: [
        { subjectId: 2, durationMin: 30 },
        { subjectId: 0, durationMin: 5 },
      ],
      vocab: [],
      mistakes: [],
    })
    const text = composeDraftText(summary, new Map(SUBJECTS.map((s) => [s.id, s.name])))
    expect(text).toContain('Hôm nay học 35 phút — Toán, chưa phân môn.')
  })
})

describe('composeEmptyDraftText', () => {
  it('mời bắt đầu nhưng vẫn chừa chỗ cảm nhận', () => {
    const text = composeEmptyDraftText()
    expect(text).toContain('chưa có dữ liệu để soạn nháp')
    expect(text).toContain('Cảm nhận hôm nay:')
  })
})

describe('composeDraftText — lang "en" (i18n, ghép môn hai ngôn ngữ)', () => {
  it('en: "Studied 35 minutes today — Toán, unassigned." — tên môn user giữ nguyên', () => {
    const summary = summarizeDay({
      ...FACTS_BASE,
      sessions: [
        { subjectId: 2, durationMin: 30 },
        { subjectId: 0, durationMin: 5 },
      ],
      vocab: [],
      mistakes: [],
    })
    const text = composeDraftText(summary, new Map(SUBJECTS.map((s) => [s.id, s.name])), 'en')
    expect(text).toContain('Studied 35 minutes today — Toán, unassigned.')
    expect(text).toContain('Reflection for today:')
  })

  it('en: 1 phút → câu số ít "Studied 1 minute today — unassigned."', () => {
    const summary = summarizeDay({
      ...FACTS_BASE,
      sessions: [{ subjectId: 0, durationMin: 1 }],
      vocab: [],
      mistakes: [],
    })
    expect(composeDraftText(summary, undefined, 'en')).toContain(
      'Studied 1 minute today — unassigned.',
    )
  })

  it('en: composeMistakesSummary dịch phần tóm tắt, giữ tên môn user', () => {
    const summary = summarizeDay({
      ...FACTS_BASE,
      sessions: [],
      vocab: [],
      mistakes: [
        { subjectId: 2, cause: 'ngữ pháp' },
        { subjectId: 2, cause: 'từ vựng' },
      ],
    })
    expect(composeMistakesSummary(summary, 'en')).toBe('2 mistakes — most in Toán (2 questions)')
  })
})

describe('buildDraftPrompt — prompt soạn nháp cho RAG', () => {
  it('chứa ngày, phút, tên môn, từ mới và lỗi sai', () => {
    const summary = summarizeDay({
      ...FACTS_BASE,
      sessions: [{ subjectId: 2, durationMin: 45 }],
      vocab: [{ word: 'commute' }],
      mistakes: [{ subjectId: 2, cause: 'ngữ pháp' }],
    })
    const names = new Map(SUBJECTS.map((s) => [s.id, s.name]))
    const prompt = buildDraftPrompt(summary, '2026-10-03', names)
    expect(prompt).toContain('03/10')
    expect(prompt).toContain('45 phút — Toán')
    expect(prompt).toContain('commute')
    expect(prompt).toContain('1 lỗi sai')
    expect(prompt).toContain('Cảm nhận hôm nay')
  })

  it('chỉ có buổi chưa phân môn → prompt cũng tính (RAG không nhận "chưa ghi buổi học nào")', () => {
    const summary = summarizeDay({
      ...FACTS_BASE,
      sessions: [{ subjectId: 0, durationMin: 25 }],
      vocab: [],
      mistakes: [],
    })
    const prompt = buildDraftPrompt(summary, '2026-10-03')
    expect(prompt).toContain('25 phút — chưa phân môn')
    expect(prompt).not.toContain('chưa ghi buổi học nào')
  })
})
