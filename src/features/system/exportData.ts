/*
 * Nhóm D (hệ thống) — LOGIC THUẦN xuất dữ liệu + sao lưu/khôi phục.
 *
 * QUY TẮC LỚP: file này KHÔNG import React/Dexie/window — chỉ types (từ
 * '@core/types' và '@core/ports'), ngày từ '@core/date' và schema từ
 * '@core/schemas' (zod). Phần dán xuống máy (tải tệp) nằm ở saveFile.ts;
 * phần gọi repos nằm ở UI.
 *
 * Quy ước xuất:
 *  - CSV: dấu phẩy, xuống dòng CRLF, bao/kép dấu " khi cần — mở thẳng bằng Excel;
 *    BOM UTF-8 được thêm bởi withBom() để Excel hiểu tiếng Việt.
 *  - Markdown: gom buổi học + ghi chú cuối ngày theo từng ngày (mới nhất trước).
 *  - Sao lưu: 1 tệp JSON gồm mọi bảng; ảnh (Blob) hoá thành data URL base64.
 */
import { z } from 'zod'

import { localDateISO } from '@core/date'
import type { RestorePhotoInput, RestorePayload } from '@core/ports'
import {
  chatMessageSchema,
  dailyNoteSchema,
  mistakeInputSchema,
  scoreInputSchema,
  sessionInputSchema,
  settingsSchema,
  srsCardSchema,
  vocabInputSchema,
} from '@core/schemas'
import type {
  ChatMessage,
  DailyNote,
  Mistake,
  PhotoRefType,
  Score,
  Session,
  SrsCard,
  Vocab,
} from '@core/types'

// ===== BOM UTF-8 (Excel đọc đúng tiếng Việt) =====

/** U+FEFF — thêm vào đầu tệp CSV để Excel nhận diện bảng mã tiếng Việt. */
export const UTF8_BOM = String.fromCharCode(0xfeff)

export function withBom(text: string): string {
  return UTF8_BOM + text
}

// ===== CSV =====

const CSV_HEADERS_SESSIONS = [
  'ngày',
  'bắt đầu',
  'kết thúc',
  'thời lượng (phút)',
  'part',
  'hoạt động',
  'nguồn',
  'ghi chú',
]
const CSV_HEADERS_VOCAB = ['từ', 'nghĩa', 'ví dụ', 'part', 'nguồn đề', 'ngày tạo']
const CSV_HEADERS_MISTAKES = [
  'đề số',
  'part',
  'câu',
  'bạn chọn',
  'đáp án đúng',
  'nguyên nhân',
  'giải thích',
  'đã ôn lại',
]
const CSV_HEADERS_SCORES = ['ngày', 'tên đề', 'điểm nghe', 'điểm đọc', 'tổng']

function csvCell(value: string | number | boolean): string {
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function csvRow(cells: Array<string | number | boolean>): string {
  return cells.map(csvCell).join(',')
}

function csvTable(headers: string[], rows: Array<Array<string | number | boolean>>): string {
  const lines = [csvRow(headers), ...rows.map(csvRow)]
  return lines.join('\r\n') + '\r\n'
}

/** Giờ địa phương 'HH:mm' từ epoch ms. */
export function formatClock(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function partText(part: number): string {
  return part > 0 ? String(part) : ''
}

export function sessionsCsv(rows: Session[]): string {
  const sorted = [...rows].sort((a, b) => a.startedAt - b.startedAt)
  return csvTable(
    CSV_HEADERS_SESSIONS,
    sorted.map((s) => [
      s.date,
      formatClock(s.startedAt),
      s.endedAt === null ? '' : formatClock(s.endedAt),
      s.durationMin,
      partText(s.part),
      s.activity,
      s.source,
      s.note,
    ]),
  )
}

export function vocabCsv(rows: Vocab[]): string {
  const sorted = [...rows].sort((a, b) => a.createdAt - b.createdAt)
  return csvTable(
    CSV_HEADERS_VOCAB,
    sorted.map((v) => [
      v.word,
      v.meaning,
      v.example,
      partText(v.part),
      v.sourceTest,
      v.createdAt > 0 ? localDateISO(new Date(v.createdAt)) : '',
    ]),
  )
}

export function mistakesCsv(rows: Mistake[]): string {
  const sorted = [...rows].sort((a, b) => a.createdAt - b.createdAt)
  return csvTable(
    CSV_HEADERS_MISTAKES,
    sorted.map((m) => [
      m.testNo > 0 ? String(m.testNo) : '',
      partText(m.part),
      m.questionNo,
      m.myAnswer,
      m.correctAnswer,
      m.cause,
      m.explanation,
      m.reviewed ? 'rồi' : 'chưa',
    ]),
  )
}

export function scoresCsv(rows: Score[]): string {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return csvTable(
    CSV_HEADERS_SCORES,
    sorted.map((s) => [s.date, s.testLabel, s.listening, s.reading, s.total]),
  )
}

// ===== Markdown (ghi chú cuối ngày + buổi học) =====

function sessionLine(s: Session): string {
  const part = s.part > 0 ? ` (Part ${s.part})` : ''
  const end = s.endedAt === null ? 'đang học' : formatClock(s.endedAt)
  const note = s.note ? ` — ${s.note}` : ''
  return `- ${s.durationMin} phút — ${s.activity}${part} · ${formatClock(s.startedAt)}–${end}${note}`
}

function noteLines(n: DailyNote): string[] {
  return [
    '### Ghi chú cuối ngày',
    `- Part đã học: ${n.partStudied.length > 0 ? n.partStudied.join(', ') : '—'}`,
    `- Từ mới: ${n.newWords}`,
    `- Lỗi sai: ${n.mistakesSummary || '—'}`,
    `- Nhận xét: ${n.reflection || '—'}`,
  ]
}

/** Sổ ghi chú dạng Markdown: mỗi ngày 1 mục, ngày mới nhất đứng trước. */
export function exportMarkdown(notes: DailyNote[], sessions: Session[], now: Date): string {
  const byDate = new Map<string, { sessions: Session[]; note?: DailyNote }>()
  for (const s of sessions) {
    const entry = byDate.get(s.date) ?? { sessions: [] }
    entry.sessions.push(s)
    byDate.set(s.date, entry)
  }
  for (const n of notes) {
    const entry = byDate.get(n.date) ?? { sessions: [] }
    entry.note = n
    byDate.set(n.date, entry)
  }

  const dates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
  const out: string[] = [
    '# Sổ học TOEIC',
    '',
    `Xuất ngày ${localDateISO(now)} lúc ${formatClock(now.getTime())}`,
    '',
  ]
  for (const date of dates) {
    const entry = byDate.get(date)
    if (!entry) continue
    out.push(`## ${date}`, '')
    if (entry.sessions.length > 0) {
      const sorted = [...entry.sessions].sort((a, b) => a.startedAt - b.startedAt)
      out.push('### Buổi học', ...sorted.map(sessionLine), '')
    }
    if (entry.note) out.push(...noteLines(entry.note), '')
  }
  return out.join('\n')
}

// ===== Ảnh ↔ base64 (Blob hoá data URL để nằm trong JSON) =====

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function bytesToBase64(bytes: Uint8Array): string {
  let out = ''
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]
    out += B64_ALPHABET[n >> 18] + B64_ALPHABET[(n >> 12) & 63] + B64_ALPHABET[(n >> 6) & 63] + B64_ALPHABET[n & 63]
  }
  const rest = bytes.length - i
  if (rest === 1) {
    const n = bytes[i] << 16
    out += B64_ALPHABET[n >> 18] + B64_ALPHABET[(n >> 12) & 63] + '=='
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8)
    out += B64_ALPHABET[n >> 18] + B64_ALPHABET[(n >> 12) & 63] + B64_ALPHABET[(n >> 6) & 63] + '='
  }
  return out
}

export function base64ToBytes(text: string): Uint8Array<ArrayBuffer> {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '')
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let out = 0
  let buffer = 0
  let bits = 0
  for (const ch of clean) {
    const v = B64_ALPHABET.indexOf(ch)
    if (v < 0) continue
    buffer = (buffer << 6) | v
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes[out++] = (buffer >> bits) & 0xff
    }
  }
  return bytes.subarray(0, out)
}

export function dataUrlOf(mime: string, bytes: Uint8Array): string {
  return `data:${mime};base64,${bytesToBase64(bytes)}`
}

export function bytesFromDataUrl(url: string): Uint8Array<ArrayBuffer> | null {
  const marker = ';base64,'
  const at = url.indexOf(marker)
  if (at < 0) return null
  return base64ToBytes(url.slice(at + marker.length))
}

// ===== Bản sao lưu (JSON mọi bảng) =====

export interface BackupPhotoRow {
  id: number
  mime: string
  refType: PhotoRefType
  refId: string
  dataUrl: string
}

export interface BackupInput {
  settings: {
    dailyGoalMinutes: number
    targetScore: number
    examDate: string
    reminderTime: string
    ragBaseUrl: string
    onboardingDone: boolean
    pomodoro: { focusMin: number; breakMin: number }
  }
  sessions: Session[]
  dailyNotes: DailyNote[]
  vocab: Vocab[]
  srsCards: SrsCard[]
  mistakes: Mistake[]
  scores: Score[]
  /** Mọi tin nhắn chat — liệt kê qua ChatRepo.listSessions() + listBySession(). */
  chatMessages: ChatMessage[]
  photos: BackupPhotoRow[]
}

export interface BackupData {
  app: 'qlearn-study-log'
  schemaVersion: 1
  exportedAt: string
  settings: BackupInput['settings']
  sessions: Session[]
  dailyNotes: DailyNote[]
  vocab: Vocab[]
  srsCards: SrsCard[]
  mistakes: Mistake[]
  scores: Score[]
  chatMessages: ChatMessage[]
  photos: BackupPhotoRow[]
}

export function buildBackup(input: BackupInput, now: Date): BackupData {
  return {
    app: 'qlearn-study-log',
    schemaVersion: 1,
    exportedAt: `${localDateISO(now)} ${formatClock(now.getTime())}`,
    settings: { ...input.settings, pomodoro: { ...input.settings.pomodoro } },
    sessions: [...input.sessions],
    dailyNotes: input.dailyNotes.map((n) => ({ ...n })),
    vocab: input.vocab.map((v) => ({ ...v })),
    srsCards: input.srsCards.map((c) => ({ ...c })),
    mistakes: input.mistakes.map((m) => ({ ...m })),
    scores: input.scores.map((s) => ({ ...s })),
    chatMessages: [...input.chatMessages],
    photos: input.photos.map((p) => ({ ...p })),
  }
}

export function serializeBackup(data: BackupData): string {
  return JSON.stringify(data, null, 2)
}

// ===== Đọc lại bản sao lưu + kế hoạch khôi phục =====

const backupSettingsSchema = settingsSchema.omit({ id: true, updatedAt: true })
const backupSessionSchema = sessionInputSchema.extend({ id: z.number(), updatedAt: z.number() })
const backupVocabSchema = vocabInputSchema.extend({ id: z.number(), createdAt: z.number(), updatedAt: z.number() })
const backupSrsSchema = srsCardSchema.extend({ id: z.number() })
const backupMistakeSchema = mistakeInputSchema.extend({
  id: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
})
const backupScoreSchema = scoreInputSchema.extend({ id: z.number(), updatedAt: z.number() })
const backupChatSchema = chatMessageSchema.extend({ id: z.number(), updatedAt: z.number() })
const backupPhotoSchema = z.object({
  id: z.number(),
  mime: z.string().min(1),
  refType: z.enum(['session', 'note', 'mistake']),
  refId: z.string(),
  dataUrl: z.string(),
})

const backupFileSchema = z.object({
  app: z.literal('qlearn-study-log'),
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  settings: backupSettingsSchema,
  sessions: z.array(backupSessionSchema),
  dailyNotes: z.array(dailyNoteSchema),
  vocab: z.array(backupVocabSchema),
  srsCards: z.array(backupSrsSchema),
  mistakes: z.array(backupMistakeSchema),
  scores: z.array(backupScoreSchema),
  chatMessages: z.array(backupChatSchema),
  photos: z.array(backupPhotoSchema),
})

export type ParseBackupResult =
  | { ok: true; data: BackupData }
  | { ok: false; error: string }

export function parseBackup(text: string): ParseBackupResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Tệp này không đọc được — chưa phải bản sao lưu của Sổ.' }
  }
  const parsed = backupFileSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const where = issue && issue.path.length > 0 ? issue.path.join(' → ') : 'nội dung'
    return {
      ok: false,
      error: `Bản sao lưu thiếu hoặc sai mục "${where}" — không khôi phục được.`,
    }
  }
  return { ok: true, data: parsed.data as BackupData }
}

/**
 * Kế hoạch khôi phục — thuần dữ liệu, UI ghi qua repos.restore.restoreAll() trong
 * MỘT transaction (all-or-nothing). Tham chiếu chéo dùng CHỈ MỤC trong mảng
 * (vocabKey cho thẻ SRS, refKey cho ảnh) — id bản sao lưu không còn ý nghĩa khi
 * ghi lại vì id mới được sinh lúc restore.
 */
export type RestorePlan = RestorePayload

export function planRestore(data: BackupData): RestorePlan {
  // Ánh xạ id cũ → chỉ mục trong payload (ảnh 'session'/'mistake' tham chiếu id cũ).
  const sessionKey = new Map<number, number>()
  data.sessions.forEach((s, i) => sessionKey.set(s.id ?? -1, i))
  const mistakeKey = new Map<number, number>()
  data.mistakes.forEach((m, i) => mistakeKey.set(m.id ?? -1, i))

  const photos: RestorePhotoInput[] = []
  for (const p of data.photos) {
    const bytes = bytesFromDataUrl(p.dataUrl)
    if (!bytes || bytes.length === 0) continue
    if (p.refType === 'note') {
      // Ảnh của ghi chú gắn theo NGÀY — giữ nguyên.
      photos.push({ refType: p.refType, refKey: p.refId, mime: p.mime, bytes })
      continue
    }
    const key = (p.refType === 'session' ? sessionKey : mistakeKey).get(Number(p.refId))
    // Ảnh trỏ tới bản ghi không có trong bản sao lưu → bỏ an toàn (không có đích gắn).
    if (key === undefined) continue
    photos.push({ refType: p.refType, refKey: String(key), mime: p.mime, bytes })
  }

  return {
    // Chọn ĐÚNG 7 trường cài đặt — syncMode/serverUrl là lựa chọn của máy này,
    // không nằm trong bản sao lưu và không bị khôi phục ghi đè.
    settings: {
      dailyGoalMinutes: data.settings.dailyGoalMinutes,
      targetScore: data.settings.targetScore,
      examDate: data.settings.examDate,
      reminderTime: data.settings.reminderTime,
      ragBaseUrl: data.settings.ragBaseUrl,
      onboardingDone: data.settings.onboardingDone,
      pomodoro: { ...data.settings.pomodoro },
    },
    sessions: data.sessions.map((s) => ({
      date: s.date,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      durationMin: s.durationMin,
      part: s.part,
      activity: s.activity,
      source: s.source,
      note: s.note,
    })),
    vocab: data.vocab.map((v) => ({
      word: v.word,
      meaning: v.meaning,
      example: v.example,
      part: v.part,
      sourceTest: v.sourceTest,
    })),
    srsCards: data.srsCards.map((c) => {
      const vocabIdx = data.vocab.findIndex((v) => (v.id ?? -1) === c.vocabId)
      return {
        vocabKey: vocabIdx,
        box: c.box,
        dueDate: c.dueDate,
        lastReviewed: c.lastReviewed,
        correctCount: c.correctCount,
      }
    }),
    mistakes: data.mistakes.map((m) => ({
      testNo: m.testNo,
      part: m.part,
      questionNo: m.questionNo,
      myAnswer: m.myAnswer,
      correctAnswer: m.correctAnswer,
      cause: m.cause,
      explanation: m.explanation,
      reviewed: m.reviewed,
    })),
    scores: data.scores.map((s) => ({
      date: s.date,
      testLabel: s.testLabel,
      listening: s.listening,
      reading: s.reading,
      total: s.total,
    })),
    dailyNotes: data.dailyNotes.map((n) => ({ ...n })),
    chat: data.chatMessages.map((c) => ({ sessionId: c.sessionId, role: c.role, content: c.content })),
    photos,
  }
}
