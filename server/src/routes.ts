/*
 * Đường dây API — mỗi endpoint của các bảng map 1-1 với một method của port
 * trong src/core/ports (app gọi qua src/data/http/*):
 *
 *   SettingsRepo  → GET/PATCH /api/settings
 *   SessionRepo   → GET+POST /api/sessions, PATCH+DELETE /api/sessions/:id
 *   NoteRepo      → GET /api/notes, GET+PUT /api/notes/:date
 *   VocabRepo     → GET /api/vocab, GET /api/vocab/search, POST /api/vocab,
 *                   PATCH+DELETE /api/vocab/:id
 *   SrsRepo       → GET /api/srs, GET /api/srs/due, GET+DELETE /api/srs/by-vocab/:vocabId,
 *                   POST+PUT /api/srs, POST /api/srs/:id/review
 *   MistakeRepo   → GET+POST /api/mistakes, PATCH+DELETE /api/mistakes/:id,
 *                   POST /api/mistakes/:id/reviewed
 *   ScoreRepo     → GET+POST /api/scores, DELETE /api/scores/:id
 *   PhotoRepo     → GET /api/photos, GET+POST /api/photos (base64 ↔ BLOB),
 *                   DELETE /api/photos/:id
 *   ChatRepo      → GET /api/chat, GET /api/chat/sessions, POST /api/chat,
 *                   DELETE /api/chat/session/:sessionId
 *   RestoreRepo   → POST /api/restore (toàn bộ bản sao lưu, 1 transaction)
 *
 * Handler là hàm thuần (db, ...) — 404 do route đổi thành JSON { error } để client
 * dịch ngược thành undefined đúng hợp đồng port.
 */
import type { DatabaseSync } from 'node:sqlite'
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express'

import * as chatHandlers from './handlers/chat.js'
import * as mistakeHandlers from './handlers/mistakes.js'
import * as noteHandlers from './handlers/notes.js'
import * as photoHandlers from './handlers/photos.js'
import * as restoreHandlers from './handlers/restore.js'
import * as scoreHandlers from './handlers/scores.js'
import * as sessionHandlers from './handlers/sessions.js'
import * as settingsHandlers from './handlers/settings.js'
import * as srsHandlers from './handlers/srs.js'
import * as subjectHandlers from './handlers/subjects.js'
import * as vocabHandlers from './handlers/vocab.js'
import { ApiError } from './errors.js'

type SyncEndpoint = (req: Request, res: Response) => void

/** Handlers đều đồng bộ (node:sqlite) — lỗi ném ra đưa cho error middleware. */
function wrap(endpoint: SyncEndpoint): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      endpoint(req, res)
    } catch (err) {
      next(err)
    }
  }
}

/** Tham số :id/:date — express 5 có thể trả mảng (repeat param); lấy giá trị đầu. */
function param(req: Request, name: string): string {
  const value = req.params[name]
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
}

function notFound(res: Response, message: string): void {
  res.status(404).json({ error: message })
}

export function createApiRouter(db: DatabaseSync): Router {
  const router = Router()

  // ===== Settings =====
  router.get('/settings', wrap((_req, res) => res.json(settingsHandlers.getSettings(db))))
  router.patch('/settings', wrap((req, res) => res.json(settingsHandlers.updateSettings(db, req.body))))

  // ===== Restore (khôi phục bản sao lưu — 1 transaction, xoá sạch rồi ghi) =====
  router.post('/restore', wrap((req, res) => res.json(restoreHandlers.restoreAll(db, req.body))))

  // ===== Subjects (môn học) =====
  router.get('/subjects', wrap((_req, res) => res.json(subjectHandlers.listSubjects(db))))
  router.post('/subjects', wrap((req, res) => res.status(201).json(subjectHandlers.createSubject(db, req.body))))
  router.put('/subjects/:id', wrap((req, res) => res.json(subjectHandlers.updateSubject(db, param(req, 'id'), req.body))))
  router.delete(
    '/subjects/:id',
    wrap((req, res) => {
      subjectHandlers.deleteSubject(db, param(req, 'id'))
      res.json({ ok: true })
    }),
  )

  // ===== Sessions =====
  router.get('/sessions', wrap((req, res) => res.json(sessionHandlers.listSessions(db, req.query))))
  router.post('/sessions', wrap((req, res) => res.status(201).json(sessionHandlers.createSession(db, req.body))))
  router.patch(
    '/sessions/:id',
    wrap((req, res) => {
      sessionHandlers.updateSession(db, param(req, 'id'), req.body)
      res.json({ ok: true })
    }),
  )
  router.delete(
    '/sessions/:id',
    wrap((req, res) => {
      sessionHandlers.deleteSession(db, param(req, 'id'))
      res.json({ ok: true })
    }),
  )

  // ===== Daily notes =====
  router.get('/notes', wrap((req, res) => res.json(noteHandlers.listNotes(db, req.query))))
  router.get(
    '/notes/:date',
    wrap((req, res) => {
      const note = noteHandlers.getNote(db, param(req, 'date'))
      if (!note) {
        notFound(res, 'Chưa có ghi chú ngày này.')
        return
      }
      res.json(note)
    }),
  )
  router.put('/notes/:date', wrap((req, res) => res.json(noteHandlers.putNote(db, param(req, 'date'), req.body))))

  // ===== Vocab =====
  router.get('/vocab', wrap((_req, res) => res.json(vocabHandlers.listVocab(db))))
  router.get('/vocab/search', wrap((req, res) => res.json(vocabHandlers.searchVocab(db, req.query))))
  router.post('/vocab', wrap((req, res) => res.status(201).json(vocabHandlers.createVocab(db, req.body))))
  router.patch(
    '/vocab/:id',
    wrap((req, res) => {
      vocabHandlers.updateVocab(db, param(req, 'id'), req.body)
      res.json({ ok: true })
    }),
  )
  router.delete(
    '/vocab/:id',
    wrap((req, res) => {
      vocabHandlers.deleteVocab(db, param(req, 'id'))
      res.json({ ok: true })
    }),
  )

  // ===== SRS =====
  router.get('/srs', wrap((_req, res) => res.json(srsHandlers.listSrs(db))))
  router.get(
    '/srs/due',
    wrap((req, res) => {
      const q = req.query.date
      const date = Array.isArray(q) ? String(q[0] ?? '') : String(q ?? '')
      res.json(srsHandlers.listDueSrs(db, date))
    }),
  )
  router.get(
    '/srs/by-vocab/:vocabId',
    wrap((req, res) => {
      const card = srsHandlers.getSrsByVocab(db, param(req, 'vocabId'))
      if (!card) {
        notFound(res, 'Chưa có thẻ cho từ này.')
        return
      }
      res.json(card)
    }),
  )
  router.delete(
    '/srs/by-vocab/:vocabId',
    wrap((req, res) => {
      srsHandlers.removeSrsByVocab(db, param(req, 'vocabId'))
      res.json({ ok: true })
    }),
  )
  router.post('/srs', wrap((req, res) => res.status(201).json(srsHandlers.createSrsForVocab(db, req.body))))
  router.put('/srs', wrap((req, res) => res.json(srsHandlers.putSrs(db, req.body))))
  router.post(
    '/srs/:id/review',
    wrap((req, res) => {
      const card = srsHandlers.reviewSrs(db, param(req, 'id'), req.body)
      if (!card) {
        notFound(res, 'Không tìm thấy thẻ.')
        return
      }
      res.json(card)
    }),
  )

  // ===== Mistakes =====
  router.get('/mistakes', wrap((_req, res) => res.json(mistakeHandlers.listMistakes(db))))
  router.post('/mistakes', wrap((req, res) => res.status(201).json(mistakeHandlers.createMistake(db, req.body))))
  router.patch(
    '/mistakes/:id',
    wrap((req, res) => {
      mistakeHandlers.updateMistake(db, param(req, 'id'), req.body)
      res.json({ ok: true })
    }),
  )
  router.post(
    '/mistakes/:id/reviewed',
    wrap((req, res) => {
      mistakeHandlers.setMistakeReviewed(db, param(req, 'id'), req.body)
      res.json({ ok: true })
    }),
  )
  router.delete(
    '/mistakes/:id',
    wrap((req, res) => {
      mistakeHandlers.deleteMistake(db, param(req, 'id'))
      res.json({ ok: true })
    }),
  )

  // ===== Scores =====
  router.get('/scores', wrap((_req, res) => res.json(scoreHandlers.listScores(db))))
  router.post('/scores', wrap((req, res) => res.status(201).json(scoreHandlers.createScore(db, req.body))))
  router.delete(
    '/scores/:id',
    wrap((req, res) => {
      scoreHandlers.deleteScore(db, param(req, 'id'))
      res.json({ ok: true })
    }),
  )

  // ===== Photos (base64 trong JSON ↔ BLOB SQLite) =====
  router.get('/photos', wrap((req, res) => res.json(photoHandlers.listPhotos(db, req.query))))
  router.get(
    '/photos/:id',
    wrap((req, res) => {
      const photo = photoHandlers.getPhoto(db, param(req, 'id'))
      if (!photo) {
        notFound(res, 'Không tìm thấy ảnh.')
        return
      }
      res.json(photo)
    }),
  )
  router.post('/photos', wrap((req, res) => res.status(201).json(photoHandlers.createPhoto(db, req.body))))
  router.delete(
    '/photos/:id',
    wrap((req, res) => {
      photoHandlers.deletePhoto(db, param(req, 'id'))
      res.json({ ok: true })
    }),
  )

  // ===== Chat =====
  router.get('/chat', wrap((req, res) => res.json(chatHandlers.listChatBySession(db, req.query))))
  router.get('/chat/sessions', wrap((_req, res) => res.json(chatHandlers.listChatSessions(db))))
  router.post('/chat', wrap((req, res) => res.status(201).json(chatHandlers.appendChat(db, req.body))))
  router.delete(
    '/chat/session/:sessionId',
    wrap((req, res) => {
      chatHandlers.deleteChatSession(db, param(req, 'sessionId'))
      res.json({ ok: true })
    }),
  )

  // ===== Health =====
  router.get('/health', wrap((_req, res) => res.json({ ok: true, app: 'qqlearn' })))

  return router
}

/** Lỗi ra JSON: ApiError → status riêng; còn lại là 500 (log đầy đủ ở console). */
export function apiErrorHandler(err: unknown, res: Response): void {
  const status = err instanceof ApiError ? err.status : 500
  if (status >= 500) {
    console.error('[api]', err)
  }
  res.status(status).json({ error: err instanceof Error ? err.message : 'Lỗi không rõ.' })
}
