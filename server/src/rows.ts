/*
 * Đổi hàng SQLite ↔ JSON đúng shape entity trong src/core/types.ts.
 * SQLite không có boolean (dùng 0/1) và không có mảng/đối tượng (dùng TEXT JSON) —
 * mọi cột như vậy được đổi ở đây; server luôn TRẢ JSON đã đổi, không lộ hàng thô.
 */
import type { DatabaseSync } from 'node:sqlite'
import { z } from 'zod'

import { getRow } from './db.js'

import {
  chatResponseSchema,
  dailyNoteSchema,
  mistakeResponseSchema,
  photoResponseSchema,
  scoreResponseSchema,
  sessionResponseSchema,
  srsResponseSchema,
  vocabResponseSchema,
  type ChatData,
  type MistakeData,
  type NoteData,
  type PhotoData,
  type ScoreData,
  type SessionData,
  type SettingsData,
  type SrsData,
  type VocabData,
} from './schemas.js'

// ===== Settings =====

export interface SettingsRow {
  id: number
  dailyGoalMinutes: number
  targetScore: number
  examDate: string
  reminderTime: string
  ragBaseUrl: string
  onboardingDone: number
  checkinEnabled: number
  pomodoro: string
  syncMode: string
  serverUrl: string
  updatedAt: number
}

export function readSettingsRow(db: DatabaseSync): SettingsRow | undefined {
  return getRow<SettingsRow>(db.prepare('SELECT * FROM settings WHERE id = 1'))
}

export function settingsRowToJs(row: SettingsRow): SettingsData {
  return {
    id: 1,
    dailyGoalMinutes: Number(row.dailyGoalMinutes),
    targetScore: Number(row.targetScore),
    examDate: String(row.examDate),
    reminderTime: String(row.reminderTime),
    ragBaseUrl: String(row.ragBaseUrl),
    onboardingDone: Number(row.onboardingDone) !== 0,
    // `?? 1`: hàng đọc từ DB chưa chạy migration (thiếu cột) coi như bật mặc định.
    checkinEnabled: (row.checkinEnabled ?? 1) !== 0,
    pomodoro: JSON.parse(String(row.pomodoro)) as SettingsData['pomodoro'],
    syncMode: String(row.syncMode) === 'server' ? 'server' : 'local',
    serverUrl: String(row.serverUrl),
    updatedAt: Number(row.updatedAt),
  }
}

// ===== Sessions =====

export interface SessionRow {
  id: number
  date: string
  startedAt: number
  endedAt: number | null
  durationMin: number
  part: number
  activity: string
  source: string
  note: string
  updatedAt: number
}

export function sessionRowToJs(row: SessionRow): SessionData {
  return {
    id: Number(row.id),
    date: String(row.date),
    startedAt: Number(row.startedAt),
    endedAt: row.endedAt === null ? null : Number(row.endedAt),
    durationMin: Number(row.durationMin),
    part: Number(row.part),
    activity: String(row.activity),
    source: String(row.source) === 'timer' ? 'timer' : 'manual',
    note: String(row.note),
    updatedAt: Number(row.updatedAt),
  }
}

// ===== Daily notes =====

export interface NoteRow {
  date: string
  partStudied: string
  newWords: number
  mistakesSummary: string
  reflection: string
  photoIds: string
  autoDrafted: number
  updatedAt: number
}

export function noteRowToJs(row: NoteRow): NoteData {
  return {
    date: String(row.date),
    partStudied: JSON.parse(String(row.partStudied)) as number[],
    newWords: Number(row.newWords),
    mistakesSummary: String(row.mistakesSummary),
    reflection: String(row.reflection),
    photoIds: JSON.parse(String(row.photoIds)) as number[],
    autoDrafted: Number(row.autoDrafted) !== 0,
    updatedAt: Number(row.updatedAt),
  }
}

// ===== Vocab =====

export interface VocabRow {
  id: number
  word: string
  meaning: string
  example: string
  part: number
  sourceTest: string
  createdAt: number
  updatedAt: number
}

export function vocabRowToJs(row: VocabRow): VocabData {
  return {
    id: Number(row.id),
    word: String(row.word),
    meaning: String(row.meaning),
    example: String(row.example),
    part: Number(row.part),
    sourceTest: String(row.sourceTest),
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
  }
}

// ===== SRS =====

export interface SrsRow {
  id: number
  vocabId: number
  box: number
  dueDate: string
  lastReviewed: number | null
  correctCount: number
  updatedAt: number
}

export function srsRowToJs(row: SrsRow): SrsData {
  return {
    id: Number(row.id),
    vocabId: Number(row.vocabId),
    box: Number(row.box),
    dueDate: String(row.dueDate),
    lastReviewed: row.lastReviewed === null ? null : Number(row.lastReviewed),
    correctCount: Number(row.correctCount),
    updatedAt: Number(row.updatedAt),
  }
}

// ===== Mistakes =====

export interface MistakeRow {
  id: number
  testNo: number
  part: number
  questionNo: number
  myAnswer: string
  correctAnswer: string
  cause: string
  explanation: string
  reviewed: number
  createdAt: number
  updatedAt: number
}

export function mistakeRowToJs(row: MistakeRow): MistakeData {
  return {
    id: Number(row.id),
    testNo: Number(row.testNo),
    part: Number(row.part),
    questionNo: Number(row.questionNo),
    myAnswer: String(row.myAnswer),
    correctAnswer: String(row.correctAnswer),
    cause: String(row.cause),
    explanation: String(row.explanation),
    reviewed: Number(row.reviewed) !== 0,
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
  }
}

// ===== Scores =====

export interface ScoreRow {
  id: number
  date: string
  testLabel: string
  listening: number
  reading: number
  total: number
  updatedAt: number
}

export function scoreRowToJs(row: ScoreRow): ScoreData {
  return {
    id: Number(row.id),
    date: String(row.date),
    testLabel: String(row.testLabel),
    listening: Number(row.listening),
    reading: Number(row.reading),
    total: Number(row.total),
    updatedAt: Number(row.updatedAt),
  }
}

// ===== Photos (BLOB ↔ base64 cho JSON) =====

export interface PhotoRow {
  id: number
  blob: Uint8Array
  mime: string
  refType: string
  refId: string
  createdAt: number
  updatedAt: number
}

export function photoRowToJs(row: PhotoRow): PhotoData {
  return {
    id: Number(row.id),
    mime: String(row.mime),
    refType: String(row.refType) as PhotoData['refType'],
    refId: String(row.refId),
    dataBase64: Buffer.from(row.blob).toString('base64'),
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
  }
}

// ===== Chat =====

export interface ChatRow {
  id: number
  sessionId: string
  role: string
  content: string
  createdAt: number
  updatedAt: number
}

export function chatRowToJs(row: ChatRow): ChatData {
  return {
    id: Number(row.id),
    sessionId: String(row.sessionId),
    role: String(row.role) === 'assistant' ? 'assistant' : 'user',
    content: String(row.content),
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
  }
}

// ===== Mảng response — validate cả danh sách 1 lần trước khi gửi =====

export const sessionListSchema = z.array(sessionResponseSchema)
export const noteListSchema = z.array(dailyNoteSchema)
export const vocabListSchema = z.array(vocabResponseSchema)
export const srsListSchema = z.array(srsResponseSchema)
export const mistakeListSchema = z.array(mistakeResponseSchema)
export const scoreListSchema = z.array(scoreResponseSchema)
export const photoListSchema = z.array(photoResponseSchema)
export const chatListSchema = z.array(chatResponseSchema)
