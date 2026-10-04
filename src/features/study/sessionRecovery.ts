/*
 * Lưu/khôi phục phiên bấm giờ đang dở (A2) — file thuần TS, KHÔNG import React/Dexie.
 *
 * Vấn đề: timer sống trong state của SessionPage — rời trang (phím tắt 1–4, menu,
 * F5) là buổi 20–25 phút đang học biến mất. Giải pháp: state phiên được lưu vào
 * sessionStorage theo TIMESTAMP — quay lại trang trong cùng tab là có ngay phiên cũ,
 * đồng hồ không drift vì elapsed luôn tính từ epoch (timerLogic). sessionStorage chỉ
 * sống theo tab: đóng hẳn tab là buông (trước đó có cảnh báo beforeunload từ trang).
 */
import type { TimerState } from '@/features/today/timerLogic'

const KEY = 'qlearn.session.timer.v1'

export interface SavedSessionState {
  /** Ngày lưu phiên ('YYYY-MM-DD' local) — khác ngày là bỏ, không khôi phục phiên qua đêm. */
  date: string
  phase: 'running' | 'paused' | 'done'
  timer: TimerState
  /** Thời lượng đích (phút) tại lúc lưu. */
  targetMin: number
  part: number
  activity: string
  /** Mốc kết thúc giờ nghỉ (epoch ms) hoặc null. */
  breakEndsAt: number | null
  /** Epoch ms bắt đầu CẢ PHIÊN (dùng làm startedAt khi lưu buổi học). */
  sessionStartAt: number
}

export function saveSessionState(state: SavedSessionState): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* chế độ riêng tư — bỏ qua */
  }
}

/** Khôi phục phiên cùng NGÀY; khác ngày hoặc dữ liệu lệch → bỏ (trả null). */
export function loadSessionState(today: string): SavedSessionState | null {
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(KEY)
  } catch {
    return null
  }
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    clearSessionState()
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const s = parsed as Partial<SavedSessionState>
  if (s.date !== today) {
    clearSessionState()
    return null
  }
  if (s.phase !== 'running' && s.phase !== 'paused' && s.phase !== 'done') return null
  if (!s.timer || typeof s.timer !== 'object') return null
  if (typeof s.targetMin !== 'number' || typeof s.sessionStartAt !== 'number') return null
  return {
    date: s.date,
    phase: s.phase,
    timer: {
      running: s.timer.running === true,
      startedAt: typeof s.timer.startedAt === 'number' ? s.timer.startedAt : null,
      accumulatedMs: typeof s.timer.accumulatedMs === 'number' ? s.timer.accumulatedMs : 0,
    },
    targetMin: s.targetMin,
    part: typeof s.part === 'number' ? s.part : 0,
    activity: typeof s.activity === 'string' ? s.activity : 'nghe',
    breakEndsAt: typeof s.breakEndsAt === 'number' ? s.breakEndsAt : null,
    sessionStartAt: s.sessionStartAt,
  }
}

export function clearSessionState(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* bỏ qua */
  }
}
