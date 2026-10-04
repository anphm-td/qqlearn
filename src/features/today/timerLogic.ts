/*
 * Logic đồng hồ bấm giờ theo TIMESTAMP — file thuần TS, KHÔNG import React/Dexie/window.
 *
 * Quy tắc của trang buổi học: KHÔNG đếm bằng setInterval (setInterval drift khi tab
 * bị treo/điện thoại ngủ). setInterval CHỈ vẽ lại màn hình; số thời gian luôn tính
 * từ epoch: elapsed = (now - startedAt) + accumulatedMs.
 */

export interface TimerState {
  /** Đang đếm hay đang dừng. */
  running: boolean
  /** Epoch ms lần chạy gần nhất (null khi dừng). */
  startedAt: number | null
  /** Tổng ms đã đếm trước lần chạy hiện tại (chốt khi pause). */
  accumulatedMs: number
}

export function emptyTimer(): TimerState {
  return { running: false, startedAt: null, accumulatedMs: 0 }
}

/** Bắt đầu/chạy tiếp — idempotent khi đang chạy. */
export function startTimer(now: number, s: TimerState): TimerState {
  if (s.running) return s
  return { running: true, startedAt: now, accumulatedMs: s.accumulatedMs }
}

/** Thời gian đã đếm tới thời điểm `now`. */
export function elapsedMs(now: number, s: TimerState): number {
  if (!s.running || s.startedAt === null) return s.accumulatedMs
  return s.accumulatedMs + Math.max(0, now - s.startedAt)
}

/** Dừng và chốt thời gian; không vượt quá `targetMs` (phần đi quá đích không tính). */
export function pauseTimer(now: number, s: TimerState, targetMs = Number.POSITIVE_INFINITY): TimerState {
  if (!s.running) return s
  return { running: false, startedAt: null, accumulatedMs: Math.min(elapsedMs(now, s), targetMs) }
}

/**
 * Nhịp kiểm tra mỗi tick vẽ lại: khi running đã đạt target → tự dừng ĐÚNG target
 * (không cộng thêm ms thừa giữa 2 tick) và báo finished để UI chuyển pha.
 */
export function advanceTimer(
  now: number,
  s: TimerState,
  targetMs: number,
): { state: TimerState; finished: boolean } {
  if (!s.running || elapsedMs(now, s) < targetMs) return { state: s, finished: false }
  return { state: { running: false, startedAt: null, accumulatedMs: targetMs }, finished: true }
}

/** Thời gian còn lại tới target (không âm). */
export function remainingMs(now: number, s: TimerState, targetMs: number): number {
  return Math.max(0, targetMs - elapsedMs(now, s))
}

/** 'mm:ss' (quá 1 giờ → 'h:mm:ss') từ ms — giá trị âm làm sàn về 0:00. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
