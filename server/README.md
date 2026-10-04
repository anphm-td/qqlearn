# server/ — Server PC (F21) + lộ trình nâng cấp

## Chạy server PC

```
npm run server          # = npm run server:build (tsc) + node server/dist/server/src/index.js
npm run server:build    # chỉ build TypeScript của server
```

Server viết bằng **TypeScript** (cấu hình riêng `server/tsconfig.json`, emit vào
`server/dist/`). Khởi động **Express + SQLite** (`node:sqlite` builtin — Node 24+)
tại `0.0.0.0:5178`, in rõ URL truy cập khi mở: `http://localhost:5178` + địa chỉ
**IP LAN** (điện thoại cùng Wi-Fi dùng địa chỉ này, ví dụ `http://192.168.1.10:5178`).

- Phục vụ bản build PWA (thư mục `../dist` — chạy `npm run build` trước) + SPA
  fallback về `index.html`; cài PWA xong vẫn dùng được qua server này.
- Cung cấp API CRUD cho **9 bảng** map 1-1 với 9 ports trong `src/core/ports`:
  `settings · sessions · dailyNotes · vocab · srsCards · mistakes · scores ·
  photos · chatMessages` (mọi lệnh đọc/ghi nằm dưới `/api/…`), cộng thêm
  `POST /api/restore` (RestoreRepo) — khôi phục toàn bộ bản sao lưu trong MỘT
  transaction SQLite (BEGIN/COMMIT/ROLLBACK): xoá sạch rồi ghi, lỗi giữa chừng
  thì rollback; `syncMode`/`serverUrl` của máy không bị restore ghi đè.
- Request/RESPONSE validate bằng **Zod schemas của `@core/schemas`**
  (`server/src/schemas.ts` khai báo lại theo input/response; ảnh truyền base64
  trong JSON và lưu cột BLOB). Lưu ý Zod v4: schema PATCH một phần phải ĐÈ
  `.default()` bằng `.optional()` — `.partial()` không tắt default, key vắng mặt
  vẫn bung giá trị default khi parse (xem `settingsPatchSchema`).
- Dữ liệu nằm ở `server/data/qlearn.db` (tự tạo lần đầu; đã gitignore).
  Đổi chỗ khác được qua biến môi trường `QLEARN_DB_PATH` (và `QLEARN_DIST_DIR`
  cho thư mục dist).

## Cấu trúc

```
server/
  tsconfig.json     build riêng bằng tsc (rootDir = gốc dự án để dùng src/core)
  src/db.ts         mở SQLite + schema 9 bảng (giữ id/date + updatedAt)
  src/schemas.ts    Zod request/response — khai báo lại từ src/core/schemas.ts
  src/rows.ts       hàng SQLite ↔ JSON (boolean 0/1, JSON text, BLOB ↔ base64)
  src/handlers/     module thuần (db, …) — test gọi thẳng, không cần mở cổng
                    (restore.ts: khôi phục all-or-nothing trong 1 transaction)
  src/routes.ts     router Express: map endpoint ↔ port, lỗi ra JSON {error}
  src/index.ts      bootstrap: static dist + SPA fallback + listen + in URL
  tests/api.test.ts vitest: SQLite in-memory, gọi handler trực tiếp (npm run test)
```

## Chọn chế độ dữ liệu trong app

**Cài đặt → Nguồn dữ liệu**:

- **Trên máy này** — mặc định. Mọi dữ liệu trong IndexedDB (Dexie) của máy,
  dùng offline được.
- **Qua server PC** — repos gọi server ở ô "Địa chỉ server PC" (mặc định
  `http://localhost:5178`). Bấm "Áp dụng và tải lại Sổ" để chuyển. Khi đang ở
  chế độ server, Home hiện banner "Dữ liệu qua server PC — <serverUrl>".

Cơ chế: lựa chọn lưu vào `Settings.syncMode` + `Settings.serverUrl`
(`@core/types`); bản sao đọc nhanh (localStorage — `src/data/dataMode.ts`) để
`createRepos()` (`src/data/index.ts`) chọn bộ impl lúc khởi động mà không cần
đọc DB trước. Mọi HTTP repo (`src/data/http/*`) cài **ĐÚNG interface ports** của
`@core/ports` (fetch + timeout 10s), nên UI không đổi gì khi đổi chế độ.
Chế độ dev (vite :5173) đã cấu hình proxy `/api` → `http://localhost:5178`.

## Quy ước giữ vững bền

- Bảng khoảng ôn SRS **1 · 3 · 7 · 16 · 35 ngày** xuất hiện ở 3 nơi phải đổi
  cùng nhau: `server/src/handlers/srs.ts` (`BOX_INTERVALS`), `src/data/
  repositories/dexieSrsRepo.ts`, `src/features/notebook/srs.ts`.
- Mọi entity có `id` + `updatedAt` (epoch ms) phục vụ đồng bộ/merge về sau.

## Lộ trình nâng cấp tiếp theo

1. **GIỮ NGUYÊN `src/core/`** — types, Zod schemas và 9 ports là hợp đồng dùng
   chung. Không sửa UI.
2. Đồng bộ 2 chiều local ↔ server: so khớp `updatedAt`, thêm bảng `sync_queue`
   nếu cần.
3. **Backend FastAPI cho RAG** theo `docs/thiet-ke-rag-toeic.md` (mục 11.2:
   `POST /ask` — client đã gọi đúng endpoint tại `src/features/smart/ragClient.ts`,
   địa chỉ đọc từ `settings.ragBaseUrl`). Điểm ghép chéo đã sẵn:
   `src/features/smart/SuggestionCard.tsx` (Home) và nút "Soạn nháp" trong form
   ghi chú cuối ngày.
