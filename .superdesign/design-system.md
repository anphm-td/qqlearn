# Design System — qqlearn (v5)

> v5, 2026-10-03: **đổi hướng app theo NOTE-FIRST** — ghi chú là đối tượng trung tâm của giao diện (kiểu Google Keep / Apple Notes), thời gian học là lớp hỗ trợ. **Mọi chỗ chọn thời gian phải tự chỉnh được** (stepper −/+ và ô nhập tự do, không khoán preset). Giữ nguyên hệ 10 pastel, quy tắc cấm tech, chất "phiếu trả lời" giấy pastel của v4. Vượt lên trên v1–v4 ở mọi điểm mâu thuẫn.

## 1. Product context

**Product**: **qqlearn** — sổ tay ghi chú học tập đa môn trên điện thoại. Note là trung tâm: user ghi nhanh điều vừa học, gắn vào môn, xem lại như bảng ghi chú. Kèm theo: bấm giờ học (thời lượng tự chỉnh), mục tiêu hằng ngày, streak.

**JTBD**: học xong → mở app → ghi ngay 10 giây vào note → note tự gắn môn/màu → cuối ngày có bảng "hôm nay đã học được gì" → bấm giờ để học, thời lượng tự chỉnh.

**Key screens (8)**:
1. Home — bảng ghi chú hôm nay (lưới note card) + thanh ghi nhanh + widget đồng hồ còn lại gọn
2. Soạn ghi chú — editor: tiêu đề, nội dung, gắn môn, loại note, liên kết buổi học
3. Buổi học — **thời lượng tự chỉnh** (stepper ± / preset / nhập số), chọn môn, bắt đầu
4. Onboarding — mục tiêu ngày **tự chỉnh** (bubble + ô nhập số phút khác)
5. Thêm môn học — tên, màu, icon, **mục tiêu riêng tự chỉnh** (stepper, không giới hạn preset)
6. Sổ tay — kho note: tìm kiếm, lọc môn/loại, nhóm theo ngày
7. Thống kê — giờ học + số note đã viết theo tuần
8. Cài đặt — mục tiêu + giờ nhắc **tự chỉnh** (stepper ± quanh thời gian)

Tab bar: Trang chủ · Học · Sổ tay · Thống kê.

## 2. Quy tắc "KHÔNG tech" (giữ từ v4, bắt buộc)

Không font mono/code; không nhãn SECTION/UPPERCASE giãn ký tự; không từ kỹ thuật (API, CSV, cache, version…); không icon công nghệ (chỉ icon đời thường: sách, bút, lá, lửa, sao, tách trà, chuông); bố cục như sổ tay/nhãn dán, không admin dashboard. Nhãn section = chữ thường thân thiện + chấm màu/gạch nhỏ.

## 3. Quy tắc "THỜI GIAN TỰ CHỈNH" (mới, bắt buộc)

Mọi thành phần chọn thời gian phải cho phép **tự chỉnh tự do**, không chỉ chọn среди preset:

- **Stepper −/+**: nút tròn nhỏ, bấm đổi 5 phút; giữ để nhảy nhanh.
- **Ô nhập số trực tiếp**: chạm vào số để gõ bất kỳ giá trị nào (vị trí chèn ghi "nhập số phút").
- Preset bubbles (15/25/45/60) chỉ là gợi ý nhanh, LUÔN kèm đường tự chỉnh.
- Áp dụng cho: thời lượng buổi học, mục tiêu hằng ngày, mục tiêu từng môn, giờ nhắc lịch.

## 4. Hướng thị giác — "bảng note giấy pastel"

- Nền `#FBF6EE`; card trắng **đường đôi 3px trên đầu**; radius 10–12px; separator nét đứt; không gradient/shadow lớn.
- **Note card = đơn vị nguyên tử**: mỗi note có **dải washi màu môn** dán ngang mép trên (chiều cao 8px, hơi lệch góc 1–2°, opacity ~0.85) — chất nhãn dán, nhận diện môn tức thì; trong card: tiêu đề đậm, 2–3 dòng nội dung, hàng chân note (tag loại + giờ, Quicksand nhỏ).
- **Signature (giữ)**: **Đồng hồ "thời gian còn lại" bubble oval trống** — track nét đứt, phần đã học tô texture nét chì teal, giữa ghi số phút còn lại. Trên Home là widget GỌN (bubble nhỏ 96px nằm cạnh nút bắt đầu), không chiếm cả màn.
- Bubble vẫn là hình ngữ pháp cho lựa chọn/checkbox/toggle/progress.
- Không emoji, không pill card, không dark mode.

## 5. Color tokens — 10 pastel user (không đổi)

Bộ A: `#F28076` coral · `#FFB6AF` hồng · `#FAE0C7` kem · `#FBC193` đào · `#4EB09B` teal.
Bộ B: `#FFD273` xoài · `#FEE686` vàng nhạt · `#FEC5E6` hồng phấn · `#DEB5D7` tím hồng · `#BFAEE3` tím oải hương.

| Token | Hex | Vai trò |
|---|---|---|
| `--bg` | `#FBF6EE` | Nền app |
| `--card` | `#FFFFFF` | Nền card/note |
| `--rule` | `#F0E6D6` | Viền, đường đôi, track trống, separator nét đứt, washi neutral |
| `--ink` | `#45403A` | Chữ chính |
| `--muted` | `#9A9188` | Chữ phụ, icon thường |
| `--teal` | `#4EB09B` | Màu hành động DUY NHẤT (nút, tiến độ, tab active, chì tô bubble) |
| `--teal-soft` | `#E4F3EF` | Nền teal nhạt |
| `--coral` | `#F28076` | Accent: streak, nhắc, cần chú ý |
| `--pink-soft` | `#FFB6AF` | Nền coral nhạt |
| `--butter` | `#FEE686` | Highlight tô sau chữ — 1 điểm/màn |
| `--lavender` `--mauve` | `#BFAEE3` `#DEB5D7` | Màu phụ/môn/trang trí |
| `--lavender-soft` `#F1ECFA`, `--mauve-soft` `#F7EDF5` | | Nền nhạt |

Màu môn (washtags + chấm + tint): TOEIC `#FFD273`/`#FFF3D9` · Toán `#BFAEE3`/`#F1ECFA` · Tiếng Nhật `#FEC5E6`/`#FFEFF6` · Lập trình `#DEB5D7`/`#F7EDF5` · môn thêm: `#FBC193`/`#FDF0DD` → `#FAE0C7`/`#FBF3E4` → lặp. Teal không dùng làm màu môn (tránh lẫn màu hành động).

## 6. Typography

Display **Bricolage Grotesque** (700/800) — wordmark, tiêu đề, số lớn · Body **Be Vietnam Pro** (400/500/600) — nội dung, nhãn · Data **Quicksand** (600/700) — mọi số liệu. Scale: display 32/40, h2 21/28, body 15/22, caption 12/16. Nhãn section chữ thường 14px 600 + chấm màu/gạch nhỏ. Số liệu Quicksand 700, luôn kèm đơn vị.

## 7. Shape, spacing, motion

Khung 390×844, gutter 16px. Card đường đôi + washi dải 8px trên note card. Bubble: rỗng nét đứt 1.5px, đầy = texture chì. Stepper: nút tròn 32px viền 1.5px `--ink`, số giữa Quicksand 700. Motion duy nhất: bubble tô chì quét 600ms khi mở Home; note card mới hiện bằng scale 0.96→1 nhẹ. `prefers-reduced-motion`: tắt hết.

## 8. Copy & dữ liệu mẫu

100% tiếng Việt thân thiện, chủ động: "Bạn vừa học được gì?", "Lưu vào sổ", "Còn 38 phút", "45 phút". Note mẫu đa môn: TOEIC — "commute, deliberate + 3 từ mới về văn phòng"; Toán — "Định lí Pytago — áp dụng tam giác vuông, sai bài 4 vì quên đổi đơn vị"; Tiếng Nhật — "Kanji N4 bài 5: 勉強 (べんきょう) — học tập"; Tổng kết — "Hôm nay tập trung tốt, mai ôn lại Part 3".

## 9. Ràng buộc kỹ thuật cho draft

Khung mobile 390px, light mode, UI tiếng Việt. Google Fonts: Bricolage Grotesque, Be Vietnam Pro, Quicksand (vietnamese). Dùng Đúng tokens mục 5–7; 10 hex pastel không đổi; không tự tạo màu/font.

## 10. Layout desktop (≥768px)

> Bổ sung 03.10.2026: app dùng tốt trên máy tính. Mobile (<768px) giữ nguyên toàn bộ quy tắc mục 1–9; breakpoint duy nhất là 768px (Tailwind `md:`).

- **Sidebar trái thay TabBar**: từ 768px trở lên, TabBar dưới cùng ẩn; thay bằng sidebar trái cố định rộng ~220px, nền `--bg`, viền phải 1px `--rule`, sticky theo chiều dọc. 4 mục chính (Hôm nay · Học · Sổ tay · Thống kê) đặt trên, nhóm phụ (Tro chuyện · Cài đặt) đặt dưới một đường kẻ ngang `--rule`. Mục active = bubble nền `--teal` chữ trắng; icon line 1.5px như mobile; chân sidebar hiển thị gợi ý phím tắt cỡ caption màu `--muted`.
- **Home "Hôm nay" 2 cột**: tổng rộng tối đa ~960px căn giữa. Cột trái (~40%): ProgressBubble (giữ hiệu ứng tô chì 600ms) + streak tuần 7 BubbleCheck + nút "Bắt đầu học" nền `--teal`; cột phải: danh sách buổi học hôm nay + form "Ghi chú cuối ngày" (NoteCard đường đôi + dải washi như mục 7). <768px giữ layout dọc như cũ.
- **Sổ từ vựng & Sổ lỗi sai dạng master–detail**: danh sách trái ~340px kèm ô tìm kiếm, chi tiết bên phải chiếm phần còn lại; chọn mục bên trái cập nhật pane phải, không điều hướng sang trang riêng. <768px giữ điều hướng danh sách → chi tiết như cũ.
- **Thống kê**: biểu đồ xếp lưới 2 cột (giờ học | phân bổ môn), heatmap và báo cáo tuần chiếm full-width.
- **Tro chuyện · Onboarding · Cài đặt**: cột giữa hẹp 480–720px căn giữa — nội dung dạng đọc/form đọc tốt nhất khi hẹp.
- **Phím tắt cơ bản**: `1`–`4` đổi 4 tab chính, `N` mở ghi chú hôm nay. Tự bỏ qua khi focus đang nằm trong input/textarea/contenteditable. Không thêm phím tắt khác ở phiên bản đầu.
- **Không thêm màu/font mới**: mọi thành phần desktop vẫn dùng tokens mục 5–7; card, bubble, đường đôi, washi, nút giữ nguyên quy cách — chỉ thay đổi bố cục.
