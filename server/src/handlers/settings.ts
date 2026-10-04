/*
 * Handlers: settings (bảng singleton id = 1).
 * Đọc khi chưa có hàng → tự tạo hàng mặc định (đúng DEFAULT_SETTINGS của app).
 */
import type { DatabaseSync } from 'node:sqlite'

import { readSettingsRow, settingsRowToJs, type SettingsRow } from '../rows.js'
import { settingsPatchSchema, settingsSchema, type SettingsData } from '../schemas.js'
import { assertShape, parseBody } from '../validate.js'

function toSettings(row: SettingsRow): SettingsData {
  return assertShape(settingsSchema, settingsRowToJs(row), 'Bản ghi settings')
}

export function getSettings(db: DatabaseSync): SettingsData {
  const row = readSettingsRow(db)
  if (row) return toSettings(row)
  db.prepare(
    `INSERT INTO settings (id, dailyGoalMinutes, targetScore, examDate, reminderTime, ragBaseUrl,
       onboardingDone, checkinEnabled, pomodoro, syncMode, serverUrl, updatedAt)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    90,
    700,
    '',
    '',
    '',
    0,
    1,
    JSON.stringify({ focusMin: 25, breakMin: 5 }),
    'local',
    '',
    Date.now(),
  )
  return toSettings(readSettingsRow(db) as SettingsRow)
}

export function updateSettings(db: DatabaseSync, body: unknown): SettingsData {
  const patch = parseBody(settingsPatchSchema, body)
  const next = { ...getSettings(db), ...patch }
  db.prepare(
    `UPDATE settings SET dailyGoalMinutes = ?, targetScore = ?, examDate = ?, reminderTime = ?,
       ragBaseUrl = ?, onboardingDone = ?, checkinEnabled = ?, pomodoro = ?, syncMode = ?,
       serverUrl = ?, updatedAt = ?
     WHERE id = 1`,
  ).run(
    next.dailyGoalMinutes,
    next.targetScore,
    next.examDate,
    next.reminderTime,
    next.ragBaseUrl,
    next.onboardingDone ? 1 : 0,
    next.checkinEnabled ? 1 : 0,
    JSON.stringify(next.pomodoro),
    next.syncMode,
    next.serverUrl,
    Date.now(),
  )
  return getSettings(db)
}
