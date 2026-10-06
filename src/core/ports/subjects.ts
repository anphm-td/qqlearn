/*
 * Port: Subject (môn học) — LỚP CORE.
 */
import type { NewSubject, Subject } from '../types'

export interface SubjectRepo {
  /** Toàn bộ môn học (gồm cả archived — UI tự lọc khi cần). */
  list(): Promise<Subject[]>
  create(input: NewSubject): Promise<Subject>
  /** Sửa một phần (tên/màu/mục tiêu riêng/lưu trữ) — bỏ trường không truyền. */
  update(id: number, patch: Partial<NewSubject>): Promise<void>
  /**
   * Xoá môn — TỪ CHỐI khi môn còn dữ liệu (buổi học/từ vựng/lỗi sai/điểm):
   * ném Error với thông điệp tiếng Việt, UI hiện để người học archive thay vì xoá.
   */
  remove(id: number): Promise<void>
}
