/*
 * Tín hiệu "dữ liệu vừa đổi" giữa các trang đang mở (Cùng một SPA — nhiều view
 * chỉ nạp dữ liệu 1 LẦN lúc mount, nên sau khi 1 khối UI khác ghi sổ, view đang
 * mở sẽ không tự thấy: ví dụ Home không cập nhật sau khi card Check-in lưu buổi).
 *
 * Cơ chế: CustomEvent trên window — theo cùng phong cách NOTE_TIME_EVENT
 * (useReminders phát, AppLayout lắng nghe). Ai GHI dữ liệu qua repos thành công
 * thì gọi emitDataChanged(); trang đang HIỂN THỊ dữ liệu của bảng đó nghe rồi
 * tự nạp lại vùng của mình. Event chỉ là "thông báo là đủ": chi tiết gọn (tên
 * bảng), người nghe tự quyết định nạp lại hay bỏ qua.
 */

/** Tên sự kiện window — hằng số dùng chung cho nơi phát và nơi nghe. */
export const DATA_CHANGED_EVENT = 'qqlearn:data-changed'

/** Bảng dữ liệu vừa được ghi — người nghe dùng để lọc tín hiệu liên quan tới mình. */
export type DataChangedTable =
  | 'sessions'
  | 'subjects'
  | 'notes'
  | 'vocab'
  | 'mistakes'
  | 'scores'
  | 'srs'
  | 'settings'

export interface DataChangedDetail {
  table: DataChangedTable
}

/** Phát tín hiệu "bảng `table` vừa được ghi" — gọi SAU khi ghi thành công qua repos. */
export function emitDataChanged(table: DataChangedTable): void {
  window.dispatchEvent(new CustomEvent<DataChangedDetail>(DATA_CHANGED_EVENT, { detail: { table } }))
}

/**
 * Nghe tín hiệu "dữ liệu đã đổi" — trả về hàm gỡ listener (dùng làm cleanup của
 * useEffect, như mọi addEventListener khác trong app).
 */
export function onDataChanged(handler: (detail: DataChangedDetail) => void): () => void {
  const listener = (e: Event): void => {
    handler((e as CustomEvent<DataChangedDetail>).detail)
  }
  window.addEventListener(DATA_CHANGED_EVENT, listener)
  return () => window.removeEventListener(DATA_CHANGED_EVENT, listener)
}
