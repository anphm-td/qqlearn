/*
 * qqlearn — Zod schemas (LỚP CORE, thuần TypeScript).
 * Dùng để validate dữ liệu ghi vào repositories (local lẫn HTTP).
 * KHÔNG import React/Dexie/window ở file này.
 */
import { z } from 'zod'

// .js extension — server build (nodenext) tái sử dụng file này qua đường dẫn tương đối.
import { SUBJECT_COLOR_HEXES } from './subjects.js'

// ===== Settings =====

export const pomodoroSchema = z.object({
  focusMin: z.number().int().min(1).max(240),
  breakMin: z.number().int().min(1).max(120),
})

export const settingsSchema = z.object({
  id: z.literal(1),
  dailyGoalMinutes: z.number().int().min(5).max(1440),
  // targetScore/examDate: cột giữ lại để tương thích DB/bản sao lưu cũ — app
  // không còn hiển thị (khung TOEIC đã bỏ, đa môn hoá).
  targetScore: z.number().int().min(10).max(990),
  examDate: z.string(),
  reminderTime: z.string(),
  ragBaseUrl: z.string(),
  onboardingDone: z.boolean(),
  // .default(true) để hàng settings/bản sao lưu cũ (chưa có trường này) vẫn đọc
  // được — mặc định BẬT. Trong PATCH settings (server/src/schemas.ts) trường này
  // phải ĐÈ BẰNG bản .optional() không .default(): key vắng mặt không được bung
  // giá trị làm reset lựa chọn người học (đọc chú thích settingsPatchSchema).
  checkinEnabled: z.boolean().default(true),
  pomodoro: pomodoroSchema,
  // .default() để bản sao lưu cũ (schemaVersion 1, chưa có 2 trường này) vẫn đọc được.
  syncMode: z.enum(['local', 'server']).default('local'),
  serverUrl: z.string().default(''),
  // .default('vi') để bản sao lưu/hàng cũ (chưa có trường này) vẫn đọc được —
  // 'vi' là ngôn ngữ mặc định (design-system.md mục 12). Trong PATCH settings
  // (server/src/schemas.ts) trường này phải ĐÈ BẰNG bản .optional() không .default():
  // key vắng mặt không được bung giá trị làm reset ngôn ngữ (xem settingsPatchSchema).
  language: z.enum(['vi', 'en']).default('vi'),
  updatedAt: z.number(),
})

// ===== Subjects (môn học) =====

/**
 * colorHex: một trong các hex của SUBJECT_PALETTE (bộ màu môn định sẵn của
 * design-system.md mục 5) — z.enum chặn cả màu tự tạo ngoài danh sách.
 */
export const subjectInputSchema = z.object({
  name: z.string().min(1, 'Tên môn không được để trống'),
  colorHex: z.enum(SUBJECT_COLOR_HEXES),
  goalMinutesPerDay: z.number().int().min(0).max(1440),
  archived: z.boolean(),
})

/** 'YYYY-MM-DD' — ngày local (dùng localDateISO() từ @core/date). */
export const dateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date phải là YYYY-MM-DD')

// ===== Sessions =====

export const sessionInputSchema = z.object({
  date: dateISO,
  startedAt: z.number(),
  endedAt: z.number().nullable(),
  durationMin: z.number().int().min(0).max(1440),
  /** Môn học (id bảng subjects); 0 = chưa phân môn. */
  subjectId: z.number().int().min(0),
  activity: z.string(),
  source: z.enum(['timer', 'manual']),
  note: z.string(),
})

// ===== Daily notes =====

/** partStudied: các môn đã học trong ngày (id bảng subjects; tên cột giữ từ thời Part). */
export const dailyNoteSchema = z.object({
  date: dateISO,
  partStudied: z.array(z.number().int().min(0)),
  newWords: z.number().int().min(0),
  mistakesSummary: z.string(),
  reflection: z.string(),
  photoIds: z.array(z.number()),
  autoDrafted: z.boolean(),
  updatedAt: z.number(),
})

// ===== Vocab =====

export const vocabInputSchema = z.object({
  word: z.string().min(1),
  meaning: z.string(),
  example: z.string(),
  subjectId: z.number().int().min(0),
  sourceTest: z.string(),
})

// ===== SRS =====

export const srsCardSchema = z.object({
  vocabId: z.number(),
  box: z.number().int().min(1).max(5),
  dueDate: dateISO,
  lastReviewed: z.number().nullable(),
  correctCount: z.number().int().min(0),
  updatedAt: z.number(),
})

// ===== Mistakes =====

export const mistakeInputSchema = z.object({
  testNo: z.number().int().min(0),
  subjectId: z.number().int().min(0),
  questionNo: z.number().int().min(0),
  myAnswer: z.string(),
  correctAnswer: z.string(),
  cause: z.string(),
  explanation: z.string(),
  reviewed: z.boolean(),
})

// ===== Scores =====

/**
 * Shape chung của một điểm (response/backup/khôi phục) — label cho phép rỗng vì
 * migration từ dữ liệu legacy có thể sinh nhãn trống (đã được server điền
 * 'Bài kiểm tra', nhưng schema response/backup không được vì vậy mà 500/fail).
 */
export const scoreRecordSchema = z.object({
  date: dateISO,
  subjectId: z.number().int().min(0),
  label: z.string(),
  score: z.number().int().min(0).max(1000),
  note: z.string(),
})

/** Input tạo/sửa từ form — nhãn bắt buộc (một điểm duy nhất theo môn). */
export const scoreInputSchema = scoreRecordSchema.extend({
  label: z.string().min(1, 'Nhãn bài kiểm tra không được để trống'),
})

// ===== Photos =====

export const photoInputSchema = z.object({
  mime: z.string().min(1),
  refType: z.enum(['session', 'note', 'mistake']),
  refId: z.string(),
  // blob không đưa vào schema Zod (Binary) — validate ở repository.
})

// ===== Chat =====

export const chatMessageSchema = z.object({
  sessionId: z.string().min(1),
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
  createdAt: z.number(),
})
