import Dexie, { type Table } from 'dexie'

import { SEED_SUBJECTS } from '@core/subjects'
import type {
  ChatMessage,
  DailyNote,
  Mistake,
  Photo,
  Score,
  Session,
  Settings,
  Subject,
  SrsCard,
  Vocab,
} from '@core/types'

/*
 * qqlearn — Dexie schema v2 (LỚP DATA).
 *
 * ⚠️ QUY ƯỚC SỞ HỮU: file này do nhóm scaffold sở hữu. Dev phía sau CHỈ import
 *   `db`, `DEFAULT_SETTINGS` và các type được re-export bên dưới — KHÔNG tự sửa
 *   db.ts. UI không bao giờ import Dexie trực tiếp: mọi truy cập đi qua repos
 *   (createLocalRepos() từ '@data' — xem src/data/index.ts).
 *   Muốn thêm bảng/migration: báo sở hữu db.ts, nâng `version(n).stores(...)`.
 *
 * v1 → v2 (đa môn hoá): thêm bảng `subjects`; Session/Vocab/Mistake đổi `part`
 *   (1–7 của TOEIC) → `subjectId` (id bảng subjects; 0 = chưa phân môn); Score
 *   bỏ listening/reading/total → một điểm duy nhất {subjectId, label, score, note}.
 *   Cột `part` cũ KHÔNG xoá khỏi các bản ghi (chỉ bỏ khỏi index) — dữ liệu cũ
 *   giữ nguyên, trường mới `subjectId` do upgrade() điền.
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
  Subject,
  SrsCard,
  Vocab,
} from '@core/types'

/** part cũ 1–7 (TOEIC) → id môn TOEIC; 0/không có → 0 (chưa phân môn). */
export function legacySubjectIdOf(part: number | undefined | null, toeicId: number): number {
  const p = typeof part === 'number' ? Math.trunc(part) : 0
  return p >= 1 && p <= 7 ? toeicId : 0
}

// ===== Dexie database =====

export class StudyLogDB extends Dexie {
  settings!: Table<Settings, number>
  subjects!: Table<Subject, number>
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
    // v1 — giữ nguyên để chuỗi upgrade có điểm khởi đầu (DB cũ đi qua đây).
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
    // v2 — đa môn hoá: bảng subjects + index subjectId thay part.
    this.version(2)
      .stores({
        settings: 'id',
        subjects: '++id, name',
        sessions: '++id, date, subjectId, source',
        dailyNotes: 'date',
        vocab: '++id, word, subjectId, createdAt',
        srsCards: '++id, vocabId, box, dueDate',
        mistakes: '++id, subjectId, reviewed, createdAt',
        scores: '++id, date',
        photos: '++id, refType, refId, createdAt',
        chatMessages: '++id, sessionId, role, createdAt',
      })
      .upgrade(async (tx) => {
        // 1) Seed 4 môn khi bảng subjects trống (TOEIC · Toán · Tiếng Nhật · Lập trình).
        const subjects = tx.table('subjects')
        if ((await subjects.count()) === 0) {
          const now = Date.now()
          await subjects.bulkAdd(
            SEED_SUBJECTS.map((s, i) => ({ ...s, archived: false, createdAt: now + i, updatedAt: now + i })),
          )
        }
        const toeic = await subjects.where('name').equals('TOEIC').first()
        const toeicId = (toeic?.id as number | undefined) ?? 1

        // 2) part cũ → subjectId (part 1–7 → môn TOEIC; 0/null → 0 "chưa phân môn").
        await tx.table('sessions').toCollection().modify((row: Record<string, unknown>) => {
          if (row.subjectId === undefined) {
            row.subjectId = legacySubjectIdOf(row.part as number | undefined, toeicId)
          }
        })
        await tx.table('vocab').toCollection().modify((row: Record<string, unknown>) => {
          if (row.subjectId === undefined) {
            row.subjectId = legacySubjectIdOf(row.part as number | undefined, toeicId)
          }
        })
        await tx.table('mistakes').toCollection().modify((row: Record<string, unknown>) => {
          if (row.subjectId === undefined) {
            row.subjectId = legacySubjectIdOf(row.part as number | undefined, toeicId)
          }
        })

        // 3) Scores: bỏ listening/reading/total → {subjectId, label, score, note}.
        //    Điểm nghe/đọc cũ ghép vào note để không mất dữ liệu; label rỗng
        //    (testLabel trống / total 0) → 'Bài kiểm tra' cho khớp schema.
        await tx.table('scores').toCollection().modify((row: Record<string, unknown>) => {
          if (row.subjectId === undefined) {
            const listening = typeof row.listening === 'number' ? row.listening : 0
            const reading = typeof row.reading === 'number' ? row.reading : 0
            row.subjectId = toeicId
            row.label = typeof row.testLabel === 'string' && row.testLabel !== '' ? row.testLabel : 'Bài kiểm tra'
            row.score = typeof row.total === 'number' ? row.total : 0
            row.note = listening > 0 || reading > 0 ? `nghe ${listening} · đọc ${reading}` : ''
          }
        })

        // 4) dailyNotes.partStudied (Part 1–7 cũ) → id môn TOEIC; giữ nguyên 0/giá trị khác.
        await tx.table('dailyNotes').toCollection().modify((row: Record<string, unknown>) => {
          if (Array.isArray(row.partStudied)) {
            row.partStudied = (row.partStudied as unknown[]).map((v) =>
              typeof v === 'number' && v >= 1 && v <= 7 ? toeicId : v,
            )
          }
        })
      })
  }
}

export const db = new StudyLogDB()

/**
 * Seed 4 môn (TOEIC · Toán · Tiếng Nhật · Lập trình) khi bảng subjects trống.
 *
 * ⚠️ Dexie KHÔNG chạy upgrade() trên DB tạo mới từ đầu — chỉ trên DB cũ đi qua
 * version 1 — nên việc seed cần chạy cả lúc MỞ APP (repo.list() gọi hàm này) để
 * người học mới cũng có 4 môn sẵn dùng.
 */
export async function seedSubjectsIfEmpty(): Promise<void> {
  if ((await db.subjects.count()) === 0) {
    await db.transaction('rw', db.subjects, async () => {
      if ((await db.subjects.count()) > 0) return // coi chừng 2 tab mở đồng thời
      const now = Date.now()
      await db.subjects.bulkAdd(
        SEED_SUBJECTS.map((s, i) => ({ ...s, archived: false, createdAt: now + i, updatedAt: now + i })),
      )
    })
  }
}

/** Cấu hình mặc định khi chưa có settings (onboarding sẽ ghi đè). */
export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  dailyGoalMinutes: 90,
  // Giữ cột tương thích — app không còn hiển thị điểm mục tiêu/ngày thi TOEIC.
  targetScore: 700,
  examDate: '',
  reminderTime: '',
  ragBaseUrl: '',
  onboardingDone: false,
  checkinEnabled: true,
  pomodoro: { focusMin: 25, breakMin: 5 },
  syncMode: 'local',
  serverUrl: '',
  // Ngôn ngữ giao diện mặc định (design-system.md mục 12) — không thêm Dexie
  // index nên KHÔNG cần bump version; hàng cũ thiếu trường được gom mặc định
  // khi get() ({ ...DEFAULT_SETTINGS, ...row } trong DexieSettingsRepo).
  language: 'vi',
  updatedAt: 0,
}

/** Tiện ích ngày local — re-export để dev import 1 nguồn duy nhất từ '@data'. */
export { addDaysISO, localDateISO, todayISO } from '@core/date'
