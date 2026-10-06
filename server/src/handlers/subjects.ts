/*
 * Handlers: subjects (môn học) — list/create/update/remove.
 *
 * Tên môn DUY NHẤT (UNIQUE COLLATE NOCASE trong SQLite) — trùng → ApiError 409.
 * Xoá môn còn dữ liệu (sessions/vocab/mistakes/scores) → ApiError 409 với thông
 * điệp rõ: môn có dữ liệu chỉ LƯU TRỮ (archived) được, không xoá.
 */
import type { DatabaseSync } from 'node:sqlite'

import { allRows, getRow, type SqlValue } from '../db.js'
import { ApiError } from '../errors.js'
import { subjectListSchema, subjectRowToJs, type SubjectRow } from '../rows.js'
import { subjectCreateSchema, subjectPatchSchema, subjectResponseSchema, type SubjectData } from '../schemas.js'
import { assertShape, parseBody, parseId } from '../validate.js'

export function listSubjects(db: DatabaseSync): SubjectData[] {
  const rows = allRows<SubjectRow>(db.prepare('SELECT * FROM subjects ORDER BY id'))
  return assertShape(subjectListSchema, rows.map(subjectRowToJs), 'Danh sách môn học')
}

function readSubject(db: DatabaseSync, id: number): SubjectData {
  const row = getRow<SubjectRow>(db.prepare('SELECT * FROM subjects WHERE id = ?'), id)
  if (!row) throw new ApiError(404, 'Không tìm thấy môn học.')
  return assertShape(subjectResponseSchema, subjectRowToJs(row), 'Môn học')
}

function assertNameFree(db: DatabaseSync, name: string, exceptId?: number): void {
  const clash = getRow<{ id: number }>(
    db.prepare('SELECT id FROM subjects WHERE name = ? COLLATE NOCASE AND id != ?'),
    name,
    exceptId ?? -1,
  )
  if (clash) throw new ApiError(409, `Đã có môn "${name}" — chọn tên khác nhé.`)
}

export function createSubject(db: DatabaseSync, body: unknown): SubjectData {
  const input = parseBody(subjectCreateSchema, body)
  assertNameFree(db, input.name)
  const now = Date.now()
  const info = db
    .prepare(
      `INSERT INTO subjects (name, colorHex, goalMinutesPerDay, archived, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(input.name, input.colorHex, input.goalMinutesPerDay, input.archived ? 1 : 0, now, now)
  return readSubject(db, Number(info.lastInsertRowid))
}

export function updateSubject(db: DatabaseSync, rawId: string, body: unknown): SubjectData {
  const id = parseId(rawId, 'Id môn học')
  const patch = parseBody(subjectPatchSchema, body)
  readSubject(db, id) // id lạ → 404 trước khi sửa
  const sets: string[] = []
  const values: SqlValue[] = []
  const push = (column: string, value: SqlValue): void => {
    sets.push(`${column} = ?`)
    values.push(value)
  }
  if (patch.name !== undefined) {
    assertNameFree(db, patch.name, id)
    push('name', patch.name)
  }
  if (patch.colorHex !== undefined) push('colorHex', patch.colorHex)
  if (patch.goalMinutesPerDay !== undefined) push('goalMinutesPerDay', patch.goalMinutesPerDay)
  if (patch.archived !== undefined) push('archived', patch.archived ? 1 : 0)
  if (sets.length > 0) {
    push('updatedAt', Date.now())
    db.prepare(`UPDATE subjects SET ${sets.join(', ')} WHERE id = ?`).run(...values, id)
  }
  return readSubject(db, id)
}

export function deleteSubject(db: DatabaseSync, rawId: string): void {
  const id = parseId(rawId, 'Id môn học')
  readSubject(db, id) // id lạ → 404 trước khi đếm dữ liệu
  const used =
    getRow<{ n: number }>(db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE subject_id = ?'), id)!.n +
    getRow<{ n: number }>(db.prepare('SELECT COUNT(*) AS n FROM vocab WHERE subject_id = ?'), id)!.n +
    getRow<{ n: number }>(db.prepare('SELECT COUNT(*) AS n FROM mistakes WHERE subject_id = ?'), id)!.n +
    getRow<{ n: number }>(db.prepare('SELECT COUNT(*) AS n FROM scores WHERE subject_id = ?'), id)!.n
  // Ghi chú cuối ngày chứa môn trong partStudied (JSON array) — cũng chặn xoá.
  // Quét JS (JSON1 không có sẵn như hàm count gọn) — bảng notes nhỏ, chấp nhận được.
  const usedInNotes = allRows<{ partStudied: string }>(db.prepare('SELECT partStudied FROM dailyNotes')).some(
    (row) => {
      try {
        const arr: unknown = JSON.parse(row.partStudied)
        return Array.isArray(arr) && arr.some((v) => Number(v) === id)
      } catch {
        return false // JSON hỏng — không chặn xoá vì dữ liệu không đọc được
      }
    },
  )
  if (Number(used) > 0 || usedInNotes) {
    throw new ApiError(
      409,
      'Môn này còn dữ liệu (buổi học, từ vựng, lỗi sai, điểm hoặc ghi chú cuối ngày) — chỉ lưu trữ được, không xoá.',
    )
  }
  db.prepare('DELETE FROM subjects WHERE id = ?').run(id)
}
