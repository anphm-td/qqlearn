import { useCallback } from 'react'

import { t, type I18nVars, type Lang, type Namespace } from '@core/i18n'

import { useSettings } from './useSettings'

export interface UseTResult {
  /**
   * Dịch 1 key trong namespace của hook: t('nav.today') → 'Hôm nay'.
   * Biến nội suy qua đối số thứ hai: t('progress.aria', { percent: 62 }).
   * Key thiếu → trả chính key (không ném lỗi).
   */
  t: (key: string, vars?: I18nVars) => string
  /** Ngôn ngữ hiện tại — 'vi' khi settings chưa tải/không đọc được. */
  lang: Lang
}

/**
 * Hook dịch của UI — lớp DATA bọc lõi thuần '@core/i18n' cho React.
 *
 * Đọc `language` từ useSettings() (publish/listen): đổi ngôn ngữ trong Cài đặt
 * → mọi hook useT đang mount render lại NGAY, không cần tải lại app.
 * settings null/đang tải → 'vi' (mặc định — design-system.md mục 12).
 *
 * Ví dụ:
 *   const { t, lang } = useT('today')
 *   <h1>{t('home.title')}</h1>
 *   document.title = t('appTitle')  // key ở namespace 'common'
 *
 * ⚠️ Agent feature: mỗi nhóm màn hình dùng namespace RIÊNG (useT('today'),
 * useT('notebook')…) và điền từ điển ở src/core/i18n/dict/<ns>.ts — key vi/en
 * phải đối xứng 1-1 (test key-parity chặn).
 */
export function useT(ns: Namespace = 'common'): UseTResult {
  const { settings } = useSettings()
  const lang: Lang = settings?.language ?? 'vi'
  const translate = useCallback(
    (key: string, vars?: I18nVars) => t(lang, ns, key, vars),
    [lang, ns],
  )
  return { t: translate, lang }
}
