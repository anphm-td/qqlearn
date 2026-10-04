/*
 * Chế độ dữ liệu (F21) — người học chọn trong Cài đặt:
 *  - 'local'  : "Trên máy này" — mọi dữ liệu nằm trong IndexedDB (Dexie) như trước.
 *  - 'server' : "Qua server PC" — repos gọi API của server Express + SQLite chạy trên
 *               máy tính (npm run server, cổng 5178) qua các HTTP repos cùng ports.
 *
 * Nguồn sự thật của lựa chọn là Settings.syncMode + Settings.serverUrl (@core/types):
 * trang Cài đặt ghi 2 trường này vào bảng settings khi bấm "Áp dụng". BẢN SAO của
 * lựa chọn được ghi thêm vào localStorage để createRepos() đọc ĐỒNG BỘ lúc app khởi
 * động — nếu chỉ dựa vào bảng settings sẽ lặp vô hạn (để đọc settings cần repo, để
 * có repo cần settings). Đổi chế độ xong app tự tải lại trang để factory dựng lại
 * bộ repos theo lựa chọn mới.
 */

import type { SyncMode } from '@core/types'

/** Tên cũ thân thiện với UI — trùng giá trị với SyncMode của '@core/types'. */
export type DataMode = SyncMode

const MODE_KEY = 'qlearn.dataMode'
const SERVER_URL_KEY = 'qlearn.serverUrl'

/** Địa chỉ server mặc định — cùng máy, cổng 5178 (server/README.md). */
export const DEFAULT_SERVER_URL = 'http://localhost:5178'

export function getDataMode(): DataMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'server' ? 'server' : 'local'
  } catch {
    return 'local'
  }
}

export function getServerUrl(): string {
  try {
    return localStorage.getItem(SERVER_URL_KEY) || DEFAULT_SERVER_URL
  } catch {
    return DEFAULT_SERVER_URL
  }
}

/** Ghi lựa chọn rồi tải lại app để factory dựng lại bộ repos theo chế độ mới. */
export function applyDataMode(mode: DataMode, serverUrl: string): void {
  try {
    localStorage.setItem(MODE_KEY, mode)
    localStorage.setItem(SERVER_URL_KEY, serverUrl.trim() || DEFAULT_SERVER_URL)
  } catch {
    /* chế độ riêng tư — vẫn tải lại với lựa chọn hiện tại */
  }
  window.location.reload()
}
