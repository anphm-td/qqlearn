/*
 * Bộ màu môn + 4 môn seed — LỚP CORE (thuần TypeScript, không import gì cả).
 *
 * NGUỒN LUẬT: .superdesign/design-system.md mục 5 — KHÔNG tự tạo màu ngoài danh
 * sách này. Teal (#4EB09B) CỐ Ý không có ở đây: "Teal không dùng làm màu môn
 * (tránh lẫn màu hành động)".
 *
 * Môn thêm (thứ 5 trở đi) lấy màu theo thứ tự #FBC193 → #FAE0C7 → LẶP lại từ đầu
 * (subjectPaletteColor(index) — xem hàm bên dưới).
 */

export interface SubjectColor {
  /** Màu chính — washi/chấm/dải màu môn. */
  colorHex: string
  /** Nền nhạt đi kèm (tint) cho bubble/section của môn. */
  softHex: string
}

/** Bộ màu môn định sẵn (theo đúng dòng "Màu môn" của design-system.md mục 5). */
export const SUBJECT_PALETTE: readonly SubjectColor[] = [
  { colorHex: '#FFD273', softHex: '#FFF3D9' }, // TOEIC — xoài
  { colorHex: '#BFAEE3', softHex: '#F1ECFA' }, // Toán — tím oải hương
  { colorHex: '#FEC5E6', softHex: '#FFEFF6' }, // Tiếng Nhật — hồng phấn
  { colorHex: '#DEB5D7', softHex: '#F7EDF5' }, // Lập trình — tím hồng
  { colorHex: '#FBC193', softHex: '#FDF0DD' }, // môn thêm 1 — đào
  { colorHex: '#FAE0C7', softHex: '#FBF3E4' }, // môn thêm 2 — kem
] as const

/** Danh sách hex hợp lệ cho colorHex của môn (validate schema + swatch UI). */
export const SUBJECT_COLOR_HEXES = [
  '#FFD273',
  '#BFAEE3',
  '#FEC5E6',
  '#DEB5D7',
  '#FBC193',
  '#FAE0C7',
] as const

/**
 * Màu của môn thứ `index` (0-based) khi tự gán màu mới: 4 môn đầu theo seed,
 * môn thêm chạy #FBC193 → #FAE0C7 rồi lặp lại toàn bộ bảng màu.
 */
export function subjectPaletteColor(index: number): string {
  const n = SUBJECT_PALETTE.length
  const i = ((Math.trunc(index) % n) + n) % n
  return SUBJECT_PALETTE[i]!.colorHex
}

/** Tint nhạt đi kèm 1 màu môn (không tìm thấy → nền rule trung tính). */
export function subjectSoftOf(colorHex: string): string {
  return SUBJECT_PALETTE.find((c) => c.colorHex.toLowerCase() === colorHex.toLowerCase())?.softHex ?? '#F0E6D6'
}

/** 4 môn seed khi bảng subjects còn trống (màu theo đúng thứ tự mục 5). */
export const SEED_SUBJECTS: ReadonlyArray<{ name: string; colorHex: string; goalMinutesPerDay: number }> = [
  { name: 'TOEIC', colorHex: '#FFD273', goalMinutesPerDay: 0 },
  { name: 'Toán', colorHex: '#BFAEE3', goalMinutesPerDay: 0 },
  { name: 'Tiếng Nhật', colorHex: '#FEC5E6', goalMinutesPerDay: 0 },
  { name: 'Lập trình', colorHex: '#DEB5D7', goalMinutesPerDay: 0 },
] as const
