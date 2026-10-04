/*
 * Impl HTTP của SettingsRepo — bảng settings trên server Express + SQLite.
 */
import type { SettingsRepo } from '@core/ports'
import type { Settings } from '@core/types'

import { httpGet, httpSend } from './client'

export class HttpSettingsRepo implements SettingsRepo {
  constructor(private readonly base: string) {}

  get(): Promise<Settings> {
    return httpGet<Settings>(this.base, '/settings')
  }

  update(patch: Partial<Omit<Settings, 'id' | 'updatedAt'>>): Promise<Settings> {
    return httpSend<Settings>(this.base, '/settings', 'PATCH', patch)
  }
}
