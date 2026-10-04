/*
 * Impl HTTP của VocabRepo — bảng vocab trên server.
 */
import type { VocabRepo } from '@core/ports'
import type { NewVocab, Vocab } from '@core/types'

import { httpGet, httpSend } from './client'

export class HttpVocabRepo implements VocabRepo {
  constructor(private readonly base: string) {}

  list(): Promise<Vocab[]> {
    return httpGet<Vocab[]>(this.base, '/vocab')
  }

  search(query: string): Promise<Vocab[]> {
    return httpGet<Vocab[]>(this.base, `/vocab/search?q=${encodeURIComponent(query)}`)
  }

  create(input: NewVocab): Promise<Vocab> {
    return httpSend<Vocab>(this.base, '/vocab', 'POST', input)
  }

  update(id: number, patch: Partial<NewVocab>): Promise<void> {
    return httpSend<void>(this.base, `/vocab/${id}`, 'PATCH', patch)
  }

  async remove(id: number): Promise<void> {
    await httpSend<void>(this.base, `/vocab/${id}`, 'DELETE')
  }
}
