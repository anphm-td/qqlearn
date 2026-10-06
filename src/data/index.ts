/*
 * LỚP DATA — điểm vào duy nhất của UI khi cần dữ liệu.
 *
 * UI KHÔNG import Dexie trực tiếp. Luôn:
 *   import { repos } from '@data'
 *   await repos.sessions.listByDate(todayISO())
 *
 * F21 — factory chọn impl THEO NGUỒN DỮ LIỆU người học đặt trong Cài đặt
 * (Settings.syncMode — bản sao đồng bộ đọc nhanh từ localStorage, xem dataMode.ts):
 *  - 'local'  : Dexie/IndexedDB (createLocalRepos) — dùng được khi mất mạng.
 *  - 'server' : HTTP repos (src/data/http/) gọi server Express + SQLite trên máy
 *               tính (npm run server → cổng 5178) — cùng interface '@core/ports'.
 * Đổi chế độ → applyDataMode() ghi lựa chọn rồi tải lại app → factory chạy lại.
 */
import type {
  ChatRepo,
  MistakeRepo,
  NoteRepo,
  PhotoRepo,
  RestoreRepo,
  ScoreRepo,
  SessionRepo,
  SettingsRepo,
  SubjectRepo,
  SrsRepo,
  VocabRepo,
} from '@core/ports'

import { getDataMode, getServerUrl } from './dataMode'
import { DexieChatRepo } from './repositories/dexieChatRepo'
import { DexieMistakeRepo } from './repositories/dexieMistakeRepo'
import { DexieNoteRepo } from './repositories/dexieNoteRepo'
import { DexiePhotoRepo } from './repositories/dexiePhotoRepo'
import { DexieRestoreRepo } from './repositories/dexieRestoreRepo'
import { DexieScoreRepo } from './repositories/dexieScoreRepo'
import { DexieSessionRepo } from './repositories/dexieSessionRepo'
import { DexieSettingsRepo } from './repositories/dexieSettingsRepo'
import { DexieSubjectRepo } from './repositories/dexieSubjectRepo'
import { DexieSrsRepo } from './repositories/dexieSrsRepo'
import { DexieVocabRepo } from './repositories/dexieVocabRepo'
import { HttpChatRepo } from './http/httpChatRepo'
import { HttpMistakeRepo } from './http/httpMistakeRepo'
import { HttpNoteRepo } from './http/httpNoteRepo'
import { HttpPhotoRepo } from './http/httpPhotoRepo'
import { HttpRestoreRepo } from './http/httpRestoreRepo'
import { HttpScoreRepo } from './http/httpScoreRepo'
import { HttpSessionRepo } from './http/httpSessionRepo'
import { HttpSettingsRepo } from './http/httpSettingsRepo'
import { HttpSubjectRepo } from './http/httpSubjectRepo'
import { HttpSrsRepo } from './http/httpSrsRepo'
import { HttpVocabRepo } from './http/httpVocabRepo'

export { db, DEFAULT_SETTINGS, addDaysISO, localDateISO, todayISO } from './db'
export { applyDataMode, DEFAULT_SERVER_URL, getDataMode, getServerUrl } from './dataMode'
export type { DataMode } from './dataMode'
export type {
  ChatMessage,
  DailyNote,
  Mistake,
  Photo,
  PhotoRefType,
  PomodoroConfig,
  Score,
  Session,
  Settings,
  Subject,
  SrsCard,
  Vocab,
} from './db'

/** Tập 11 repo — cài đặt các ports của '@core/ports' (UI chỉ nhìn interface này). */
export interface Repos {
  settings: SettingsRepo
  subjects: SubjectRepo
  sessions: SessionRepo
  notes: NoteRepo
  vocab: VocabRepo
  srs: SrsRepo
  mistakes: MistakeRepo
  scores: ScoreRepo
  photos: PhotoRepo
  chat: ChatRepo
  /** Khôi phục bản sao lưu ALL-OR-NOTHING (1 transaction: xoá sạch rồi ghi). */
  restore: RestoreRepo
}

/** Tập repository chạy trên Dexie (IndexedDB) — chế độ "Trên máy này". */
export function createLocalRepos(): Repos {
  return {
    settings: new DexieSettingsRepo(),
    subjects: new DexieSubjectRepo(),
    sessions: new DexieSessionRepo(),
    notes: new DexieNoteRepo(),
    vocab: new DexieVocabRepo(),
    srs: new DexieSrsRepo(),
    mistakes: new DexieMistakeRepo(),
    scores: new DexieScoreRepo(),
    photos: new DexiePhotoRepo(),
    chat: new DexieChatRepo(),
    restore: new DexieRestoreRepo(),
  }
}

/** Tập repository gọi server PC — chế độ "Qua server PC" (cùng ports, UI không đổi). */
export function createServerRepos(baseUrl: string): Repos {
  return {
    settings: new HttpSettingsRepo(baseUrl),
    subjects: new HttpSubjectRepo(baseUrl),
    sessions: new HttpSessionRepo(baseUrl),
    notes: new HttpNoteRepo(baseUrl),
    vocab: new HttpVocabRepo(baseUrl),
    srs: new HttpSrsRepo(baseUrl),
    mistakes: new HttpMistakeRepo(baseUrl),
    scores: new HttpScoreRepo(baseUrl),
    photos: new HttpPhotoRepo(baseUrl),
    chat: new HttpChatRepo(baseUrl),
    restore: new HttpRestoreRepo(baseUrl),
  }
}

/**
 * Đang chạy ở chế độ "Qua server PC"? (Home dùng để hiện banner nguồn dữ liệu.)
 * Điều kiện trùng với createRepos() — serverUrl trống thì vẫn dùng bộ local.
 */
export function isServerMode(): boolean {
  return getDataMode() === 'server' && getServerUrl().trim() !== ''
}

/** Factory chọn impl theo nguồn dữ liệu đã đặt (mặc định local khi chưa cấu hình). */
export function createRepos(): Repos {
  if (isServerMode()) {
    return createServerRepos(getServerUrl())
  }
  return createLocalRepos()
}

/**
 * Singleton dùng chung cho UI (hook, trang) — impl được chọn lúc app khởi động.
 * Test có thể gọi createLocalRepos() riêng.
 */
export const repos = createRepos()
