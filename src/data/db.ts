import Dexie, { type Table } from 'dexie'

import type {
  ChatMessage,
  DailyNote,
  Mistake,
  Photo,
  Score,
  Session,
  Settings,
  SrsCard,
  Vocab,
} from '@core/types'

/*
 * Sổ học TOEIC — Dexie schema v1 (LỚP DATA).
 *
 * ⚠️ QUY ƯỚC SỞ HỮU: file này do nhóm scaffold sở hữu. Dev phía sau CHỈ import
 *   `db`, `DEFAULT_SETTINGS` và các type được re-export bên dưới — KHÔNG tự sửa
 *   db.ts. UI không bao giờ import Dexie trực tiếp: mọi truy cập đi qua repos
 *   (createLocalRepos() từ '@data' — xem src/data/index.ts).
 *   Muốn thêm bảng/migration: báo sở hữu db.ts, nâng `version(n).stores(...)`.
 */

// ===== Interfaces mọi bảng (định nghĩa ở @core/types — re-export tại đây) =====

export type {
  ChatMessage,
  DailyNote,
  Mistake,
  Photo,
  PhotoRefType,
  PomodoroConfig,
  Score,
  Session,
  Settings,
  SrsCard,
  Vocab,
} from '@core/types'

// ===== Dexie database =====

export class StudyLogDB extends Dexie {
  settings!: Table<Settings, number>
  sessions!: Table<Session, number>
  dailyNotes!: Table<DailyNote, string>
  vocab!: Table<Vocab, number>
  srsCards!: Table<SrsCard, number>
  mistakes!: Table<Mistake, number>
  scores!: Table<Score, number>
  photos!: Table<Photo, number>
  chatMessages!: Table<ChatMessage, number>

  constructor() {
    super('qlearn-study-log')
    this.version(1).stores({
      settings: 'id',
      sessions: '++id, date, part, source',
      dailyNotes: 'date',
      vocab: '++id, word, part, createdAt',
      srsCards: '++id, vocabId, box, dueDate',
      mistakes: '++id, part, reviewed, createdAt',
      scores: '++id, date, total',
      photos: '++id, refType, refId, createdAt',
      chatMessages: '++id, sessionId, role, createdAt',
    })
  }
}

export const db = new StudyLogDB()

/** Cấu hình mặc định khi chưa có settings (onboarding sẽ ghi đè). */
export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  dailyGoalMinutes: 90,
  targetScore: 700,
  examDate: '',
  reminderTime: '',
  ragBaseUrl: '',
  onboardingDone: false,
  checkinEnabled: true,
  pomodoro: { focusMin: 25, breakMin: 5 },
  syncMode: 'local',
  serverUrl: '',
  updatedAt: 0,
}

/** Tiện ích ngày local — re-export để dev import 1 nguồn duy nhất từ '@data'. */
export { addDaysISO, localDateISO, todayISO } from '@core/date'
