/*
 * Impl HTTP của SubjectRepo — bảng subjects trên server.
 */
import type { SubjectRepo } from '@core/ports'
import type { NewSubject, Subject } from '@core/types'

import { httpGet, httpSend } from './client'

export class HttpSubjectRepo implements SubjectRepo {
  constructor(private readonly base: string) {}

  list(): Promise<Subject[]> {
    return httpGet<Subject[]>(this.base, '/subjects')
  }

  create(input: NewSubject): Promise<Subject> {
    return httpSend<Subject>(this.base, '/subjects', 'POST', input)
  }

  update(id: number, patch: Partial<NewSubject>): Promise<void> {
    return httpSend<void>(this.base, `/subjects/${id}`, 'PUT', patch)
  }

  async remove(id: number): Promise<void> {
    await httpSend<void>(this.base, `/subjects/${id}`, 'DELETE')
  }
}
