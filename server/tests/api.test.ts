// @vitest-environment node
/*
 * Test server (vitest, chạy chung `npm run test`):
 *  - SQLite IN-MEMORY (openDb(':memory:')) — không đụng tệp server/data/qlearn.db;
 *  - gọi HANDLER TRỰC TIẾP (không mở cổng, không cần express listen);
 *  - phủ cả đường vui lẫn validate Zod 400 / không tìm thấy 404 của 9 bảng.
 */
import type { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'

import { openDb } from '../src/db.js'
import { ApiError } from '../src/errors.js'
import * as chat from '../src/handlers/chat.js'
import * as mistakes from '../src/handlers/mistakes.js'
import * as notes from '../src/handlers/notes.js'
import * as photos from '../src/handlers/photos.js'
import * as restore from '../src/handlers/restore.js'
import * as scores from '../src/handlers/scores.js'
import * as sessions from '../src/handlers/sessions.js'
import * as settings from '../src/handlers/settings.js'
import * as srs from '../src/handlers/srs.js'
import * as vocab from '../src/handlers/vocab.js'

let db: DatabaseSync

beforeEach(() => {
  db = openDb(':memory:')
})

/** Handler là hàm đồng bộ — bắt ApiError và kiểm tra mã HTTP. */
function expectApiError(status: number, run: () => unknown): void {
  try {
    run()
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(status)
    return
  }
  throw new Error(`Mong đợi ApiError ${status} nhưng handler chạy thông.`)
}

const SESSION_INPUT = {
  date: '2026-10-01',
  startedAt: 1_759_276_800_000,
  endedAt: null,
  durationMin: 25,
  part: 2,
  activity: 'nghe',
  source: 'timer' as const,
  note: '',
}

const NOTE_INPUT = {
  date: '2026-10-02',
  partStudied: [1, 2],
  newWords: 5,
  mistakesSummary: 'Part 2 hội thoại',
  reflection: 'Cần nghe chậm lại',
  photoIds: [],
  autoDrafted: false,
  updatedAt: 0,
}

describe('settings handler', () => {
  it('lần đầu tự tạo hàng mặc định (syncMode local, serverUrl rỗng)', () => {
    const row = settings.getSettings(db)
    expect(row.id).toBe(1)
    expect(row.dailyGoalMinutes).toBe(90)
    expect(row.targetScore).toBe(700)
    expect(row.pomodoro).toEqual({ focusMin: 25, breakMin: 5 })
    expect(row.syncMode).toBe('local')
    expect(row.serverUrl).toBe('')
    expect(row.checkinEnabled).toBe(true)
    expect(row.updatedAt).toBeGreaterThan(0)
    // get lần nữa không nhân bản hàng
    expect(settings.getSettings(db).updatedAt).toBe(row.updatedAt)
  })

  it('update ghi một phần và giữ nguyên các trường còn lại', () => {
    const next = settings.updateSettings(db, {
      dailyGoalMinutes: 30,
      syncMode: 'server',
      serverUrl: 'http://192.168.1.5:5178',
    })
    expect(next.dailyGoalMinutes).toBe(30)
    expect(next.syncMode).toBe('server')
    expect(next.serverUrl).toBe('http://192.168.1.5:5178')
    expect(next.targetScore).toBe(700)
    expect(settings.getSettings(db).dailyGoalMinutes).toBe(30)
  })

  it('sai ràng buộc (targetScore 5000) → ApiError 400', () => {
    expectApiError(400, () => settings.updateSettings(db, { targetScore: 5000 }))
  })

  it('patch MỘT trường KHÔNG có syncMode/serverUrl → giữ nguyên lựa chọn nguồn dữ liệu (Zod không bung default)', () => {
    settings.updateSettings(db, { syncMode: 'server', serverUrl: 'http://192.168.1.5:5178' })
    const next = settings.updateSettings(db, { dailyGoalMinutes: 45 })
    expect(next.dailyGoalMinutes).toBe(45)
    expect(next.syncMode).toBe('server')
    expect(next.serverUrl).toBe('http://192.168.1.5:5178')
  })

  it('patch checkinEnabled → ghi đúng; patch trường khác KHÔNG reset checkinEnabled (Zod không bung default)', () => {
    settings.updateSettings(db, { checkinEnabled: false })
    const next = settings.updateSettings(db, { dailyGoalMinutes: 60 })
    expect(next.dailyGoalMinutes).toBe(60)
    expect(next.checkinEnabled).toBe(false)
  })
})

describe('sessions handler', () => {
  it('create trả về bản ghi đầy đủ (id + updatedAt)', () => {
    const row = sessions.createSession(db, SESSION_INPUT)
    expect(row.id).toBeGreaterThan(0)
    expect(row.updatedAt).toBeGreaterThan(0)
    expect(row.source).toBe('timer')
    expect(row.endedAt).toBeNull()
  })

  it('listBetween lọc theo khoảng ngày', () => {
    sessions.createSession(db, SESSION_INPUT)
    sessions.createSession(db, { ...SESSION_INPUT, date: '2026-10-03' })
    expect(sessions.listSessions(db, { from: '2026-10-01', to: '2026-10-01' })).toHaveLength(1)
    expect(sessions.listSessions(db, { from: '2026-10-01', to: '2026-10-03' })).toHaveLength(2)
    expect(sessions.listSessions(db, {})).toHaveLength(2)
  })

  it('update ghi đè trường truyền vào (endedAt null được giữ)', () => {
    const row = sessions.createSession(db, SESSION_INPUT)
    sessions.updateSession(db, String(row.id), { endedAt: null, durationMin: 40 })
    const [after] = sessions.listSessions(db, { from: '2026-10-01', to: '2026-10-01' })
    expect(after.durationMin).toBe(40)
    expect(after.endedAt).toBeNull()
  })

  it('update id không tồn tại → 404; date sai định dạng → 400', () => {
    expectApiError(404, () => sessions.updateSession(db, '9999', { note: 'x' }))
    expectApiError(400, () =>
      sessions.createSession(db, { ...SESSION_INPUT, date: '01-10-2026' }),
    )
  })

  it('remove xóa hẳn buổi học', () => {
    const row = sessions.createSession(db, SESSION_INPUT)
    sessions.deleteSession(db, String(row.id))
    expect(sessions.listSessions(db, {})).toHaveLength(0)
  })
})

describe('notes handler', () => {
  it('upsert + get khôi tròn dữ liệu (mảng, boolean)', () => {
    const saved = notes.putNote(db, '2026-10-02', NOTE_INPUT)
    expect(saved.date).toBe('2026-10-02')
    expect(saved.partStudied).toEqual([1, 2])
    expect(saved.updatedAt).toBeGreaterThan(0)
    const read = notes.getNote(db, '2026-10-02')
    expect(read).toEqual(saved)
  })

  it('upsert lần 2 ghi đè (một bản ghi mỗi ngày)', () => {
    notes.putNote(db, '2026-10-02', NOTE_INPUT)
    notes.putNote(db, '2026-10-02', { ...NOTE_INPUT, reflection: 'sửa' })
    const read = notes.getNote(db, '2026-10-02')
    expect(read?.reflection).toBe('sửa')
    expect(notes.listNotes(db, {})).toHaveLength(1)
  })

  it('get ngày chưa có → undefined; listBetween lọc đúng', () => {
    expect(notes.getNote(db, '2026-10-02')).toBeUndefined()
    notes.putNote(db, '2026-10-02', NOTE_INPUT)
    notes.putNote(db, '2026-10-05', { ...NOTE_INPUT, date: '2026-10-05' })
    expect(notes.listNotes(db, { from: '2026-10-03', to: '2026-10-31' })).toHaveLength(1)
  })

  it('partStudied có part 9 → 400; ngày sai định dạng → 400', () => {
    expectApiError(400, () => notes.putNote(db, '2026-10-02', { ...NOTE_INPUT, partStudied: [9] }))
    expectApiError(400, () => notes.getNote(db, 'not-a-date'))
  })
})

describe('vocab handler', () => {
  const VOCAB = { word: 'commute (v/n)', meaning: 'đi làm hằng ngày', example: 'I commute by bus.', part: 4, sourceTest: '' }

  it('create + list + search (không phân biệt hoa thường)', () => {
    const row = vocab.createVocab(db, VOCAB)
    expect(row.id).toBeGreaterThan(0)
    expect(row.createdAt).toBeGreaterThan(0)
    expect(vocab.listVocab(db)).toHaveLength(1)
    expect(vocab.searchVocab(db, { q: 'COMMUTE' })).toHaveLength(1)
    expect(vocab.searchVocab(db, { q: 'đi làm' })).toHaveLength(1)
    expect(vocab.searchVocab(db, { q: '' })).toHaveLength(0)
    expect(vocab.searchVocab(db, { q: 'không có' })).toHaveLength(0)
  })

  it('update ghi một phần; id lạ → 404; word rỗng → 400; remove xóa', () => {
    const row = vocab.createVocab(db, VOCAB)
    vocab.updateVocab(db, String(row.id), { meaning: 'đi làm mỗi ngày' })
    const [after] = vocab.listVocab(db)
    expect(after.meaning).toBe('đi làm mỗi ngày')
    expect(after.word).toBe(VOCAB.word)
    expectApiError(404, () => vocab.updateVocab(db, '9999', { meaning: 'x' }))
    expectApiError(400, () => vocab.createVocab(db, { ...VOCAB, word: '' }))
    vocab.deleteVocab(db, String(row.id))
    expect(vocab.listVocab(db)).toHaveLength(0)
  })
})

describe('srs handler', () => {
  it('createForVocab tạo thẻ hộp 1 chưa ôn', () => {
    const card = srs.createSrsForVocab(db, { vocabId: 5, dueDate: '2026-10-01' })
    expect(card.box).toBe(1)
    expect(card.correctCount).toBe(0)
    expect(card.lastReviewed).toBeNull()
    expect(srs.getSrsByVocab(db, '5')?.id).toBe(card.id)
    expect(srs.getSrsByVocab(db, '99')).toBeUndefined()
  })

  it('removeSrsByVocab xóa mọi thẻ của 1 từ vựng (gọi khi xoá từ)', () => {
    srs.createSrsForVocab(db, { vocabId: 5, dueDate: '2026-10-01' })
    srs.createSrsForVocab(db, { vocabId: 6, dueDate: '2026-10-01' })
    srs.removeSrsByVocab(db, '5')
    expect(srs.getSrsByVocab(db, '5')).toBeUndefined()
    expect(srs.getSrsByVocab(db, '6')).not.toBeUndefined() // thẻ của từ khác còn nguyên
  })

  it('review đúng → hộp +1, dueDate lùi 3 ngày (hộp 2); sai → về hộp 1, lùi 1 ngày', () => {
    const card = srs.createSrsForVocab(db, { vocabId: 5, dueDate: '2026-10-01' })
    const good = srs.reviewSrs(db, String(card.id), { correct: true, today: '2026-10-04' })
    expect(good?.box).toBe(2)
    expect(good?.dueDate).toBe('2026-10-07')
    expect(good?.correctCount).toBe(1)
    expect(good?.lastReviewed).toBeGreaterThan(0)
    const bad = srs.reviewSrs(db, String(card.id), { correct: false, today: '2026-10-04' })
    expect(bad?.box).toBe(1)
    expect(bad?.dueDate).toBe('2026-10-05')
    expect(bad?.correctCount).toBe(1)
  })

  it('listDue lấy thẻ đến hạn (dueDate <= ngày), bỏ thẻ mồ côi (từ đã xoá)', () => {
    // listDue JOIN vocab — tạo 2 từ thật để thẻ không bị coi là mồ côi.
    const v1 = vocab.createVocab(db, { word: 'commute', meaning: '', example: '', part: 0, sourceTest: '' })
    const v2 = vocab.createVocab(db, { word: 'deliberate', meaning: '', example: '', part: 0, sourceTest: '' })
    srs.createSrsForVocab(db, { vocabId: v1.id, dueDate: '2026-10-01' })
    srs.createSrsForVocab(db, { vocabId: v2.id, dueDate: '2026-10-09' })
    const due = srs.listDueSrs(db, '2026-10-05')
    expect(due).toHaveLength(1)
    expect(due[0].vocabId).toBe(v1.id)
  })

  it('put ghi NGUYÊN trạng thái (có id) hoặc tạo mới (không id)', () => {
    const card = srs.createSrsForVocab(db, { vocabId: 5, dueDate: '2026-10-01' })
    const overwritten = srs.putSrs(db, {
      id: card.id,
      vocabId: 5,
      box: 4,
      dueDate: '2026-11-01',
      lastReviewed: 1_759_000_000_000,
      correctCount: 9,
    })
    expect(overwritten.id).toBe(card.id)
    expect(overwritten.box).toBe(4)
    expect(overwritten.correctCount).toBe(9)
    const fresh = srs.putSrs(db, { vocabId: 6, box: 2, dueDate: '2026-10-10', lastReviewed: null, correctCount: 0 })
    expect(fresh.id).not.toBe(card.id)
    expect(fresh.box).toBe(2)
  })

  it('review thẻ không tồn tại → undefined; ngày ôn sai → 400', () => {
    expect(srs.reviewSrs(db, '9999', { correct: true, today: '2026-10-04' })).toBeUndefined()
    expectApiError(400, () => srs.reviewSrs(db, '1', { correct: true, today: '10-2026' }))
  })
})

describe('mistakes handler', () => {
  const MISTAKE = {
    testNo: 2,
    part: 3,
    questionNo: 14,
    myAnswer: 'A',
    correctAnswer: 'B',
    cause: 'từ vựng',
    explanation: 'nhầm meaning',
    reviewed: false,
  }

  it('create + list + setReviewed', () => {
    const row = mistakes.createMistake(db, MISTAKE)
    expect(row.reviewed).toBe(false)
    mistakes.setMistakeReviewed(db, String(row.id), { reviewed: true })
    const [after] = mistakes.listMistakes(db)
    expect(after.reviewed).toBe(true)
  })

  it('update một phần, id lạ → 404, part 9 → 400, remove', () => {
    const row = mistakes.createMistake(db, MISTAKE)
    mistakes.updateMistake(db, String(row.id), { cause: 'chăm chú' })
    const [after] = mistakes.listMistakes(db)
    expect(after.cause).toBe('chăm chú')
    expect(after.questionNo).toBe(14)
    expectApiError(404, () => mistakes.updateMistake(db, '9999', { cause: 'x' }))
    expectApiError(400, () => mistakes.createMistake(db, { ...MISTAKE, part: 9 }))
    mistakes.deleteMistake(db, String(row.id))
    expect(mistakes.listMistakes(db)).toHaveLength(0)
  })
})

describe('scores handler', () => {
  it('create đúng tổng → trả về bản ghi', () => {
    const row = scores.createScore(db, { date: '2026-10-01', testLabel: 'ETS 2023 · Đề 2', listening: 350, reading: 400, total: 750 })
    expect(row.id).toBeGreaterThan(0)
    expect(scores.listScores(db)).toHaveLength(1)
  })

  it('total lệch listening + reading → 400; remove xóa', () => {
    expectApiError(400, () =>
      scores.createScore(db, { date: '2026-10-01', testLabel: 'ETS', listening: 350, reading: 400, total: 700 }),
    )
    const row = scores.createScore(db, { date: '2026-10-01', testLabel: 'ETS', listening: 350, reading: 400, total: 750 })
    scores.deleteScore(db, String(row.id))
    expect(scores.listScores(db)).toHaveLength(0)
  })
})

describe('photos handler', () => {
  const PNG_BASE64 = Buffer.from([1, 2, 3, 255, 0]).toString('base64')

  it('create lưu BLOB và trả base64 ngược lại đúng bytes', () => {
    const row = photos.createPhoto(db, {
      mime: 'image/png',
      refType: 'note',
      refId: '2026-10-04',
      dataBase64: PNG_BASE64,
    })
    expect(row.id).toBeGreaterThan(0)
    expect(row.dataBase64).toBe(PNG_BASE64)
    expect(photos.getPhoto(db, String(row.id))?.dataBase64).toBe(PNG_BASE64)
    expect(photos.getPhoto(db, '9999')).toBeUndefined()
  })

  it('list theo refType + refId hoặc tất cả', () => {
    photos.createPhoto(db, { mime: 'image/png', refType: 'note', refId: '2026-10-04', dataBase64: PNG_BASE64 })
    photos.createPhoto(db, { mime: 'image/png', refType: 'session', refId: '1', dataBase64: PNG_BASE64 })
    expect(photos.listPhotos(db, { refType: 'note', refId: '2026-10-04' })).toHaveLength(1)
    expect(photos.listPhotos(db, {})).toHaveLength(2)
  })

  it('dataBase64 rác → 400; remove xóa', () => {
    expectApiError(400, () =>
      photos.createPhoto(db, { mime: 'image/png', refType: 'note', refId: 'x', dataBase64: '!!!!' }),
    )
    const row = photos.createPhoto(db, { mime: 'image/png', refType: 'note', refId: 'x', dataBase64: PNG_BASE64 })
    photos.deletePhoto(db, String(row.id))
    expect(photos.getPhoto(db, String(row.id))).toBeUndefined()
  })
})

describe('chat handler', () => {
  it('append + listBySession theo thứ tự tạo', () => {
    chat.appendChat(db, { sessionId: 's1', role: 'user', content: 'xin chào' })
    chat.appendChat(db, { sessionId: 's1', role: 'assistant', content: 'chào bạn' })
    chat.appendChat(db, { sessionId: 's2', role: 'user', content: 'phiên khác' })
    const rows = chat.listChatBySession(db, { sessionId: 's1' })
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.role)).toEqual(['user', 'assistant'])
    expect(rows[0].createdAt).toBeGreaterThan(0)
    expect(chat.listChatSessions(db)).toEqual(['s1', 's2'])
  })

  it('removeSession xóa cả phiên; sessionId rỗng → 400', () => {
    chat.appendChat(db, { sessionId: 's1', role: 'user', content: 'xin chào' })
    chat.deleteChatSession(db, 's1')
    expect(chat.listChatBySession(db, { sessionId: 's1' })).toHaveLength(0)
    expect(chat.listChatSessions(db)).toEqual([])
    expectApiError(400, () => chat.appendChat(db, { sessionId: '', role: 'user', content: 'x' }))
  })
})

// ===== Restore (khôi phục bản sao lưu — 1 transaction, xoá sạch rồi ghi) =====

const RESTORE_PAYLOAD = {
  settings: {
    dailyGoalMinutes: 60,
    targetScore: 800,
    examDate: '',
    reminderTime: '20:00',
    ragBaseUrl: '',
    onboardingDone: true,
    pomodoro: { focusMin: 30, breakMin: 5 },
  },
  sessions: [SESSION_INPUT],
  vocab: [{ word: 'commute', meaning: 'đi làm', example: 'I commute.', part: 3, sourceTest: '' }],
  srsCards: [{ vocabKey: 0, box: 2, dueDate: '2026-10-05', lastReviewed: 1, correctCount: 1 }],
  mistakes: [
    { testNo: 1, part: 2, questionNo: 10, myAnswer: 'A', correctAnswer: 'B', cause: 'từ vựng', explanation: '', reviewed: false },
  ],
  scores: [{ date: '2026-10-01', testLabel: 'Đề thử', listening: 300, reading: 300, total: 600 }],
  dailyNotes: [NOTE_INPUT],
  chat: [{ sessionId: 's1', role: 'user' as const, content: 'xin chào' }],
  photos: [],
}

describe('restore handler', () => {
  it('xoá sạch dữ liệu cũ rồi ghi lại; syncMode/serverUrl của máy GIỮ NGUYÊN', () => {
    // Dữ liệu "bẩn" trước khi khôi phục
    sessions.createSession(db, SESSION_INPUT)
    sessions.createSession(db, { ...SESSION_INPUT, date: '2026-10-02' })
    settings.updateSettings(db, { syncMode: 'server', serverUrl: 'http://192.168.1.5:5178' })

    restore.restoreAll(db, RESTORE_PAYLOAD)

    expect(sessions.listSessions(db, {})).toHaveLength(1) // dữ liệu bẩn đã bị thay
    const row = settings.getSettings(db)
    expect(row.dailyGoalMinutes).toBe(60)
    expect(row.syncMode).toBe('server') // nguồn dữ liệu không bị restore ghi đè
    expect(row.serverUrl).toBe('http://192.168.1.5:5178')
  })

  it('chạy lại 2 lần → không nhân đôi (clear-trước-ghi, idempotent)', () => {
    restore.restoreAll(db, RESTORE_PAYLOAD)
    restore.restoreAll(db, RESTORE_PAYLOAD)
    expect(sessions.listSessions(db, {})).toHaveLength(1)
    expect(vocab.listVocab(db)).toHaveLength(1)
    expect(srs.listSrs(db)).toHaveLength(1)
    expect(mistakes.listMistakes(db)).toHaveLength(1)
    expect(scores.listScores(db)).toHaveLength(1)
    expect(notes.listNotes(db, {})).toHaveLength(1)
    expect(chat.listChatBySession(db, { sessionId: 's1' })).toHaveLength(1)
  })

  it('thẻ SRS khôi phục tham chiếu đúng từ qua vocabKey; listDue JOIN vocab không trả thẻ mồ côi', () => {
    restore.restoreAll(db, RESTORE_PAYLOAD)
    const cards = srs.listDueSrs(db, '2026-10-05')
    expect(cards).toHaveLength(1)
    const vocabRow = vocab.listVocab(db)[0]
    expect(cards[0].vocabId).toBe(vocabRow.id)

    // Thẻ mồ côi (vocabId không tồn tại) không được listDue trả về
    const dbAny = db
    dbAny
      .prepare('INSERT INTO srsCards (vocabId, box, dueDate, lastReviewed, correctCount, updatedAt) VALUES (9999, 1, ?, NULL, 0, ?)')
      .run('2026-10-01', Date.now())
    expect(srs.listDueSrs(db, '2026-10-05')).toHaveLength(1)
  })

  it('payload thiếu trường → 400', () => {
    const broken = { ...RESTORE_PAYLOAD, vocab: undefined }
    expectApiError(400, () => restore.restoreAll(db, broken))
  })
})
