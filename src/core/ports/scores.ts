/*
 * Port: Score (điểm luyện đề) — LỚP CORE.
 */
import type { NewScore, Score } from '../types'

export interface ScoreRepo {
  list(): Promise<Score[]>
  create(input: NewScore): Promise<Score>
  remove(id: number): Promise<void>
}
