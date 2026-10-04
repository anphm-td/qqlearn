/*
 * Impl local của SrsRepo — bảng srsCards (Leitner 5 hộp).
 * Khoảng cách ôn theo hộp: 1 · 3 · 7 · 16 · 35 ngày (đúng đặt hàng B5,
 * khớp bảng BOX_INTERVALS trong src/features/notebook/srs.ts).
 */
import type { SrsCardInput, SrsRepo } from '@core/ports'
import type { SrsCard } from '@core/types'
import { addDaysISO } from '@core/date'

import { db } from '../db'

/** Số ngày tới hạn sau khi trả lời ĐÚNG ở từng hộp (index = box - 1). */
const BOX_INTERVALS = [1, 3, 7, 16, 35]

export class DexieSrsRepo implements SrsRepo {
  listAll(): Promise<SrsCard[]> {
    return db.srsCards.toArray()
  }

  /** Thẻ đến hạn — lọc sẵn thẻ mồ côi (từ đã xoá) để badge/ôn tập/gợi ý nhất quán. */
  async listDue(dateISO: string): Promise<SrsCard[]> {
    const due = await db.srsCards.where('dueDate').belowOrEqual(dateISO).toArray()
    if (due.length === 0) return due
    const vocabs = await db.vocab.bulkGet(due.map((c) => c.vocabId))
    return due.filter((_, i) => vocabs[i] !== undefined)
  }

  getByVocab(vocabId: number): Promise<SrsCard | undefined> {
    return db.srsCards.where('vocabId').equals(vocabId).first()
  }

  async createForVocab(vocabId: number, dueDate: string): Promise<SrsCard> {
    return this.put({ vocabId, box: 1, dueDate, lastReviewed: null, correctCount: 0 })
  }

  async put(card: SrsCardInput): Promise<SrsCard> {
    const row: SrsCard = { ...card, updatedAt: Date.now() }
    if (row.id === undefined) {
      const id = await db.srsCards.add(row)
      return { ...row, id }
    }
    await db.srsCards.put(row)
    return row
  }

  async removeByVocab(vocabId: number): Promise<void> {
    await db.srsCards.where('vocabId').equals(vocabId).delete()
  }

  async review(cardId: number, correct: boolean, today: string): Promise<SrsCard | undefined> {
    const card = await db.srsCards.get(cardId)
    if (!card) return undefined
    const box = correct ? Math.min(5, card.box + 1) : 1
    const next: SrsCard = {
      ...card,
      box,
      dueDate: addDaysISO(today, BOX_INTERVALS[box - 1]),
      lastReviewed: Date.now(),
      correctCount: card.correctCount + (correct ? 1 : 0),
      updatedAt: Date.now(),
    }
    await db.srsCards.put(next)
    return next
  }
}
