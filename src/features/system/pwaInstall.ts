/*
 * Nhóm D (hệ thống) — LOGIC THUẦN dò thiết bị cho hướng dẫn cài Sổ vào máy (PWA).
 * QUY TẮC LỚP: KHÔNG import React/Dexie/window — userAgent được truyền vào dưới dạng chuỗi.
 */

export type InstallPlatform = 'ios' | 'android' | 'desktop'

export function detectPlatform(userAgent: string): InstallPlatform {
  const ua = userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  return 'desktop'
}

/**
 * Các bước cài "Thêm vào Màn hình chính" theo thiết bị — dạng KEY trong từ điển
 * 'settings' (src/core/i18n/dict/settings.ts, nhóm 'pwa.step.*'); UI tra chuỗi
 * hiển thị qua t() theo ngôn ngữ đã chọn (SettingsPage — nơi duy nhất dùng).
 */
export const INSTALL_STEP_KEYS: Record<InstallPlatform, string[]> = {
  ios: ['pwa.step.ios.1', 'pwa.step.ios.2', 'pwa.step.ios.3'],
  android: ['pwa.step.android.1', 'pwa.step.android.2', 'pwa.step.android.3'],
  desktop: ['pwa.step.desktop.1', 'pwa.step.desktop.2', 'pwa.step.desktop.3'],
}

/** Key của một dòng gợi ý cho các thiết bị KHÁC thiết bị hiện tại (dict 'settings'). */
export const OTHER_DEVICE_HINT_KEYS: Record<InstallPlatform, string> = {
  ios: 'pwa.otherDevice.ios',
  android: 'pwa.otherDevice.android',
  desktop: 'pwa.otherDevice.desktop',
}
