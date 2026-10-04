/*
 * Port: Vocab (từ vựng) — LỚP CORE.
 */
import type { NewVocab, Vocab } from '../types'

export interface VocabRepo {
  list(): Promise<Vocab[]>
  /** Tìm theo từ/nghĩa/ví dụ (contains, không phân biệt hoa thường). */
  search(query: string): Promise<Vocab[]>
  create(input: NewVocab): Promise<Vocab>
  update(id: number, patch: Partial<NewVocab>): Promise<void>
  remove(id: number): Promise<void>
}
