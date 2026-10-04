/*
 * Port: Photo (ảnh đính kèm) — LỚP CORE.
 */
import type { Photo, PhotoRefType } from '../types'

export interface PhotoRepo {
  save(input: { blob: Blob; mime: string; refType: PhotoRefType; refId: string }): Promise<Photo>
  get(id: number): Promise<Photo | undefined>
  listByRef(refType: PhotoRefType, refId: string): Promise<Photo[]>
  remove(id: number): Promise<void>
}
