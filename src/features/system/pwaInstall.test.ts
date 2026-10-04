/*
 * Test logic thuần dò thiết bị cho hướng dẫn cài PWA (nhóm D).
 * Chạy: npx vitest run src/features/system
 */
import { describe, expect, it } from 'vitest'

import { INSTALL_STEPS, OTHER_DEVICE_HINTS, detectPlatform } from './pwaInstall'

const UA_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const UA_IPAD = 'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
const UA_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const UA_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'

describe('detectPlatform', () => {
  it('iPhone / iPad → ios', () => {
    expect(detectPlatform(UA_IOS)).toBe('ios')
    expect(detectPlatform(UA_IPAD)).toBe('ios')
  })

  it('Android → android', () => {
    expect(detectPlatform(UA_ANDROID)).toBe('android')
  })

  it('Windows / Mac → desktop', () => {
    expect(detectPlatform(UA_DESKTOP)).toBe('desktop')
    expect(detectPlatform(UA_MAC)).toBe('desktop')
  })

  it('chuỗi lạ → desktop (mặc định)', () => {
    expect(detectPlatform('')).toBe('desktop')
  })
})

describe('nội dung hướng dẫn', () => {
  it('mỗi nền đều có đủ các bước, không chuỗi rỗng', () => {
    for (const key of ['ios', 'android', 'desktop'] as const) {
      expect(INSTALL_STEPS[key].length).toBeGreaterThanOrEqual(3)
      for (const step of INSTALL_STEPS[key]) expect(step.trim().length).toBeGreaterThan(0)
      expect(OTHER_DEVICE_HINTS[key].length).toBeGreaterThan(0)
    }
  })
})
