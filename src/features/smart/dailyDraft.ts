/*
 * [ĐIỂM GHÉP CHÉO — team SMART/RAG sở hữu file này]
 * Trang "Ghi chú cuối ngày" (src/features/notes/DailyNotePage.tsx) có sẵn nút "Soạn nháp"
 * đã gọi buildDailyDraft() bên dưới. Team smart viết thân hàm trong FILE NÀY,
 * KHÔNG sửa DailyNotePage. Chữ ký (input/output) GIỮ NGUYÊN như scaffold đã chốt.
 *
 * D15 — buildDailyDraft(): từ sessions/vocab tạo hôm nay + mistakes tạo hôm nay,
 * soạn nháp nội dung ghi chú cuối ngày. Khi ragBaseUrl đã cấu hình sẽ hỏi RAG
 * (ragClient.queryRag); RAG lỗi/chưa cấu hình → fallback soạn tại chỗ — không bao giờ throw.
 */

import type { Mistake, Session, Vocab } from '@core/types'

import { repos } from '@data'

import {
  buildDraftPrompt,
  composeDraftText,
  composeEmptyDraftText,
  dayRangeMs,
  hasMeaningfulData,
  summarizeDay,
  type DaySummary,
} from './draftCompose'
import { queryRag } from './ragClient'

export interface DailyDraftInput {
  /** Ngày soạn nháp, 'YYYY-MM-DD' local — lấy từ todayISO(). */
  date: string
  /** Các Part đã học hôm nay (từ sessions/dailyNotes). */
  partStudied?: number[]
  /** Số phút đã học hôm nay. */
  minutesStudied?: number
  /** Số từ mới hôm nay. */
  newWords?: number
  /** Tóm tắt lỗi sai thô (tuỳ chọn). */
  mistakesSummary?: string
}

export interface DailyDraft {
  date: string
  /** Nội dung nháp đề xuất — dev chỉ chèn, người học sửa rồi mới lưu vào dailyNotes. */
  text: string
  /** true khi sinh thành công từ dữ liệu thật. */
  autoDrafted: boolean
}

/** Gom dữ liệu trong ngày: sessions theo date, vocab/mistakes lọc theo createdAt.
 *  Đọc TUẦN TỰ (không Promise.all): Dexie mở DB lỗi khi nhiều op chạy đồng thời vẫn
 *  nhả 1 unhandled rejection nội bộ (môi trường không có IndexedDB). */
async function loadDayFacts(
  date: string,
): Promise<{ sessions: Session[]; vocab: Vocab[]; mistakes: Mistake[] }> {
  const { startMs, endMs } = dayRangeMs(date)
  const sessions = await repos.sessions.listByDate(date)
  const allVocab = await repos.vocab.list()
  const allMistakes = await repos.mistakes.list()
  return {
    sessions,
    vocab: allVocab.filter((v) => v.createdAt >= startMs && v.createdAt < endMs),
    mistakes: allMistakes.filter((m) => m.createdAt >= startMs && m.createdAt < endMs),
  }
}

/** Điểm gọi RAG: đọc ragBaseUrl qua SettingsRepo (bản không-React của useSettings). */
async function askRagForDraft(
  summary: DaySummary,
  date: string,
): Promise<string | null> {
  try {
    const settings = await repos.settings.get()
    if (!settings.ragBaseUrl.trim()) return null
    const outcome = await queryRag(settings.ragBaseUrl, buildDraftPrompt(summary, date))
    if (outcome.ok && outcome.answer) return outcome.answer
    return null
  } catch {
    // Không đọc được settings hay RAG lỗi đều bỏ qua — fallback soạn tại chỗ.
    return null
  }
}

export async function buildDailyDraft(input: DailyDraftInput): Promise<DailyDraft> {
  try {
    const facts = await loadDayFacts(input.date)
    const summary = summarizeDay(facts)

    // Ghi đè bằng số liệu caller truyền sẵn (nếu có).
    if (input.minutesStudied !== undefined) summary.minutes = input.minutesStudied
    if (input.partStudied !== undefined) {
      summary.partStudied = [
        ...new Set(input.partStudied.filter((p) => p >= 1 && p <= 7)),
      ].sort((a, b) => a - b)
    }
    if (input.newWords !== undefined) {
      summary.newWords = input.newWords
      summary.words = [] // chỉ hiện "N từ" — danh sách từ không phải của caller
    }
    if (input.mistakesSummary !== undefined) summary.mistakesNote = input.mistakesSummary

    // Chưa có dữ liệu gì → nháp mời bắt đầu, không gắn cờ autoDrafted.
    if (!hasMeaningfulData(summary)) {
      return { date: input.date, text: composeEmptyDraftText(), autoDrafted: false }
    }

    // Ưu tiên nháp từ RAG (backend dựng sau — lỗi thì im lặng fallback xuống dưới).
    const ragText = await askRagForDraft(summary, input.date)
    if (ragText) return { date: input.date, text: ragText, autoDrafted: true }

    return {
      date: input.date,
      text: composeDraftText(summary),
      autoDrafted: true,
    }
  } catch {
    // Lỗi đọc dữ liệu (vd. IndexedDB không mở được) — UI không được chết.
    return { date: input.date, text: composeEmptyDraftText(), autoDrafted: false }
  }
}
