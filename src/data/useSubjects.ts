import { useCallback, useEffect, useState } from 'react'

import type { Subject } from '@core/types'

import { repos } from './index'

interface UseSubjectsResult {
  /** null khi đang tải lần đầu; lỗi đọc → mảng null + loadError. */
  subjects: Subject[] | null
  /** Nạp lại danh sách môn (sau tạo/sửa/xoá/lưu trữ). */
  reload: () => Promise<void>
  loadError: boolean
}

/**
 * Hook đọc bảng subjects cho UI — đi qua SubjectRepo của '@data' (không đụng
 * Dexie trực tiếp). Mọi lỗi đọc được BẮT lại, không nhả unhandled rejection.
 */
export function useSubjects(): UseSubjectsResult {
  const [subjects, setSubjects] = useState<Subject[] | null>(null)
  const [loadError, setLoadError] = useState(false)

  const reload = useCallback(async () => {
    try {
      const rows = await repos.subjects.list()
      setSubjects(rows)
      setLoadError(false)
    } catch {
      setLoadError(true)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { subjects, reload, loadError }
}
