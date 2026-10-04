/*
 * Impl local của NoteRepo — bảng dailyNotes (PK = date 'YYYY-MM-DD' local).
 */
import type { NoteRepo } from '@core/ports'
import type { DailyNote } from '@core/types'

import { db } from '../db'

export class DexieNoteRepo implements NoteRepo {
  get(date: string): Promise<DailyNote | undefined> {
    return db.dailyNotes.get(date)
  }

  async upsert(note: DailyNote): Promise<DailyNote> {
    const row: DailyNote = { ...note, updatedAt: Date.now() }
    await db.dailyNotes.put(row)
    return row
  }

  listBetween(from: string, to: string): Promise<DailyNote[]> {
    return db.dailyNotes.where('date').between(from, to, true, true).toArray()
  }
}
