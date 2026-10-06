/*
 * Test logic thuần "Kết nối điện thoại" (trang Cài đặt):
 *  - chọn địa chỉ gốc theo nguồn dữ liệu (server → serverUrl, local → localhost:5178);
 *  - fetchLanInfo gọi đúng /api/lan qua đường dữ liệu HTTP chung (client.ts) — fetch giả;
 *  - lanSvgDataUrl gói SVG thành data URL cho <img>; 3 bước hướng dẫn luôn đủ
 *    (dạng KEY trong dict 'settings' — chuỗi hiển thị tra qua t()).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { dicts } from '@core/i18n'

import {
  LAN_FETCH_ERROR_KEY,
  PHONE_CONNECT_STEP_KEYS,
  fetchLanInfo,
  lanSvgDataUrl,
  phoneConnectBaseUrl,
} from './phoneConnect'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('phoneConnectBaseUrl', () => {
  it('chế độ "Qua server PC" → dùng đúng địa chỉ server đã nhập (bỏ khoảng trắng 2 đầu)', () => {
    expect(phoneConnectBaseUrl('server', ' http://192.168.1.10:5178 ')).toBe(
      'http://192.168.1.10:5178',
    )
  })

  it('chế độ "Qua server PC" nhưng ô trống → về mặc định localhost:5178', () => {
    expect(phoneConnectBaseUrl('server', '   ')).toBe('http://localhost:5178')
  })

  it('chế độ "Trên máy này" → giả định server cùng máy: localhost:5178', () => {
    expect(phoneConnectBaseUrl('local', 'http://192.168.1.10:5178')).toBe('http://localhost:5178')
  })
})

describe('fetchLanInfo', () => {
  it('gọi đúng GET {base}/api/lan và trả JSON (đường dữ liệu HTTP chung)', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: string | URL | Request) => {
      calls.push(String(url))
      return {
        ok: true,
        status: 200,
        json: async () => ({ urls: ['http://192.168.1.10:5178'], qrSvg: '<svg></svg>' }),
      }
    })

    const info = await fetchLanInfo('http://localhost:5178/')
    expect(calls).toEqual(['http://localhost:5178/api/lan'])
    expect(info.urls).toEqual(['http://192.168.1.10:5178'])
    expect(info.qrSvg).toContain('<svg')
  })

  it('server không trả lời → ném lỗi (UI hiện thông báo thân thiện + nút thử lại)', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('mạng đứt')
    })
    await expect(fetchLanInfo('http://localhost:5178')).rejects.toThrow()
    for (const lang of ['vi', 'en'] as const) {
      const text = dicts.settings[lang][LAN_FETCH_ERROR_KEY]
      expect(typeof text === 'string' && text.trim().length > 0).toBe(true)
    }
    expect(dicts.settings.vi[LAN_FETCH_ERROR_KEY]).toContain('qqlearn.cmd')
  })
})

describe('lanSvgDataUrl', () => {
  it('gói chuỗi SVG thành data URL ảnh — encodeURIComponent để không vỡ thuộc tính src', () => {
    const dataUrl = lanSvgDataUrl('<svg viewBox="0 0 33 33"></svg>')
    expect(dataUrl.startsWith('data:image/svg+xml;utf8,')).toBe(true)
    expect(dataUrl).not.toContain('<')
    expect(decodeURIComponent(dataUrl.replace('data:image/svg+xml;utf8,', ''))).toContain('<svg')
  })
})

describe('PHONE_CONNECT_STEP_KEYS', () => {
  it('đủ 3 bước dạng KEY, mỗi key có chuỗi hiển thị vi/en không rỗng, không emoji', () => {
    expect(PHONE_CONNECT_STEP_KEYS).toHaveLength(3)
    for (const key of PHONE_CONNECT_STEP_KEYS) {
      for (const lang of ['vi', 'en'] as const) {
        const text = dicts.settings[lang][key]
        expect(typeof text === 'string' && text.trim().length > 0).toBe(true)
        expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
      }
    }
  })
})
