# qqlearn

**qqlearn** — PWA (Vite + React + TypeScript) sổ tay học tập **đa môn** để ghi chú
và theo dõi việc học hằng ngày: bấm giờ buổi học, sổ từ vựng ôn giãn cách, sổ lỗi
sai, sổ điểm theo môn, thống kê + báo cáo tuần. Mỗi môn một màu riêng — TOEIC chỉ
còn là một trong các môn bạn tự định nghĩa. Dữ liệu local-first, dùng offline được.

## Chạy không cần lệnh (dành cho người dùng phổ thông)

- **Trên PC Windows: nhấp đúp file `qqlearn.cmd`.**
  - Lần đầu chạy: tự cài và tự chuẩn bị mọi thứ (vài phút) — chỉ làm đúng một lần.
  - Các lần sau: nhấp đúp là chạy ngay. Cửa sổ hiện địa chỉ
    **PC: http://localhost:5178** và tự mở trình duyệt trên PC.
- **Dùng trên điện thoại** (nối điện thoại vào **cùng Wi-Fi** với PC):
  - quét **mã QR** hiện trong cửa sổ `qqlearn.cmd` khi khởi động, hoặc
  - mở Sổ trên PC → *Cài đặt → Kết nối điện thoại* → bấm **"Hiện mã QR"** rồi quét,
  - mở địa chỉ hiện dưới mã QR bằng trình duyệt điện thoại (menu trình duyệt →
    "Thêm vào Màn hình chính" để cài Sổ như ứng dụng).
- **Dữ liệu**: khi dùng qua server PC, dữ liệu lưu tại **`server/data/qlearn.db`
  trên PC** — sao lưu định kỳ trong *Cài đặt → "Sao lưu toàn bộ vào máy"*.

## App là gì & vòng lặp học hằng ngày

Vòng lặp mỗi ngày của người học:

1. **Lần đầu mở app** — trang *Onboarding* hỏi mục tiêu: học bao nhiêu phút mỗi
   ngày, và cho chọn/tạo các môn đang học (`src/features/onboarding/OnboardingPage.tsx`).
2. **Mở app → trang "Hôm nay"** — vòng tròn tiến độ % mục tiêu trong ngày (tổng số
   phút các buổi học hôm nay / mục tiêu), chuỗi streak tuần, danh sách buổi học đã
   ghi, gợi ý *"Hôm nay nên học gì"*, và form ghi chú cuối ngày
   (`src/features/today/TodayPage.tsx`).
3. **Bấm "Bắt đầu học"** — trang buổi học đếm giờ theo timestamp (không trôi khi
   tab bị treo/điện thoại ngủ), mặc định Pomodoro 25/5 nhưng **thời lượng tự chỉnh**
   (stepper ±5 + nhập tự do), chọn môn học; kết thúc buổi lưu vào sổ
   (`src/features/study/SessionPage.tsx`, `src/features/today/timerLogic.ts`).
4. **Cuối ngày** — điền ghi chú cuối ngày ("Hôm nay học được gì": môn đã học, từ
   mới, lỗi sai, nhận xét), có nút *"Soạn nháp"* tự điền nháp từ dữ liệu hôm nay
   (`src/features/notes/DailyNotePage.tsx`, `src/features/smart/dailyDraft.ts`).
5. **Định kỳ** — ôn từ vựng đến hạn (SRS), xem báo cáo tuần để so với tuần trước.

## Tính năng (nhóm A–E)

### A — Vòng lặp học hằng ngày

- **A1 Onboarding** (`/onboarding`) — đặt mục tiêu hằng ngày + chọn/tạo môn đang
  học; chỉnh lại được sau trong Cài đặt và trang Môn học.
- **A4 Trang "Hôm nay"** (`/`) — ProgressBubble % mục tiêu, streak tuần 7 ô,
  danh sách buổi học hôm nay, nút "Bắt đầu học".
- **A2 Buổi học** (`/hoc/buoi-hoc`) — timer học + nhập tay buổi học; chọn môn;
  Pomodoro cấu hình được trong Cài đặt.
- **A3 Ghi chú cuối ngày** (`/ghichu`) — form "Hôm nay học được gì" + nút "Soạn nháp".
- **A5 Hỏi giờ học khi mở app (check-in)** — khi mở Sổ, app hỏi "Bạn vừa học được
  bao nhiêu phút?" — trả lời được lưu ngay thành một buổi học, cộng vào tiến độ
  hôm nay và thống kê; bật/tắt trong Cài đặt (`CheckinPrompt.tsx`, `checkinLogic.ts`).
- **Môn học** (`/mon-hoc`) — tự định nghĩa môn: tên (duy nhất), màu từ bộ 6 pastel
  định sẵn (mục 5 design-system), mục tiêu phút/ngày riêng tự chỉnh, lưu trữ.
  Môn đã có dữ liệu chỉ lưu trữ được, không xoá (`src/features/subjects/`).

### B — Sổ tay nội dung theo môn (`src/features/notebook/`)

- **B5 Sổ từ vựng** (`/sotay/tu-vung`) — thêm/sửa/xoá từ (nghĩa, ví dụ, môn,
  nguồn) + tìm kiếm + lọc theo môn; **ôn tập flashcard** (`/sotay/tu-vung/on-tap`)
  theo giãn cách Leitner 5 hộp — trả đúng tăng hộp (hạn ôn 1 · 3 · 7 · 16 · 35
  ngày), trả sai về hộp 1 (`srs.ts`).
- **B6 Sổ lỗi sai** (`/sotay/loi-sai`) — ghi lỗi sai theo đề/bài/môn/câu, nguyên
  nhân, giải thích; lọc chưa ôn lại + theo môn; đánh dấu đã ôn.
- **B7** — lọc theo môn + ô tìm kiếm nhanh cho từ vựng, lỗi sai và ghi chú.
- **B8** — đính kèm ảnh trang sách/bài tập (lưu Blob, xem lại trong ghi chú).

### C — Thống kê & động lực (`src/features/stats/`)

- **C9 Thống kê** (`/thongke`) — biểu đồ SVG tự vẽ giờ học theo ngày/tuần/tháng +
  phân bổ theo môn (mỗi môn một màu riêng từ bộ màu môn, không dùng thư viện chart).
- **C10 Sổ điểm** (`/thongke/diem`) — nhập điểm kiểm tra theo môn (một điểm duy
  nhất + nhãn + ghi chú) + đồ thị tiến bộ.
- **C11 Báo cáo tuần** (`/thongke/tuan`) — tổng giờ, từ mới, lỗi sai, so với tuần
  trước + lịch heatmap theo tháng.

### D — Hệ thống (`src/features/system/`, `src/features/settings/`)

- **Cài đặt** (`/caidat`) — mục tiêu hằng ngày, cấu hình Pomodoro, giờ nhắc, địa
  chỉ máy trợ lý (chat RAG), chọn nguồn dữ liệu.
- **C12 Nhắc lịch** — nhắc giờ học + nhắc ghi chú cuối ngày bằng Notification API;
  chưa cấp quyền thì hiện banner ngay trong app; mở lại app được "bù" lời nhắc lỡ
  trong 90 phút (`useReminders.ts`).
- **Xuất dữ liệu** — Markdown (buổi học + ghi chú), CSV (sessions, vocab, mistakes,
  scores — BOM UTF-8 để Excel mở đúng tiếng Việt), **sao lưu JSON toàn bộ mọi bảng
  + ảnh** và khôi phục lại (`exportData.ts`).
- **Hướng dẫn cài PWA** hiển thị trong Cài đặt theo thiết bị (iOS/Android/desktop)
  (`pwaInstall.ts`).

### E — Học thông minh (`src/features/smart/`)

- **D14 "Hôm nay nên học gì"** — thẻ gợi ý trên Home: ưu tiên lỗi sai chưa ôn →
  thẻ SRS đến hạn hôm nay → môn có số giờ ít nhất trong 7 ngày qua
  (`suggestion.ts`).
- **D15 Soạn nháp ghi chú cuối ngày** — `buildDailyDraft()` từ dữ liệu hôm nay;
  RAG lỗi/chưa cấu hình thì tự soạn tại chỗ, không bao giờ treo UI (`dailyDraft.ts`).
- **D13 Chat hỏi đáp RAG** (`/tro-chuyen`) — ⚠️ *đang chờ backend*: UI bong bóng
  chat + lịch hội thoại đã hoàn thành; client gọi `POST {ragBaseUrl}/ask` (timeout
  30s). Backend RAG (FastAPI) theo `docs/thiet-ke-rag-toeic.md` **chưa được dựng**,
  nên app hiển thị trạng thái rõ ràng *"Chưa kết nối máy trợ lý — nhập địa chỉ máy
  trợ lý trong Cài đặt"* và không bao giờ chết khi fetch lỗi (`ragClient.ts`).
  Đây là mục duy nhất chưa dùng được cho đến khi có backend.

## Chạy dự án

```bash
npm install       # cài dependencies
npm run dev       # chạy app chế độ dev (Vite) — http://localhost:5173
npm run build     # tsc -b + build PWA ra dist/ (service worker precache toàn bộ asset)
npm run preview   # phục vụ thử bản build dist/ — http://localhost:4173
npm test          # chạy toàn bộ unit test (Vitest + jsdom + fake-indexeddb)
npm run e2e       # chạy kiểm thử Playwright (e2e/) — tự chạy `npm run dev` trước
npm run server    # (tuỳ chọn) server PC: build TS rồi chạy Express + SQLite ở cổng 5178
```

Ghi chú: ở chế độ dev, Vite proxy `/api` → `http://localhost:5178` nên app dev gọi
server PC được như cùng nguồn (`vite.config.ts`).

## Cài lên điện thoại (PWA)

- **Trên localhost, Chrome/Edge cài được ngay** — mở `npm run dev`
  (http://localhost:5173) hoặc `npm run preview` (http://localhost:4173) rồi bấm
  biểu tượng cài đặt trên thanh địa chỉ.
- **Khi deploy ra ngoài (điện thoại dùng qua mạng), PWA cần HTTPS.** Hai cách phổ biến:
  - *Hosting tĩnh*: bản build trong `dist/` là tĩnh hoàn toàn (precache mọi asset,
    SPA fallback) — kéo thả `dist/` lên Netlify/Vercel/Cloudflare Pages là có HTTPS
    ngay. Manifest đặt `start_url: '/'` nên nên deploy ở gốc domain; nếu deploy vào
    thư mục con (vd. GitHub Pages) cần chỉnh `base` trong `vite.config.ts`.
  - *HTTPS cục bộ*: phục vụ `dist/` bằng máy chủ có TLS, ví dụ
    `caddy file-server --root dist` (tự ký chứng chỉ) hoặc `mkcert` + bất kỳ static
    server nào hỗ trợ `-S/-C` (http-server…). Trên mạng LAN không có HTTPS, trình
    duyệt sẽ không cho cài PWA đầy đủ (xem mục *PC làm server* bên dưới).
- Trong app, trang **Cài đặt** có sẵn hướng dẫn cài theo từng thiết bị
  (iOS: Safari → Chia sẻ → "Thêm vào Màn hình chính"; Android: Chrome → menu ba
  chấm → "Cài đặt ứng dụng").

## Dữ liệu nằm ở đâu?

- **Chế độ mặc định "Trên máy này"**: toàn bộ dữ liệu nằm trong **IndexedDB của
  trình duyệt** (qua Dexie) — nghĩa là **gắn với đúng máy tính/điện thoại và đúng
  trình duyệt đó**. Mở bằng trình duyệt khác, hoặc trên máy khác, sẽ không thấy
  dữ liệu cũ; dọn dữ liệu trình duyệt / chế độ ẩn danh có thể mất dữ liệu.
- Vì vậy nên **sao lưu định kỳ**: vào *Cài đặt → "Sao lưu toàn bộ vào máy"* để tải
  một tệp JSON gồm mọi bảng + ảnh (hoá base64); khôi phục bằng *"Khôi phục từ bản
  sao lưu"* (sẽ thay thế toàn bộ dữ liệu hiện tại — `exportData.ts`).
- **Chế độ "Qua server PC"**: dữ liệu nằm trong SQLite trên máy tính — xem mục tiếp theo.

## Dùng trên máy tính

- **Cài như ứng dụng desktop**: mở Sổ bằng **Chrome hoặc Edge trên Windows**, bấm
  biểu tượng cài đặt ở đầu thanh địa chỉ (bên phải) → *"Cài đặt"* — Sổ mở thành
  cửa sổ riêng như một ứng dụng. Cách này hoạt động ngay trên localhost.
- **Phím tắt** (tự bỏ qua khi đang gõ trong ô nhập — `src/hooks/useHotkeys.ts`):
  - `1`–`4` — đổi 4 tab chính: Hôm nay · Học · Sổ tay · Thống kê.
  - `N` — mở trang ghi chú hôm nay (Ghi chú cuối ngày, `/ghichu`).
- Màn hình rộng ≥768px: sidebar thay thanh tab dưới, Sổ tay dạng master–detail.

## PC làm server — điện thoại dùng qua web

Một PC (Windows/Linux/macOS) chạy server, điện thoại chỉ cần trình duyệt:

1. Trên PC: `npm run build` (tạo `dist/`) rồi `npm run server`. Server Express +
   SQLite lắng nghe `0.0.0.0:5178`, vừa phục vụ bản PWA vừa cung cấp API CRUD cho
   các bảng (gồm môn học), và in rõ URL truy cập: `http://localhost:5178` + các địa chỉ IP LAN của
   máy (`server/src/index.ts`).
2. Trên điện thoại **cùng Wi-Fi**: mở `http://<IP-máy>:5178` (địa chỉ server in ra
   khi khởi động).
3. **Dữ liệu**: khi điện thoại đổi sang nguồn *"Qua server PC"*, dữ liệu lưu trong
   SQLite tại **`server/data/qlearn.db` trên PC** (thư mục tự tạo; đổi được qua biến
   môi trường `QLEARN_DB_PATH` — `server/src/db.ts`).
4. **Đổi nguồn dữ liệu** trong *Cài đặt → Nguồn dữ liệu*: **"Trên máy này"**
   (IndexedDB) hoặc **"Qua server PC"** (gọi API của server). Khi chọn qua server,
   nhập đúng địa chỉ `http://<IP-máy>:5178` — mặc định `localhost:5178` chỉ đúng
   khi dùng trên chính máy PC. Đổi xong app tự tải lại để dựng lại bộ repos
   (`src/data/dataMode.ts`).

Lưu ý: kết nối qua LAN là **HTTP chưa mã hoá** và server không có xác thực — chỉ
dùng trong mạng gia đình tin cậy. Vì chưa có HTTPS, điện thoại qua IP LAN **không
cài được PWA đầy đủ** (một số tính năng như Notification có thể bị chặn); muốn cài
đầy đủ cần phục vụ qua HTTPS (reverse proxy TLS hoặc hosting). **Trên PC, mở qua
`http://localhost:5178` thì được coi là secure context nên mọi tính năng PWA đầy đủ.**

## Cấu trúc thư mục & nâng cấp server

```
src/
  core/       — thuần TypeScript: types, Zod schemas, các ports (interface dữ liệu, gồm SubjectRepo),
                tiện ngày tháng. KHÔNG import React/Dexie/window; server tái sử dụng
                trực tiếp (server/tsconfig.json include ../src/core).
  data/       — lớp dữ liệu: Dexie/IndexedDB (repositories/) + HTTP repos (http/)
                cài CÙNG interface @core/ports. Factory createRepos() chọn impl theo
                chế độ "Trên máy này" / "Qua server PC". UI chỉ gọi `repos` từ '@data'.
  features/   — UI + logic thuần tách file riêng, chia theo nhóm A–E ở trên.
server/       — server PC (Express + SQLite): API CRUD map 1-1 với các ports trong src/core/ports,
                phục vụ dist/ + SPA fallback, POST /api/restore cho bản sao lưu.
```

Điểm mấu chốt: UI chỉ biết `@core/ports`, nên **đổi nơi lưu dữ liệu không phải đổi
UI**. Lộ trình nâng cấp server gồm 3 bước:

1. **HTTP repositories cùng interface** — đã có trong `src/data/http/` (mỗi port một repo,
   một repo cho mỗi port); chế độ "Qua server PC" đang dùng chính bộ này.
2. **Dựng backend RAG (FastAPI)** theo `docs/thiet-ke-rag-toeic.md` — hạ tầng chat
   D13 đã sẵn sàng chờ: nhập địa chỉ backend vào Cài đặt (trường máy trợ lý) là
   `/tro-chuyen` và "Soạn nháp" dùng được ngay, UI không phải sửa.
3. **Đồng bộ đa thiết bị** — các bảng SQLite đã giữ sẵn `id` + `updatedAt` (epoch ms)
   để merge theo thời gian (`server/src/db.ts`); bước tiếp là API đồng bộ 2 chiều
   giữa IndexedDB (Dexie) và SQLite, vẫn đi qua cùng các ports nên UI giữ nguyên.

## Hạn chế đã biết

- **Nhắc lịch chỉ hoạt động khi app đang mở** — lên lịch bằng `setTimeout` trong
  trang, không có background push; khi mở lại app, lời nhắc lỡ trong 90 phút được
  "bù" (`useReminders.ts`).
- **Icon PWA là SVG, iOS cần PNG** — `index.html` đang dùng `<link rel="apple-touch-icon"
  href="/icon.svg">`, trong khi iOS yêu cầu PNG cho apple-touch-icon nên icon thêm
  vào màn hình chính trên iPhone có thể không hiện đúng. Đây là ghi chú tiếp cần
  cân nhắc: tạo bản PNG (192/512px + apple-touch-icon 180px) bổ sung vào `public/`.
- Chat RAG chưa dùng được cho đến khi có backend (xem nhóm E).
- Dữ liệu chế độ "Trên máy này" gắn chặt với trình duyệt — nhớ sao lưu JSON định kỳ.
