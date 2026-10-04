/*
 * Helper validate dùng chung:
 *  - parseBody/parseQuery: dữ liệu ĐẦU VÀO — lỗi → ApiError 400 với thông điệp rõ.
 *  - assertShape: dữ liệu ĐẦU RA (response) — lệch schema là lỗi 500 của server.
 *  - parseId/parseDateParam: tham số đường dẫn.
 */
import type { ZodType } from 'zod'

import { dateISO } from '../../src/core/schemas.js'
import { ApiError } from './errors.js'

function firstIssueMessage(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  const issue = error.issues[0]
  const where = issue && issue.path.length > 0 ? issue.path.map(String).join('.') : 'dữ liệu'
  return `${where}: ${issue?.message ?? 'không hợp lệ'}`
}

export function parseWith<T>(schema: ZodType<T>, value: unknown, what: string): T {
  const parsed = schema.safeParse(value ?? {})
  if (!parsed.success) {
    throw new ApiError(400, `${what} không hợp lệ — ${firstIssueMessage(parsed.error)}`)
  }
  return parsed.data
}

/** Body JSON của request. */
export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  return parseWith(schema, body, 'Dữ liệu gửi lên')
}

/** Query string của request. */
export function parseQuery<T>(schema: ZodType<T>, query: unknown): T {
  return parseWith(schema, query, 'Tham số truy vấn')
}

/** Response trước khi gửi đi — lệch shape là lỗi server, không trả dữ liệu sai cho app. */
export function assertShape<T>(schema: ZodType<T>, value: unknown, what: string): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    throw new ApiError(500, `${what} server trả về không đúng định dạng — ${firstIssueMessage(parsed.error)}`)
  }
  return parsed.data
}

/** Tham số :id — số nguyên dương. */
export function parseId(raw: string, what = 'Id'): number {
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, `${what} không hợp lệ: "${raw}".`)
  }
  return id
}

/** Tham số :date — 'YYYY-MM-DD'. */
export function parseDateParam(raw: string, what = 'Ngày'): string {
  const parsed = dateISO.safeParse(raw)
  if (!parsed.success) {
    throw new ApiError(400, `${what} phải là 'YYYY-MM-DD' — nhận được "${raw}".`)
  }
  return parsed.data
}
