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

import type { Lang } from '@core/i18n'
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
  /** Các môn đã học hôm nay (id bảng subjects, từ sessions/dailyNotes). */
  subjectIds?: number[]
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

/** Gom dữ liệu trong ngày: sessions theo date, vocab/mistakes lọc theo createdAt,
 *  kèm danh sách môn để nháp/prompt hiện TÊN môn.
 *  Đọc TUẦN TỰ (không Promise.all): Dexie mở DB lỗi khi nhiều op chạy đồng thời vẫn
 *  nhả 1 unhandled rejection nội bộ (môi trường không có IndexedDB). */
async function loadDayFacts(
  date: string,
): Promise<{ sessions: Session[]; vocab: Vocab[]; mistakes: Mistake[]; subjects: { id: number; name: string }[] }> {
  const { startMs, endMs } = dayRangeMs(date)
  const sessions = await repos.sessions.listByDate(date)
  const allVocab = await repos.vocab.list()
  const allMistakes = await repos.mistakes.list()
  const allSubjects = await repos.subjects.list()
  return {
    sessions,
    vocab: allVocab.filter((v) => v.createdAt >= startMs && v.createdAt < endMs),
    mistakes: allMistakes.filter((m) => m.createdAt >= startMs && m.createdAt < endMs),
    subjects: allSubjects.map((s) => ({ id: s.id ?? 0, name: s.name })),
  }
}

/** Điểm gọi RAG: nhận ragBaseUrl đã đọc sẵn (không đọc settings lần nữa).
 *  Prompt soạn theo `lang` để trợ lý trả nháp đúng ngôn ngữ người học. */
async function askRagForDraft(
  ragBaseUrl: string,
  summary: DaySummary,
  date: string,
  subjectNames?: ReadonlyMap<number, string>,
  lang: Lang = 'vi',
): Promise<string | null> {
  try {
    if (!ragBaseUrl.trim()) return null
    const outcome = await queryRag(ragBaseUrl, buildDraftPrompt(summary, date, subjectNames, lang))
    if (outcome.ok && outcome.answer) return outcome.answer
    return null
  } catch {
    // RAG lỗi đều bỏ qua — fallback soạn tại chỗ.
    return null
  }
}

/**
 * Ngôn ngữ của nháp/prompt — đọc từ settings một lần; đọc lỗi (IndexedDB hỏng,
 * settings chưa có) thì rớt về 'vi' (nguồn chuẩn) mà KHÔNG làm rơi việc soạn nháp.
 */
async function readLangAndRagBaseUrl(): Promise<{ lang: Lang; ragBaseUrl: string }> {
  try {
    const settings = await repos.settings.get()
    return { lang: settings.language, ragBaseUrl: settings.ragBaseUrl.trim() }
  } catch {
    return { lang: 'vi', ragBaseUrl: '' }
  }
}

export async function buildDailyDraft(input: DailyDraftInput): Promise<DailyDraft> {
  // Ngôn ngữ hiện tại + địa chỉ máy trợ lý — đọc trước, lỗi thì dùng mặc định 'vi'.
  const { lang, ragBaseUrl } = await readLangAndRagBaseUrl()
  try {
    const facts = await loadDayFacts(input.date)
    const summary = summarizeDay(facts, lang)
    // Map id môn → tên để nháp/prompt hiện "Toán — …" thay vì "môn 2".
    const subjectNames = new Map(facts.subjects.map((s) => [s.id, s.name]))

    // Ghi đè bằng số liệu caller truyền sẵn (nếu có).
    if (input.minutesStudied !== undefined) summary.minutes = input.minutesStudied
    if (input.subjectIds !== undefined) {
      summary.subjectIdsStudied = [
        ...new Set(input.subjectIds.filter((id) => id >= 1)),
      ].sort((a, b) => a - b)
    }
    if (input.newWords !== undefined) {
      summary.newWords = input.newWords
      summary.words = [] // chỉ hiện "N từ" — danh sách từ không phải của caller
    }
    if (input.mistakesSummary !== undefined) summary.mistakesNote = input.mistakesSummary

    // Chưa có dữ liệu gì → nháp mời bắt đầu, không gắn cờ autoDrafted.
    if (!hasMeaningfulData(summary)) {
      return { date: input.date, text: composeEmptyDraftText(lang), autoDrafted: false }
    }

    // Ưu tiên nháp từ RAG (backend dựng sau — lỗi thì im lặng fallback xuống dưới).
    const ragText = await askRagForDraft(ragBaseUrl, summary, input.date, subjectNames, lang)
    if (ragText) return { date: input.date, text: ragText, autoDrafted: true }

    return {
      date: input.date,
      text: composeDraftText(summary, subjectNames, lang),
      autoDrafted: true,
    }
  } catch {
    // Lỗi đọc dữ liệu (vd. IndexedDB không mở được) — UI không được chết.
    return { date: input.date, text: composeEmptyDraftText(lang), autoDrafted: false }
  }
}
