/*
 * Impl HTTP của RestoreRepo — khôi phục bản sao lưu qua server PC.
 *
 * Ảnh hoá base64 trong JSON (25mb limit phía server); server xử lý TOÀN BỘ payload
 * trong MỘT transaction SQLite (BEGIN/COMMIT/ROLLBACK ở handlers/restore.ts) —
 * lỗi giữa chừng thì rollback, không để lại dữ liệu một phần.
 */
import type { RestorePayload, RestoreRepo } from '@core/ports'

import { blobToBase64, httpSend } from './client'

export class HttpRestoreRepo implements RestoreRepo {
  constructor(private readonly base: string) {}

  async restoreAll(payload: RestorePayload): Promise<void> {
    const photos = []
    for (const p of payload.photos) {
      photos.push({
        refType: p.refType,
        refKey: p.refKey,
        mime: p.mime,
        dataBase64: await blobToBase64(new Blob([p.bytes], { type: p.mime })),
      })
    }
    await httpSend<void>(this.base, '/restore', 'POST', { ...payload, photos })
  }
}
