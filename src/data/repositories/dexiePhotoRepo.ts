/*
 * Impl local của PhotoRepo — bảng photos (Blob nhị phân).
 */
import type { PhotoRepo } from '@core/ports'
import type { Photo, PhotoRefType } from '@core/types'

import { db } from '../db'

export class DexiePhotoRepo implements PhotoRepo {
  async save(input: { blob: Blob; mime: string; refType: PhotoRefType; refId: string }): Promise<Photo> {
    const now = Date.now()
    const row: Photo = { ...input, createdAt: now, updatedAt: now }
    const id = await db.photos.add(row)
    return { ...row, id }
  }

  get(id: number): Promise<Photo | undefined> {
    return db.photos.get(id)
  }

  listByRef(refType: PhotoRefType, refId: string): Promise<Photo[]> {
    return db.photos.where({ refType, refId }).toArray()
  }

  remove(id: number): Promise<void> {
    return db.photos.delete(id)
  }
}
