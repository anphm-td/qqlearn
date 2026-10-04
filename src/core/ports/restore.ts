/*
 * Port: Restore (khôi phục bản sao lưu ALL-OR-NOTHING) — LỚP CORE.
 *
 * Khác với các repo CRUD ghi-từng-hàng, khôi phục phải là MỘT TRANSACTION:
 * xoá sạch dữ liệu rồi ghi lại từ đầu — lỗi giữa chừng (server ngắt, hết quota)
 * phải rollback về trạng thái trước khôi phục, không để lại dữ liệu nửa vời;
 * chạy lại thì cho cùng kết quả (idempotent — clear-trước-ghi), không nhân đôi.
 */
import type {
  ChatMessage,
  DailyNote,
  NewMistake,
  NewScore,
  NewSession,
  NewVocab,
  PhotoRefType,
  Settings,
} from '../types'

/** Ảnh của bản sao lưu — bytes đã giải mã khỏi data URL. */
export interface RestorePhotoInput {
  refType: PhotoRefType
  /**
   * Đích gắn ảnh, dạng chữ:
   *  - 'note'  → ngày của ghi chú ('YYYY-MM-DD', giữ nguyên);
   *  - 'session' / 'mistake' → CHỈ MỤC trong mảng sessions/mistakes của payload
   *    (impl tự ánh xạ sang id mới sau khi ghi — id bản sao lưu không còn ý nghĩa).
   */
  refKey: string
  mime: string
  /** Uint8Array trên ArrayBuffer riêng (không SharedArrayBuffer) — dựng Blob được. */
  bytes: Uint8Array<ArrayBuffer>
}

/** Thẻ SRS trong bản sao lưu — tham chiếu từ vựng theo CHỈ MỤC trong mảng vocab. */
export interface RestoreCardInput {
  vocabKey: number
  box: number
  dueDate: string
  lastReviewed: number | null
  correctCount: number
}

/** Toàn bộ dữ liệu của 1 bản sao lưu, đã tách sẵn để ghi qua repos. */
export interface RestorePayload {
  /** Các trường cài đặt — KHÔNG gồm syncMode/serverUrl (nguồn dữ liệu là lựa chọn của máy này). */
  settings: Pick<
    Settings,
    'dailyGoalMinutes' | 'targetScore' | 'examDate' | 'reminderTime' | 'ragBaseUrl' | 'onboardingDone' | 'pomodoro'
  >
  sessions: NewSession[]
  vocab: NewVocab[]
  srsCards: RestoreCardInput[]
  mistakes: NewMistake[]
  scores: NewScore[]
  dailyNotes: DailyNote[]
  chat: { sessionId: string; role: ChatMessage['role']; content: string }[]
  photos: RestorePhotoInput[]
}

export interface RestoreRepo {
  /**
   * Khôi phục trong MỘT transaction: xoá sạch 8 bảng dữ liệu rồi ghi payload
   * (settings chỉ ghi các trường của payload, giữ nguyên syncMode/serverUrl hiện có).
   * Lỗi bất kỳ → rollback toàn bộ, dữ liệu như trước khi gọi.
   */
  restoreAll(payload: RestorePayload): Promise<void>
}
