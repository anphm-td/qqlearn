/*
 * Server PC cho qqlearn — chạy bằng `npm run server` (build: `npm run server:build`),
 * hoặc nhấp đúp qqlearn.cmd ở gốc dự án (tự build rồi gọi lệnh này).
 *
 *  - Express + SQLite (node:sqlite builtin), DB tại server/data/qlearn.db;
 *  - API CRUD map 1-1 với các ports trong src/core/ports (validate Zod);
 *  - GET /api/lan — URL LAN + mã QR (SVG) cho mục "Kết nối điện thoại" trong Cài đặt;
 *  - phục vụ bản build PWA (dist/) + SPA fallback về index.html;
 *  - lắng nghe 0.0.0.0:5178 — khởi động in banner: URL PC + từng IP LAN + QR console
 *    cho điện thoại quét; chiếm cổng/EADDRINUSE → thông điệp tiếng Việt + exit 1.
 */
import express, { type ErrorRequestHandler, type Express } from 'express'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defaultDbPath, defaultDistDir, openDb } from './db.js'
import { lanAddresses, lanInfo, terminalQr } from './handlers/lan.js'
import { apiErrorHandler, createApiRouter } from './routes.js'

const PORT = Number(process.env.PORT ?? 5178)
const HOST = '0.0.0.0'

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

  // GET /api/lan — "Kết nối điện thoại" (Cài đặt): URL LAN + QR SVG, không auth,
  // không đụng DB. Dựng trước router chính (router chỉ các bảng dữ liệu).
  app.get('/api/lan', (_req, res) => {
    void lanInfo(PORT)
      .then((info) => res.json(info))
      .catch(() => res.json({ urls: [`http://localhost:${PORT}`], qrSvg: '' }))
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
        .send('qqlearn — API server đang chạy. Chạy "npm run build" để có bản PWA cho server phục vụ.')
    })
  }
  return app
}

/**
 * Banner khởi động — tiếng Việt rõ ràng: URL cho PC, mỗi IP LAN một dòng cho điện
 * thoại cùng Wi-Fi, và mã QR (ký tự console) của URL LAN đầu tiên để quét thẳng.
 */
async function printBanner(dbPath: string, distDir: string, port: number): Promise<void> {
  const lan = lanAddresses(port)
  const primary = lan[0] ?? `http://localhost:${port}`
  const qr = await terminalQr(primary)
  const pwaNote = existsSync(distDir)
    ? distDir
    : `${distDir} — chưa có, chạy "npm run build" để server phục vụ giao diện`
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '  qqlearn — sổ học tập của bạn',
    '',
    `  PC: http://localhost:${port}`,
    ...(lan.length > 0
      ? lan.map((url) => `  Điện thoại (cùng Wi-Fi): ${url}`)
      : ['  Điện thoại (cùng Wi-Fi): (không dò được IP LAN của máy này)']),
    '',
    `  Quét mã QR dưới đây bằng điện thoại — mở: ${primary}`,
  ]
  if (qr !== '') lines.push('', ...qr.split('\n').map((line) => `  ${line}`))
  lines.push(
    '',
    `  Dữ liệu lưu tại: ${dbPath}`,
    `  Giao diện (PWA): ${pwaNote}`,
    '  Để app chạy: đừng đóng cửa sổ này. Dừng: Ctrl+C.',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  )
  console.log(lines.join('\n'))
}

function main(): void {
  const dbPath = defaultDbPath()
  const distDir = defaultDistDir()
  try {
    const db = openDb(dbPath)
    const app = createApp(db, distDir)

    const server = app.listen(PORT, HOST, () => {
      void printBanner(dbPath, distDir, PORT)
    })
    // Lỗi mở cổng (vd. EADDRINUSE) — thông điệp thân thiện, KHÔNG stack trace.
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(
          [
            '',
            `Cổng ${PORT} đang được dùng — có thể qqlearn đang mở ở cửa sổ khác.`,
            'Đóng cửa sổ cũ rồi thử lại.',
          ].join('\n'),
        )
      } else {
        console.error(`Không khởi động được qqlearn: ${err.message}`)
      }
      process.exit(1)
    })
  } catch (err) {
    // Lỗi khởi động khác (vd. mở được dữ liệu) — thông điệp ngắn gọn tiếng Việt + exit 1.
    const reason = err instanceof Error ? err.message : String(err)
    console.error(`Không khởi động được qqlearn: ${reason}`)
    process.exit(1)
  }
}

// Chỉ main() khi chạy trực tiếp (npm run server); test import handler/db — không đụng file này.
const isEntry = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isEntry) {
  main()
}
