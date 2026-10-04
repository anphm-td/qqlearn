/*
 * Client dùng chung cho các HTTP repos (chế độ "Qua server PC").
 * Mỗi HTTP repo trong src/data/http/ cài ĐÚNG một port của '@core/ports' — UI không
 * đổi gì khi đổi chế độ dữ liệu. Giả định server (npm run server) trả JSON:
 *  - 2xx + body JSON cho mọi lệnh đọc/ghi;
 *  - 404 khi bản ghi không tồn tại (repo dịch thành undefined);
 *  - lỗi mạng/timeout/4xx/5xx khác → throw có thông điệp rõ để UI hiện.
 */
import type { PhotoRefType } from '@core/types'

/** Mỗi lệnh fetch chờ tối đa 10 giây — quá là lỗi có thông điệp, không treo UI. */
const HTTP_TIMEOUT_MS = 10_000

export class HttpApiError extends Error {
  /** 0 = lỗi mạng/timeout (chưa tới được HTTP response). */
  status: number
  notFound?: boolean
  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpApiError'
    this.status = status
  }
}

/** Nối path vào base URL (bỏ slash thừa ở đuôi base). */
export function apiUrl(baseUrl: string, path: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  return `${base}/api${path}`
}

async function requestJson(baseUrl: string, path: string, init?: RequestInit): Promise<unknown> {
  const url = apiUrl(baseUrl, path)
  let res: Response
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) })
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new HttpApiError(0, `Server không phản hồi sau 10 giây (${url}).`)
    }
    throw new HttpApiError(
      0,
      `Không kết nối được server PC (${url}) — hãy chắc chắn server đang chạy trên máy tính (npm run server).`,
    )
  }
  if (res.status === 404) {
    const err = new HttpApiError(404, 'Không tìm thấy bản ghi trên server.')
    err.notFound = true
    throw err
  }
  if (!res.ok) {
    throw new HttpApiError(res.status, `Server trả lỗi (mã ${res.status}).`)
  }
  try {
    return await res.json()
  } catch {
    throw new HttpApiError(res.status, `Server trả dữ liệu không đọc được (JSON lỗi, mã ${res.status}).`)
  }
}

export async function httpGet<T>(baseUrl: string, path: string): Promise<T> {
  return (await requestJson(baseUrl, path)) as T
}

export async function httpGetMaybe404<T>(baseUrl: string, path: string): Promise<T | undefined> {
  try {
    return (await requestJson(baseUrl, path)) as T
  } catch (err) {
    if (err instanceof HttpApiError && err.status === 404) return undefined
    throw err
  }
}

export async function httpSend<T>(
  baseUrl: string,
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<T> {
  return (await requestJson(baseUrl, path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })) as T
}

// ===== Blob ↔ base64 (ảnh đi qua JSON) =====

/** Blob → chuỗi base64 (không phần data: URL) để gửi lên server. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

/** Chuỗi base64 → Blob (kèm mime) khi nhận ảnh từ server. */
export function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/** Kiểu dòng ảnh trên "dây truyền" JSON — server luôn trả đủ các trường này. */
export interface PhotoWire {
  id: number
  mime: string
  refType: PhotoRefType
  refId: string
  dataBase64: string
  createdAt: number
  updatedAt: number
}
