/*
 * Logic thuần của tính năng "Hỏi giờ học khi mở app" (check-in) — file KHÔNG import
 * React/Dexie/window. localStorage được đọc/ghi ở tầng UI (CheckinPrompt.tsx) rồi
 * đưa vào các hàm thuần ở đây để quyết định (dễ test vitest).
 */

/** localStorage key lưu epoch ms lần hỏi gần nhất (Lưu, Bỏ qua đều ghi). */
export const CHECKIN_PROMPT_KEY = 'qlearn.checkin.lastPromptAt'

/** Phải qua ít nhất bao nhiêu phút kể từ lần hỏi gần nhất mới hỏi lại. */
export const CHECKIN_COOLDOWN_MIN = 15

/** Đầu vào của shouldPromptCheckin — `now` truyền vào để tính toán không dính thời gian thật. */
export interface CheckinGateInput {
  /** Bật/tắt trong Cài đặt (Settings.checkinEnabled). */
  enabled: boolean
  /** Chỉ hỏi sau khi onboarding xong (Settings.onboardingDone). */
  onboardingDone: boolean
  /** Epoch ms lần hỏi gần nhất (null = chưa từng hỏi trên máy này). */
  lastPromptAt: number | null
  /** Thời điểm "bây giờ" (epoch ms). */
  now: number
}

/**
 * Đủ điều kiện hiện lời hỏi check-in khi mở app?
 * Bật trong Cài đặt + đã xong onboarding + (chưa từng hỏi HOẶC đã quá 15 phút
 * kể từ lần hỏi gần nhất — tránh hỏi dồn mỗi lần người học mở lại Sổ).
 */
export function shouldPromptCheckin({ enabled, onboardingDone, lastPromptAt, now }: CheckinGateInput): boolean {
  if (!enabled || !onboardingDone) return false
  if (lastPromptAt === null) return true
  return now - lastPromptAt >= CHECKIN_COOLDOWN_MIN * 60_000
}

/**
 * Đọc epoch ms lần hỏi gần nhất từ giá trị localStorage — không có / hỏng / số
 * không hợp lệ → null (coi như chưa từng hỏi).
 */
export function parseLastPromptAt(raw: string | null): number | null {
  if (raw === null) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}
