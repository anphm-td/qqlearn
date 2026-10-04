/*
 * Port: Mistake (lỗi sai luyện đề) — LỚP CORE.
 */
import type { NewMistake, Mistake } from '../types'

export interface MistakeRepo {
  list(): Promise<Mistake[]>
  create(input: NewMistake): Promise<Mistake>
  /** Sửa nội dung 1 lỗi (đề/câu/đáp án/nguyên nhân/giải thích) — bỏ trường không truyền. */
  update(id: number, patch: Partial<NewMistake>): Promise<void>
  setReviewed(id: number, reviewed: boolean): Promise<void>
  remove(id: number): Promise<void>
}
