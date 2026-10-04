/*
 * Port: Session (buổi học) — LỚP CORE.
 */
import type { NewSession, Session } from '../types'

export interface SessionRepo {
  listByDate(date: string): Promise<Session[]>
  /** Các buổi trong khoảng ngày [from, to] (inclusive, 'YYYY-MM-DD' local). */
  listBetween(from: string, to: string): Promise<Session[]>
  create(input: NewSession): Promise<Session>
  update(id: number, patch: Partial<NewSession>): Promise<void>
  remove(id: number): Promise<void>
}
