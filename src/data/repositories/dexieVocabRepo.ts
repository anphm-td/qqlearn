/*
 * Impl local của VocabRepo — bảng vocab.
 */
import type { VocabRepo } from '@core/ports'
import type { NewVocab, Vocab } from '@core/types'

import { db } from '../db'

export class DexieVocabRepo implements VocabRepo {
  list(): Promise<Vocab[]> {
    return db.vocab.orderBy('createdAt').reverse().toArray()
  }

  async search(query: string): Promise<Vocab[]> {
    const q = query.trim().toLowerCase()
    if (!q) return this.list()
    const all = await db.vocab.toArray()
    return all.filter(
      (v) =>
        v.word.toLowerCase().includes(q) ||
        v.meaning.toLowerCase().includes(q) ||
        v.example.toLowerCase().includes(q),
    )
  }

  async create(input: NewVocab): Promise<Vocab> {
    const now = Date.now()
    const row: Vocab = { ...input, createdAt: now, updatedAt: now }
    const id = await db.vocab.add(row)
    return { ...row, id }
  }

  async update(id: number, patch: Partial<NewVocab>): Promise<void> {
    await db.vocab.update(id, { ...patch, updatedAt: Date.now() })
  }

  remove(id: number): Promise<void> {
    return db.vocab.delete(id)
  }
}
