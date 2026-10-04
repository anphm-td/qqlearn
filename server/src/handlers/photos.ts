/*
 * Handlers: photos (ảnh đính kèm) — ảnh truyền base64 trong JSON, server lưu BLOB.
 * Response trả base64 (dataBase64); client app đổi ngược thành Blob để hiển thị.
 */
import { Buffer } from 'node:buffer'
import type { DatabaseSync } from 'node:sqlite'

import { allRows, getRow } from '../db.js'
import { ApiError } from '../errors.js'
import { photoListSchema, photoRowToJs, type PhotoRow } from '../rows.js'
import { photoCreateSchema, photoListQuerySchema, photoResponseSchema, type PhotoData } from '../schemas.js'
import { assertShape, parseBody, parseId, parseQuery } from '../validate.js'

export function listPhotos(db: DatabaseSync, query: unknown): PhotoData[] {
  const { refType, refId } = parseQuery(photoListQuerySchema, query)
  let rows: PhotoRow[]
  if (refType !== undefined && refId !== undefined) {
    rows = allRows<PhotoRow>(
      db.prepare('SELECT * FROM photos WHERE refType = ? AND refId = ? ORDER BY createdAt, id'),
      refType,
      refId,
    )
  } else {
    rows = allRows<PhotoRow>(db.prepare('SELECT * FROM photos ORDER BY createdAt, id'))
  }
  return assertShape(photoListSchema, rows.map(photoRowToJs), 'Danh sách ảnh')
}

export function getPhoto(db: DatabaseSync, rawId: string): PhotoData | undefined {
  const id = parseId(rawId, 'Id ảnh')
  const row = getRow<PhotoRow>(db.prepare('SELECT * FROM photos WHERE id = ?'), id)
  return row ? assertShape(photoResponseSchema, photoRowToJs(row), 'Ảnh') : undefined
}

export function createPhoto(db: DatabaseSync, body: unknown): PhotoData {
  const input = parseBody(photoCreateSchema, body)
  const bytes = Buffer.from(input.dataBase64, 'base64')
  if (bytes.length === 0) {
    throw new ApiError(400, 'Dữ liệu ảnh (dataBase64) không đọc được — chuỗi base64 rỗng hoặc sai.')
  }
  const ts = Date.now()
  const info = db
    .prepare(
      `INSERT INTO photos (blob, mime, refType, refId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(bytes, input.mime, input.refType, input.refId, ts, ts)
  const row = getRow<PhotoRow>(db.prepare('SELECT * FROM photos WHERE id = ?'), info.lastInsertRowid)
  if (!row) throw new ApiError(500, 'Không đọc lại được ảnh vừa lưu.')
  return assertShape(photoResponseSchema, photoRowToJs(row), 'Ảnh')
}

export function deletePhoto(db: DatabaseSync, rawId: string): void {
  db.prepare('DELETE FROM photos WHERE id = ?').run(parseId(rawId, 'Id ảnh'))
}
