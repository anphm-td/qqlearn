/*
 * Lỗi có mã HTTP — routes đổi thành status + JSON { error: message }.
 * Handlers (thuần, không express) ném loại này để test gọi trực tiếp được.
 */
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}
