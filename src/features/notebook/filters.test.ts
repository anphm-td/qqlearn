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
  part: 0,
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
  part: 5,
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
    expect(matchesQuery(['commute (v)', 'đi làm'], '')).toBe(true)
    expect(matchesQuery(['commute (v)'], 'MUTE')).toBe(true)
    expect(matchesQuery(['commute (v)'], 'bus')).toBe(false)
  })
})

describe('filterVocab (B7: tìm kiếm + Part chip)', () => {
  const rows: Vocab[] = [
    vocab({ word: 'commute (v)', meaning: 'đi làm hằng ngày', part: 3, sourceTest: 'ETS 2023 · Đề 2' }),
    vocab({ word: 'deliberate', meaning: 'cân nhắc kỹ', example: 'a deliberate choice', part: 5 }),
    vocab({ word: 'bank', meaning: 'ngân hàng', part: 0 }),
  ]

  it('tìm theo word/meaning/example/sourceTest, không phân biệt hoa thường', () => {
    expect(filterVocab(rows, { query: 'commute', part: 0 })).toHaveLength(1)
    expect(filterVocab(rows, { query: 'cân nhắc', part: 0 })).toHaveLength(1)
    expect(filterVocab(rows, { query: 'deliberate choice', part: 0 })).toHaveLength(1)
    expect(filterVocab(rows, { query: 'ets 2023', part: 0 })).toHaveLength(1)
  })

  it('lọc Part; part 0 = tất cả', () => {
    expect(filterVocab(rows, { query: '', part: 3 })).toHaveLength(1)
    expect(filterVocab(rows, { query: '', part: 5 })).toHaveLength(1)
    expect(filterVocab(rows, { query: '', part: 7 })).toHaveLength(0)
    expect(filterVocab(rows, { query: '', part: 0 })).toHaveLength(3)
  })

  it('kết hợp tìm kiếm + Part', () => {
    expect(filterVocab(rows, { query: 'commute', part: 5 })).toHaveLength(0)
    expect(filterVocab(rows, { query: 'commute', part: 3 })).toHaveLength(1)
  })
})

describe('filterNotes (B7: tìm kiếm ghi chú + Part đã học)', () => {
  const rows: DailyNote[] = [
    note({ date: '2026-10-01', reflection: 'Ôn Part 3 hội thoại', partStudied: [3, 4], newWords: 5 }),
    note({ date: '2026-10-02', reflection: 'Luyện đề đọc hiểu', mistakesSummary: 'sai câu 12', partStudied: [7] }),
  ]

  it('tìm theo reflection/mistakesSummary/date', () => {
    expect(filterNotes(rows, { query: 'hội thoại', part: 0 })).toHaveLength(1)
    expect(filterNotes(rows, { query: 'câu 12', part: 0 })).toHaveLength(1)
    expect(filterNotes(rows, { query: '2026-10-02', part: 0 })).toHaveLength(1)
  })

  it('lọc theo Part đã học trong ngày', () => {
    expect(filterNotes(rows, { query: '', part: 3 })).toHaveLength(1)
    expect(filterNotes(rows, { query: '', part: 7 })).toHaveLength(1)
    expect(filterNotes(rows, { query: '', part: 5 })).toHaveLength(0)
  })
})

describe('filterMistakes (B6: lọc chưa reviewed + Part)', () => {
  const rows: Mistake[] = [
    mistake({ part: 2, reviewed: false }),
    mistake({ part: 2, reviewed: true }),
    mistake({ part: 5, reviewed: false }),
  ]

  it('lọc chưa ôn / đã ôn / tất cả', () => {
    expect(filterMistakes(rows, { part: 0, reviewed: 'unreviewed' })).toHaveLength(2)
    expect(filterMistakes(rows, { part: 0, reviewed: 'reviewed' })).toHaveLength(1)
    expect(filterMistakes(rows, { part: 0, reviewed: 'all' })).toHaveLength(3)
  })

  it('lọc kết hợp Part + trạng thái', () => {
    expect(filterMistakes(rows, { part: 2, reviewed: 'unreviewed' })).toHaveLength(1)
    expect(filterMistakes(rows, { part: 5, reviewed: 'reviewed' })).toHaveLength(0)
  })

  it('countUnreviewed đếm đúng', () => {
    expect(countUnreviewed(rows)).toBe(2)
    expect(countUnreviewed([])).toBe(0)
  })
})
