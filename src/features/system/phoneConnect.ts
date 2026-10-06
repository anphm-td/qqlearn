/*
 * "Kết nối điện thoại" (trang Cài đặt) — LOGIC THUẦN tách khỏi UI:
 * hỏi server PC GET /api/lan (đi đúng đường dữ liệu HTTP của chế độ "Qua server PC"
 * — client.ts, có timeout + lỗi có thông điệp) rồi UI vẽ mã QR + liệt kê địa chỉ.
 *
 *  - nguồn dữ liệu "Qua server PC" → hỏi đúng server người học đã nhập (serverUrl);
 *  - nguồn dữ liệu "Trên máy này"  → giả định server chạy cùng máy: localhost:5178
 *    (người dùng phổ thông mở Sổ bằng qqlearn.cmd — server luôn ở cổng mặc định).
 */

import { httpGet } from '@data/http/client'
import { DEFAULT_SERVER_URL } from '@data'
import type { DataMode } from '@data'

/** Trả về của GET /api/lan — server/src/handlers/lan.ts. */
export interface LanInfo {
  urls: string[]
  qrSvg: string
}

/**
 * Key thông báo khi không hỏi được server PC — UI tra chuỗi hiển thị qua t()
 * theo ngôn ngữ đã chọn (dict 'settings' — nhóm 'pc.*'; kèm nút "Thử lại").
 */
export const LAN_FETCH_ERROR_KEY = 'pc.lanFetchError'

/** Địa chỉ gốc để hỏi /api/lan theo nguồn dữ liệu đang chọn (serverUrl trống → mặc định). */
export function phoneConnectBaseUrl(mode: DataMode, serverUrl: string): string {
  const base = mode === 'server' ? serverUrl.trim() : ''
  return base !== '' ? base : DEFAULT_SERVER_URL
}

/** Hỏi server PC danh sách địa chỉ + mã QR (SVG) — lỗi ném ra cho UI hiện thân thiện. */
export async function fetchLanInfo(baseUrl: string): Promise<LanInfo> {
  return httpGet<LanInfo>(baseUrl, '/lan')
}

/** Chuỗi SVG → data URL nhúng vào <img src> (encodeURIComponent để không vỡ thuộc tính). */
export function lanSvgDataUrl(qrSvg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(qrSvg)}`
}

/** Ba bước kết nối — dạng KEY trong dict 'settings' ('pc.step.*'); UI tra qua t(). */
export const PHONE_CONNECT_STEP_KEYS = ['pc.step.1', 'pc.step.2', 'pc.step.3'] as const
