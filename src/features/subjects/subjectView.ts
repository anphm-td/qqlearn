import { useMemo } from 'react'

import { t, type Lang } from '@core/i18n'
import { SUBJECT_PALETTE } from '@core/subjects'
import type { Subject } from '@core/types'

/**
 * Tiện ích hiển thị theo môn cho UI — thuần dữ liệu (không Dexie/window).
 * UI nạp subjects qua useSubjects() rồi dựng map id → môn để tra tên/màu O(1).
 * Nhãn dự phòng là KEY trong dict 'subjects' (name.*), tra qua t(lang, …) —
 * 'vi' là nguồn chuẩn nên mặc định giữ tiếng Việt.
 */
export function subjectByIdMap(subjects: readonly Subject[]): Map<number, Subject> {
  return new Map(subjects.filter((s) => s.id != null).map((s) => [s.id as number, s]))
}

/** Tên môn hiển thị; subjectId 0 → "chưa phân môn"; id lạ (đã xoá) → nhãn dự phòng. */
export function subjectNameOf(map: Map<number, Subject>, subjectId: number, lang: Lang = 'vi'): string {
  if (subjectId === 0) return t(lang, 'subjects', 'name.unassigned')
  return map.get(subjectId)?.name ?? t(lang, 'subjects', 'name.deleted')
}

/** Màu hex của môn; id 0/lạ → undefined (UI dùng màu trung tính). */
export function subjectColorOf(map: Map<number, Subject>, subjectId: number): string | undefined {
  return map.get(subjectId)?.colorHex
}

/** Chỉ các môn đang hoạt động (chưa lưu trữ) — dùng cho mọi chỗ chọn môn. */
export function activeSubjects(subjects: readonly Subject[]): Subject[] {
  return subjects.filter((s) => !s.archived)
}

/** Màu của môn mới khi tự gán: 4 môn đầu theo seed, môn thêm chạy #FBC193 → #FAE0C7 → lặp. */
export function nextSubjectColor(existing: readonly Subject[]): string {
  // Môn seed (TOEIC/Toán/Tiếng Nhật/Lập trình) chiếm 4 màu đầu của bảng màu —
  // môn thứ 5 trở đi đi từ #FBC193 (index 4) rồi lặp.
  const index = existing.length
  const n = SUBJECT_PALETTE.length
  return SUBJECT_PALETTE[((index % n) + n) % n]!.colorHex
}

/** Hook-less memo helper cho map + danh sách hoạt động trong 1 lần gọi. */
export function useSubjectIndex(subjects: readonly Subject[] | null) {
  return useMemo(() => {
    const list = subjects ?? []
    return { map: subjectByIdMap(list), active: activeSubjects(list) }
  }, [subjects])
}
