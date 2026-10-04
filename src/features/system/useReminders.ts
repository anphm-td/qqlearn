/*
 * Nhóm D (hệ thống) — hook nhắc lịch (C12): nhắc giờ học + nhắc ghi chú cuối ngày.
 *
 * Cách hoạt động (app đang mở):
 *  - Lên lịch bằng setTimeout theo mốc kế tiếp (reminderSchedule.nextOccurrence);
 *    khi hết giờ → thông báo hệ thống (Notification API) nếu đã cấp quyền,
 *    không thì hiện BANNER ngay trong app (fallback).
 *  - Mở lại app / quay lại tab: tính lại (bù lời nhắc đã lỡ trong 90 phút,
 *    đánh dấu đã nhắc theo ngày để không nhắc trùng).
 *
 * MOUNT MỘT LẦN cho toàn app: AppLayout gọi useReminders() và hiển thị banner
 * trên mọi trang. Trang Cài đặt chỉ cần quyền thông báo → dùng
 * useNotificationPermission() (KHÔNG mount scheduler lần 2 — tránh nhắc trùng).
 *
 * LƯU Ý: settings chỉ có MỘT trường reminderTime (nhắc học). Giờ nhắc ghi chú
 * cuối ngày tạm lưu localStorage (khoá qlearn.reminder.noteTime) — khi schema
 * settings thêm trường riêng thì chuyển sang updateSettings().
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { todayISO } from '@core/date'

import { catchUpNeeded, nextOccurrence } from './reminderSchedule'

const FIRED_KEY = 'qlearn.reminder.fired.'
const NOTE_TIME_KEY = 'qlearn.reminder.noteTime'
export const DEFAULT_NOTE_REMINDER = '21:30'
/** Quá giờ nhiều nhất bao lâu thì vẫn "bù" lời nhắc khi mở lại app (phút). */
export const CATCH_UP_GRACE_MIN = 90
/** Window event phát khi đổi giờ nhắc ghi chú — AppLayout nghe để lên lịch lại. */
export const NOTE_TIME_EVENT = 'qlearn.reminder.noteTime'

export type ReminderPermission = 'granted' | 'denied' | 'default' | 'unsupported'

export interface ReminderBanner {
  kind: 'study' | 'note'
  title: string
  body: string
}

export interface ReminderJob {
  kind: 'study' | 'note'
  time: string
  title: string
  body: string
}

export const REMINDER_JOBS: ReminderJob[] = [
  {
    kind: 'study',
    time: '',
    title: 'Đã đến giờ học!',
    body: 'Mở Sổ và bắt đầu một phiên học nhỏ nhé.',
  },
  {
    kind: 'note',
    time: '',
    title: 'Ghi lại hôm nay nhé',
    body: 'Bạn vừa học được gì? Ghi nhanh vài dòng trước khi ngủ.',
  },
]

export function loadNoteReminderTime(): string {
  try {
    return localStorage.getItem(NOTE_TIME_KEY) || DEFAULT_NOTE_REMINDER
  } catch {
    return DEFAULT_NOTE_REMINDER
  }
}

export function saveNoteReminderTime(value: string): void {
  try {
    localStorage.setItem(NOTE_TIME_KEY, value)
  } catch {
    /* chế độ riêng tư — bỏ qua */
  }
  // Báo cho chỗ khác đang nghe (AppLayout lên lịch lại banner nhắc).
  try {
    window.dispatchEvent(new CustomEvent(NOTE_TIME_EVENT, { detail: value }))
  } catch {
    /* bỏ qua */
  }
}

function firedKeyFor(kind: ReminderJob['kind']): string {
  return FIRED_KEY + kind
}

function markFiredToday(kind: ReminderJob['kind']): void {
  try {
    localStorage.setItem(firedKeyFor(kind), todayISO())
  } catch {
    /* bỏ qua */
  }
}

function hasFiredToday(kind: ReminderJob['kind']): boolean {
  try {
    return localStorage.getItem(firedKeyFor(kind)) === todayISO()
  } catch {
    return false
  }
}

function currentPermission(): ReminderPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

/**
 * Quyền thông báo + nút xin quyền — cho trang Cài đặt (CHỈ UI, không lên lịch).
 * Scheduler nhắc nằm ở useReminders() mount một lần trong AppLayout.
 */
export function useNotificationPermission(): {
  permission: ReminderPermission
  requestPermission: () => Promise<void>
} {
  const [permission, setPermission] = useState<ReminderPermission>(currentPermission)

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported')
      return
    }
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
    } catch {
      setPermission(Notification.permission)
    }
  }, [])

  // Quyền có thể đổi ngoài hook (Cài đặt hệ thống) — đọc lại khi quay lại tab.
  useEffect(() => {
    const sync = () => setPermission(currentPermission())
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])

  return { permission, requestPermission }
}

/**
 * Lên lịch + hiển thị nhắc. Mount MỘT LẦN ở AppLayout cho toàn app:
 *  - `reminderTime` — giờ nhắc học (settings.reminderTime), '' = tắt.
 *  - `noteTime` — giờ nhắc ghi chú cuối ngày (localStorage), '' = tắt.
 */
export function useReminders(reminderTime: string, noteTime: string): {
  banner: ReminderBanner | null
  dismissBanner: () => void
} {
  const [banner, setBanner] = useState<ReminderBanner | null>(null)
  const timersRef = useRef<number[]>([])

  const fire = useCallback((job: ReminderJob) => {
    markFiredToday(job.kind)
    let shown = false
    if (currentPermission() === 'granted') {
      try {
        const n = new Notification(job.title, { body: job.body, tag: `qlearn-${job.kind}` })
        n.onclick = () => {
          window.focus()
          n.close()
        }
        shown = true
      } catch {
        shown = false
      }
    }
    // Fallback: chưa cấp quyền / thông báo lỗi → banner trong app.
    if (!shown) setBanner({ kind: job.kind, title: job.title, body: job.body })
  }, [])

  const activeJobs = useCallback(
    (): ReminderJob[] =>
      REMINDER_JOBS.map((j) => ({ ...j, time: j.kind === 'study' ? reminderTime : noteTime })).filter(
        (j) => j.time !== '',
      ),
    [reminderTime, noteTime],
  )

  // Lên lịch các mốc kế tiếp; tính lại khi đổi giờ / quay lại tab
  // (trình duyệt giữ ở nền có thể trễ setTimeout).
  useEffect(() => {
    const clearAll = () => {
      for (const id of timersRef.current) window.clearTimeout(id)
      timersRef.current = []
    }
    const scheduleAll = () => {
      clearAll()
      const now = new Date()
      for (const job of activeJobs()) {
        if (hasFiredToday(job.kind)) continue
        const at = nextOccurrence(now, job.time)
        if (at === null) continue
        const id = window.setTimeout(() => fire(job), Math.max(0, at - Date.now()))
        timersRef.current.push(id)
      }
    }
    scheduleAll()
    const onVisible = () => {
      if (document.visibilityState === 'visible') scheduleAll()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearAll()
    }
  }, [activeJobs, fire])

  // Bù lời nhắc đã lỡ khi vừa mở app (trong khoảng grace, chưa nhắc hôm nay).
  useEffect(() => {
    const now = new Date()
    for (const job of activeJobs()) {
      if (hasFiredToday(job.kind)) continue
      if (catchUpNeeded(now, job.time, CATCH_UP_GRACE_MIN)) fire(job)
    }
  }, [activeJobs, fire])

  const dismissBanner = useCallback(() => setBanner(null), [])

  return { banner, dismissBanner }
}
