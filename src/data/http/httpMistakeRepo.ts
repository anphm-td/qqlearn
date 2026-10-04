/*
 * Impl HTTP của MistakeRepo — bảng mistakes trên server.
 */
import type { MistakeRepo } from '@core/ports'
import type { Mistake, NewMistake } from '@core/types'

import { httpGet, httpSend } from './client'

export class HttpMistakeRepo implements MistakeRepo {
  constructor(private readonly base: string) {}

  list(): Promise<Mistake[]> {
    return httpGet<Mistake[]>(this.base, '/mistakes')
  }

  create(input: NewMistake): Promise<Mistake> {
    return httpSend<Mistake>(this.base, '/mistakes', 'POST', input)
  }

  update(id: number, patch: Partial<NewMistake>): Promise<void> {
    return httpSend<void>(this.base, `/mistakes/${id}`, 'PATCH', patch)
  }

  setReviewed(id: number, reviewed: boolean): Promise<void> {
    return httpSend<void>(this.base, `/mistakes/${id}/reviewed`, 'POST', { reviewed })
  }

  async remove(id: number): Promise<void> {
    await httpSend<void>(this.base, `/mistakes/${id}`, 'DELETE')
  }
}
