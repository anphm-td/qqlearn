/*
 * Impl HTTP của SessionRepo — bảng sessions trên server.
 */
import type { SessionRepo } from '@core/ports'
import type { NewSession, Session } from '@core/types'

import { httpGet, httpSend } from './client'

export class HttpSessionRepo implements SessionRepo {
  constructor(private readonly base: string) {}

  listByDate(date: string): Promise<Session[]> {
    return this.listBetween(date, date)
  }

  listBetween(from: string, to: string): Promise<Session[]> {
    return httpGet<Session[]>(this.base, `/sessions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
  }

  create(input: NewSession): Promise<Session> {
    return httpSend<Session>(this.base, '/sessions', 'POST', input)
  }

  update(id: number, patch: Partial<NewSession>): Promise<void> {
    return httpSend<void>(this.base, `/sessions/${id}`, 'PATCH', patch)
  }

  async remove(id: number): Promise<void> {
    await httpSend<void>(this.base, `/sessions/${id}`, 'DELETE')
  }
}
