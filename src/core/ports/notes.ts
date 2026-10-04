/*
 * Port: Note (ghi chú cuối ngày) — LỚP CORE.
 */
import type { DailyNote } from '../types'

export interface NoteRepo {
  get(date: string): Promise<DailyNote | undefined>
  /** Ghi (tạo hoặc cập nhật) ghi chú của 1 ngày; tự đính updatedAt. */
  upsert(note: DailyNote): Promise<DailyNote>
  listBetween(from: string, to: string): Promise<DailyNote[]>
}
