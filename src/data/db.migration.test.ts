/*
 * Test migration Dexie v1 → v2 (đa môn hoá) — mô phỏng DB v1 THẬT trong
 * fake-indexeddb: tạo tay object store đúng schema v1, chèn dữ liệu cũ (part 1–7),
 * rồi mở bằng StudyLogDB hiện tại (version 2) — Dexie chạy upgrade() và ta kiểm
 * chứng: seed 4 môn, part → subjectId, scores reshape, và DB mới vẫn dùng được.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { legacySubjectIdOf, seedSubjectsIfEmpty, StudyLogDB } from './db'

const DB_NAME = 'qlearn-study-log'
const NOW = 1_759_500_000_000

/** Dựng IndexedDB "v1" thủ công (cùng tên DB với StudyLogDB). */
async function createLegacyV1Db(rows: {
  sessions?: Record<string, unknown>[]
  vocab?: Record<string, unknown>[]
  mistakes?: Record<string, unknown>[]
  scores?: Record<string, unknown>[]
  dailyNotes?: Record<string, unknown>[]
}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const idb = req.result
      const sessions = idb.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true })
      sessions.createIndex('date', 'date')
      sessions.createIndex('part', 'part')
      sessions.createIndex('source', 'source')
      const vocab = idb.createObjectStore('vocab', { keyPath: 'id', autoIncrement: true })
      vocab.createIndex('word', 'word')
      vocab.createIndex('part', 'part')
      vocab.createIndex('createdAt', 'createdAt')
      const mistakes = idb.createObjectStore('mistakes', { keyPath: 'id', autoIncrement: true })
      mistakes.createIndex('part', 'part')
      mistakes.createIndex('reviewed', 'reviewed')
      mistakes.createIndex('createdAt', 'createdAt')
      const scores = idb.createObjectStore('scores', { keyPath: 'id', autoIncrement: true })
      scores.createIndex('date', 'date')
      scores.createIndex('total', 'total')
      idb.createObjectStore('settings', { keyPath: 'id' })
      idb.createObjectStore('dailyNotes', { keyPath: 'date' })
      const srs = idb.createObjectStore('srsCards', { keyPath: 'id', autoIncrement: true })
      srs.createIndex('vocabId', 'vocabId')
      srs.createIndex('box', 'box')
      srs.createIndex('dueDate', 'dueDate')
      const photos = idb.createObjectStore('photos', { keyPath: 'id', autoIncrement: true })
      photos.createIndex('refType', 'refType')
      photos.createIndex('refId', 'refId')
      photos.createIndex('createdAt', 'createdAt')
      const chat = idb.createObjectStore('chatMessages', { keyPath: 'id', autoIncrement: true })
      chat.createIndex('sessionId', 'sessionId')
      chat.createIndex('role', 'role')
      chat.createIndex('createdAt', 'createdAt')
    }
    req.onsuccess = () => {
      const idb = req.result
      try {
        const tx = idb.transaction(['sessions', 'vocab', 'mistakes', 'scores', 'dailyNotes'], 'readwrite')
        const put = (store: string, rows_: Record<string, unknown>[] | undefined) => {
          for (const r of rows_ ?? []) tx.objectStore(store).put(r)
        }
        put('sessions', rows.sessions)
        put('vocab', rows.vocab)
        put('mistakes', rows.mistakes)
        put('scores', rows.scores)
        put('dailyNotes', rows.dailyNotes)
        tx.oncomplete = () => {
          idb.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      } catch (err) {
        reject(err)
      }
    }
    req.onerror = () => reject(req.error)
  })
}

beforeEach(async () => {
  // Xoá DB giả để mỗi test tự dựng v1 từ đầu.
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = req.onerror = req.onblocked = () => resolve()
  })
})

describe('Dexie v1 → v2 upgrade (đa môn hoá)', () => {
  it('seed 4 môn + part 1–7 → môn TOEIC, part 0 → 0, scores reshape', async () => {
    await createLegacyV1Db({
      sessions: [
        { id: 1, date: '2026-10-01', startedAt: 1, endedAt: 2, durationMin: 25, part: 4, activity: 'nghe', source: 'timer', note: '', updatedAt: NOW },
        { id: 2, date: '2026-10-02', startedAt: 3, endedAt: 4, durationMin: 40, part: 0, activity: 'đọc', source: 'manual', note: '', updatedAt: NOW },
      ],
      vocab: [
        { id: 1, word: 'commute', meaning: '', example: '', part: 5, sourceTest: '', createdAt: NOW, updatedAt: NOW },
      ],
      mistakes: [
        { id: 1, testNo: 2, part: 7, questionNo: 14, myAnswer: 'A', correctAnswer: 'B', cause: '', explanation: '', reviewed: false, createdAt: NOW, updatedAt: NOW },
      ],
      scores: [
        { id: 1, date: '2026-10-01', testLabel: 'ETS 2023 · Đề 2', listening: 350, reading: 390, total: 740, updatedAt: NOW },
        { id: 2, date: '2026-10-02', testLabel: '', listening: 0, reading: 0, total: 0, updatedAt: NOW },
      ],
      dailyNotes: [
        { id: 1, date: '2026-10-01', partStudied: [3, 0, 9], newWords: 0, mistakesSummary: '', reflection: '', photoIds: [], autoDrafted: false, updatedAt: NOW },
      ],
    })

    const db = new StudyLogDB()
    await db.open()

    // 4 môn seed đúng thứ tự + màu TOEIC
    const subjects = await db.subjects.orderBy('id').toArray()
    expect(subjects.map((s) => s.name)).toEqual(['TOEIC', 'Toán', 'Tiếng Nhật', 'Lập trình'])
    const toeicId = subjects[0].id!

    // part 4 → môn TOEIC; part 0 → 0 (chưa phân môn)
    const sessions = await db.sessions.toArray()
    expect(sessions.map((s) => s.subjectId).sort()).toEqual([0, toeicId].sort((a, b) => a - b))
    expect(sessions.find((s) => s.id === 1)?.subjectId).toBe(toeicId)
    expect(sessions.find((s) => s.id === 2)?.subjectId).toBe(0)

    // vocab/mistakes giữ nguyên dữ liệu + có subjectId
    expect((await db.vocab.get(1))?.subjectId).toBe(toeicId)
    expect((await db.mistakes.get(1))?.subjectId).toBe(toeicId)

    // scores reshape; label trống → 'Bài kiểm tra'
    const score = await db.scores.get(1)
    expect(score).toMatchObject({
      subjectId: toeicId,
      label: 'ETS 2023 · Đề 2',
      score: 740,
      note: 'nghe 350 · đọc 390',
    })
    expect(await db.scores.get(2)).toMatchObject({ subjectId: toeicId, label: 'Bài kiểm tra', score: 0, note: '' })

    // dailyNotes.partStudied: Part 1–7 cũ → TOEIC; 0/giá trị khác giữ nguyên
    expect(await db.dailyNotes.get('2026-10-01')).toMatchObject({ partStudied: [toeicId, 0, 9] })

    db.close()
  })

  it('DB mới (chưa tồn tại) mở bằng StudyLogDB → Dexie KHÔNG chạy upgrade, seed runtime bù vào', async () => {
    const db = new StudyLogDB()
    await db.open()
    // Dexie bỏ qua upgrade() trên DB tạo mới — bảng subjects rỗng cho tới khi
    // app gọi seedSubjectsIfEmpty() (qua DexieSubjectRepo.list()).
    expect(await db.subjects.count()).toBe(0)

    // Seed runtime (đường đi thật của app khi nạp danh sách môn lần đầu).
    await seedSubjectsIfEmpty()
    const subjects = await db.subjects.orderBy('id').toArray()
    expect(subjects.map((s) => s.name)).toEqual(['TOEIC', 'Toán', 'Tiếng Nhật', 'Lập trình'])

    // DB mới dùng được ngay: tạo buổi qua Dexie table API (như repo làm).
    const session = {
      date: '2026-10-03',
      startedAt: 1,
      endedAt: 2,
      durationMin: 25,
      subjectId: subjects[0]!.id!,
      activity: 'nghe',
      source: 'timer' as const,
      note: '',
      updatedAt: NOW,
    }
    expect(await db.sessions.add(session)).toBeGreaterThan(0)
    db.close()
  })
})

describe('legacySubjectIdOf — quy tắc part cũ → môn', () => {
  it('part 1–7 → id môn TOEIC; part 0/không có → 0', () => {
    expect(legacySubjectIdOf(1, 42)).toBe(42)
    expect(legacySubjectIdOf(7, 42)).toBe(42)
    expect(legacySubjectIdOf(0, 42)).toBe(0)
    expect(legacySubjectIdOf(undefined, 42)).toBe(0)
    expect(legacySubjectIdOf(null, 42)).toBe(0)
    expect(legacySubjectIdOf(8, 42)).toBe(0)
  })
})
