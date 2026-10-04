/*
 * Impl HTTP của SrsRepo — bảng srsCards trên server.
 * Bảng khoảng ôn (1 · 3 · 7 · 16 · 35 ngày) nằm ở server/src/handlers/srs.ts — cùng
 * bảng với src/features/notebook/srs.ts và dexieSrsRepo.ts (3 nơi đổi cùng nhau).
 */
import type { SrsCardInput, SrsRepo } from '@core/ports'
import type { SrsCard } from '@core/types'

import { HttpApiError, httpGet, httpGetMaybe404, httpSend } from './client'

export class HttpSrsRepo implements SrsRepo {
  constructor(private readonly base: string) {}

  listAll(): Promise<SrsCard[]> {
    return httpGet<SrsCard[]>(this.base, '/srs')
  }

  listDue(dateISO: string): Promise<SrsCard[]> {
    return httpGet<SrsCard[]>(this.base, `/srs/due?date=${encodeURIComponent(dateISO)}`)
  }

  getByVocab(vocabId: number): Promise<SrsCard | undefined> {
    return httpGetMaybe404<SrsCard>(this.base, `/srs/by-vocab/${vocabId}`)
  }

  createForVocab(vocabId: number, dueDate: string): Promise<SrsCard> {
    return httpSend<SrsCard>(this.base, '/srs', 'POST', { vocabId, dueDate })
  }

  put(card: SrsCardInput): Promise<SrsCard> {
    return httpSend<SrsCard>(this.base, '/srs', 'PUT', card)
  }

  async removeByVocab(vocabId: number): Promise<void> {
    await httpSend<void>(this.base, `/srs/by-vocab/${vocabId}`, 'DELETE')
  }

  async review(cardId: number, correct: boolean, today: string): Promise<SrsCard | undefined> {
    try {
      return await httpSend<SrsCard>(this.base, `/srs/${cardId}/review`, 'POST', { correct, today })
    } catch (err) {
      if (err instanceof HttpApiError && err.status === 404) return undefined
      throw err
    }
  }
}
