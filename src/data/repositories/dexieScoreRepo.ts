/*
 * Impl local của ScoreRepo — bảng scores.
 */
import type { ScoreRepo } from '@core/ports'
import type { NewScore, Score } from '@core/types'

import { db } from '../db'

export class DexieScoreRepo implements ScoreRepo {
  list(): Promise<Score[]> {
    return db.scores.orderBy('date').reverse().toArray()
  }

  async create(input: NewScore): Promise<Score> {
    const row: Score = { ...input, updatedAt: Date.now() }
    const id = await db.scores.add(row)
    return { ...row, id }
  }

  remove(id: number): Promise<void> {
    return db.scores.delete(id)
  }
}
