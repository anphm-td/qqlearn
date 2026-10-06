// @vitest-environment node
/*
 * Test handler "Kết nối điện thoại" (GET /api/lan — server/src/handlers/lan.ts):
 *  - gọi lanInfo() TRỰC TIẾP với danh sách mạng GIẢ truyền vào — không cần mạng thật,
 *    không cần express listen (cùng phong cách api.test.ts);
 *  - trường hợp máy KHÔNG có IP LAN (danh sách rỗng) → fallback localhost, không crash.
 */
import type { NetworkInterfaceInfo } from 'node:os'
import { describe, expect, it } from 'vitest'

import { lanAddresses, lanInfo } from '../src/handlers/lan.js'

/** Mạng giả: một card Wi-Fi (1 IPv4 thường + 1 IPv6 + 1 loopback — hai cái sau bị bỏ). */
const FAKE_NETS: NodeJS.Dict<NetworkInterfaceInfo[]> = {
  'Wi-Fi': [
    {
      address: '192.168.1.10',
      family: 'IPv4',
      internal: false,
      mac: 'aa:bb:cc:dd:ee:ff',
      netmask: '255.255.255.0',
      cidr: '192.168.1.10/24',
    },
    {
      address: 'fe80::1',
      family: 'IPv6',
      internal: false,
      mac: 'aa:bb:cc:dd:ee:ff',
      netmask: 'ffff:ffff:ffff:ffff::',
      cidr: 'fe80::1/64',
      scopeid: 5,
    },
    {
      address: '127.0.0.1',
      family: 'IPv4',
      internal: true,
      mac: '00:00:00:00:00:00',
      netmask: '255.0.0.0',
      cidr: '127.0.0.1/8',
    },
  ],
}

describe('lanAddresses', () => {
  it('chỉ giữ IPv4 non-internal, đúng cổng; IPv6 và loopback bị bỏ', () => {
    expect(lanAddresses(5178, FAKE_NETS)).toEqual(['http://192.168.1.10:5178'])
  })

  it('không có mạng nào → mảng rỗng (không crash)', () => {
    expect(lanAddresses(5178, {})).toEqual([])
  })
})

describe('lanInfo — handler của GET /api/lan', () => {
  it('trả urls là mảng string (IP LAN đầu tiên) và qrSvg chứa SVG', async () => {
    const info = await lanInfo(5178, FAKE_NETS)
    expect(Array.isArray(info.urls)).toBe(true)
    for (const url of info.urls) expect(typeof url).toBe('string')
    expect(info.urls).toEqual(['http://192.168.1.10:5178'])
    expect(info.qrSvg).toContain('<svg')
    expect(info.qrSvg).toContain('</svg>')
  })

  it('KHÔNG dò được IP LAN (máy chỉ có loopback / danh sách rỗng) → fallback localhost, vẫn có QR', async () => {
    const info = await lanInfo(5178, {})
    expect(info.urls).toEqual(['http://localhost:5178'])
    expect(info.qrSvg).toContain('<svg')
  })

  it('dùng đúng cổng truyền vào (không cứng 5178)', async () => {
    const info = await lanInfo(6000, FAKE_NETS)
    expect(info.urls).toEqual(['http://192.168.1.10:6000'])
    expect(info.qrSvg).toContain('<svg')
  })
})
