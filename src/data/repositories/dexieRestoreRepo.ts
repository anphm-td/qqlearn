/*
 * Impl local của RestoreRepo — khôi phục bản sao lưu trên Dexie (IndexedDB).
 *
 * Toàn bộ thao tác xoá + ghi nằm trong MỘT db.transaction('rw', …): Dexie tự
 * ABORT transaction khi có lỗi (duyệt ra exception) và ROLLBACK mọi thay đổi —
 * không bao giờ để lại dữ liệu khôi phục một phần. Chạy lại cho cùng kết quả vì
 * mỗi lần đều clear-trước-ghi.
 *
 * Môn học: subjects được xoá + ghi lại từ payload; id CŨ trong bản sao lưu được
 * ÁNH XẠ sang id mới (pattern refKey của ảnh) rồi remap subjectId của sessions/
 * vocab/mistakes/scores và dailyNotes.partStudied theo ánh xạ — môn không có
 * trong payload → 0 (chưa phân môn).
 */
import type { RestorePayload, RestoreRepo } from '@core/ports'
import type {
  ChatMessage,
  DailyNote,
  Mistake,
  Photo,
  Session,
  Subject,
  SrsCard,
  Vocab,
} from '@core/types'

import { DEFAULT_SETTINGS, db } from '../db'

export class DexieRestoreRepo implements RestoreRepo {
  async restoreAll(payload: RestorePayload): Promise<void> {
    await db.transaction(
      'rw',
      [
        db.settings,
        db.subjects,
        db.sessions,
        db.dailyNotes,
        db.vocab,
        db.srsCards,
        db.mistakes,
        db.scores,
        db.photos,
        db.chatMessages,
      ],
      async () => {
        const now = Date.now()

        // Xoá sạch các bảng dữ liệu (gồm subjects; giữ hàng settings — chỉ ghi đè các trường payload).
        await Promise.all([
          db.subjects.clear(),
          db.sessions.clear(),
          db.dailyNotes.clear(),
          db.vocab.clear(),
          db.srsCards.clear(),
          db.mistakes.clear(),
          db.scores.clear(),
          db.photos.clear(),
          db.chatMessages.clear(),
        ])

        // Settings: merge payload lên hàng hiện có — syncMode/serverUrl/checkinEnabled
        // KHÔNG nằm trong bản sao lưu (lựa chọn của máy này, không đổi khi restore).
        const current = (await db.settings.get(1)) ?? DEFAULT_SETTINGS
        await db.settings.put({ ...current, ...payload.settings, id: 1, updatedAt: now })

        // Subjects: ghi lại payload (id mới tự sinh) + ÁNH XẠ id cũ → id mới.
        const subjectIdMap = new Map<number, number>()
        for (const s of payload.subjects) {
          const { id: oldId, ...rest } = s
          const row: Subject = { ...rest, createdAt: now, updatedAt: now }
          const newId = await db.subjects.add(row)
          subjectIdMap.set(oldId, newId)
        }
        /** Id cũ → id mới; môn không có trong payload → 0 (chưa phân môn). */
        const remapSubject = (oldId: number): number => subjectIdMap.get(oldId) ?? 0

        // Sessions + mapping chỉ mục → id mới (ảnh tham chiếu theo chỉ mục).
        const sessionIds: number[] = []
        for (const s of payload.sessions) {
          const row: Session = { ...s, subjectId: remapSubject(s.subjectId), updatedAt: now }
          sessionIds.push(await db.sessions.add(row))
        }

        // Vocab + mapping chỉ mục → id mới (thẻ SRS tham chiếu theo chỉ mục).
        const vocabIds: number[] = []
        for (const v of payload.vocab) {
          const row: Vocab = { ...v, subjectId: remapSubject(v.subjectId), createdAt: now, updatedAt: now }
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
          const row: Mistake = { ...m, subjectId: remapSubject(m.subjectId), createdAt: now, updatedAt: now }
          mistakeIds.push(await db.mistakes.add(row))
        }

        for (const s of payload.scores) {
          await db.scores.add({ ...s, subjectId: remapSubject(s.subjectId), updatedAt: now })
        }

        for (const n of payload.dailyNotes) {
          const row: DailyNote = {
            ...n,
            partStudied: n.partStudied.map(remapSubject),
            updatedAt: now,
          }
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
