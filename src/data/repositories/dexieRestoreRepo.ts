/*
 * Impl local của RestoreRepo — khôi phục bản sao lưu trên Dexie (IndexedDB).
 *
 * Toàn bộ thao tác xoá + ghi nằm trong MỘT db.transaction('rw', …): Dexie tự
 * ABORT transaction khi có lỗi (duyệt ra exception) và ROLLBACK mọi thay đổi —
 * không bao giờ để lại dữ liệu khôi phục một phần. Chạy lại cho cùng kết quả vì
 * mỗi lần đều clear-trước-ghi.
 */
import type { RestorePayload, RestoreRepo } from '@core/ports'
import type { ChatMessage, DailyNote, Mistake, Photo, Session, SrsCard, Vocab } from '@core/types'

import { DEFAULT_SETTINGS, db } from '../db'

export class DexieRestoreRepo implements RestoreRepo {
  async restoreAll(payload: RestorePayload): Promise<void> {
    await db.transaction(
      'rw',
      [db.settings, db.sessions, db.dailyNotes, db.vocab, db.srsCards, db.mistakes, db.scores, db.photos, db.chatMessages],
      async () => {
        const now = Date.now()

        // Xoá sạch 8 bảng dữ liệu (giữ hàng settings — chỉ ghi đè các trường payload).
        await Promise.all([
          db.sessions.clear(),
          db.dailyNotes.clear(),
          db.vocab.clear(),
          db.srsCards.clear(),
          db.mistakes.clear(),
          db.scores.clear(),
          db.photos.clear(),
          db.chatMessages.clear(),
        ])

        // Settings: merge payload lên hàng hiện có — syncMode/serverUrl KHÔNG nằm
        // trong bản sao lưu (nguồn dữ liệu là lựa chọn của máy này, không đổi khi restore).
        const current = (await db.settings.get(1)) ?? DEFAULT_SETTINGS
        await db.settings.put({ ...current, ...payload.settings, id: 1, updatedAt: now })

        // Sessions + mapping chỉ mục → id mới (ảnh tham chiếu theo chỉ mục).
        const sessionIds: number[] = []
        for (const s of payload.sessions) {
          const row: Session = { ...s, updatedAt: now }
          sessionIds.push(await db.sessions.add(row))
        }

        // Vocab + mapping chỉ mục → id mới (thẻ SRS tham chiếu theo chỉ mục).
        const vocabIds: number[] = []
        for (const v of payload.vocab) {
          const row: Vocab = { ...v, createdAt: now, updatedAt: now }
          vocabIds.push(await db.vocab.add(row))
        }

        // Thẻ SRS: giữ nguyên trạng thái hộp/hạn/correctCount của bản sao lưu.
        for (const c of payload.srsCards) {
          const vocabId = vocabIds[c.vocabKey]
          if (vocabId === undefined) continue // từ gốc không có trong payload — bỏ an toàn
          const row: SrsCard = {
            vocabId,
            box: c.box,
            dueDate: c.dueDate,
            lastReviewed: c.lastReviewed,
            correctCount: c.correctCount,
            updatedAt: now,
          }
          await db.srsCards.add(row)
        }

        const mistakeIds: number[] = []
        for (const m of payload.mistakes) {
          const row: Mistake = { ...m, createdAt: now, updatedAt: now }
          mistakeIds.push(await db.mistakes.add(row))
        }

        for (const s of payload.scores) {
          await db.scores.add({ ...s, updatedAt: now })
        }

        for (const n of payload.dailyNotes) {
          const row: DailyNote = { ...n, updatedAt: now }
          await db.dailyNotes.put(row)
        }

        for (const c of payload.chat) {
          const row: ChatMessage = { ...c, createdAt: now, updatedAt: now }
          await db.chatMessages.add(row)
        }

        // Ảnh: refKey = chỉ mục (session/mistake) hoặc ngày (note) — giữ đúng đích gắn.
        for (const p of payload.photos) {
          let refId: string | null
          if (p.refType === 'note') {
            refId = p.refKey
          } else {
            const ids = p.refType === 'session' ? sessionIds : mistakeIds
            const newId = ids[Number(p.refKey)]
            refId = newId === undefined ? null : String(newId)
          }
          if (refId === null) continue // bản ghi đích không có trong payload — bỏ an toàn
          const row: Photo = {
            blob: new Blob([p.bytes], { type: p.mime }),
            mime: p.mime,
            refType: p.refType,
            refId,
            createdAt: now,
            updatedAt: now,
          }
          await db.photos.add(row)
        }
      },
    )
  }
}
