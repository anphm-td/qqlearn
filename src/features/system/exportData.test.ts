/*
 * Test logic thuần xuất dữ liệu + sao lưu/khôi phục (nhóm D — hệ thống).
 * Chạy: npx vitest run src/features/system
 */
import { describe, expect, it } from 'vitest'

import { t as translate } from '@core/i18n'

import {
  base64ToBytes,
  buildBackup,
  bytesFromDataUrl,
  bytesToBase64,
  dataUrlOf,
  exportMarkdown,
  formatClock,
  mistakesCsv,
  parseBackup,
  planRestore,
  scoresCsv,
  serializeBackup,
  sessionsCsv,
  vocabCsv,
  withBom,
} from './exportData'
import type { BackupInput, TranslateFn } from './exportData'
import type { DailyNote, Mistake, Score, Session, Subject, Vocab } from '@core/types'

/** Hàm dịch tiếng Việt (nguồn chuẩn) — tiêm vào parseBackup để kiểm tra thông điệp hiển thị. */
const tVi: TranslateFn = (key, vars) => translate('vi', 'settings', key, vars)

const day = (d: number, h = 0, m = 0) => new Date(2026, 9, d, h, m, 0, 0)

const SESSION: Session = {
  id: 7,
  date: '2026-10-03',
  startedAt: day(3, 19, 0).getTime(),
  endedAt: day(3, 19, 45).getTime(),
  durationMin: 45,
  subjectId: 3,
  activity: 'nghe',
  source: 'timer',
  note: 'ghi chú, có dấu phẩy',
  updatedAt: 2,
}

const NOTE: DailyNote = {
  date: '2026-10-03',
  partStudied: [3, 4],
  newWords: 12,
  mistakesSummary: 'quên đổi đơn vị',
  reflection: 'hôm nay tập trung tốt',
  photoIds: [],
  autoDrafted: false,
  updatedAt: 2,
}

const VOCAB: Vocab = {
  id: 5,
  word: 'commute (v/n)',
  meaning: 'đi làm hằng ngày',
  example: 'I commute by train — "quoted".',
  subjectId: 3,
  sourceTest: 'ETS 2023 · Đề 2',
  createdAt: day(3, 8, 0).getTime(),
  updatedAt: 2,
}

const MISTAKE: Mistake = {
  id: 3,
  testNo: 2,
  subjectId: 3,
  questionNo: 14,
  myAnswer: 'A',
  correctAnswer: 'B',
  cause: 'từ vựng',
  explanation: 'nhầm nghĩa của "deliberate"',
  reviewed: false,
  createdAt: day(3, 20, 0).getTime(),
  updatedAt: 2,
}

const SCORE: Score = {
  id: 9,
  date: '2026-10-01',
  subjectId: 3,
  label: 'Toán — Định lí Pytago',
  score: 8,
  note: 'sai bài 4 vì quên đổi đơn vị',
  updatedAt: 2,
}

const BACKUP_INPUT: BackupInput = {
  settings: {
    dailyGoalMinutes: 90,
    targetScore: 740,
    examDate: '2026-12-14',
    reminderTime: '19:00',
    ragBaseUrl: 'http://localhost:8000',
    onboardingDone: true,
    pomodoro: { focusMin: 25, breakMin: 5 },
  },
  subjects: [
    { id: 1, name: 'TOEIC', colorHex: '#FFD273', goalMinutesPerDay: 0, archived: false, createdAt: 0, updatedAt: 0 },
    { id: 2, name: 'Toán', colorHex: '#BFAEE3', goalMinutesPerDay: 30, archived: false, createdAt: 0, updatedAt: 0 },
  ],
  sessions: [SESSION],
  dailyNotes: [NOTE],
  vocab: [VOCAB],
  srsCards: [{ id: 11, vocabId: 5, box: 3, dueDate: '2026-10-10', lastReviewed: 1, correctCount: 4, updatedAt: 2 }],
  mistakes: [MISTAKE],
  scores: [SCORE],
  chatMessages: [],
  photos: [{ id: 21, mime: 'image/png', refType: 'session', refId: '7', dataUrl: dataUrlOf('image/png', new Uint8Array([1, 2, 3])) }],
}

const SUBJECT_NAMES = new Map<number, string>([
  [1, 'TOEIC'],
  [2, 'Toán'],
])
const nameOf = (id: number) => SUBJECT_NAMES.get(id)

// ===== BOM + CSV =====

describe('withBom (BOM UTF-8 cho Excel)', () => {
  it('thêm U+FEFF vào đầu chuỗi', () => {
    const bom = withBom('abc')
    expect(bom.length).toBe(4)
    expect(bom.charCodeAt(0)).toBe(0xfeff)
    expect(bom.slice(1)).toBe('abc')
  })
})

describe('sessionsCsv', () => {
  it('có dòng tiêu đề tiếng Việt + xuống dòng CRLF', () => {
    const csv = sessionsCsv([SESSION])
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('ngày,bắt đầu,kết thúc,thời lượng (phút),môn,hoạt động,nguồn,ghi chú')
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it('ghi đúng giờ local và bao kép ô chứa dấu phẩy', () => {
    const csv = sessionsCsv([SESSION])
    expect(csv).toContain('2026-10-03,19:00,19:45,45,3,nghe,timer,"ghi chú, có dấu phẩy"')
  })

  it('cột môn dùng TÊN môn khi có map id→tên (LOW 7)', () => {
    const withNamed = sessionsCsv([{ ...SESSION, subjectId: 2 }], nameOf)
    expect(withNamed).toContain(',45,Toán,nghe,')
    // Môn không có trong map (id 3) → fallback chữ số; môn 0 → trống
    expect(sessionsCsv([SESSION], nameOf)).toContain('2026-10-03,19:00,19:45,45,3,nghe,timer,')
    expect(sessionsCsv([{ ...SESSION, subjectId: 0 }], nameOf)).toContain('2026-10-03,19:00,19:45,45,,nghe,timer,')
  })

  it('môn 0 → ô trống; đang học → kết thúc trống', () => {
    const csv = sessionsCsv([{ ...SESSION, subjectId: 0, endedAt: null, note: '' }])
    expect(csv).toContain('2026-10-03,19:00,,45,,nghe,timer,')
  })

  it('dấu ngoặc kép trong ô được nhân đôi', () => {
    const csv = sessionsCsv([{ ...SESSION, note: 'nói "listen again"' }])
    expect(csv).toContain('"nói ""listen again"""')
  })
})

describe('vocabCsv / mistakesCsv / scoresCsv', () => {
  it('vocab: ngày tạo theo giờ local, bao kép ví dụ có ngoặc kép', () => {
    const csv = vocabCsv([VOCAB])
    expect(csv).toContain('từ,nghĩa,ví dụ,môn,nguồn,ngày tạo')
    // Ô không chứa dấu phẩy/ngoặc kép thì KHÔNG được bao (chuẩn RFC-4180).
    expect(csv).toContain('commute (v/n),đi làm hằng ngày,"I commute by train — ""quoted"".",3,ETS 2023 · Đề 2,2026-10-03')
  })

  it('mistakes: testNo 0 → trống, đã ôn lại → "rồi", giải thích có bao kép', () => {
    const csv = mistakesCsv([{ ...MISTAKE, testNo: 0, reviewed: true }])
    expect(csv).toContain(',3,14,A,B,từ vựng,"nhầm nghĩa của ""deliberate""",rồi')
  })

  it('scores: đủ môn/nhãn/điểm/ghi chú — môn theo TÊN khi có map', () => {
    const csv = scoresCsv([SCORE])
    expect(csv).toContain('ngày,môn,nhãn,điểm,ghi chú')
    expect(csv).toContain('2026-10-01,3,Toán — Định lí Pytago,8,sai bài 4 vì quên đổi đơn vị')
    expect(scoresCsv([{ ...SCORE, subjectId: 2 }], nameOf)).toContain('2026-10-01,Toán,')
  })
})

describe('formatClock', () => {
  it('trả HH:mm giờ địa phương', () => {
    expect(formatClock(day(3, 19, 5).getTime())).toBe('19:05')
    expect(formatClock(day(3, 6, 30).getTime())).toBe('06:30')
  })
})

// ===== Markdown =====

describe('exportMarkdown', () => {
  it('gom buổi học + ghi chú theo ngày, ngày mới nhất đứng trước', () => {
    const other: Session = { ...SESSION, id: 8, date: '2026-10-01', note: '', subjectId: 0, activity: 'từ vựng' }
    const md = exportMarkdown([NOTE], [SESSION, other], day(3, 21, 0))
    expect(md.startsWith('# qqlearn')).toBe(true)
    expect(md).toContain('Xuất ngày 2026-10-03 lúc 21:00')
    expect(md.indexOf('## 2026-10-03')).toBeLessThan(md.indexOf('## 2026-10-01'))
    expect(md).toContain('- 45 phút — nghe (môn 3) · 19:00–19:45 — ghi chú, có dấu phẩy')
    expect(md).toContain('### Ghi chú cuối ngày')
    expect(md).toContain('- Môn đã học: 3, 4')
    expect(md).toContain('- Từ mới: 12')
    expect(md).toContain('- Lỗi sai: quên đổi đơn vị')
    expect(md).toContain('- Nhận xét: hôm nay tập trung tốt')
  })

  it('buổi đang học ghi "đang học"; ngày không có gì bị bỏ', () => {
    const running: Session = { ...SESSION, endedAt: null }
    const md = exportMarkdown([], [running], day(3, 21, 0))
    expect(md).toContain('19:00–đang học')
    expect(md).not.toContain('### Ghi chú cuối ngày')
  })

  it('rỗng → chỉ có phần mở đầu', () => {
    const md = exportMarkdown([], [], day(3, 21, 0))
    expect(md).not.toContain('## ')
  })
})

// ===== Base64 / data URL (ảnh trong bản sao lưu) =====

describe('base64 ↔ bytes', () => {
  it('vector quen thuộc: [104,105] → "aGk="', () => {
    expect(bytesToBase64(new Uint8Array([104, 105]))).toBe('aGk=')
  })

  it('đi và về khớp với mọi độ dài 0–20', () => {
    for (let len = 0; len <= 20; len++) {
      const bytes = new Uint8Array(len)
      for (let i = 0; i < len; i++) bytes[i] = (i * 37 + len * 11) % 256
      expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes)
    }
  })

  it('data URL: dựng và đọc lại', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 255])
    const url = dataUrlOf('image/png', bytes)
    expect(url.startsWith('data:image/png;base64,')).toBe(true)
    expect(bytesFromDataUrl(url)).toEqual(bytes)
  })

  it('chuỗi không phải data URL → null', () => {
    expect(bytesFromDataUrl('không-phải-data-url')).toBeNull()
  })
})

// ===== Sao lưu JSON: dựng → serialize → đọc lại =====

describe('buildBackup + serializeBackup + parseBackup', () => {
  it('vòng tròn đầy đủ: mọi bảng giữ nguyên dữ liệu', () => {
    const data = buildBackup(BACKUP_INPUT, day(3, 21, 0))
    const text = serializeBackup(data)
    const parsed = parseBackup(text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.data.exportedAt).toBe('2026-10-03 21:00')
    // settingsSchema có checkinEnabled/syncMode/serverUrl/language với .default() —
    // bản sao lưu cũ chưa có các trường này vẫn đọc được và được tự điền mặc định
    // (language mặc định 'vi' — design-system.md mục 12).
    expect(parsed.data.settings).toEqual({
      ...BACKUP_INPUT.settings,
      checkinEnabled: true,
      syncMode: 'local',
      serverUrl: '',
      language: 'vi',
    })
    expect(parsed.data.sessions).toEqual([SESSION])
    expect(parsed.data.dailyNotes).toEqual([NOTE])
    expect(parsed.data.vocab).toEqual([VOCAB])
    expect(parsed.data.mistakes).toEqual([MISTAKE])
    expect(parsed.data.scores).toEqual([SCORE])
    expect(parsed.data.srsCards).toEqual(BACKUP_INPUT.srsCards)
    expect(parsed.data.photos).toEqual(BACKUP_INPUT.photos)
    expect(parsed.data.chatMessages).toEqual([])
  })

  it('JSON hỏng → báo lỗi dễ hiểu (qua hàm dịch tiếng Việt được tiêm vào)', () => {
    const result = parseBackup('không phải json', tVi)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('không đọc được')
  })

  it('sai cấu trúc → báo đúng mục lỗi', () => {
    const result = parseBackup(JSON.stringify({ app: 'qlearn-study-log' }), tVi)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('schemaVersion')
  })

  it('dòng hỏng trong bảng → báo đúng bảng', () => {
    const data = buildBackup(BACKUP_INPUT, day(3, 21, 0))
    const broken = { ...data, sessions: [{ ...data.sessions[0], date: '3-10-2026' }] }
    const result = parseBackup(JSON.stringify(broken), tVi)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('sessions')
  })

  it('điểm ngoài khoảng hợp lệ (score 5000) → từ chối', () => {
    const data = buildBackup(BACKUP_INPUT, day(3, 21, 0))
    const broken = { ...data, scores: [{ ...data.scores[0], score: 5000 }] }
    expect(parseBackup(JSON.stringify(broken)).ok).toBe(false)
  })
})

// ===== Kế hoạch khôi phục (tham chiếu chéo theo CHỈ MỤC trong payload) =====

describe('planRestore', () => {
  it('chuẩn bị mọi bảng + tham chiếu chéo theo chỉ mục cho ảnh/thẻ ôn', () => {
    const data = buildBackup(BACKUP_INPUT, day(3, 21, 0))
    const plan = planRestore(data)

    // Settings: đúng 7 trường — syncMode/serverUrl là lựa chọn của máy, không trong payload.
    expect(plan.settings).toEqual({
      dailyGoalMinutes: 90,
      targetScore: 740,
      examDate: '2026-12-14',
      reminderTime: '19:00',
      ragBaseUrl: 'http://localhost:8000',
      onboardingDone: true,
      pomodoro: { focusMin: 25, breakMin: 5 },
    })
    expect('syncMode' in plan.settings).toBe(false)
    expect('serverUrl' in plan.settings).toBe(false)
    expect('checkinEnabled' in plan.settings).toBe(false)

    // Subjects giữ id CŨ để impl restore ánh xạ id cũ → mới (pattern refKey).
    expect(plan.subjects).toEqual(BACKUP_INPUT.subjects.map((s: Subject) => ({
      id: s.id,
      name: s.name,
      colorHex: s.colorHex,
      goalMinutesPerDay: s.goalMinutesPerDay,
      archived: s.archived,
    })))

    expect(plan.sessions).toEqual([
      {
        date: '2026-10-03',
        startedAt: SESSION.startedAt,
        endedAt: SESSION.endedAt,
        durationMin: 45,
        subjectId: 3,
        activity: 'nghe',
        source: 'timer',
        note: 'ghi chú, có dấu phẩy',
      },
    ])

    expect(plan.vocab).toEqual([
      {
        word: 'commute (v/n)',
        meaning: 'đi làm hằng ngày',
        example: 'I commute by train — "quoted".',
        subjectId: 3,
        sourceTest: 'ETS 2023 · Đề 2',
      },
    ])

    // Thẻ SRS tham chiếu từ vựng theo CHỈ MỤC trong mảng vocab (vocabId 5 → chỉ mục 0).
    expect(plan.srsCards).toEqual([
      { vocabKey: 0, box: 3, dueDate: '2026-10-10', lastReviewed: 1, correctCount: 4 },
    ])

    expect(plan.mistakes[0].reviewed).toBe(false)

    expect(plan.scores).toEqual([
      { date: '2026-10-01', subjectId: 3, label: 'Toán — Định lí Pytago', score: 8, note: 'sai bài 4 vì quên đổi đơn vị' },
    ])

    expect(plan.dailyNotes).toEqual([NOTE])
    expect(plan.chat).toEqual([])

    // Ảnh 'session' tham chiếu theo chỉ mục trong mảng sessions (id cũ 7 → chỉ mục 0).
    expect(plan.photos).toHaveLength(1)
    expect(plan.photos[0].refType).toBe('session')
    expect(plan.photos[0].refKey).toBe('0')
    expect(plan.photos[0].mime).toBe('image/png')
    expect(plan.photos[0].bytes).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('ảnh trỏ tới bản ghi không có trong bản sao lưu bị bỏ qua', () => {
    const data = buildBackup(BACKUP_INPUT, day(3, 21, 0))
    const orphanRef = {
      ...data,
      photos: [{ ...data.photos[0], refId: '999' }],
    }
    expect(planRestore(orphanRef).photos).toHaveLength(0)
  })

  it('ảnh với data URL hỏng bị bỏ qua', () => {
    const data = buildBackup(BACKUP_INPUT, day(3, 21, 0))
    const brokenPhotos = { ...data, photos: [{ ...data.photos[0], dataUrl: 'data:image/png,not-base64!' }] }
    expect(planRestore(brokenPhotos).photos).toHaveLength(0)
  })

  it("ảnh của ghi chú ('note') giữ nguyên refKey là ngày", () => {
    const data = buildBackup(BACKUP_INPUT, day(3, 21, 0))
    const notePhoto = {
      ...data,
      photos: [{ id: 22, mime: 'image/png', refType: 'note' as const, refId: '2026-10-02', dataUrl: dataUrlOf('image/png', new Uint8Array([9])) }],
    }
    const plan = planRestore(notePhoto)
    expect(plan.photos).toHaveLength(1)
    expect(plan.photos[0].refType).toBe('note')
    expect(plan.photos[0].refKey).toBe('2026-10-02')
  })
})

// ===== Converter v1 → v2 (bản sao lưu schema cũ: part/testLabel/total, chưa có subjects) =====

describe('parseBackup — bản sao lưu v1 được chuyển đổi sang v2', () => {
  const V1_BACKUP = {
    app: 'qlearn-study-log',
    schemaVersion: 1,
    exportedAt: '2026-09-01 20:00',
    settings: {
      dailyGoalMinutes: 90,
      targetScore: 700,
      examDate: '',
      reminderTime: '',
      ragBaseUrl: '',
      onboardingDone: true,
      pomodoro: { focusMin: 25, breakMin: 5 },
    },
    sessions: [
      { id: 1, date: '2026-09-01', startedAt: 1, endedAt: 2, durationMin: 25, part: 4, activity: 'nghe', source: 'timer', note: '', updatedAt: 2 },
      { id: 2, date: '2026-09-02', startedAt: 3, endedAt: 4, durationMin: 40, part: 0, activity: 'đọc', source: 'manual', note: '', updatedAt: 4 },
    ],
    dailyNotes: [
      { date: '2026-09-01', partStudied: [3, 0, 9], newWords: 1, mistakesSummary: '', reflection: 'ok', photoIds: [], autoDrafted: false, updatedAt: 2 },
    ],
    vocab: [{ id: 1, word: 'commute', meaning: '', example: '', part: 5, sourceTest: '', createdAt: 1, updatedAt: 2 }],
    srsCards: [{ id: 1, vocabId: 1, box: 1, dueDate: '2026-09-02', lastReviewed: null, correctCount: 0, updatedAt: 2 }],
    mistakes: [{ id: 1, testNo: 2, part: 7, questionNo: 14, myAnswer: 'A', correctAnswer: 'B', cause: '', explanation: '', reviewed: false, createdAt: 1, updatedAt: 2 }],
    scores: [
      { id: 1, date: '2026-09-01', testLabel: 'ETS 2023 · Đề 2', listening: 350, reading: 390, total: 740, updatedAt: 2 },
      { id: 2, date: '2026-09-02', testLabel: '', listening: 0, reading: 0, total: 0, updatedAt: 2 },
    ],
    chatMessages: [],
    photos: [],
  }

  it('part 1–7 → subjectId TOEIC (1), total→score, testLabel→label, nhãn trống → "Bài kiểm tra"', () => {
    const result = parseBackup(JSON.stringify(V1_BACKUP))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.schemaVersion).toBe(2)
    // Converter tự sinh 4 môn seed với id cố định 1..4
    expect(result.data.subjects.map((s) => s.name)).toEqual(['TOEIC', 'Toán', 'Tiếng Nhật', 'Lập trình'])
    expect(result.data.sessions[0].subjectId).toBe(1) // part 4 cũ → TOEIC
    expect(result.data.sessions[1].subjectId).toBe(0) // part 0 → chưa phân môn
    expect(result.data.vocab[0].subjectId).toBe(1)
    expect(result.data.mistakes[0].subjectId).toBe(1)
    expect(result.data.scores[0]).toMatchObject({ subjectId: 1, label: 'ETS 2023 · Đề 2', score: 740, note: 'nghe 350 · đọc 390' })
    expect(result.data.scores[1]).toMatchObject({ subjectId: 1, label: 'Bài kiểm tra', score: 0, note: '' })
    // partStudied: 3 → TOEIC; 0/9 giữ nguyên
    expect(result.data.dailyNotes[0].partStudied).toEqual([1, 0, 9])
  })

  it('planRestore trên backup v1 đã chuyển đổi → subjects có sẵn cho ánh xạ', () => {
    const result = parseBackup(JSON.stringify(V1_BACKUP))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const plan = planRestore(result.data)
    expect(plan.subjects).toHaveLength(4)
    expect(plan.sessions[0].subjectId).toBe(1)
  })

  it('backup v1 có label trống (scores) vẫn parse được nhờ schema response nới lỏng', () => {
    // scores[1] có label rỗng sau converter — nếu schema response vẫn min(1) thì sẽ fail.
    const result = parseBackup(JSON.stringify(V1_BACKUP))
    expect(result.ok).toBe(true)
  })
})
