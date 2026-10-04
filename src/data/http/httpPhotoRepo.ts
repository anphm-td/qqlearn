/*
 * Impl HTTP của PhotoRepo — bảng photos trên server.
 * Blob đi qua JSON dạng base64 (blobToBase64/base64ToBlob trong client.ts);
 * server lưu cột BLOB của SQLite.
 */
import type { PhotoRepo } from '@core/ports'
import type { Photo, PhotoRefType } from '@core/types'

import { base64ToBlob, blobToBase64, httpGet, httpGetMaybe404, httpSend, type PhotoWire } from './client'

function toPhoto(row: PhotoWire): Photo {
  return {
    id: row.id,
    mime: row.mime,
    refType: row.refType,
    refId: row.refId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    blob: base64ToBlob(row.dataBase64, row.mime),
  }
}

export class HttpPhotoRepo implements PhotoRepo {
  constructor(private readonly base: string) {}

  async save(input: { blob: Blob; mime: string; refType: PhotoRefType; refId: string }): Promise<Photo> {
    const dataBase64 = await blobToBase64(input.blob)
    const row = await httpSend<PhotoWire>(this.base, '/photos', 'POST', {
      mime: input.mime,
      refType: input.refType,
      refId: input.refId,
      dataBase64,
    })
    return toPhoto(row)
  }

  async get(id: number): Promise<Photo | undefined> {
    const row = await httpGetMaybe404<PhotoWire>(this.base, `/photos/${id}`)
    return row ? toPhoto(row) : undefined
  }

  async listByRef(refType: PhotoRefType, refId: string): Promise<Photo[]> {
    const rows = await httpGet<PhotoWire[]>(
      this.base,
      `/photos?refType=${encodeURIComponent(refType)}&refId=${encodeURIComponent(refId)}`,
    )
    return rows.map(toPhoto)
  }

  async remove(id: number): Promise<void> {
    await httpSend<void>(this.base, `/photos/${id}`, 'DELETE')
  }
}
