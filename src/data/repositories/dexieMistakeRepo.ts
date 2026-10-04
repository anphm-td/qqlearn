/*
 * Impl local của MistakeRepo — bảng mistakes.
 */
import type { MistakeRepo } from '@core/ports'
import type { Mistake, NewMistake } from '@core/types'

import { db } from '../db'

export class DexieMistakeRepo implements MistakeRepo {
  list(): Promise<Mistake[]> {
    return db.mistakes.orderBy('createdAt').reverse().toArray()
  }

  async create(input: NewMistake): Promise<Mistake> {
    const now = Date.now()
    const row: Mistake = { ...input, createdAt: now, updatedAt: now }
    const id = await db.mistakes.add(row)
    return { ...row, id }
  }

  async update(id: number, patch: Partial<NewMistake>): Promise<void> {
    await db.mistakes.update(id, { ...patch, updatedAt: Date.now() })
  }

  async setReviewed(id: number, reviewed: boolean): Promise<void> {
    await db.mistakes.update(id, { reviewed, updatedAt: Date.now() })
  }

  remove(id: number): Promise<void> {
    return db.mistakes.delete(id)
  }
}
