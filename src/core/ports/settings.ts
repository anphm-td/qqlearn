/*
 * Port: Settings — LỚP CORE (interface thuần, không Dexie/React/window).
 * Impl local: src/data/repositories/dexieSettingsRepo.ts. Impl server: thêm sau ở server/.
 */
import type { Settings } from '../types'

export interface SettingsRepo {
  /** Luôn trả về hàng settings (tự tạo mặc định nếu chưa có). */
  get(): Promise<Settings>
  /** Ghi một phần settings, trả về bản ghi đầy đủ sau khi ghi (tự đính updatedAt). */
  update(patch: Partial<Omit<Settings, 'id' | 'updatedAt'>>): Promise<Settings>
}
