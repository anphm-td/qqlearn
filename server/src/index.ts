/*
 * Server PC cho Sổ học TOEIC — chạy bằng `npm run server` (build: `npm run server:build`).
 *
 *  - Express + SQLite (node:sqlite builtin), DB tại server/data/qlearn.db;
 *  - API CRUD cho 9 bảng map 1-1 với 9 ports trong src/core/ports (validate Zod);
 *  - phục vụ bản build PWA (dist/) + SPA fallback về index.html;
 *  - lắng nghe 0.0.0.0:5178 — khởi động in rõ URL truy cập: localhost + IP LAN
 *    (điện thoại cùng Wi-Fi dùng địa chỉ LAN để mở Sổ).
 */
import express, { type ErrorRequestHandler, type Express } from 'express'
import { existsSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defaultDbPath, defaultDistDir, openDb } from './db.js'
import { apiErrorHandler, createApiRouter } from './routes.js'

const PORT = Number(process.env.PORT ?? 5178)
const HOST = '0.0.0.0'

/** Các địa chỉ IP LAN (IPv4, không loopback) của máy — cho điện thoại cùng Wi-Fi. */
export function lanAddresses(port: number): string[] {
  const urls: string[] = []
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) urls.push(`http://${net.address}:${port}`)
    }
  }
  return urls
}

/** Ứng dụng Express — tách riêng để test dựng được mà không mở cổng. */
export function createApp(
  db: ReturnType<typeof openDb>,
  distDir: string = defaultDistDir(),
): Express {
  const app = express()
  app.disable('x-powered-by')

  // Ảnh truyền base64 trong JSON → cần limit cao.
  app.use(express.json({ limit: '25mb' }))

  // CORS cho /api — PWA ở chế độ dev (vite :5173) gọi thẳng server này được.
  app.use('/api', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    if (req.method === 'OPTIONS') {
      res.sendStatus(204)
      return
    }
    next()
  })

  app.use('/api', createApiRouter(db))
  app.use('/api', ((err, _req, res, _next) => apiErrorHandler(err, res)) as ErrorRequestHandler)

  if (existsSync(distDir)) {
    // PWA tĩnh + SPA fallback — mọi GET không phải /api trả index.html.
    app.use(express.static(distDir))
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) {
        next()
        return
      }
      res.sendFile(join(distDir, 'index.html'))
    })
  } else {
    app.get('/', (_req, res) => {
      res
        .status(200)
        .send('Sổ học TOEIC — API server đang chạy. Chạy "npm run build" để có bản PWA cho server phục vụ.')
    })
  }
  return app
}

function main(): void {
  const dbPath = defaultDbPath()
  const distDir = defaultDistDir()
  const db = openDb(dbPath)
  const app = createApp(db, distDir)

  app.listen(PORT, HOST, () => {
    const lan = lanAddresses(PORT)
    const pwaNote = existsSync(distDir)
      ? `${distDir}`
      : `${distDir} — chưa có, chạy "npm run build" để server phục vụ giao diện`
    console.log(
      [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '  Sổ học TOEIC — server PC đang chạy',
        `  Máy này:        http://localhost:${PORT}`,
        `  Máy khác (LAN): ${lan.length > 0 ? lan.join('   ') : '(không thấy IP LAN)'}`,
        `  SQLite:         ${dbPath}`,
        `  PWA (dist):     ${pwaNote}`,
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ].join('\n'),
    )
  })
}

// Chỉ main() khi chạy trực tiếp (npm run server); test import handler/db — không đụng file này.
const isEntry = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isEntry) {
  main()
}
