/*
 * Impl local của SessionRepo — bảng sessions.
 * date luôn là 'YYYY-MM-DD' THEO MÚI GIỜ LOCAL (người gọi dùng todayISO()).
 */
import type { SessionRepo } from '@core/ports'
import type { NewSession, Session } from '@core/types'

import { db } from '../db'

export class DexieSessionRepo implements SessionRepo {
  listByDate(date: string): Promise<Session[]> {
    return db.sessions.where('date').equals(date).toArray()
  }

  listBetween(from: string, to: string): Promise<Session[]> {
    return db.sessions.where('date').between(from, to, true, true).toArray()
  }

  async create(input: NewSession): Promise<Session> {
    const row: Session = { ...input, updatedAt: Date.now() }
    const id = await db.sessions.add(row)
    return { ...row, id }
  }

  async update(id: number, patch: Partial<NewSession>): Promise<void> {
    await db.sessions.update(id, { ...patch, updatedAt: Date.now() })
  }

  remove(id: number): Promise<void> {
    return db.sessions.delete(id)
  }
}
