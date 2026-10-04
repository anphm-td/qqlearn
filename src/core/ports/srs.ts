/*
 * Port: SRS (thẻ ôn tập Leitner) — LỚP CORE.
 */
import type { SrsCard } from '../types'

/** Dữ liệu tạo/ghi nguyên 1 thẻ — repo tự sinh id khi trống + tự đính updatedAt. */
export type SrsCardInput = Omit<SrsCard, 'id' | 'updatedAt'> & { id?: number }

export interface SrsRepo {
  listAll(): Promise<SrsCard[]>
  /**
   * Thẻ đến hạn ở ngày 'YYYY-MM-DD' local. Thẻ MỒ CÔI (từ vựng đã xoá khỏi sổ)
   * luôn bị lọc ra — mọi nơi đếm/duyệt qua listDue đều nhất quán.
   */
  listDue(dateISO: string): Promise<SrsCard[]>
  getByVocab(vocabId: number): Promise<SrsCard | undefined>
  /** Tạo thẻ cho 1 từ vựng (hộp 1, đến hạn ngày truyền vào). */
  createForVocab(vocabId: number, dueDate: string): Promise<SrsCard>
  /**
   * Ghi NGUYÊN trạng thái thẻ (khôi phục sao lưu: giữ hộp/lastReviewed/correctCount).
   * id trống → tự sinh; id có sẵn → ghi đè hàng đó.
   */
  put(card: SrsCardInput): Promise<SrsCard>
  /** Xoá thẻ của 1 từ vựng — gọi khi xoá từ khỏi sổ để không để lại thẻ mồ côi. */
  removeByVocab(vocabId: number): Promise<void>
  /**
   * Ôn xong 1 thẻ: đúng → hộp +1 (tối đa 5) và dueDate lùi xa hơn; sai → về hộp 1.
   * Trả về thẻ sau khi cập nhật (undefined nếu không tìm thấy).
   */
  review(cardId: number, correct: boolean, today: string): Promise<SrsCard | undefined>
}
