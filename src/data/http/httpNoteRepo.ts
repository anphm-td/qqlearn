/*
 * Impl HTTP của NoteRepo — bảng dailyNotes trên server (PK = date).
 */
import type { NoteRepo } from '@core/ports'
import type { DailyNote } from '@core/types'

import { httpGet, httpGetMaybe404, httpSend } from './client'

export class HttpNoteRepo implements NoteRepo {
  constructor(private readonly base: string) {}

  get(date: string): Promise<DailyNote | undefined> {
    return httpGetMaybe404<DailyNote>(this.base, `/notes/${encodeURIComponent(date)}`)
  }

  upsert(note: DailyNote): Promise<DailyNote> {
    return httpSend<DailyNote>(this.base, `/notes/${encodeURIComponent(note.date)}`, 'PUT', note)
  }

  listBetween(from: string, to: string): Promise<DailyNote[]> {
    return httpGet<DailyNote[]>(this.base, `/notes?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
  }
}
