import { useCallback, useEffect, useState } from 'react'

import type { Settings } from '@core/types'

import { repos } from './index'

interface UseSettingsResult {
  /** null khi đang tải lần đầu. */
  settings: Settings | null
  /** Ghi một phần settings (persist ngay qua SettingsRepo, không cần gọi thêm). */
  updateSettings: (patch: Partial<Omit<Settings, 'id' | 'updatedAt'>>) => Promise<void>
  loading: boolean
}

/*
 * Đồng bộ đa instance: khi 1 trang ghi settings (vd. Cài đặt đổi giờ nhắc), các hook
 * đang mount ở trang khác (vd. AppLayout dùng cho banner nhắc) nhận hàng mới ngay.
 */
type SettingsListener = (next: Settings) => void
const listeners = new Set<SettingsListener>()

function publish(next: Settings): void {
  for (const listener of listeners) listener(next)
}

/**
 * Hook đọc/ghi bảng settings — điểm truy cập DUY NHẤT vào settings cho UI.
 * Đi qua SettingsRepo (không đụng Dexie/db.ts trực tiếp).
 * Mọi lỗi đọc (IndexedDB mất, DB đóng…) được BẮT LẠI — hook không bao giờ
 * nhả unhandled rejection làm rơi test/smoke; UI thấy settings = null + loading xong.
 */
export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const row = await repos.settings.get()
        if (!alive) return
        setSettings(row)
      } catch {
        // Không đọc được settings (thiếu IndexedDB…) — UI giữ trạng thái chưa có.
      } finally {
        if (alive) setLoading(false)
      }
    })()
    const listener: SettingsListener = (next) => {
      if (alive) setSettings(next)
    }
    listeners.add(listener)
    return () => {
      alive = false
      listeners.delete(listener)
    }
  }, [])

  const updateSettings = useCallback(
    async (patch: Partial<Omit<Settings, 'id' | 'updatedAt'>>) => {
      const next = await repos.settings.update(patch)
      publish(next)
    },
    [],
  )

  return { settings, updateSettings, loading }
}
