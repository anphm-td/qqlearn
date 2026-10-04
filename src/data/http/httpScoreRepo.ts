/*
 * Impl HTTP của ScoreRepo — bảng scores trên server.
 */
import type { ScoreRepo } from '@core/ports'
import type { NewScore, Score } from '@core/types'

import { httpGet, httpSend } from './client'

export class HttpScoreRepo implements ScoreRepo {
  constructor(private readonly base: string) {}

  list(): Promise<Score[]> {
    return httpGet<Score[]>(this.base, '/scores')
  }

  create(input: NewScore): Promise<Score> {
    return httpSend<Score>(this.base, '/scores', 'POST', input)
  }

  async remove(id: number): Promise<void> {
    await httpSend<void>(this.base, `/scores/${id}`, 'DELETE')
  }
}
