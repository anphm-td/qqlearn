/*
 * Nhóm D (hệ thống) — dán tệp xuống máy (glue UI, được phép dùng window/document).
 * Phần SINH nội dung tệp là logic thuần ở exportData.ts — file này chỉ lưu xuống đĩa.
 */

/** Tạo tệp từ chuỗi và tải về máy qua trình duyệt. */
export function saveTextFile(fileName: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 'so-hoc-toeic' + '2026-10-03' → 'so-hoc-toeic-2026-10-03' (tên tệp tải về). */
export function stampFileName(base: string, now: Date): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${base}-${y}-${m}-${d}`
}
