/*
 * Test bộ lọc + tìm kiếm nhanh (B6/B7) cho từ vựng, ghi chú, lỗi sai.
 */
import { describe, expect, it } from 'vitest'

import type { DailyNote, Mistake, Vocab } from '@core/types'

import {
  countUnreviewed,
  filterMistakes,
  filterNotes,
  filterVocab,
  matchesQuery,
  normalizeQuery,
} from './filters'

const vocab = (over: Partial<Vocab>): Vocab => ({
  word: '',
  meaning: '',
  example: '',
  subjectId: 0,
  sourceTest: '',
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

const note = (over: Partial<DailyNote>): DailyNote => ({
  date: '2026-10-01',
  partStudied: [],
  newWords: 0,
  mistakesSummary: '',
  reflection: '',
  photoIds: [],
  autoDrafted: false,
  updatedAt: 0,
  ...over,
})

const mistake = (over: Partial<Mistake>): Mistake => ({
  testNo: 1,
  subjectId: 5,
  questionNo: 10,
  myAnswer: 'B',
  correctAnswer: 'D',
  cause: 'từ vựng',
  explanation: '',
  reviewed: false,
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

describe('normalizeQuery + matchesQuery', () => {
  it('chữ thường, gộp khoảng trắng, trim', () => {
    expect(normalizeQuery('  Commute   đi làm ')).toBe('commute đi làm')
  })

  it('query rỗng khớp mọi thứ; query có nội dung khớp contains', () => {
    expect(matchesQuery(['định lí Pytago', 'tam giác vuông'], '')).toBe(true)
    expect(matchesQuery(['định lí Pytago'], 'LÍ PY')).toBe(true)
    expect(matchesQuery(['định lí Pytago'], 'hình tròn')).toBe(false)
  })
})

describe('filterVocab (B7: tìm kiếm + chip môn)', () => {
  const rows: Vocab[] = [
    vocab({ word: 'commute (v)', meaning: 'đi làm hằng ngày', subjectId: 1, sourceTest: 'ETS 2023 · Đề 2' }),
    vocab({ word: 'định lí Pytago', meaning: 'tam giác vuông', example: 'a² + b² = c²', subjectId: 2 }),
    vocab({ word: 'bank', meaning: 'ngân hàng', subjectId: 0 }),
  ]

  it('tìm theo word/meaning/example/sourceTest, không phân biệt hoa thường', () => {
    expect(filterVocab(rows, { query: 'commute', subjectId: 0 })).toHaveLength(1)
    expect(filterVocab(rows, { query: 'tam giác', subjectId: 0 })).toHaveLength(1)
    expect(filterVocab(rows, { query: 'a² + b²', subjectId: 0 })).toHaveLength(1)
    expect(filterVocab(rows, { query: 'ets 2023', subjectId: 0 })).toHaveLength(1)
  })

  it('lọc môn; môn 0 = tất cả', () => {
    expect(filterVocab(rows, { query: '', subjectId: 1 })).toHaveLength(1)
    expect(filterVocab(rows, { query: '', subjectId: 2 })).toHaveLength(1)
    expect(filterVocab(rows, { query: '', subjectId: 7 })).toHaveLength(0)
    expect(filterVocab(rows, { query: '', subjectId: 0 })).toHaveLength(3)
  })

  it('kết hợp tìm kiếm + môn', () => {
    expect(filterVocab(rows, { query: 'commute', subjectId: 2 })).toHaveLength(0)
    expect(filterVocab(rows, { query: 'commute', subjectId: 1 })).toHaveLength(1)
  })
})

describe('filterNotes (B7: tìm kiếm ghi chú + môn đã học)', () => {
  const rows: DailyNote[] = [
    note({ date: '2026-10-01', reflection: 'Ôn Toán hình không gian', partStudied: [2, 3], newWords: 5 }),
    note({ date: '2026-10-02', reflection: 'Ôn Tiếng Nhật kanji', mistakesSummary: 'sai câu 12', partStudied: [4] }),
  ]

  it('tìm theo reflection/mistakesSummary/date', () => {
    expect(filterNotes(rows, { query: 'hình không gian', subjectId: 0 })).toHaveLength(1)
    expect(filterNotes(rows, { query: 'câu 12', subjectId: 0 })).toHaveLength(1)
    expect(filterNotes(rows, { query: '2026-10-02', subjectId: 0 })).toHaveLength(1)
  })

  it('lọc theo môn đã học trong ngày', () => {
    expect(filterNotes(rows, { query: '', subjectId: 2 })).toHaveLength(1)
    expect(filterNotes(rows, { query: '', subjectId: 4 })).toHaveLength(1)
    expect(filterNotes(rows, { query: '', subjectId: 5 })).toHaveLength(0)
  })
})

describe('filterMistakes (B6: lọc chưa reviewed + môn)', () => {
  const rows: Mistake[] = [
    mistake({ subjectId: 2, reviewed: false }),
    mistake({ subjectId: 2, reviewed: true }),
    mistake({ subjectId: 3, reviewed: false }),
  ]

  it('lọc chưa ôn / đã ôn / tất cả', () => {
    expect(filterMistakes(rows, { subjectId: 0, reviewed: 'unreviewed' })).toHaveLength(2)
    expect(filterMistakes(rows, { subjectId: 0, reviewed: 'reviewed' })).toHaveLength(1)
    expect(filterMistakes(rows, { subjectId: 0, reviewed: 'all' })).toHaveLength(3)
  })

  it('lọc kết hợp môn + trạng thái', () => {
    expect(filterMistakes(rows, { subjectId: 2, reviewed: 'unreviewed' })).toHaveLength(1)
    expect(filterMistakes(rows, { subjectId: 3, reviewed: 'reviewed' })).toHaveLength(0)
  })

  it('countUnreviewed đếm đúng', () => {
    expect(countUnreviewed(rows)).toBe(2)
    expect(countUnreviewed([])).toBe(0)
  })
})
