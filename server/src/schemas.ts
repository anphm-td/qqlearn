/*
 * Zod schemas cho "dây truyền" HTTP của server — REQUEST lẫn RESPONSE.
 *
 * Khai báo lại từ các schema của '@core/schemas' (src/core/schemas.ts — hợp đồng
 * dùng chung với app): schema request là bản input của port; schema response là
 * bản input + id/createdAt/updatedAt — đúng shape entity trong src/core/types.ts.
 * Import BẰNG ĐƯỜNG DẪN TƯƠNG ĐỐI (tsc không rewrite alias; file đích thuần TS,
 * không đụng React/Dexie/window nên build/emit ra server/dist/src/core/ được).
 */
import { z } from 'zod'

import {
  chatMessageSchema,
  dailyNoteSchema,
  dateISO,
  mistakeInputSchema,
  photoInputSchema,
  scoreInputSchema,
  sessionInputSchema,
  settingsSchema,
  srsCardSchema,
  vocabInputSchema,
} from '../../src/core/schemas.js'

// ===== Request — body/query gửi LÊN server =====

/**
 * PATCH /api/settings — ghi một phần settings (không cho sửa id/updatedAt).
 *
 * syncMode/serverUrl/checkinEnabled phải ĐÈ BẰNG bản .optional() không .default():
 * trong Zod v4, .partial() KHÔNG tắt default — key vắng mặt vẫn bung giá trị default
 * khi parse (safeParse({}) → {syncMode:'local', serverUrl:'', checkinEnabled:true}),
 * khiến MỌI patch một phần (vd. chỉ đổi dailyGoalMinutes từ Cài đặt) ghi đè lựa chọn
 * đã lưu trên server. Bản .optional() thuần: key vắng mặt → không có trong output →
 * handler giữ nguyên giá trị cũ của hàng settings.
 */
export const settingsPatchSchema = settingsSchema
  .omit({ id: true, updatedAt: true })
  .extend({
    syncMode: z.enum(['local', 'server']).optional(),
    serverUrl: z.string().optional(),
    checkinEnabled: z.boolean().optional(),
  })
  .partial()

/** Body POST /api/sessions — đúng NewSession. */
export const sessionCreateSchema = sessionInputSchema
/** Body PATCH /api/sessions/:id — bỏ trường không truyền. */
export const sessionPatchSchema = sessionInputSchema.partial()

/** Query ?from&to cho listBetween (cả hai đều 'YYYY-MM-DD' khi có). */
export const rangeQuerySchema = z.object({
  from: dateISO.optional(),
  to: dateISO.optional(),
})

/** Body PUT /api/notes/:date — nguyên ghi chú của ngày (PK = date). */
export const notePutSchema = dailyNoteSchema

export const vocabCreateSchema = vocabInputSchema
export const vocabPatchSchema = vocabInputSchema.partial()
export const vocabSearchQuerySchema = z.object({ q: z.string() })

/** Body POST /api/srs (createForVocab) — hộp 1, chưa ôn: server tự điền. */
export const srsCreateSchema = z.object({ vocabId: z.number(), dueDate: dateISO })
/** Body PUT /api/srs (put — ghi NGUYÊN trạng thái thẻ, có hoặc không có id). */
export const srsPutSchema = srsCardSchema.omit({ updatedAt: true }).extend({ id: z.number().optional() })
/** Body POST /api/srs/:id/review. */
export const srsReviewSchema = z.object({ correct: z.boolean(), today: dateISO })

export const mistakeCreateSchema = mistakeInputSchema
export const mistakePatchSchema = mistakeInputSchema.partial()
export const mistakeReviewedSchema = z.object({ reviewed: z.boolean() })

export const scoreCreateSchema = scoreInputSchema

/** Body POST /api/photos — ảnh truyền base64 trong JSON (server lưu BLOB). */
export const photoCreateSchema = photoInputSchema.extend({ dataBase64: z.string().min(1) })
export const photoListQuerySchema = z.object({
  refType: z.string().optional(),
  refId: z.string().optional(),
})

/** Body POST /api/chat — server tự sinh createdAt + updatedAt. */
export const chatAppendSchema = chatMessageSchema
  .omit({ createdAt: true })
  .extend({ content: z.string() })
export const chatListQuerySchema = z.object({ sessionId: z.string().min(1) })
export const chatSessionParamSchema = z.string().min(1)

/**
 * Body POST /api/restore — khôi phục TOÀN BỘ bản sao lưu trong MỘT transaction
 * (xoá sạch rồi ghi; lỗi giữa chừng → ROLLBACK). Thẻ SRS tham chiếu từ vựng theo
 * CHỈ MỤC trong mảng vocab; ảnh tham chiếu theo chỉ mục (session/mistake) hoặc
 * ngày (note) — id bản sao lưu không có ý nghĩa sau khi ghi lại.
 */
export const restoreCardSchema = z.object({
  vocabKey: z.number().int().min(0),
  box: z.number().int().min(1).max(5),
  dueDate: dateISO,
  lastReviewed: z.number().nullable(),
  correctCount: z.number().int().min(0),
})

export const restorePhotoSchema = z.object({
  refType: z.enum(['session', 'note', 'mistake']),
  /** 'note' → ngày ghi chú; 'session'/'mistake' → chỉ mục trong mảng tương ứng (dạng chữ). */
  refKey: z.string(),
  mime: z.string().min(1),
  dataBase64: z.string().min(1),
})

export const restoreChatSchema = z.object({
  sessionId: z.string().min(1),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
})

export const restorePayloadSchema = z.object({
  // syncMode/serverUrl CỐ Ý không nằm trong payload — nguồn dữ liệu là lựa chọn
  // của máy này, khôi phục không được đổi nó.
  settings: settingsSchema.omit({ id: true, updatedAt: true, syncMode: true, serverUrl: true }),
  sessions: z.array(sessionInputSchema),
  vocab: z.array(vocabInputSchema),
  srsCards: z.array(restoreCardSchema),
  mistakes: z.array(mistakeInputSchema),
  scores: z.array(scoreInputSchema),
  dailyNotes: z.array(dailyNoteSchema),
  chat: z.array(restoreChatSchema),
  photos: z.array(restorePhotoSchema),
})

// ===== Response — JSON server TRẢ VỀ (validate trước khi gửi) =====

export const sessionResponseSchema = sessionInputSchema.extend({
  id: z.number(),
  updatedAt: z.number(),
})
export const vocabResponseSchema = vocabInputSchema.extend({
  id: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
})
export const srsResponseSchema = srsCardSchema.extend({ id: z.number() })
export const mistakeResponseSchema = mistakeInputSchema.extend({
  id: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
})
export const scoreResponseSchema = scoreInputSchema.extend({ id: z.number(), updatedAt: z.number() })
/** Ảnh đi qua JSON: blob hoá base64 (client ở app đổi ngược thành Blob). */
export const photoResponseSchema = z.object({
  id: z.number(),
  mime: z.string().min(1),
  refType: photoInputSchema.shape.refType,
  refId: z.string(),
  dataBase64: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
})
export const chatResponseSchema = chatMessageSchema.extend({
  id: z.number(),
  updatedAt: z.number(),
})

// ===== Re-export schema gốc — handlers chỉ cần import từ '../schemas.js' =====

export {
  chatMessageSchema,
  dailyNoteSchema,
  dateISO,
  mistakeInputSchema,
  photoInputSchema,
  scoreInputSchema,
  sessionInputSchema,
  settingsSchema,
  srsCardSchema,
  vocabInputSchema,
} from '../../src/core/schemas.js'

// ===== Kiểu dữ liệu các handler trả về (khớp entity của @core/types) =====

export type SettingsData = z.infer<typeof settingsSchema>
export type SessionData = z.infer<typeof sessionResponseSchema>
export type NoteData = z.infer<typeof dailyNoteSchema>
export type VocabData = z.infer<typeof vocabResponseSchema>
export type SrsData = z.infer<typeof srsResponseSchema>
export type MistakeData = z.infer<typeof mistakeResponseSchema>
export type ScoreData = z.infer<typeof scoreResponseSchema>
export type PhotoData = z.infer<typeof photoResponseSchema>
export type ChatData = z.infer<typeof chatResponseSchema>
