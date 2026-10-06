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
import type { I18nVars } from '@core/i18n'
import type { RestorePhotoInput, RestorePayload } from '@core/ports'
import {
  chatMessageSchema,
  dailyNoteSchema,
  mistakeInputSchema,
  scoreRecordSchema,
  sessionInputSchema,
  settingsSchema,
  srsCardSchema,
  subjectInputSchema,
  vocabInputSchema,
} from '@core/schemas'
import { SEED_SUBJECTS } from '@core/subjects'
import type {
  ChatMessage,
  DailyNote,
  Mistake,
  PhotoRefType,
  Score,
  Session,
  SrsCard,
  Subject,
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
  'môn',
  'hoạt động',
  'nguồn',
  'ghi chú',
]
const CSV_HEADERS_VOCAB = ['từ', 'nghĩa', 'ví dụ', 'môn', 'nguồn', 'ngày tạo']
const CSV_HEADERS_MISTAKES = [
  'đề/bài số',
  'môn',
  'câu',
  'bạn chọn',
  'đáp án đúng',
  'nguyên nhân',
  'giải thích',
  'đã ôn lại',
]
const CSV_HEADERS_SCORES = ['ngày', 'môn', 'nhãn', 'điểm', 'ghi chú']

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

/** Tra tên môn từ map id→tên; không có map/không thấy id → chữ số (fallback an toàn). */
function subjectCell(subjectId: number, subjectNameOf?: (id: number) => string | undefined): string {
  if (subjectId <= 0) return ''
  return subjectNameOf?.(subjectId) ?? String(subjectId)
}

export function sessionsCsv(
  rows: Session[],
  subjectNameOf?: (id: number) => string | undefined,
): string {
  const sorted = [...rows].sort((a, b) => a.startedAt - b.startedAt)
  return csvTable(
    CSV_HEADERS_SESSIONS,
    sorted.map((s) => [
      s.date,
      formatClock(s.startedAt),
      s.endedAt === null ? '' : formatClock(s.endedAt),
      s.durationMin,
      subjectCell(s.subjectId, subjectNameOf),
      s.activity,
      s.source,
      s.note,
    ]),
  )
}

export function vocabCsv(
  rows: Vocab[],
  subjectNameOf?: (id: number) => string | undefined,
): string {
  const sorted = [...rows].sort((a, b) => a.createdAt - b.createdAt)
  return csvTable(
    CSV_HEADERS_VOCAB,
    sorted.map((v) => [
      v.word,
      v.meaning,
      v.example,
      subjectCell(v.subjectId, subjectNameOf),
      v.sourceTest,
      v.createdAt > 0 ? localDateISO(new Date(v.createdAt)) : '',
    ]),
  )
}

export function mistakesCsv(
  rows: Mistake[],
  subjectNameOf?: (id: number) => string | undefined,
): string {
  const sorted = [...rows].sort((a, b) => a.createdAt - b.createdAt)
  return csvTable(
    CSV_HEADERS_MISTAKES,
    sorted.map((m) => [
      m.testNo > 0 ? String(m.testNo) : '',
      subjectCell(m.subjectId, subjectNameOf),
      m.questionNo,
      m.myAnswer,
      m.correctAnswer,
      m.cause,
      m.explanation,
      m.reviewed ? 'rồi' : 'chưa',
    ]),
  )
}

export function scoresCsv(
  rows: Score[],
  subjectNameOf?: (id: number) => string | undefined,
): string {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return csvTable(
    CSV_HEADERS_SCORES,
    sorted.map((s) => [s.date, subjectCell(s.subjectId, subjectNameOf), s.label, s.score, s.note]),
  )
}

// ===== Markdown (ghi chú cuối ngày + buổi học) =====

function sessionLine(s: Session, subjectName?: string): string {
  const subject = s.subjectId > 0 ? ` (môn ${subjectName ?? s.subjectId})` : ''
  const end = s.endedAt === null ? 'đang học' : formatClock(s.endedAt)
  const note = s.note ? ` — ${s.note}` : ''
  return `- ${s.durationMin} phút — ${s.activity}${subject} · ${formatClock(s.startedAt)}–${end}${note}`
}

function noteLines(n: DailyNote, subjectNameOf?: (id: number) => string | undefined): string[] {
  const studied =
    n.partStudied.length > 0
      ? n.partStudied.map((id) => subjectNameOf?.(id) ?? String(id)).join(', ')
      : '—'
  return [
    '### Ghi chú cuối ngày',
    `- Môn đã học: ${studied}`,
    `- Từ mới: ${n.newWords}`,
    `- Lỗi sai: ${n.mistakesSummary || '—'}`,
    `- Nhận xét: ${n.reflection || '—'}`,
  ]
}

/**
 * Sổ ghi chú dạng Markdown: mỗi ngày 1 mục, ngày mới nhất đứng trước.
 * `subjectNameOf` (tuỳ chọn) đổi subjectId → tên môn để tệp dễ đọc hơn.
 */
export function exportMarkdown(
  notes: DailyNote[],
  sessions: Session[],
  now: Date,
  subjectNameOf?: (id: number) => string | undefined,
): string {
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
    '# qqlearn',
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
      out.push('### Buổi học', ...sorted.map((s) => sessionLine(s, subjectNameOf?.(s.subjectId))), '')
    }
    if (entry.note) out.push(...noteLines(entry.note, subjectNameOf), '')
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
  /** Môn học — kèm theo backup để khôi phục chéo máy không lệch subjectId. */
  subjects: Subject[]
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
  /** v2 — đa môn hoá: thêm bảng subjects + subjectId thay part. */
  schemaVersion: 2
  exportedAt: string
  settings: BackupInput['settings']
  subjects: Subject[]
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
    schemaVersion: 2,
    exportedAt: `${localDateISO(now)} ${formatClock(now.getTime())}`,
    settings: { ...input.settings, pomodoro: { ...input.settings.pomodoro } },
    subjects: input.subjects.map((s) => ({ ...s })),
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
const backupSubjectSchema = subjectInputSchema.extend({
  id: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
})
const backupSessionSchema = sessionInputSchema.extend({ id: z.number(), updatedAt: z.number() })
const backupVocabSchema = vocabInputSchema.extend({ id: z.number(), createdAt: z.number(), updatedAt: z.number() })
const backupSrsSchema = srsCardSchema.extend({ id: z.number() })
const backupMistakeSchema = mistakeInputSchema.extend({
  id: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
})
// label cho phép rỗng ở response/backup (MEDIUM 5) — input form mới yêu cầu min(1).
const backupScoreSchema = scoreRecordSchema.extend({ id: z.number(), updatedAt: z.number() })
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
  schemaVersion: z.literal(2),
  exportedAt: z.string(),
  settings: backupSettingsSchema,
  subjects: z.array(backupSubjectSchema),
  sessions: z.array(backupSessionSchema),
  dailyNotes: z.array(dailyNoteSchema),
  vocab: z.array(backupVocabSchema),
  srsCards: z.array(backupSrsSchema),
  mistakes: z.array(backupMistakeSchema),
  scores: z.array(backupScoreSchema),
  chatMessages: z.array(backupChatSchema),
  photos: z.array(backupPhotoSchema),
})

/**
 * Chuyển đổi bản sao lưu v1 (khung TOEIC cũ: part 1–7, testLabel/listening/reading/
 * total, chưa có subjects) sang shape v2 — chạy TRƯỚC khi validate. Quy tắc giống
 * migration DB: part 1–7 → id môn TOEIC (1 — seed cố định của converter), 0/khác → 0;
 * total → score; testLabel → label ('Bài kiểm tra' nếu trống); nghe/đọc → note.
 */
function convertBackupV1toV2(raw: Record<string, unknown>): unknown {
  const TOEIC_ID = 1
  const legacySubject = (part: unknown): number =>
    typeof part === 'number' && part >= 1 && part <= 7 ? TOEIC_ID : 0
  const now = Date.now()

  const sessions = Array.isArray(raw.sessions) ? raw.sessions : []
  const vocab = Array.isArray(raw.vocab) ? raw.vocab : []
  const mistakes = Array.isArray(raw.mistakes) ? raw.mistakes : []
  const scores = Array.isArray(raw.scores) ? raw.scores : []
  const dailyNotes = Array.isArray(raw.dailyNotes) ? raw.dailyNotes : []

  return {
    ...raw,
    schemaVersion: 2,
    subjects: SEED_SUBJECTS.map((s, i) => ({
      id: i + 1,
      name: s.name,
      colorHex: s.colorHex,
      goalMinutesPerDay: s.goalMinutesPerDay,
      archived: false,
      createdAt: now + i,
      updatedAt: now + i,
    })),
    sessions: sessions.map((s: Record<string, unknown>) => {
      const { part, ...rest } = s
      return { ...rest, subjectId: legacySubject(part) }
    }),
    vocab: vocab.map((v: Record<string, unknown>) => {
      const { part, ...rest } = v
      return { ...rest, subjectId: legacySubject(part) }
    }),
    mistakes: mistakes.map((m: Record<string, unknown>) => {
      const { part, ...rest } = m
      return { ...rest, subjectId: legacySubject(part) }
    }),
    scores: scores.map((s: Record<string, unknown>) => {
      const { testLabel, listening, reading, total, ...rest } = s
      const li = typeof listening === 'number' ? listening : 0
      const re = typeof reading === 'number' ? reading : 0
      return {
        ...rest,
        subjectId: TOEIC_ID,
        label: typeof testLabel === 'string' && testLabel !== '' ? testLabel : 'Bài kiểm tra',
        score: typeof total === 'number' ? total : 0,
        note: li > 0 || re > 0 ? `nghe ${li} · đọc ${re}` : '',
      }
    }),
    dailyNotes: dailyNotes.map((n: Record<string, unknown>) => ({
      ...n,
      partStudied: Array.isArray(n.partStudied)
        ? n.partStudied.map((v) => (typeof v === 'number' && v >= 1 && v <= 7 ? TOEIC_ID : v))
        : [],
    })),
  }
}

/**
 * Kết quả đọc tệp sao lưu. Lỗi trả về là chuỗi HIỂN THỊ đã dịch qua `t` (dict
 * 'settings' — nhóm 'data.backup.*'); hàm dịch được TIÊM vào nên logic vẫn thuần
 * (không truyền `t` → trả chính key, an toàn không ném).
 */
export type ParseBackupResult =
  | { ok: true; data: BackupData }
  | { ok: false; error: string }

/** Kiểu hàm dịch tối giản — khớp signature `t` của '@core/i18n' (thuần, không React). */
export type TranslateFn = (key: string, vars?: I18nVars) => string

export function parseBackup(text: string, t: TranslateFn = (key) => key): ParseBackupResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: t('data.backup.notBackup') }
  }
  // Backup v1 (schema cũ) → tự chuyển sang v2 rồi mới validate.
  if (
    typeof raw === 'object' &&
    raw !== null &&
    (raw as Record<string, unknown>)['schemaVersion'] === 1
  ) {
    raw = convertBackupV1toV2(raw as Record<string, unknown>)
  }
  const parsed = backupFileSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const where = issue && issue.path.length > 0 ? issue.path.join(' → ') : t('data.backup.where.content')
    return { ok: false, error: t('data.backup.missingField', { where }) }
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
    // Chọn ĐÚNG 7 trường cài đặt — syncMode/serverUrl/checkinEnabled là lựa chọn
    // của máy này, không nằm trong bản sao lưu và không bị khôi phục ghi đè.
    settings: {
      dailyGoalMinutes: data.settings.dailyGoalMinutes,
      targetScore: data.settings.targetScore,
      examDate: data.settings.examDate,
      reminderTime: data.settings.reminderTime,
      ragBaseUrl: data.settings.ragBaseUrl,
      onboardingDone: data.settings.onboardingDone,
      pomodoro: { ...data.settings.pomodoro },
    },
    // Môn học giữ id CŨ — impl restore ánh xạ id cũ → mới rồi remap subjectId
    // của các hàng dữ liệu (pattern refKey của ảnh).
    subjects: data.subjects.map((s) => ({
      id: s.id ?? 0,
      name: s.name,
      colorHex: s.colorHex,
      goalMinutesPerDay: s.goalMinutesPerDay,
      archived: s.archived,
    })),
    sessions: data.sessions.map((s) => ({
      date: s.date,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      durationMin: s.durationMin,
      subjectId: s.subjectId,
      activity: s.activity,
      source: s.source,
      note: s.note,
    })),
    vocab: data.vocab.map((v) => ({
      word: v.word,
      meaning: v.meaning,
      example: v.example,
      subjectId: v.subjectId,
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
      subjectId: m.subjectId,
      questionNo: m.questionNo,
      myAnswer: m.myAnswer,
      correctAnswer: m.correctAnswer,
      cause: m.cause,
      explanation: m.explanation,
      reviewed: m.reviewed,
    })),
    scores: data.scores.map((s) => ({
      date: s.date,
      subjectId: s.subjectId,
      label: s.label,
      score: s.score,
      note: s.note,
    })),
    dailyNotes: data.dailyNotes.map((n) => ({ ...n })),
    chat: data.chatMessages.map((c) => ({ sessionId: c.sessionId, role: c.role, content: c.content })),
    photos,
  }
}
