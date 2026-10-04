/*
 * Handlers: dailyNotes (ghi chú cuối ngày, PK = date) — get/upsert/listBetween.
 */
import type { DatabaseSync } from 'node:sqlite'

import { allRows, getRow } from '../db.js'
import { noteListSchema, noteRowToJs, type NoteRow } from '../rows.js'
import { dailyNoteSchema, notePutSchema, rangeQuerySchema, type NoteData } from '../schemas.js'
import { assertShape, parseBody, parseDateParam, parseQuery } from '../validate.js'

export function getNote(db: DatabaseSync, rawDate: string): NoteData | undefined {
  const date = parseDateParam(rawDate, 'Ngày ghi chú')
  const row = getRow<NoteRow>(db.prepare('SELECT * FROM dailyNotes WHERE date = ?'), date)
  return row ? assertShape(dailyNoteSchema, noteRowToJs(row), 'Ghi chú ngày') : undefined
}

export function putNote(db: DatabaseSync, rawDate: string, body: unknown): NoteData {
  const date = parseDateParam(rawDate, 'Ngày ghi chú')
  const input = parseBody(notePutSchema, body)
  db.prepare(
    `INSERT INTO dailyNotes (date, partStudied, newWords, mistakesSummary, reflection, photoIds, autoDrafted, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       partStudied = excluded.partStudied, newWords = excluded.newWords,
       mistakesSummary = excluded.mistakesSummary, reflection = excluded.reflection,
       photoIds = excluded.photoIds, autoDrafted = excluded.autoDrafted, updatedAt = excluded.updatedAt`,
  ).run(
    date,
    JSON.stringify(input.partStudied),
    input.newWords,
    input.mistakesSummary,
    input.reflection,
    JSON.stringify(input.photoIds),
    input.autoDrafted ? 1 : 0,
    Date.now(),
  )
  const row = getRow<NoteRow>(db.prepare('SELECT * FROM dailyNotes WHERE date = ?'), date) as NoteRow
  return assertShape(dailyNoteSchema, noteRowToJs(row), 'Ghi chú ngày')
}

export function listNotes(db: DatabaseSync, query: unknown): NoteData[] {
  const { from, to } = parseQuery(rangeQuerySchema, query)
  let rows: NoteRow[]
  if (from !== undefined && to !== undefined) {
    rows = allRows<NoteRow>(
      db.prepare('SELECT * FROM dailyNotes WHERE date >= ? AND date <= ? ORDER BY date'),
      from,
      to,
    )
  } else {
    rows = allRows<NoteRow>(db.prepare('SELECT * FROM dailyNotes ORDER BY date'))
  }
  return assertShape(noteListSchema, rows.map(noteRowToJs), 'Danh sách ghi chú')
}
