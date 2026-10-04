/*
 * Sổ học TOEIC — Zod schemas (LỚP CORE, thuần TypeScript).
 * Dùng để validate dữ liệu ghi vào repositories (local lẫn HTTP sau này).
 * KHÔNG import React/Dexie/window ở file này.
 */
import { z } from 'zod'

// ===== Settings =====

export const pomodoroSchema = z.object({
  focusMin: z.number().int().min(1).max(240),
  breakMin: z.number().int().min(1).max(120),
})

export const settingsSchema = z.object({
  id: z.literal(1),
  dailyGoalMinutes: z.number().int().min(5).max(1440),
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
  updatedAt: z.number(),
})

// ===== Sessions =====

/** 'YYYY-MM-DD' — ngày local (dùng localDateISO() từ @core/date). */
export const dateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date phải là YYYY-MM-DD')

export const sessionInputSchema = z.object({
  date: dateISO,
  startedAt: z.number(),
  endedAt: z.number().nullable(),
  durationMin: z.number().int().min(0).max(1440),
  part: z.number().int().min(0).max(7),
  activity: z.string(),
  source: z.enum(['timer', 'manual']),
  note: z.string(),
})

// ===== Daily notes =====

export const dailyNoteSchema = z.object({
  date: dateISO,
  partStudied: z.array(z.number().int().min(0).max(7)),
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
  part: z.number().int().min(0).max(7),
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
  part: z.number().int().min(0).max(7),
  questionNo: z.number().int().min(0),
  myAnswer: z.string(),
  correctAnswer: z.string(),
  cause: z.string(),
  explanation: z.string(),
  reviewed: z.boolean(),
})

// ===== Scores =====

export const scoreInputSchema = z
  .object({
    date: dateISO,
    testLabel: z.string().min(1),
    listening: z.number().int().min(5).max(495),
    reading: z.number().int().min(5).max(495),
    total: z.number().int().min(10).max(990),
  })
  .refine((s) => s.total === s.listening + s.reading, {
    message: 'total phải bằng listening + reading',
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
