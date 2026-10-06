/*
 * Handler "Kết nối điện thoại" — KHÔNG đụng DB, KHÔNG cần auth:
 *  - lanAddresses(): dò IPv4 LAN (non-internal) của máy → http://<ip>:<port>;
 *  - lanInfo(): { urls, qrSvg } — dùng cho GET /api/lan (SVG cho UI nhúng vào <img>);
 *  - terminalQr(): QR ký tự in thẳng trong console lúc server khởi động.
 *
 * KHÔNG BAO GIỜ CRASH: không dò được IP LAN (máy chỉ có loopback / test truyền danh
 * sách mạng rỗng) → fallback `http://localhost:<port>`; sinh QR lỗi → qrSvg rỗng.
 * Danh sách mạng truyền vào được (mặc định dò thật) để test không cần mạng thật.
 */
import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os'

import QRCode from 'qrcode'

/** Cổng mặc định của server PC — trùng PORT trong server/src/index.ts. */
export const DEFAULT_LAN_PORT = 5178

/** Bản đồ tên card mạng → danh sách địa chỉ (dò thật khi không truyền vào). */
export type InterfaceMap = NodeJS.Dict<NetworkInterfaceInfo[]>

/** Các địa chỉ IP LAN (IPv4, không loopback) của máy — cho điện thoại cùng Wi-Fi. */
export function lanAddresses(port: number, nets: InterfaceMap = networkInterfaces()): string[] {
  const urls: string[] = []
  for (const list of Object.values(nets)) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) urls.push(`http://${net.address}:${port}`)
    }
  }
  return urls
}

export interface LanInfo {
  /** Địa chỉ mở Sổ được — đầu tiên là URL sinh mã QR; rỗng LAN → fallback localhost. */
  urls: string[]
  /** QR dạng SVG của urls[0] — chuỗi rỗng nếu sinh QR lỗi. */
  qrSvg: string
}

/**
 * Thông tin "Kết nối điện thoại" — trả về cho GET /api/lan:
 * urls là mọi IP LAN của máy (fallback localhost khi không dò được), qrSvg là SVG
 * của URL ĐẦU TIÊN (chính là URL được in vào mã QR).
 */
export async function lanInfo(
  port: number = DEFAULT_LAN_PORT,
  nets: InterfaceMap = networkInterfaces(),
): Promise<LanInfo> {
  const found = lanAddresses(port, nets)
  const urls = found.length > 0 ? found : [`http://localhost:${port}`]
  return { urls, qrSvg: await svgQr(urls[0] ?? `http://localhost:${port}`) }
}

/** QR dạng SVG cho một địa chỉ — lỗi trả chuỗi rỗng, không ném ra ngoài. */
export async function svgQr(url: string): Promise<string> {
  try {
    return await QRCode.toString(url, { type: 'svg' })
  } catch {
    return ''
  }
}

/** QR ký tự để in trong console (small — dùng nửa ô, gọn hơn) — lỗi trả chuỗi rỗng. */
export async function terminalQr(url: string): Promise<string> {
  try {
    return await QRCode.toString(url, { type: 'terminal', small: true })
  } catch {
    return ''
  }
}
