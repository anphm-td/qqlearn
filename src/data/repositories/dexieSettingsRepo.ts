/*
 * Impl local của SettingsRepo — bảng settings (singleton id = 1).
 */
import type { SettingsRepo } from '@core/ports'
import type { Settings } from '@core/types'

import { DEFAULT_SETTINGS, db } from '../db'

export class DexieSettingsRepo implements SettingsRepo {
  async get(): Promise<Settings> {
    // Hàng ghi trước khi có syncMode/serverUrl thiếu 2 trường mới — gom mặc định vào
    // (không cần bump Dexie version vì 2 trường này KHÔNG nằm trong index).
    const row = await db.settings.get(1)
    if (row) return { ...DEFAULT_SETTINGS, ...row }
    const created: Settings = { ...DEFAULT_SETTINGS, updatedAt: Date.now() }
    await db.settings.put(created)
    return created
  }

  async update(patch: Partial<Omit<Settings, 'id' | 'updatedAt'>>): Promise<Settings> {
    const current = await this.get()
    const next: Settings = { ...current, ...patch, id: 1, updatedAt: Date.now() }
    await db.settings.put(next)
    return next
  }
}
