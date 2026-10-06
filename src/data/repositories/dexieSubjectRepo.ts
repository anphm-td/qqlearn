/*
 * Impl local của SubjectRepo — bảng subjects.
 * Tên môn DUY NHẤT (không phân biệt hoa thường) — chặn ngay ở repo, không đợi DB.
 */
import type { SubjectRepo } from '@core/ports'
import type { NewSubject, Subject } from '@core/types'

import { db, seedSubjectsIfEmpty } from '../db'

/** Mã lỗi của repo môn học — UI (SubjectsPage) map code → thông điệp theo ngôn ngữ. */
export type SubjectErrorCode = 'duplicate_subject' | 'subject_in_use'

/**
 * Lỗi ném khi tên môn đã tồn tại. `message` giữ tiếng Việt (ngôn ngữ mặc định —
 * fallback hiển thị), nhưng UI ĐỌC `code` để tự dịch qua dict 'subjects'
 * (error.duplicate kèm biến {name} = `subjectName`).
 */
export class DuplicateSubjectError extends Error {
  readonly code = 'duplicate_subject' as const satisfies SubjectErrorCode
  /** Tên môn bị trùng (đã trim) — để UI nội suy vào thông điệp dịch. */
  readonly subjectName: string
  constructor(name: string) {
    super(`Đã có môn "${name}" — chọn tên khác nhé.`)
    this.name = 'DuplicateSubjectError'
    this.subjectName = name
  }
}

/**
 * Lỗi ném khi xoá môn CÒN dữ liệu (buổi học, từ vựng, lỗi sai, điểm, ghi chú
 * cuối ngày). UI đọc `code` ('subject_in_use') để tự dịch qua dict 'subjects'.
 */
export class SubjectInUseError extends Error {
  readonly code = 'subject_in_use' as const satisfies SubjectErrorCode
  constructor() {
    super(
      'Môn này còn dữ liệu (buổi học, từ vựng, lỗi sai, điểm hoặc ghi chú cuối ngày) — chỉ lưu trữ được, không xoá.',
    )
    this.name = 'SubjectInUseError'
  }
}

async function assertNameFree(name: string, exceptId?: number): Promise<void> {
  const normalized = name.trim().toLowerCase()
  const all = await db.subjects.toArray()
  const clash = all.some((s) => s.name.trim().toLowerCase() === normalized && s.id !== exceptId)
  if (clash) throw new DuplicateSubjectError(name.trim())
}

export class DexieSubjectRepo implements SubjectRepo {
  async list(): Promise<Subject[]> {
    // Dexie không chạy upgrade() trên DB mới từ đầu — seed 4 môn ở lần đọc đầu.
    await seedSubjectsIfEmpty()
    return db.subjects.orderBy('id').toArray()
  }

  async create(input: NewSubject): Promise<Subject> {
    await assertNameFree(input.name)
    const now = Date.now()
    const row: Subject = { ...input, name: input.name.trim(), createdAt: now, updatedAt: now }
    const id = await db.subjects.add(row)
    return { ...row, id }
  }

  async update(id: number, patch: Partial<NewSubject>): Promise<void> {
    if (patch.name !== undefined) await assertNameFree(patch.name, id)
    await db.subjects.update(id, {
      ...patch,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      updatedAt: Date.now(),
    })
  }

  /**
   * Xoá môn — chỉ cho phép khi môn CHƯA có dữ liệu nào (buổi học, từ vựng, lỗi
   * sai, điểm, ghi chú cuối ngày). Môn đã có dữ liệu phải archive — ném Error
   * với thông điệp rõ.
   */
  async remove(id: number): Promise<void> {
    const [sessionCount, vocabCount, mistakeCount, scoreCount, noteCount] = await Promise.all([
      db.sessions.where('subjectId').equals(id).count(),
      db.vocab.where('subjectId').equals(id).count(),
      db.mistakes.where('subjectId').equals(id).count(),
      db.scores.filter((s) => s.subjectId === id).count(),
      db.dailyNotes.filter((n) => n.partStudied.includes(id)).count(),
    ])
    if (sessionCount + vocabCount + mistakeCount + scoreCount + noteCount > 0) {
      throw new SubjectInUseError()
    }
    await db.subjects.delete(id)
  }
}
