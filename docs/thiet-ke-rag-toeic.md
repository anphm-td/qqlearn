# THIẾT KẾ HỆ THỐNG RAG TOEIC — TÀI LIỆU HỢP NHẤT

> Tài liệu này hợp nhất 5 thiết kế phân hệ: **(1) Nạp tài liệu (Ingestion)**, **(2) Chunking**, **(3) Chống trùng lặp (Dedup)**, **(4) Truy xuất (Retrieval)**, **(5) Sinh câu trả lời (Answer Generation) + khung triển khai**.
>
> Quy ước: những điểm mà các tài liệu nguồn mâu thuẫn nhau được đánh dấu **[CHỐT HỢP NHẤT]** kèm lý do ngay tại chỗ; danh sách đầy đủ ở **Phụ lục B**. Các bảng tham số tổng hợp nằm ở **Phụ lục A**; schema SQLite hợp nhất nằm ở **mục 12**.

---

## Mục lục

1. Mục tiêu hệ thống và phạm vi
2. Nguyên tắc xuyên suốt
3. Trạng thái môi trường đã kiểm chứng
4. Bảng quyết định kiến trúc tóm tắt
5. Kiến trúc tổng thể
6. Phân hệ 1 — Nạp tài liệu (Ingestion)
7. Phân hệ 2 — Chunking
8. Phân hệ 3 — Chống trùng lặp (Dedup)
9. Phân hệ 4 — Truy xuất (Retrieval)
10. Phân hệ 5 — Sinh câu trả lời (Answer Generation) + LLM local-first
11. Giao diện sử dụng (CLI + API)
12. Schema dữ liệu hợp nhất (SQLite + Chroma)
13. Cấu trúc repo, cấu hình và thư viện
14. Ràng buộc Windows & local-first
15. Lộ trình triển khai
16. Kế hoạch đánh giá
17. Phụ lục A — Bảng tham số khuyến nghị tổng hợp
18. Phụ lục B — Các mâu thuẫn đã chốt khi hợp nhất
19. Phụ lục C — Tổng hợp trạng thái kiểm chứng (đã / chưa chạy)

---

# 1. Mục tiêu hệ thống và phạm vi

## 1.1 Mục tiêu

Xây dựng hệ RAG chạy **100% local trên Windows** (workspace `E:\PROJECT\rag_toeic`) phục vụ luyện thi TOEIC L&R, trên corpus gồm: đề ETS chính thức (PDF, phần lớn scan), đề/mock do trung tâm soạn (thường gộp nhiều đề trong 1 file), sách chiến thuật và ngữ pháp (Hackers, Longman, Barron's…), file tổng hợp câu hỏi của cộng đồng, wordlist (600 Essential Words, XLSX/CSV, flashcard APKG), transcript SRT và ZIP audio.

Hệ phải phục vụ 6 use case lõi:

| Use case | Cần LLM? | Đường xử lý chính |
|---|---|---|
| Tra "câu N đề M" (vd "giải thích câu 134 đề 3 ETS 2022") | Không | SQLite metadata — đường nhanh < 1s |
| Hỏi đáp nội dung đề (paraphrase, suy luận) | Có | Hybrid retrieval + rerank + LLM có citation |
| Giải thích 1 câu cụ thể | Có (có fallback) | Metadata fetch + hybrid + LLM; extractive nếu LLM chết |
| Luyện theo Part (bộ câu hỏi ngẫu nhiên, chấm điểm) | Không (chấm); Có (giải thích sâu) | SQLite fetch → answer key |
| Tra từ vựng (wordlist đã merge) | Không | SQLite `word_canon` + FTS5 |
| Tìm đề/passage theo nội dung | Không | BM25 aggregate theo `test_id` |

Bốn mục tiêu chất lượng cốt lõi:

1. **Truy vấn chính xác theo metadata tuyệt đối** — mọi truy vấn dạng "câu 134 đề 3 ETS Vol 2" quy về `(part, question_number, test_id)` và đi đường nhanh không LLM, luôn hoạt động kể cả khi LLM chết.
2. **Trả lời có trích dẫn, chống hallucination** — mọi khẳng định kèm `[n]` trỏ nguồn (số đề, Part, chunk); thiếu nguồn → abstain trung thực thay vì bịa.
3. **Chống trùng lặp 3 lớp** — cùng đề nạp qua nhiều bản scan/tái bản/file tổng hợp phải quy về một canonical, không nhân bản trong vector index, vẫn truy vết được mọi nguồn.
4. **Idempotent + resumable mọi lúc** — nạp lại file đã nạp (kể cả đổi tên, bản scan khác) không sinh duplicate; crash giữa chừng OCR hàng trăm trang chạy tiếp từ checkpoint.

## 1.2 Phạm vi

**Trong phạm vi (input nạp được):** PDF native, PDF scan (OCR), DJVU, ảnh JPG/PNG chụp trang, DOCX, EPUB, TXT/MD (kể cả file cũ TCVN3/VNI — tự chuyển mã), SRT, XLSX/CSV, APKG (Anki), ZIP audio (chỉ metadata, không ASR).

**Ngoài phạm vi v1:** ASR cho audio (chỉ map audio ↔ transcript qua duration/naming), embed ảnh Part 1 (chỉ lưu `image_ref` + caption), upload nội dung ETS/đề leak lên cloud API (ràng buộc bản quyền — xem mục 10.5), CI cloud (regression gate chạy local).

---

# 2. Nguyên tắc xuyên suốt

## 2.1 Bốn nguyên tắc của phân hệ nạp tài liệu (áp cho toàn hệ)

1. **Idempotent 4 lớp** — tầng file (`file_sha256`), tầng nội dung chuẩn hoá (`content_sha256`), tầng chunk (`chunk_id` ổn định), tầng nội dung fuzzy (dedup gate S9). Nạp lại file đã nạp không bao giờ sinh duplicate, bất kể đổi tên hay bản scan khác.
2. **Resumable theo trang** — checkpoint SQLite (`ocr_pages`, `ingest_jobs`), crash giữa chừng OCR hàng trăm trang không phải chạy lại từ đầu.
3. **Không nạp thầm** — parse lệch format → `needs_review` + lý do, không bao giờ lọt vào index.
4. **Neo metadata vào question_item** — mọi truy vấn dạng "câu 134 đề 3 ETS Vol 2" quy về `(part, question_number, test_id)`.

## 2.2 Bốn nguyên tắc điều phối của phân hệ chống trùng lặp

5. **Dedup trước khi ghi index** — chunk trùng không bao giờ được embed 2 lần vào vector store.
6. **Idempotent theo hash nội dung chuẩn hoá, KHÔNG theo tên file hay hash byte thô** — cùng đề nạp qua PDF và DOCX phải ra cùng kết quả.
7. **Không bao giờ DELETE** — chunk/tài liệu thua cuộc chỉ bị đánh dấu `status='duplicate_of'`/`'superseded'`; mọi thứ truy vết được, merge sai có thể hoàn tác.
8. **Sai-merge nguy hiểm hơn trùng-lọt** — merge nhầm 2 nội dung độc lập = mất nội dung; lọt 1 bản trùng chỉ gây index bloat. Auto-merge chỉ ở ngưỡng rất cao; vùng xám đẩy vào `review_queue` chứ không tự quyết.

## 2.3 Ràng buộc môi trường đặt trước

- Windows, hệ file case-insensitive, MAX_PATH 260 → mọi I/O dùng `pathlib.Path` tuyệt đối; path dài dùng prefix `\\?\`; so sánh path qua bản lowercase.
- Local-first: nội dung đề ETS/leak không rời máy; model embedding tải 1 lần về `HF_HOME` rồi offline hoàn toàn.
- Máy đích kiểm chứng: Python 3.14.6, 16 logical CPU AMD Zen 3 — **khuyến nghị venv Python 3.11/3.12** cho stack ML (wheel torch/faiss ổn định nhất); 3.14 dry-run resolve được nhiều wheel nhưng chưa test cài thực tế.

---

# 3. Trạng thái môi trường đã kiểm chứng

> Các lệnh dưới đây được chạy lại trực tiếp trên máy đích **trong phiên hợp nhất này** (ngày 2026-10-03) và khớp với kết quả ghi trong các tài liệu nguồn.

| Lệnh đã chạy | Kết quả |
|---|---|
| `python --version` | **Python 3.14.6** |
| `pip --version` | **pip 26.2.1** |
| `where tesseract` | **Không tìm thấy** → Tesseract chưa cài, bắt buộc cài (bản UB-Mannheim) trước khi triển khai OCR |
| `ls -la E:/PROJECT/rag_toeic` | Workspace trống (chỉ `.zcode/`, `.zcodeignore`) — thiết kế là design-only |
| `python -c "importlib.util.find_spec(...)"` × 18 module | **Có sẵn:** `pandas`, `lxml`, `charset_normalizer`, `tiktoken`. **Thiếu:** `fitz` (PyMuPDF), `python-docx`, `ebooklib`, `pytesseract`, `paddleocr`, `faiss`, `chromadb`, `sentence_transformers`, `rapidfuzz`, `pikepdf`, `datasketch`, `srt`, `bs4`, `pypdf` |

Hệ quả thiết kế:

- (a) Cài **Tesseract 5 UB-Mannheim** (installer Windows chuẩn, kèm language data; tải `tessdata_best` cho `eng`/`vie`);
- (b) **Tạo venv riêng trên Python 3.11 hoặc 3.12** — 3.11/3.12 là vùng wheel đầy đủ nhất cho cả stack (`faiss-cpu`/`paddlepaddle`/torch thường có wheel chậm hơn nhiều so với CPython mới nhất);
- (c) Các phiên thiết kế nguồn đã chạy thêm (không lặp lại trong phiên hợp nhất): đo token 7 mẫu TOEIC-style bằng `tiktoken` + tokenizer e5 (bảng ở mục 7.2); check FTS5 → `FTS5_OK` SQLite 3.50.4; `pip index versions` → chromadb 1.5.9, sentence-transformers 6.1.0, FlagEmbedding 1.4.2, faiss-cpu 1.15.1, datasketch 2.0.0, simhash 2.1.2, mmh3 5.3.1, rapidfuzz 3.14.6; `pip install --dry-run --no-deps` resolve được mmh3/simhash/datasketch/RapidFuzz trên 3.14.

---

# 4. Bảng quyết định kiến trúc tóm tắt

> Mỗi dòng một quyết định lớn của hệ thống. Các dòng **[CHỐT]** là nơi các tài liệu nguồn chọn khác nhau và đã được quyết ở đây — chi tiết đối chiếu ở Phụ lục B.

| # | Hạng mục | Quyết định | Lý do ngắn |
|---|---|---|---|
| A1 | Vector store | **ChromaDB 1.5.9 embedded**, 2 collections `toeic_child` + `toeic_parent`, HNSW cosine (M=32, ef_c=200, ef_search=128) **[CHỐT]** | Filter metadata native (`where`), quy mô 50k–200k chunk là dư sức; bottleneck thật của hệ là OCR + embedding (giờ), không phải vector search (ms). Thay quyết định FAISS ở tài liệu nguồn P1-S10 và P5-B2 |
| A2 | Embedding | **`BAAI/bge-m3`** 1024-d, L2-normalize, encode `max_length=512`, không cần prefix **[CHỐT]** | Cross-lingual VI↔EN là nhu cầu lõi (người học hỏi tiếng Việt trên đề tiếng Anh); cùng họ với reranker; MIT; không prefix = ít bug tích hợp. Thay e5-base (P1/P2), e5-large (P5); tokenizer XLM-R nên bảng đo token của e5 áp dụng được |
| A3 | Reranker | **`BAAI/bge-reranker-v2-m3`** (CrossEncoder, CPU, top-20 mặc định) | Cross-encoder chấm đồng thời (query, passage) — bù chính xác lệch ngôn ngữ query-VN/content-EN; chunk nhỏ dễ trùng chủ đề nên bi-encoder phân biệt yếu |
| A4 | BM25 | **SQLite FTS5** (`porter unicode61 remove_diacritics 2`) + cột `text_nodiacritic` tự fold tiếng Việt bằng Python **[CHỐT]** | Stdlib, đã test chạy (`FTS5_OK`); `remove_diacritics` của FTS5 không fold đủ tiếng Việt (P5 đúng — `đ`, tổ hợp dấu VN) nên phải có cột tự chuẩn hoá |
| A5 | Metadata SSOT | **1 file SQLite `data/rag.sqlite3`** — schema hợp nhất (mục 12); Chroma chỉ giữ vector + metadata phẳng | Backup/migrate 1 file; mọi quan hệ (parent, provenance, alias) join trong SQLite |
| A6 | OCR | **Tesseract 5** (`--oem 1 --psm 3/6`, tessdata_best `eng`/`eng+vie`/`vie`), render 300 DPI; **PaddleOCR fallback** khi page mean conf < 60 | LSTM chính xác hơn legacy; fallback có điều kiện vì paddle nặng ~1-2 GB; trang fail (>10%) → cả file `needs_review` |
| A7 | PDF parser | **PyMuPDF** (`fitz`) chính; `page.find_tables()` cho bảng; pdfplumber fallback; repair 1 lần bằng pikepdf | Nhanh nhất, xử lý tốt path Unicode Windows, `get_text("dict")` trả spans font/size = tín hiệu heading |
| A8 | Chunking | **Structure-first theo unit TOEIC** (question_item / passage / talk / word_entry / lesson); chỉ prose tự do cắt theo token budget; cap embed 512 token, overlap chỉ cho size-based (60 token) | Biên chunk = biên cấu trúc TOEIC; chunk cố định làm đứt quan hệ question ↔ passage |
| A9 | Dedup | **3 lớp**: L1 doc (file_sha256 + content_sha256 + MinHash/LSH + bảng J 0.90/0.75); L2 chunk (`qi_key` exact → SimHash ≤ 6 bit → cosine); L3 cổng chấp nhận/version + canonical + provenance. MinHash shingle: **word 5-gram doc-level, char 5-gram chunk-level** **[CHỐT]** | Xếp tầng rẻ → đắt; cosine multilingual là tầng duy nhất bắt được trùng chéo EN↔VI; tái sử dụng vector store chính, không dựng index dedup riêng |
| A10 | Retrieval | Hybrid **dense (Chroma) ⊕ sparse (FTS5)** → Weighted RRF k=60 (dense 0.6 / bm25 0.4, theo intent) → rerank → parent expansion → context pack ≤ 6k token | BM25 chủ lực cho exact term (tên ngữ pháp, số câu), dense chủ lực cho paraphrase; RRF không cần normalize score |
| A11 | Query routing | Router regex 8 intent (rules trước, LLM fallback); `exact_item` đi đường nhanh SQLite | Pattern số câu/đề không được để LLM bóp méo; 4/6 use case không cần LLM |
| A12 | LLM | **Ollama `qwen2.5:7b-instruct-q4_K_M`** (14b khi RAM ≥ 16 GB; 3b dự phòng; `gemma2:9b` phương án thay thế), `num_ctx=8192`, `temperature=0.15` | Tiếng Việt tốt nhất lớp 7B open-weight trên Ollama; `num_ctx=8192` bắt buộc — mặc định 2048 sẽ cắt ngầm context → hallucination |
| A13 | Chống lỗi LLM | tenacity retry + circuit breaker tự viết + degradation ladder (7b → 3b → extractive fallback không LLM) | 4/6 use case không cần LLM → hệ luôn usable |
| A14 | Cloud API | `allow_cloud=false` mặc định; chỉ bật per-request khi **mọi chunk trong context có `cloud_ok=1`**; use case cloud hợp lệ duy nhất ngoài đó là rewrite query (chỉ gửi câu hỏi người dùng) | Ràng buộc bản quyền: không upload nội dung ETS/leak |
| A15 | Ngôn ngữ truy vấn | Đa ngôn ngữ VI/EN; detect `lang` bằng lingua + rule dấu phụ; FTS5 có cột không dấu | Query VI trên content EN là case lõi |
| A16 | Giao diện | CLI `typer`+`rich` (`toeic`) + FastAPI :8300 (loopback only) | Streaming first token; local không cần CORS |
| A17 | Ngôn ngữ lập trình | Python, venv **3.11/3.12** (khuyến nghị), toàn bộ I/O `pathlib` | Vùng wheel đầy đủ nhất cho stack ML trên Windows |
| A18 | Đánh giá | Golden set QA 120 câu (nhóm A–E) + golden retrieval (Recall@10/MRR@10) + gold set dedup 2.500 cặp + sentinel queries; regression gate local | Ba lớp đo: retrieval, generation, dedup — mỗi lớp có ngưỡng pass rõ |

---

# 5. Kiến trúc tổng thể

## 5.1 Sơ đồ kiến trúc

```
                ┌──────────────────────────────────────────────────────────────┐
                │   NGƯỜI DÙNG     CLI (toeic ask/explain/practice/vocab/find)  │
                │                  API  FastAPI http://127.0.0.1:8300           │
                └────────┬──────────────────────────────────────┬───────────────┘
                         │ query (VI/EN)                        │ render + citation (stream)
                         ▼                                      ▲
   ┌─────────────────────┴──────────────────────────────────────┴───────────────────┐
   │ TRUY XUẤT (mục 9)                         │ SINH CÂU TRẢ LỜI (mục 10)          │
   │  B1 Intent Router (8 intent, regex→LLM)   │  B5 PromptBuilder (SYSTEM + [n])    │
   │  B2 Hybrid: Chroma dense ⊕ FTS5 BM25      │  B6 LLMRouter → Ollama qwen2.5:7b   │
   │     → Weighted RRF k=60 (0.6/0.4)         │     retry/breaker/degrade ladder    │
   │  B3 Rerank bge-reranker-v2-m3 (top-20)    │  B7 Postprocess citation [n]        │
   │  B4 Parent expansion (SQLite join)        │  Đường nhanh: metadata_lookup (SQL) │
   └─────────────────────┬──────────────────────────────────────┬──────────────────┘
                         │ chunk_id + filters                   │ context pack ≤ 6k tok
                         ▼                                      │
   ┌────────────────────────────────────────────────────────────┴──────────────────┐
   │ LƯU TRỮ LOCAL  (E:\PROJECT\rag_toeic\data)                                    │
   │  rag.sqlite3  — SSOT: chunks · documents · works · tests · chunk_sources      │
   │                 chunk_links · dedup_matches · review_queue · chunks_fts (FTS5)│
   │                 emb_cache · test_alias · word_canon · ocr_pages · index_queue │
   │  chroma/      — toeic_child + toeic_parent (bge-m3 1024-d, cosine, HNSW)      │
   │  store/raw    — file gốc content-addressed theo sha256                        │
   │  store/images — ảnh Part 1 đã render                                          │
   │  .models/hf   — HF_HOME: bge-m3, bge-reranker-v2-m3 (offline cache)           │
   └─────────────────────▲─────────────────────────────────────────────────────────┘
                         │ chunk có metadata đầy đủ, sẵn sàng enqueue (index_queue)
   ┌─────────────────────┴─────────────────────────────────────────────────────────┐
   │ NẠP TÀI LIỆU (mục 6)  S1 intake → S2 route → S3 extract/OCR (checkpoint       │
   │  theo trang) → S4 normalize → S5 structure parse → S6 validation              │
   │  → S7 chunking → S8 enrich → S9 DEDUP GATE (L1+L2, mục 8) → S10 enqueue       │
   │  → Embedding worker: emb_cache lookup → bge-m3 encode → Chroma upsert         │
   │  INPUT: PDF native/scan · DJVU · JPG/PNG · DOCX · EPUB · TXT/MD (TCVN3/VNI)   │
   │         SRT · XLSX/CSV · APKG · ZIP audio                                     │
   └───────────────────────────────────────────────────────────────────────────────┘
```

Điểm neo kiến trúc:

- **SQLite là source of truth duy nhất** cho mọi quan hệ (parent/child, provenance, alias, dedup decisions); Chroma chỉ là chỉ số vector + metadata phẳng — rebuild được từ SQLite + emb_cache mà không cần re-embed.
- **Dedup là các cổng cài vào ingestion pipeline** (S9 + cổng intake S1), không phải bước riêng lẻ — chi tiết mục 8.
- **Mọi chunk truy vấn được đều quy về question_item** kèm chunk-cha (passage/talk) — cấm flatten; retrieval bò 2 tầng lên để kèm ngữ cảnh.
- **Hai đường trả lời**: đường nhanh SQL (metadata_lookup, không LLM) và đường hybrid + LLM — hệ không bao giờ "chết" hoàn toàn.

## 5.2 Luồng dữ liệu một truy vấn điển hình

```
"giải thích câu 134 đề 3 ETS 2022"
  → B1 router: EXACT_ITEM (câu 134 + đề 3 + series ETS 2022)
  → đường nhanh: test_alias("ets 2022 đề 3" → test_id) → SQL chunks WHERE question_number=134
  → trả: question_item + 4 choices + answer + explanation (merge n_sources, ghi nguồn từng bản)
         + parent (passage/talk nếu Part 3/4/6/7) — không LLM, < 1s
  (nếu cần "giải thích sâu": B2 hybrid tìm lesson/chứng cứ bổ sung → LLM tổng hợp có [n])
```
---

# 6. Phân hệ 1 — Nạp tài liệu (Ingestion)

**Ranh giới phân hệ:** nhận file thô (PDF/DOCX/EPUB/TXT/MD/SRT/XLSX/CSV/APKG/ZIP audio) → xuất **chunk có metadata đầy đủ, sẵn sàng enqueue** cho embedding + vector store. Embedding/Chroma thuộc tầng index worker; ingestion chỉ quản lý `index_queue` và áp kết quả dedup.

## 6.0 Sơ đồ luồng nạp tài liệu

```
 FILE THÔ (PDF/DOCX/EPUB/TXT/SRT/XLSX/APKG/ZIP/ảnh)
   │
   ▼
 S1 INTAKE ── tính file_sha256 → copy content-addressed store/raw/{sha[:2]}/{sha}{ext}
   │             ├─ [CỔNG D1] file_sha256 trùng (partial unique, bỏ qua bản failed) → REJECT_SOFT,
   │             │   trả doc_id cũ — skip toàn bộ OCR/parse (idempotent tầng file)
   │             └─ insert documents (ingest_status='pending', ingest_batch_id=uuid)
   ▼
 S2 ROUTE ── sniff magic bytes (bảng 6.1) → chọn parser; PDF hỏng repair 1 lần (pikepdf);
   │          PDF có password → needs_review; thiếu Tesseract binary → fail fast + hướng dẫn cài
   ▼
 S3 EXTRACT ── PDF native: pymupdf (+find_tables, get_toc) │ PDF scan: OCR 300 DPI
   │           Tesseract → (conf < 60) PaddleOCR fallback → (conf < 50) ocr_failed
   │           checkpoint MỖI TRANG vào ocr_pages → crash resume không OCR lại
   │           > 10% trang fail → cả file needs_review
   ▼
 S4 NORMALIZE ── NFC → gộp hyphen ngắt dòng → join line-wrap → lọc boilerplate
   │             (dòng ≤ 80 ký tự lặp ≥ 50% trang [CHỐT] + blacklist cứng) → collapse space
   │             ├─ [CỔNG D2] content_sha256 (hash canonical text) trùng → REJECT_SOFT,
   │             │   thêm alias nguồn vào doc cũ — không nhân bản
   │             └─ else tính content_sha256 mới
   ▼
 S5 STRUCTURE PARSE ── outline/TOC → heading font/style → instruction fingerprint (fuzzy ≥ 85)
   │                    → state machine dãy số câu 1-200 (nguồn chân lý cuối)
   ▼
 S6 VALIDATION ── tổng 200 + dải từng Part đúng → ok; mini → unverified; lệch → needs_review
   │              (+ validation_detail) — KHÔNG enqueue khi mismatch; answer key thiếu → cờ, không chặn
   ▼
 S7 CHUNKING ── theo unit_type (mục 7): question_item/passage/talk/lesson/word_entry/...
   │            parent-child bắt buộc (P3/4→talk, P6/7→passage), cấm flatten
   ▼
 S8 ENRICH ── lang (lingua+rule dấu) · token_count (tokenizer XLM-R) · ocr_conf
   │          · text_sha256 · minhash (char 5-gram, 128 perm) · qi_key · simhash (≥ 80 tok)
   ▼
 S9 DEDUP GATE (CHUNK-LEVEL — Lớp 2 của phân hệ dedup, chi tiết mục 8.3–8.4)
   │    exact qi_key/text_sha256 → drop_b (ghi nguồn) │ fuzzy Jaccard ≥ 0.85 ∨ token_set_ratio ≥ 92
   │    → canonical + chunk_sources │ 0.80–0.85 → similar_to (giữ cả hai)
   │    │ cross-lang EN↔VI → KHÔNG drop, link translates │ wordlist → merge giữ nguồn
   ▼
 S10 INDEX ENQUEUE ── chỉ chunk được duyệt → index_queue (status='queued')
   ▼
 EMBEDDING WORKER (tầng index) ── emb_cache(model|revision|max_length|text) hit? → miss:
     bge-m3 encode (max_length 512, normalize) → INSERT emb_cache → Chroma upsert
     (toeic_child / toeic_parent) → index_queue.status='embedded' (transactional)
```

Bốn cổng idempotency/dedup đánh dấu **[CỔNG D1..D2]** ở S1/S4 + S9 là giao điểm với phân hệ chống trùng lặp — chính sách đầy đủ 3 lớp ở mục 8.

## 6.1 Parse theo từng loại file — công cụ cụ thể trên Windows

Bảng định tuyến S2 (theo **magic bytes**, không tin extension):

| Magic bytes | Loại | Parser chính |
|---|---|---|
| `%PDF-` | PDF (native hoặc scan) | pymupdf → OCR pipeline nếu không có text layer |
| `AT&TFORM` | DJVU | `ddjvu` (djvulibre) convert sang TIFF rồi vào pipeline ảnh |
| JPEG/PNG magic | Ảnh chụp trang | thẳng vào pipeline ảnh → OCR (đúng case xấu nhất: ảnh chụp từng trang sách) |
| `PK\x03\x04` + `mimetype=application/epub+zip` | EPUB | ebooklib + BeautifulSoup4 (lxml) |
| `PK\x03\x04` + `[Content_Types].xml` có wordprocessingml | DOCX | python-docx |
| `PK\x03\x04` + sheet xml / `.apkg` có `collection.anki2` | XLSX / APKG | pandas / sqlite3 |
| UTF-8/BOM/text heuristics | TXT/MD | đọc trực tiếp + chuyển mã |
| SRT block pattern `00:00:0x,000 -->` | SRT | thư viện `srt` (pypi) |
| `PK` chứa `*.mp3/m4a/wav` | ZIP audio | chỉ extract metadata, không ASR |

### 6.1.1 PDF native (có text layer)

- **pymupdf** (import `fitz`) — chọn làm parser chính vì: nhanh nhất trong các thư viện PDF Python, xử lý tốt đường dẫn Unicode có dấu/khoảng trắng trên Windows, và `page.get_text("dict")` trả về **spans kèm font/size/flags** — chính là tín hiệu heading cần cho mục 6.2.
- **Bảng biểu** (Part 7 dạng table, wordlist dạng bảng): `page.find_tables()` (có từ PyMuPDF 1.23.0). Fallback `pdfplumber` chỉ khi `find_tables()` trả rỗng trên trang có đường kẻ bảng — pdfplumber chậm hơn nên không dùng mặc định.
- Probe text layer: lấy 5 trang đầu + 5 trang giữa, nếu median `len(page.get_text().strip()) < 80` ký tự → classify **pdf_scan**, chuyển OCR path. Ngưỡng 80 vì trang đề TOEIC native luôn > 200 ký tự, trang scan OCR-fail thường < 50.
- Ưu tiên thứ tự đọc: **PDF outline** `doc.get_toc()` (trả `[[level, title, page], ...]`) — sách chiến thuật bản số hoá thường có sẵn TOC, là backbone cấu trúc rẻ nhất.

### 6.1.2 PDF scan → OCR (path quan trọng nhất: ETS là nguồn "vàng" nhưng phần lớn scan)

Pipeline 5 bước, đều chạy được CPU Windows:

1. **Render:** `page.get_pixmap(dpi=300)` — 300 DPI cho chiều cao chữ sách ~30-40px, trên ngưỡng khuyến nghị Tesseract (~20px); 200 DPI làm OCR Part 5 với chữ in nghiêng down-số câu xuống dưới 90% accuracy.
2. **Tiền xử lý ảnh** bằng `opencv-python-headless` (bản headless để tránh dependency GUI trên Windows):
   - Grayscale → `fastNlMeansDenoising` (h=10) cho ảnh chụp nhiễu;
   - **Deskew:** đo góc bằng `cv2.minAreaRect` trên toạ độ pixel chữ (sau threshold) — chỉ xoay khi |góc| ∈ [0.5°, 15°]; dưới 0.5° không đáng xoay, trên 15° thường là ảnh chụp lệch hoàn toàn → cần PaddleOCR;
   - Binarize bằng **Sauvola** (window 31, k=0.2) thay Otsu — scan sách có gradient sáng/tối giữa tâm và mép trang, Sauvola ổn hơn.
3. **Tách cột cho scan 2-up** (2 trang sách trên 1 ảnh — rủi ro trùng lặp điển hình của đề scan): tính vertical whitespace projection trên dải giữa trang; nếu có run cột trắng ≥ 4% bề rộng nằm trong ±10% tâm trang và cả hai nửa đều có mực → tách thành 2 ảnh con, OCR riêng, ghép theo thứ tự trái→phải.
4. **OCR Tesseract 5** qua `pytesseract`:
   - `--oem 1` (LSTM-only, chính xác hơn legacy engine);
   - `--psm 3` mặc định (auto page segmentation, tự xử lý cột); `--psm 6` cho trang đã tách cột hoặc trang đơn khối (tăng tốc + ổn định);
   - `-c preserve_interword_spaces=1` để không phá cột A/B/C/D;
   - **Language packs:** tải **tessdata_best** (chính xác hơn tessdata_fast ~1-2% nhưng OCR chỉ chạy 1 lần và resumable — đáng trả). Trang đề thuần Anh: `eng`; trang giải thích song ngữ: `eng+vie`; trang thuần tiếng Việt: `vie` riêng (dấu phụ tiếng Việt dễ hỏng khi trộn model).
   - Lấy **confidence từng word** từ `pytesseract.image_to_data` → tính mean conf của trang và của từng block.
5. **Fallback PaddleOCR** (điều kiện: mean conf của trang từ Tesseract < **60/100**): PaddleOCR có text detection riêng nên xử lý tốt ảnh chụp nghiêng/mờ/hở góc. Chỉ fallback có điều kiện vì paddlepaddle nặng (~1-2 GB) và CPU chậm hơn Tesseract nhiều lần. Nếu cả hai đều conf < 50 → trang đánh dấu `ocr_failed`, không hallucinate text.

### 6.1.3 DJVU và ảnh JPG/PNG

- DJVU: `ddjvu -format=tiff -scale=300 in.djvu out.tiff` rồi đi vào pipeline ảnh ở bước 2. Binding Python `python-djvulibre` cài trên Windows phiền nên dùng binary qua `subprocess`.
- Ảnh: đọc bằng Pillow, **bắt buộc** `ImageOps.exif_transpose()` trước (ảnh chụp điện thoại lưu hướng trong EXIF, sai bước này là OCR text quay ngang).

### 6.1.4 DOCX

- `python-docx`: đoạn văn + style (`Heading 1-3`, bold) là tín hiệu cấu trúc sạch nhất toàn pipeline — đề soạn lại của trung tâm thường dựng từ Word.
- Duyệt body theo đúng thứ tự tài liệu qua `document.element.body` (iter paragraph + table xen kẽ) — nếu chỉ dùng `document.paragraphs` sẽ **mất vị trí bảng**, phá cấu trúc Part 7 dạng table.
- Bảng: `table.rows[i].cells[j].text`, render lại thành text pipe-delimited (`c1 | c2 | c3`) kèm flag `is_table`.

### 6.1.5 EPUB

- `ebooklib` + BeautifulSoup4 (parser `lxml`): đọc theo **spine** (thứ tự đọc thật, không thứ tự alphabetical trong zip).
- TOC EPUB (`book.toc`) là **bookmark cấu trúc miễn phí** cho sách chiến thuật bản EPUB (Lesson → Part → mục chiến thuật) — đưa thẳng vào S5 làm backbone.
- Gỡ tag nhưng giữ `<table>` (render pipe-delimited như DOCX), giữ `<h1-h6>` với level.

### 6.1.6 TXT/MD — chuyển mã tiếng Việt (constraint "file cũ TCVN3/VNI phải chuyển mã trước")

Thứ tự thử codec, mỗi lần **chấm điểm bằng tần suất từ tiếng Việt phổ biến** ("của", "người", "và", "đề", "câu", "ngữ pháp"…) sau decode:

1. `utf-8-sig` (mặc định; BOM có/không đều ăn);
2. `charset_normalizer.from_path().best()` (đã có sẵn trên máy — đã kiểm tra);
3. Heuristic TCVN3/VNI: nếu decode UTF-8 ra tỷ lệ ký tự rác (non-printable, `ï¿½`) > 2% nhưng text chứa marker TCVN3 điển hình (tổ hợp `µ`, `ä`, `ò`, `Ù`) hoặc VNI (`a1`, `o7`, `ee`) → thử `cp1258` (superset gần TCVN3) rồi chấm lại điểm từ-vựng; chọn codec cho điểm cao nhất. Không dùng `chardet` thuần vì nó không phân biệt TCVN3 vs Latin-1 rác.

> Bổ sung từ phân hệ dedup (không mâu thuẫn): TCVN3(ABC)→Unicode dựng module nội bộ bằng bảng map cố định (~134 ký tự, chuẩn công khai, ~50 dòng code) — hiện **không có pip package đáng tin cậy** cho việc này; với `.doc`/`.docx` legacy: LibreOffice headless `soffice --headless --convert-to txt:UTF8` là đường an toàn.

- MD: giữ heading (`#`…`######`) làm tín hiệu cấu trúc; file tổng hợp cộng đồng thường là MD list câu hỏi — heading level 2 thường là "Câu N".

### 6.1.7 SRT (transcript audio đã xử lý)

- Thư viện `srt` (pypi): parse thành list cue (index, start, end, content).
- Gộp cue thành block theo marker câu hỏi nếu có ("Questions 76-78" trong cue text); không có marker thì gộp window 400 token, overlap 50 (giống talk chunking ở mục 7), lưu `time_span` = [start đầu, end cuối] vào metadata chunk.

### 6.1.8 XLSX/CSV/APKG (wordlist) và ZIP audio

- **pandas** `read_excel`/`read_csv` với `dtype=str` (tránh pandas tự đổi "12345" thành số làm hỏng cột ví dụ); mỗi row → word entry (mục 7).
- **APKG**: apkg là zip chứa `collection.anki2` (hoặc `.anki21`) — mở bằng `sqlite3` thuần, bảng `notes`, cột `flds` phân tách bởi `\x1f`; cột `mid` → bảng `models` trong JSON `col.models` để biết thứ tự field (word, nghĩa, ví dụ…). Tự đọc thay vì bắt user export ra CSV.
- **ZIP audio**: chỉ extract **danh sách file + hash + duration** (`mutagen` cho MP3/M4A) — hệ RAG văn bản không cần ASR; duration dùng để kiểm chứng mapping audio ↔ transcript (heuristic: expected_duration ≈ word_count(transcript) / 2.8 từ/giây, chấp nhận sai số ±40% — TOEIC listening ~2.5-3 từ/s).

### 6.1.9 Ràng buộc Windows cụ thể (áp cho TOÀN BỘ I/O của phân hệ)

- **pathlib.Path tuyệt đối**, cấm nối chuỗi `\` hoặc `/` thủ công;
- **MAX_PATH 260**: mọi path nội bộ sinh từ hash nên luôn ngắn; với path gốc user vượt 240 ký tự → ghi cảnh báo và truy cập qua prefix `\?\`;
- **Case-insensitive FS**: so sánh path luôn qua `str(path).lower()` (lưu `source_path_norm` làm key, giữ original path để hiển thị); dedup không bao giờ dựa vào tên file nên rủi ro thấp, nhưng cột `source_path` vẫn lưu nguyên gốc để truy vết;
- **ZIP encoding** (nguồn Hàn có tên file cp437/utf-8): với mỗi entry, nếu `zinfo.flag_bits & 0x800` → tên là UTF-8; ngược lại tên đang bị decode cp437 sai → thử `zinfo.filename.encode('cp437').decode('cp949')`; nếu decode cp949 raise → giữ nguyên cp437. Ghi `encoding_fixed` flag vào metadata file. Tên file KHÔNG được dùng làm key dedup.

## 6.2 Nhận diện cấu trúc TOEIC lúc nạp

### 6.2.1 Thứ tự tín hiệu (rẻ → đắt, tin cậy cao → thấp)

1. **PDF outline / EPUB TOC** — nếu có, dùng làm backbone ranh giới Test/Lesson/Part; title các entry vẫn phải qua regex để phân loại.
2. **Heading qua font** (PDF native + DOCX): PDF — span `size > 1.3 × median(size)` của trang **hoặc** flag bold (bit 16 trong `get_text("dict")`) + độ dài < 100 ký tự; DOCX — style `Heading 1-3`. Kết hợp từ khoá (6.2.2) để gán nghĩa.
3. **Instruction fingerprint** — mỗi Part có câu Directions đặc trưng, chuẩn hoá bởi ETS nên ổn định hơn cả chữ "Part N" (scan hay OCR sai). So bằng `rapidfuzz.partial_ratio ≥ 85` với câu chuẩn (ngưỡng 85 vì OCR sai 1-2 từ vẫn ≥ 85; hạ 80 sẽ bắt nhầm câu thường).
4. **State machine theo dãy số câu 1-200** — tín hiệu mạnh nhất, hoạt động cả khi mọi thứ trên fail.

### 6.2.2 Bộ regex cụ thể (chạy trên text đã NFC + gộp dòng)

```text
# Ranh giới đề
(?i)^\s*(practice\s+test|actual\s+test|test)\s*(\d+|[IVX]+)\b
(?i)^\s*đề\s*(số\s*)?(\d+)
# Ranh giới Part (khi chữ rõ)
(?i)^\s*part\s*([1-7])\b
# Instruction fingerprint (fuzzy ≥85, mỗi Part 1 câu chuẩn)
P1: for each question in this part, you will hear four statements
P2: you will hear a question or statement and three responses
P3: you will hear some conversations between two or more people
P4: you will hear some talks given by a single speaker
P5: choose the (one )?(word or phrase )?that best completes
P6: four answer choices (are )?(given )?(for )?each blank
P7: (read the following|answer all questions following|the questions are based on)
# Số câu + lựa chọn
^\s*(\d{1,3})\s*[.)]?\s+                      # đầu câu hỏi
^\s*\(?\s*([A-D])\s*[).]?\s+                  # option A-D
# Nhóm câu dùng chung transcript/passage (đơn vị chunk-cha)
(?i)questions?\s*(\d{1,3})\s*[–—-]|through|to|đến\s*(\d{1,3})\s*,?\s*(refer to|dùng cho)
# Answer key
(?i)^\s*answer\s*key\s*$   rồi dòng:\s*(\d{1,3})\s*[.)]?\s*([ABCD])\b
# Marker giải thích (EN + VI)
(?i)(explanation|why .{1,30} is (correct|wrong|incorrect)|key word|detailed explanation)
(?i)(giải\s*thích|lời\s*giải|phân\s*tích|dịch\s*câu|chú\s*ý|cấu\s*trúc)
^\s*(câu|question)\s*(\d{1,3})\b              # gắn giải thích về câu
# Cấu trúc passage Part 7 (phân loại email/memo/notice…)
^(From|To|Cc|Subject|Date|Sent)\s*:
(?i)^\s*(memorandum|memo|notice|announcement|advertisement|article|schedule|form|invoice|order form|e-?mail|letter)\b
Dear\s+(Mr\.?|Ms\.?|Mrs\.?|Dr\.?)\s+\w+
# Word entry (sổ từ vựng)
^([A-Za-z][a-z-]{2,})\s*\((n|v|adj|adv|phr)[a-z.]*\)\s*[:.]?\s+
```

Lưu ý Part 2 chỉ có 3 lựa chọn A–C — parser không cứng nhắc giả định 4 choices (bắt từ phân hệ chunking, dùng chung ở đây).

### 6.2.3 State machine theo dãy số câu — vùng chuẩn từng Part

Dải số câu format hiện hành (trùng khớp chuẩn ETS 2016+):

| Part | Vùng câu | Số câu | skill |
|---|---|---|---|
| 1 | 1–6 | 6 | listening |
| 2 | 7–31 | 25 | listening |
| 3 | 32–70 | 39 (13 hội thoại × 3) | listening |
| 4 | 71–100 | 30 (10 talks × 3) | listening |
| 5 | 101–140 | 40 | reading |
| 6 | 141–152 | 12 (4 passages × 3) | reading |
| 7 | 153–200 | 48 | reading |

Hoạt động của machine: duyệt các **numbered line** tuần tự trên toàn văn (không parse theo trang — trang chỉ ghi lại `page_span`):

- Số **tăng liên tục +1** → đang cùng Part;
- Số **reset về 1** (hoặc về 101) giữa file → ranh giới đề mới (bắt đúng case "hay gộp nhiều đề trong 1 file" và file mini test của sách chiến thuật);
- Số **nhảy vùng** (vd 100 → 101) → chuyển listening→reading, kết hợp fingerprint P5 để xác nhận;
- **Nhóm "Questions 76-78 refer to the following conversation"** → mở block `talk` làm chunk-cha, 3 câu kế tiếp có `parent_id` trỏ vào; Part 6/7 tương tự với passage (double passage: 2 block passage liên tiếp trước nhóm câu — phân biệt bằng 2 marker email/notice riêng biệt);
- **Câu mở dở dang** (đã thấy số câu chưa đủ 4 option mà gặp số câu mới): giữ buffer, gắn cờ `answer_options_incomplete` — bắt đúng rủi ro "câu hỏi bị tách qua trang".

### 6.2.4 Số đề (test_number) — chỉ suy từ bằng chứng, không đoán

Thứ tự: (a) bookmark/heading "Practice Test 3" → regex bắt số; (b) thứ tự đếm các test trong file (test thứ 2 của file = test 2 nếu heading không ghi số); (c) tên file `(?i)test\s*(\d+)` chỉ dùng khi (a),(b) thất bại và ghi `test_number_source='filename'` (độ tin cậy thấp nhất); (d) không suy được → `test_number = NULL` + cờ `test_number_unknown`. Không bao giờ sinh số đề từ vị trí trang.

`test_id` sinh theo công thức **[CHỐT HỢP NHẤT]**: `{series_key}_t{test_number}` (vd `ets2023_t2`) — chuỗi dễ đọc, dùng thẳng cho CLI/API; khi `test_number=NULL` → `{series_key}_tunk_{seq}`. (Tài liệu nguồn P1 định danh test bằng uuid, P4/P5 dùng chuỗi dễ đọc — chốt theo chuỗi dễ đọc.)

### 6.2.5 Validation format (constraint bắt buộc "đề parse lệch phải gắn cờ review")

- Full test: tổng đúng 200 và từng Part đúng bảng trên → `validation_status='ok'`;
- Đề rút gọn (phổ biến trong sách chiến thuật): dãy 1→100 hoặc 1→50 → `format='mini'`, `validation_status='unverified'` (nạp bình thường, ghi rõ format);
- Lệch (thiếu câu, trùng số câu, Part không xác định): `validation_status='mismatch'` + `validation_detail` JSON `{expected:{...}, actual:{...}, missing:[…], duplicated:[…]}` → **status needs_review, không enqueue vào index**;
- Cờ review phổ biến: `missing_part_detected`, `question_number_gaps`, `answer_key_missing`, `low_ocr_conf`, `part_unknown`;
- Answer key thiếu không chặn: nạp với `answer=NULL` + cờ `answer_key_missing`.

## 6.3 Metadata model — quy tắc thiết kế

Sơ đồ quan hệ và DDL đầy đủ nằm ở **mục 12 (schema hợp nhất)**. Các bảng phân hệ này sở hữu: `documents`, `works`, `tests`, `chunks`, `chunk_links`, `chunk_sources`, `audio_files`, `ocr_pages`, `ingest_jobs`, `index_queue`. Quy tắc thiết kế giữ nguyên như sau:

- **`chunk_id` ổn định** là chìa khoá idempotency tầng chunk. Công thức hợp nhất **[CHỐT HỢP NHẤT]**: một cột duy nhất, chuỗi dễ đọc ổn định giữa các lần nạp — `{work_key}:{unit_type}:{test_number}:{part}:{qn|seq}` (vd `q_ets2023_t2_p5_134`, `talk_ets2023_t2_07`); với unit ngoài đề: `{work_key}:{unit_type}:{slug}` (vd `word:reimburse`). Nạp lại cùng file sinh đúng lại các chunk_id cũ → `INSERT OR IGNORE` không sinh gì mới, vector record không bị nhân bản. (P1 dùng uuid4 + cột uid riêng, P2 dùng uuid5, P4/P5 dùng chuỗi dễ đọc — chốt một cột chuỗi dễ đọc.)
- **Answer không ghép vào `text`** của question_item (chỉ nằm ở cột `answer`) — tránh leakage đáp án khi retrieval trả đề cho người học luyện tập.
- Mọi chunk **bắt buộc có `lang`**: phát hiện bằng `lingua-language-detector` (chỉ load en+vi cho nhanh) hoặc `fasttext` lid.176; nếu conf < 0.6 → rule dự phòng: tỷ lệ ký tự có dấu tiếng Việt (U+1EA0–U+1EFF) > 5% mà phần lớn từ còn lại ASCII → `mixed`, > 60% ký tự có dấu → `vi`.
- `token_count` tính bằng tokenizer XLM-R (cùng tokenizer family với bge-m3 — xem mục 7.2) để chunking và embedding dùng chung đơn vị.
- Mỗi chunk giữ thêm `text_nodiacritic` (NFKD → bỏ combining marks → đ→d) phục vụ FTS5 (mục 9.3) — cột gốc `text` giữ nguyên dấu để hiển thị và embed.

## 6.4 Pipeline 10 stage — chi tiết từng stage

Đã vẽ tổng thể ở 6.0; đây là các quyết định chi tiết chưa nêu:

### S1 — Intake (idempotency tầng file)
1. Stream-read, tính `file_sha256`;
2. Copy vào `store/raw/{sha[:2]}/{sha}{ext}` (**content-addressed** — tên nội bộ luôn ≤ 150 ký tự, tự chống "copy đổi tên file" và triệt tiêu MAX_PATH);
3. Lookup `documents.file_sha256` (partial index bỏ qua bản failed): hit → ghi thêm ghi chú nguồn mới (chunk_sources) rồi **skip toàn bộ**;
4. Insert row `documents` (`ingest_status='pending'`, `ingest_batch_id = uuid` mỗi lần chạy CLI).

### S2 — Route
Sniff magic bytes (bảng 6.1). File hỏng: nếu magic PDF nhưng `fitz.open()` raise → **repair đúng 1 lần** bằng `pikepdf.Pdf.open(...).save(tmp)` (pikepdf/QPDF rebuild xref) rồi thử lại; vẫn raise → `failed` + `error_json`, **batch tiếp tục file kế** (không chết cả batch). PDF có password → `needs_review` (cờ `password_protected`), không brute-force. Tesseract binary không tìm thấy → fail fast S2 với thông báo cài đặt.

### S3 — Extract (checkpoint theo trang)
- PDF scan: OCR **từng trang**, mỗi trang xong commit ngay `ocr_pages` (status, conf, text_sha256). Restart CLI → trang đã `ok` không OCR lại. Tesseract đơn-thread phần lớn: bật `multiprocessing` pool **2-4 worker chỉ khi file > 20 trang** (spawn cost đáng kể với file ngắn).
- PDF native: extract toàn văn + `get_toc()`; DOCX/EPUB/SRT/XLSX/APKG theo mục 6.1; ZIP audio chỉ metadata (6.1.8).
- Ảnh/JPG/PNG: EXIF transpose → pipeline ảnh.
- Trang `ocr_failed` (cả Tesseract lẫn Paddle đều conf < 50): skip, ghi status; **tổng trang fail > 10% của file → cả file `needs_review`** (OCR âm thầm chất lượng tệ sẽ làm fuzzy-dedup và retrieval sai).

### S4 — Normalize (trước chunk VÀ trước dedup)
1. **Unicode NFC** toàn văn — OCR/extract sinh NFD làm 2 chuỗi "đề" khác byte, hash và dedup sót;
2. Gộp hyphen ngắt dòng: `\w-\n\w` → nối liền (chỉ khi chữ sau viết thường, tránh phá từ ghép chủ ý);
3. Gộp dòng trong block narrative (`\n` → space); giữ `\n` khi dòng bắt đầu bằng pattern số câu/option/heading (tín hiệu cấu trúc);
4. **Lọc header/footer lặp:** dòng (≤ 80 ký tự) xuất hiện trên ≥ **50%** số trang **[CHỐT HỢP NHẤT: P1 đề xuất 60%, P2 50%, P3 30% — chốt 50% làm mặc định, cấu hình trong `thresholds.yaml`; blacklist cứng không đổi]** → boilerplate ("GO ON TO THE NEXT PAGE", số trang, tên sách) + regex trực tiếp `(?i)go\s*on\s*to\s*the\s*next\s*page` và dòng chỉ là số `^\d{1,3}$`. Không để câu lệnh Part ("Mark your answer…") bị dính boilerplate — nó chỉ lặp vài lần trong file, dưới ngưỡng 50%, và là nội dung chunk `instruction` có ý nghĩa;
5. Sửa lỗi OCR dạng TOEIC: chuẩn hoá `A .` → `A.`; trong vị trí số câu ưu tiên diễn giải `l|I` → `1`, `O` → `0` chỉ khi dãy validation lệch;
6. Collapse multi-space.

Sau đó tính `content_sha256 = sha256(NFC-normalized full text)` → **[CỔNG D2]**: hit → bỏ qua S5-S10, chỉ thêm bảng ghi nguồn phụ. Đây là đúng ràng buộc "idempotent theo hash nội dung chuẩn hoá sau OCR/extract, không theo tên file hay hash byte thô".

### S5 — Structure parse
Chạy chiến lược 6.2 (outline → heading → fingerprint fuzzy → state machine dãy số câu). Đầu ra: draft cây `test → part → (talk|passage)? → question_item → options + answer? + explanation?`, mỗi node có page_span. State machine là nguồn chân lý cuối; outline/heading chỉ dùng để cắt nhanh ranh giới lớn.

### S6 — Validation
So dải số câu từng Part (bảng 6.2.3) và tổng 200; mini → `unverified`; lệch → `needs_review` + `validation_detail`, **không enqueue**. Answer key thiếu không chặn: nạp với `answer=NULL` + cờ `answer_key_missing`.

### S7 — Chunking theo unit_type
Xem chi tiết tại **mục 7** (phân hệ chunking). Giao điểm bắt buộc: câu hỏi Part 6/7 **luôn** giữ `parent_id` về passage; Part 3/4 về talk — cấm flatten; answer_key_entry không chunk trần "1. A 2. C" mà gán vào `chunks.answer` theo question_number; ảnh Part 1 render `store/images/{doc_id}/p{n}.png` qua `page.get_pixmap(clip=rect)` và lưu `media_ref`.

### S8 — Metadata enrich
`lang` (lingua + rule dấu phụ), `token_count` (tokenizer XLM-R), `text_nodiacritic`, `ocr_conf` trung bình chunk, sinh **khóa dedup** cho S9 (định nghĩa đầy đủ ở mục 8):
- `text_sha256` (NFC, lowercase, collapse space);
- **MinHash signature** — `datasketch.MinHash`, 128 permutation, **char 5-gram** cho chunk (giữ word 5-gram cho doc-level — [CHỐT HỢP NHẤT], lý do mục 8.3);
- `qi_key` = sha1(norm(stem) + '||A:' + norm(choice_A) + … + '||D:' + norm(choice_D)) — không gồm đáp án, không sort choices;
- `simhash` 64-bit (chỉ chunk ≥ 80 token).

### S9 — Dedup gate (chunk-level)
Điểm giao với phân hệ chống trùng lặp. Phân vai rõ: **ingestion sinh khóa + thực thi quyết định; dedup engine ra quyết định; mọi cặp ghi `dedup_matches` làm audit trail.** Tham số hợp nhất cuối cùng ở mục 8.3–8.4; tóm tắt thứ tự áp dụng tại S9:

1. **Exact:** lookup `text_sha256` → mặc định `drop_b`, ghi nguồn vào `chunk_sources`;
2. **Fuzzy nội ngôn ngữ:** MinHash LSH (threshold 0.80, char 5-gram) — chỉ so trong cùng `unit_type` + cùng `part` (giảm không gian so hàng nghìn lần); candidate → xác nhận: Jaccard ≥ 0.85 ∨ `rapidfuzz.fuzz.token_set_ratio ≥ 92` → trùng (canonical policy); vùng 0.80–0.85 → chỉ gắn `similar_to` (chunk_links), không drop **[CHỐT HỢP NHẤT — hợp ngưỡng P1 (0.80 + rapidfuzz 85) và P2 (0.85 + 92)]**;
3. **Question-level canon:** nhóm question_item trùng theo `qi_key` — chọn **canonical deterministically** (ưu tiên: conf OCR cao nhất → có answer → explanation dài hơn), các bản còn lại `status='duplicate_of'` + `chunk_sources`, **không xóa**; answer khác nhau giữa các bản cùng `qi_key` → `answer_conflict` → `review_queue`;
4. **Chéo ngôn ngữ:** giải thích EN ↔ VI **KHÔNG drop** — match qua (test identity, part, question_number) + cosine ≥ 0.88 (bảng mục 8.3), giữ cả hai với link `translates` và ghi nguồn từng bản; wordlist trùng chéo sách: merge nghĩa/ví dụ vào `word_canon`, giữ `chunk_links` về từng nguồn.

Chunk bị drop không vào index nhưng vẫn nằm trong SQLite để truy vết.

### S10 — Index enqueue + embedding worker
Chỉ chunk được S9 duyệt → `index_queue` (status `queued`). Worker (thuộc tầng index, nêu ở đây để chốt giao diện) — **[CHỐT HỢP NHẤT: Chroma thay FAISS]**:

- Model: **`BAAI/bge-m3`** (1024-d, max_seq 8192 nhưng encode mặc định `max_length=512`, L2-normalize, không cần prefix); phương án tiết kiệm khi máy yếu: `paraphrase-multilingual-MiniLM-L12-v2` chỉ để smoke-test.
- Vector store: **ChromaDB 1.5.9 embedded**, 2 collections `toeic_child` (question_item, explanation, word_entry, exercise_item, image_item) và `toeic_parent` (passage, talk, lesson, theory_point) — xem cấu hình chi tiết mục 9.1.2. Chunk-cha dài quá 512 token → cắt theo câu thành `is_partial` và nhúng từng phần (mục 7.4).
- Ghi `emb_cache` theo `sha256(model_id|hf_revision|max_length|normalize|text)` — re-index không phải re-embed; text đưa vào hash là text đã chuẩn hoá OCR → 2 bản scan khác chất lượng cùng câu trùng key, không embed 2 lần.
- `index_queue` cập nhật `embedded`; transactional để crash không mất rãnh.

### CLI và xử lý lỗi tổng

```
python -m ingest run --input <file|folder>            # nạp mới / resume tự động
python -m ingest review --list                        # xem needs_review + lý do
python -m ingest revalidate --doc-id <id>             # nạp lại sau khi sửa cờ
```

- Mỗi stage bọc try/except → `error_json = {stage, message, traceback_head}`, status tương ứng; retry 2 lần backoff cho lỗi tạm;
- Restart sau crash: `ingest_jobs` cho biết dừng ở đâu; `ocr_pages` cho biết trang nào xong;
- File hỏng vĩnh viễn → `failed`, batch chạy tiếp; file fail được phép nạp lại (partial unique index);
- Tất cả insert dùng `INSERT OR IGNORE`/UPSERT theo key tự nhiên (chunk_id, file_sha256) — idempotent ở mọi mức trùng lặp kể cả thao tác người dùng (nạp trùng file).
---

# 7. Phân hệ 2 — Chunking

## 7.0 Vị trí phân hệ và hợp đồng I/O

- **Input**: plain text đã qua phân hệ OCR/extract + normalize (mục 6.4-S4: gộp hyphen, lọc header/footer, chuyển mã TCVN3/VNI) kèm doc-level info: `doc_path`, `source_type`, `ocr_engine`, `page_map` (vị trí từng trang để ghi `page_span`).
- **Output**: list chunk + metadata + fingerprint → ghi **SQLite `rag.sqlite3` (source of truth)** và **vector store (Chroma, 2 collections)** — schema ở mục 12.
- **Nguyên tắc nền**: biên chunk là biên cấu trúc TOEIC (Part / passage / talk / question item / word entry) — chỉ nội dung prose tự do (lesson, giải thích dài) mới cắt theo token budget + overlap. Lý do: mọi truy vấn người học đều quy về question item, và chunk theo kích thước cố định sẽ đứt quan hệ question ↔ passage.

## 7.1 Chiến lược chia chunk theo cấu trúc TOEIC

### 7.1.1 Bảng quyết định theo `source_type`

| source_type | Nguồn | Đơn vị chunk | Chiến lược | Lý do |
|---|---|---|---|---|
| `ets_test` | Bộ đề ETS chính thức | `question_item`, `talk_block`, `passage_block`, `image_item` | **Cấu trúc** | Nguồn "vàng", chunk chặt nhất theo Part |
| `practice_test` | Đề trung tâm/cộng đồng | như trên + nhận dạng câu trích rời | Cấu trúc | Cùng format, dễ trùng câu với ETS |
| `transcript_expl` | Transcript + answer key + giải thích | `explanation_item`, `talk_block` | Cấu trúc + **map ngược** về question item | Giải thích phải neo vào câu hỏi, không đứng riêng |
| `strategy_book` | Hackers, Longman, Barron's… | `lesson_section` | Heading + **token budget** | Prose dài, truy vấn theo chủ đề ("cách làm Part 5 dạng từ đồng nghĩa") |
| `grammar_book` | Sách ngữ pháp TOEIC | `theory_point` + `exercise_item` | Cấu trúc theo điểm ngữ pháp | Giữ link lý thuyết ↔ bài tập |
| `wordlist` | 600 Essential Words, XLSX/CSV, APKG | `word_entry` | **Entry-based** | Đơn vị nội dung là word entry, merge khi trùng |
| `community_compilation` | "tổng hợp câu Part 5 hay ra" | `question_item` | Cấu trúc (parse câu rời) | Trùng lặp ở question-level, cần quy về canon |

### 7.1.2 Pipeline chunk đề thi theo Part

Segmentation 3 bước:

1. **Locate Part**: regex `PART\s+[1-7]` + dòng directions đặc trưng ("Mark your answer", "respond to the questions"); fallback: dò ranh giới bằng bảng số câu mong đợi (bảng 6.2.3).
2. **Locate question number**: regex `^\s*(\d{1,3})\s*[.)]` đầu dòng, kèm bảng sửa lỗi OCR thường gặp: `l.`/`i.` → `1.`, `Q1G` → số, `®` → ký tự lạ (dùng `rapidfuzz` so chuỗi label với mẫu). Choice marker: `^\s*[ABCD]\s*[.)]` — **lưu ý Part 2 chỉ có 3 lựa chọn A–C**, parser không cứng nhắc giả định 4 choices.
3. **Gom theo anchor câu hỏi**: dòng `Questions?\s+(\d{1,3})(?:\s*[-–~]+\s*(\d{1,3}))?\s+refer to (the following)` là anchor chính quyết định ranh giới passage/talk trong Part 3–7 — đây là marker ổn định nhất trong đề thật, đáng tin hơn dò layout khi OCR kém.

Quy tắc từng Part (tổng 200 câu):

| Part | Số câu | Đơn vị | Quy tắc chunk |
|---|---|---|---|
| 1 | 6 | `image_item` | 1 ảnh + 1 câu transcript = 1 chunk; ảnh lưu `image_ref` (media_ref) + caption OCR trong text |
| 2 | 25 | `question_item` | độc lập, 3 choices; giữ nguyên dạng câu hỏi–trả lời ngắn |
| 3 | 39 (13 hội thoại × 3) | `talk_block` (parent) + 3 `question_item` (child) | transcript nguyên khối, giữ label người nói `W:/M:/W2:`; **không tách câu hỏi khỏi transcript** |
| 4 | 30 (10 talks × 3) | `talk_block` + 3 child | như Part 3, `content_format` = announcement/talk/recorded_message |
| 5 | 40 | `question_item` | độc lập: stem + 4 choices + `answer` + explanation nếu cùng nguồn |
| 6 | 12 (4 passages × 3) | `passage_block` (parent) + 3 child | passage nguyên khối gồm 3 blank; child = từng blank + choices |
| 7 | 48 (single + multiple) | `passage_block` / `passage_set` | single → 1 parent; double/triple → mỗi passage 1 parent component, chung `group_id` |

**Xử lý passage phi tuyến** (cấm cắt ký tự cố định):

- Email/memo/letter: detect qua header fields `^(From|To|Cc|Subject|Date|Re)\s*:` → serialize nguyên khối header `From: …\nTo: …\nSubject: …` thành prefix của parent text, **cấm cắt giữa các field** (Deadline/Subject là nơi query hay trúng).
- Bảng (schedule, price list): nếu parse có layout (PyMuPDF `page.find_tables()` hoặc PaddleOCR table) → convert **Markdown table nguyên khối**; nếu chỉ plain OCR → giữ các dòng bảng liền nhau + gắn `has_table=true`, `content_format=table` để retrieval lọc.

**Payload chuẩn `question_item`**: `question_number` (1–200, giữ nguyên số trong đề), stem (đã strip số câu), `choices[]`, `answer` (cột riêng, không ghép vào text), `explanation` (chunk child riêng), `audio_ref` (P3/P4), `image_ref` (P1).

### 7.1.3 Map ngược transcript / answer key / explanation về đề

- **Key map**: `(work_key, test_number, part, question_number)`.
- Answer key dạng "134. B" → **UPSERT `answer` vào question_item đã tồn tại**, không tạo chunk mới; `answer_source='answer_key'`.
- Explanation chi tiết (VI hoặc EN) → chunk `explanation_item` là **child của question item** (tầng thứ 3 của cây, mục 7.3).
- Không map được (sách giải đề không cùng bản in) → chunk `talk_block`/`passage_block` độc lập với `linked=false` + `review_flag`, không nhầm với đề gốc.

### 7.1.4 Sách chiến lược & ngữ pháp

- Split theo heading (H1 = lesson, H2 = section), gom đoạn liên tiếp đến budget 350 token; giữ `lesson_id`, `part_tag` (extract từ heading chứa "Part 5"…), `topic_tag`, `heading_path` đầy đủ ("Lesson 5 > Part 5 > Word Choice").
- Mini test / review test cuối lesson → chuyển qua parser question_item như đề; mini test theo format 100 câu gắn `test_type=mini` (`format='mini_100'`).
- Grammar: 1 `theory_point` = parent; các câu exercise = `exercise_item` child mang `theory_id` — truy vấn "điểm ngữ pháp cho câu này" đi theo chiều ngược.

### 7.1.5 Wordlist

- 1 `word_entry` = 1 chunk. Nhận dạng entry: dòng bắt đầu bằng từ + POS marker `(n)/(v)/(adj)/(adv)/…`; XLSX/CSV: mỗi row 1 entry (đọc bằng `pandas`/`openpyxl`, `dtype=str`); APKG Anki: mở `collection.anki2` bằng `sqlite3` rồi export ra entry (mục 6.1.8).
- Metadata: `lemma`, `pos`, `theme`, `part_affinity` (Part 5/7…).
- Không gộp cross-entry — dedup wordlist cần granularity entry; trùng chéo sách được merge ở tầng `word_canon` (mục 8.4), ground truth vẫn là từng entry chunk.

### 7.1.6 Validation parse trước khi index

- Đề full phải đạt đếm `{P1:6, P2:25, P3:39, P4:30, P5:40, P6:12, P7:48}` (tổng 200); đề rút gọn 100 câu (pattern phổ biến sách chiến thuật) → `format='mini_100'`.
- Lệch (thiếu câu, trùng số câu, không xác định Part) → `validation_status='mismatch'` + `review_flag`, ghi `validation_detail`, **không đưa vào vector index** thay vì nạp âm thầm (mục 6.2.5 — cùng một cơ chế, hai phân hệ cùng tham chiếu).

## 7.2 Kích thước chunk, overlap, tokenizer

### 7.2.1 Dùng tokenizer nào để đếm — quyết định kèm đo thực nghiệm

**Quyết định: đếm bằng tokenizer của embedding model** qua `AutoTokenizer.from_pretrained(...)`. Với model chốt `BAAI/bge-m3` **[CHỐT HỢP NHẤT]**, tokenizer là XLM-RoBERTa — **cùng tokenizer family với `intfloat/multilingual-e5-*`**, nên bảng đo thực nghiệm dưới đây (đo bằng tokenizer e5 = XLM-R) áp dụng trực tiếp cho budget.

Bằng chứng đo trong phiên thiết kế nguồn (lệnh `python -c` đếm 7 mẫu TOEIC-style **tự soạn — không chép câu từ đề ETS vì bản quyền** bằng `tiktoken.get_encoding('cl100k_base')` và tokenizer `intfloat/multilingual-e5-base`, Python 3.14.6, máy đích):

- Text tiếng Anh 100–146 từ: XLM-R ≈ **1.10–1.13×** cl100k.
- Text **tiếng Việt 31 từ**: cl100k = **59** token nhưng XLM-R = **39** token (tỷ lệ 0.66×) — hệ số quy đổi chéo ngôn ngữ **không cố định**, nên budget bắt buộc tính bằng tokenizer của embedder (XLM-R); tiktoken chỉ dùng làm pre-check nhanh (pure Rust, không cần load model) với hệ số tự hiệu chuẩn trên 100 chunk đầu mỗi doc. (Phân hệ answer generation dùng tiktoken cl100k cho **budget context LLM** — mục 10.3 — chỉ cần xấp xỉ, không phải đơn vị embedder.)

- Model chốt `BAAI/bge-m3`: max_seq 8192 nhưng **encode chunk mặc định `max_length=512`** (mục 9.2); config chunking param hoá: `embedder.max_length`, `embedder.normalize=true`. bge-m3 **không cần prefix** — bỏ yêu cầu prefix `query:`/`passage:` của thiết kế e5 cũ.
- Vẫn giữ chunk ≤ 512 token kể cả khi bge-m3 hỗ trợ 8192: CPU nhanh hơn và embedding chunk quá dài bị pha loãng, giảm chất lượng retrieval.

### 7.2.2 Bảng budget theo `unit_type` (số đo thực nghiệm, đã trừ buffer)

| unit_type | Size tự nhiên (đo/XLM-R) | Budget | Cắt? |
|---|---|---|---|
| `question_item` P5 | 35–38 token (26 từ) | hard cap 150, không cắt | Trừ khi vượt → lỗi parse, review |
| `question_item` P2 / `image_item` | ~25–45 token | không cắt | — |
| `explanation_item` | 39–59 token (giải thích VI đo được) | cap 250 | — |
| `talk_block` P3/P4 | 162 token/126 từ; talk thực 100–200 từ ≈ 130–260 | nguyên khối, cap 400 | cắt theo câu nếu vượt (hiếm) |
| `passage_block` P6 / P7 single | email 106 từ = 144 token | nguyên khối, cap 400 | — |
| `passage_set` P7 double | 193 token/146 từ | nguyên khối, cap 600 | — |
| `passage_set` P7 triple | 300–500 từ ≈ 400–670 | ≤ 512: nguyên set (mỗi passage 1 parent + `group_id` nếu quá); vượt → cắt có cấu trúc | cắt có cấu trúc |
| `lesson_section` / `theory_point` | 137 token/100 từ tiếng Anh | target 350, max 450 (≈ 250–300 từ) | cắt theo câu + overlap 60 |
| `word_entry` | 56–61 token (36 từ mixed) | nguyên entry | entry > 250 (hiếm) → tách câu ví dụ thành child |

Đo cụ thể từng mẫu (name | chars | words | cl100k | XLM-R): `p5_item` 149/26/35/**38**; `p6_email` 673/106/135/**144**; `p3_talk` 664/126/146/**162**; `p7_double` 841/146/188/**193**; `lesson_prose` 559/100/122/**137**; `word_entry` 186/36/61/**56**; `vi_explain` 144/31/59/**39**.

Lý do mốc 450/512: `max_length=512` khi encode bge-m3 (quyết retrieval cho tốc độ + nhất quán cache), trừ safety buffer ≈ 60 token (dành cho dòng metadata prefix thêm vào text khi embed, mục 7.4.2).

**[CHỐT HỢP NHẤT]** Tài liệu nguồn P1 quy passage split 384/overlap 64 — chốt thống nhất theo bảng trên: nguyên khối đến cap 400/600 theo unit_type; vượt mới cắt theo câu (hiếm khi xảy ra vì TOEIC passage thực tế 150–350 từ). Buffer prefix giữ 60 token như P2.

### 7.2.3 Overlap

- **Chỉ áp cho size-based** (`lesson_section`, `theory_point`, giải thích dài): overlap **60 token** (~1–2 câu) **[CHỐT HỢP NHẤT: P1 đề xuất 50, P2 dùng 60 sau khi đo — chốt 60]**, điểm cắt là ranh giới câu (regex `. ! ?` + theo dấu hoa thị/ký tự đặc biệt tránh cắt giữa "p.m."), không bao giờ overlap vượt qua ranh giới H2 khác.
- **Structure-based: overlap = 0** — biên Part/passage/question/talk là biên ngữ nghĩa thật; overlap còn làm fingerprint sai lệch đầu–cuối, phá fuzzy-dedup giữa các bản scan khác chất lượng.

### 7.2.4 Fallback khi unit cấu trúc vượt cap

Cắt tại ranh giới câu thành `is_partial=true, part_index=i, part_count=n`, cùng `chunk_id` gốc (hậu quả `_p{i}of{n}`); lúc assembly context gộp lại theo `(chunk_id gốc, part_index)` trước khi đưa cho LLM.

## 7.3 Parent-child / small-to-big retrieval

### 7.3.1 Cây chunk 3 tầng

```
level 0  doc (work_key + test_number)
level 1  block     (Part)
level 2  parent    (talk_block | passage_block | passage_set component | lesson_section | theory_point)
level 3  child     (question_item | explanation_item | word_entry | exercise_item | image_item)
```

- `group_id` nối các parent component của cùng 1 double/triple passage (P7) hoặc cùng 1 talk bị cắt (hiếm).
- P3/P4: **cấm flatten** — question_item child luôn giữ `parent_id` về talk_block; P6/7 tương tự với passage.

### 7.3.2 Cách lưu quan hệ cha-con

SQLite là source of truth; Chroma chỉ giữ text nhúng + metadata phẳng (cột đầy đủ ở mục 12: `chunks`):

- `chunk_id` ổn định theo công thức mục 6.3 — UPSERT idempotent giữa các lần re-ingest.
- **2 Chroma collections** (giữ theo P2 — đã chốt A1): `toeic_child` (embed question_item + explanation + word_entry + exercise_item + image_item; metadata gồm `parent_id`, `group_id`, `part`, `source_type`, `lang`, `unit_type`) và `toeic_parent` (embed talk/passage/lesson/theory). Parent đều được nhúng vì đo được: P7 passage 145–200 token, nằm gọn trong 512 — cho phép query hướng passage ("email về việc dời lịch audit") trúng parent trực tiếp. **[CHỐT HỢP NHẤT: P4 viết "chunk-cha không embed" — chốt theo P2: parent có collection riêng, mixed search; parent expansion SQL vẫn giữ vai trò chính.]**
- Chọn Chroma thay FAISS: filter `where={"part": 5}` native; FAISS phải join SQLite sau search (dùng được, thêm 1 bước). Chi tiết so sánh ở mục 9.1.1.

### 7.3.3 Retrieval flow small-to-big (pseudocode)

```text
q_vec = embed(question)
cands = toeic_child.query(q_vec, k=24, where=filter)        # k lớn để gom đủ parent
parents = group_by(cands.parent_id)                          # score parent = max(child) + 0.1*|hit children|
parents = top(parents, 4) ∪ toeic_parent.query(q_vec, k=2)   # mixed search
ctx = mỗi parent: parent_text + [children sort theo question_no] + explanations
total cap 3000-6000 token; khi tràn: cắt explanation dài trước, giữ question + đáp án
```

- `k=24` vì mỗi parent chỉ 3–4 child → 24 child đủ cho 4–6 parent sau gộp; gộp theo parent làm số kết quả độc lập giảm nhanh nên k nhỏ sẽ sót.
- **3 tầng explanation → question → passage**: query "giải thích câu 134 đề 3" trúng `explanation_item` ở child-level, context vẫn bò 2 tầng lên để kèm transcript/passage.
- Truy vấn chính xác kiểu "câu 134 đề 3 ETS Vol 2" **không cần vector**: query SQLite theo `(test_id, part, question_number)` rồi bò lên parent (mục 9.5, 10.4).

## 7.4 Metadata + fingerprint cho dedup và lọc

### 7.4.1 Metadata bắt buộc mỗi chunk

| Field | Dùng để |
|---|---|
| `part` (1–7), `skill` (listening nếu part ≤ 4, reading nếu ≥ 5) | lọc retrieval `where={"part": …}`; query lọc theo skill |
| `question_number`, `question_number_end`, `test_number`, `test_id`, `work_key` | tra cứu chính xác "câu 134 đề 3" |
| `unit_type`, `level`, `parent_id`, `group_id` | small-to-big assembly |
| `source_type`, `format` (full_200/mini) | ưu tiên nguồn (ETS > trung tâm > cộng đồng) khi trùng |
| `content_format` (email/memo/notice/letter/form/article/table/conversation/announcement) | lọc + hiển thị đúng dạng |
| `lang` (en/vi/mixed) | detect bằng lingua/fasttext lid.176 hoặc heuristic dấu phụ (mục 6.3); query đa ngôn ngữ |
| `media_ref` (audio_ref/image_ref), `time_span` | map audio ↔ đề ↔ transcript, ảnh Part 1 |
| `page_span`, `review_flags`, `linked`, `is_partial`, `quality_score` | truy vết về trang scan gốc, loại chunk cần review |
| `text_sha256`, `qi_key`, `simhash`, `minhash` | dedup, mục 8 |

### 7.4.2 Dòng metadata prefix khi embed

Khi embed, prepend một dòng metadata ngắn vào text (vd `[Part 7 | Double passage | Đề 3 ETS Vol 2]`) — đã trừ buffer 60 token ở 7.2.2; cách này tăng recall cho query nhắc tên Part/đề. bge-m3 không cần prefix task riêng — dòng này chỉ là ngữ cảnh nội dung.

### 7.4.3 Fingerprint cho chống trùng lặp (tổng hợp — chi tiết chính sách ở mục 8)

1. **Exact — `text_sha256`**: SHA-256 của normalized text. Chunk trùng hash qua doc khác → đánh dấu `duplicate_of`, **không embed lại**, chỉ thêm nguồn (chunk_sources). Đảm bảo nạp lại ZIP/file là idempotent.
2. **Fuzzy question-level — `qi_key` + MinHash/SimHash**: `qi_key = sha1(norm(stem) + '||A:' + norm(choice_A) + … + '||D:' + norm(choice_D))` — bắt trùng câu dù **số câu lệch giữa các bản biên tập**; giữ thứ tự A→D, đáp án không vào key (answer conflict → review). Biến thể OCR: MinHash char 5-gram 128 perm + SimHash 64-bit (chunk ≥ 80 token, Hamming ≤ 6). **[CHỐT HỢP NHẤT] ngưỡng fuzzy hợp nhất: LSH candidate 0.80; confirm Jaccard ≥ 0.85 ∨ token_set_ratio ≥ 92 → trùng; 0.80–0.85 → `similar_to` không drop** (chi tiết mục 8.3).
3. **Cross-lingual — giải thích VI↔EN và transcript trùng audio**: cosine của model đa ngôn ngữ (dùng chính embedding bge-m3 có sẵn trong vector store — mục 8.3.5); ngưỡng auto-merge ≥ 0.88, review 0.85–0.88 **[CHỐT HỢP NHẤT — P2 đề xuất 0.90, P3 0.88; chốt 0.88 + review zone, calibrate gold set]**. Chỉ chạy trên candidate pairs đã thu hẹp theo `(part, question_number)` hoặc MinHash — tránh O(n²) toàn kho.

### 7.4.4 Chuẩn hoá trước khi hash (bắt buộc)

Thứ tự: decode (`charset-normalizer`; TCVN3/VNI nhận qua tần suất byte đặc trưng rồi convert UTF-8 — mục 6.1.6) → `unicodedata.normalize('NFC')` → gộp hyphen ngắt dòng `([A-Za-z])-\n([a-z])` → join line-wrap → **lọc boilerplate** (mục 6.4-S4, ngưỡng 50% + blacklist) → collapse whitespace. Hash dùng bản lowercase; **text để embedding giữ nguyên bản gốc có dấu**.

## 7.5 Ghi chú Windows / local-first

- Toàn bộ I/O dùng `pathlib`; path > 260 ký tự dùng prefix `\\?\`.
- ZIP nguồn Hàn: `zipfile` đọc `info.flag_bits & 0x800` để biết tên file UTF-8 hay cp437, decode lại tên **trước khi** tạo doc/chunk key (tên file không được dùng làm key dedup).
- Phân hệ chunking thuần local (regex + SQLite + tokenizer local); nguyên bản ETS không rời máy.
---

# 8. Phân hệ 3 — Chống trùng lặp (Dedup) — 3 lớp + đo lường

> **Mục trọng tâm của hệ thống.** Dedup KHÔNG phải bước riêng lẻ mà là các cổng (gates) cài vào ingestion pipeline (đánh dấu **[CỔNG D1–D3]** trong sơ đồ 6.0 và sơ đồ dưới đây). Tài liệu nguồn P1/P2/P3 mô tả cùng cơ chế với tham số lệch nhau — mọi ngưỡng trong chương này là **giá trị hợp nhất cuối cùng** (đối chiếu ở Phụ lục B).

```
extract (PDF/OCR/DOCX) → normalize → boilerplate filter → parse units + validate (200 câu)
  → [CỔNG D1: file_sha256 + content_sha256 + LỚP 1: MinHash/LSH doc-level]
  → [CỔNG D2: chấp nhận/từ chối/version — state machine cổng 1–6]
  → chunk (question_item / passage / talk / word_entry / lesson_section)
  → [CỔNG D3 = S9: qi_key + SimHash + cosine → chọn canonical + merge metadata]
  → ghi vector index → provenance + dedup_stats
```

## 8.1 Tiền đề bắt buộc: chuẩn hoá văn bản trước mọi so khớp

Fuzzy-dedup sẽ bỏ sót bản sao sinh từ scan khác chất lượng nếu không chuẩn hoá. Hàm `normalize_for_dedup(text) -> str` thực hiện đúng thứ tự (chính là S4 của ingestion — một hàm duy nhất, hai phân hệ dùng chung, không có hai bản normalize lệch nhau):

1. **Unicode NFC**: `unicodedata.normalize('NFC', t)` — chuẩn hoá tổ hợp dấu tiếng Việt sinh từ OCR (o + dấu → ô).
2. **Gộp hyphen ngắt dòng**: regex `r'-\n'` → `''`, rồi nối dòng bị cắt giữa câu.
3. **Collapse whitespace**: `\xa0`, nhiều space/newline → 1 space.
4. **Lọc boilerplate**: (a) blacklist cứng: `GO ON TO THE NEXT PAGE`, `* marks the correct answer`, dòng chỉ chứa số trang, dòng tên sách/tên đề lặp; (b) tự học theo file: mọi dòng xuất hiện trên **≥ 50% số trang** của cùng file → đánh dấu boilerplate **[CHỐT HỢP NHẤT: 30%/50%/60% ở ba tài liệu nguồn → 50%]** (câu lệnh part chỉ lặp vài lần, không bị dính).
5. **Lowercase** — chỉ áp dụng cho bản fingerprint dùng dedup; bản text gốc hiển thị giữ nguyên.

Lỗi OCR thường gặp cần map trong bước fingerprint (không sửa text gốc): `O↔0, l↔1, I↔1, S↔5, B↔8` — chỉ dùng khi so `qi_key`/fingerprint, không dùng cho text lưu index.

**Encoding Việt cũ (TCVN3/VNI)**: chuyển mã trước khi vào pipeline (mục 6.1.6). TCVN3(ABC)→Unicode dựng module nội bộ bằng bảng map cố định (~134 ký tự, chuẩn công khai, ~50 dòng code) — hiện **không có pip package đáng tin cậy**; phát hiện heuristic: file `.txt`/`.doc` cũ + tỷ lệ ký tự Latin Extended lạ cao. Với `.doc`/`.docx` legacy: LibreOffice headless `soffice --headless --convert-to txt:UTF8` (local, miễn phí) là đường an toàn.

## 8.2 LỚP 1 — mức tài liệu: exact hash + MinHash/LSH

### 8.2.1 Exact duplicate — 2 mức SHA-256 (thư viện `hashlib`, stdlib)

| Hash | Băm trên | Chặn trường hợp |
|---|---|---|
| `file_sha256` | byte thô của file | Giải nén cùng ZIP 2 lần; copy đổi tên file; nạp lại file đã nạp |
| `content_sha256` | canonical text **sau `normalize_for_dedup`** | Cùng đề nạp qua PDF và DOCX (bản soạn lại); cùng sách ở 2 container khác nhau |

Cả hai lưu SQLite với **partial UNIQUE index** (mục 12). **[CỔNG D1]** của ingestion (S1/S4) kiểm `file_sha256` trước tiên — trùng thì skip cả OCR (idempotency rẻ nhất, tiết kiệm hàng giờ CPU). Hash byte thô **không dùng** để quyết dedup nội dung — chỉ dùng làm idempotency mức file. (`content_sha256` = `normalized_text_sha256` của tài liệu nguồn P1 — hợp nhất tên cột.)

### 8.2.2 Near-duplicate — MinHash + LSH, thư viện `datasketch`

**Thư viện**: `datasketch` 2.0.0 — thuần Python + numpy, không có vấn đề gì trên Windows (đã xác nhận dry-run resolve được trên Python 3.14/Windows x64 trong phiên thiết kế nguồn).

**Tham số và lý do:**

- **Shingles — [CHỐT HỢP NHẤT: P3/P2 dùng word 5-gram, P1 dùng char 5-gram → chốt theo granularity]:**
  - **Doc-level: word 5-gram** trên canonical text. Lý do k=5 (word): k=3 bắt cả cụm lặp dạng formula của TOEIC ('mark your answer on your answer sheet', 'questions refer to the following') làm hai đề khác nhau trông giống nhau; k≥7 quá nhạy với OCR noise (1 từ OCR sai phá 7 shingles thay vì 5).
  - **Chunk-level: char 5-gram** — vì chunk TOEIC ngắn (question item 30–70 token), word segmentation của OCR khác chất lượng biến động mạnh; n-gram ký tự ổn hơn ở granularity nhỏ.
- **num_perm = 128**: sai số chuẩn của ước lượng Jaccard ≈ √(J(1−J)/128) ≈ 0.044 tại J=0.5 — đủ phân biệt dứt khoát vùng 0.90 và 0.75. Nâng 256 chỉ tăng chính xác √2 lần mà hash chậm gấp đôi — không đáng.
- **`MinHashLSH(threshold=0.80, num_perm=128)`**: datasketch tự tính b=16, r=8. Xác suất bắt cặp: J=0.80 → 1−(1−0.8⁸)¹⁶ ≈ 0.94 (bắt được); J=0.60 → ≈ 0.37 (hầu như bỏ qua — đúng ý, vì 0.6 là partial overlap xử lý ở Lớp 2).

```python
# pattern sử dụng (pseudocode)
mh = MinHash(num_perm=128)
for sh in shingles(norm_text, k=5):   # word 5-gram (doc) / char 5-gram (chunk)
    mh.update(sh.encode('utf-8'))
lsh.insert(doc_id, mh)            # khi nạp
cands = lsh.query(mh)             # khi nạp doc mới: ứng viên trùng
J = mh.jaccard(mh_stored[cand])   # xác nhận lại J trước khi quyết
```

**Persistence trên Windows**: serialize `MinHash.hashvalues` (128×uint64 ≈ 1 KB/doc) thành BLOB lưu SQLite (cột `documents.minhash`); khởi động thì rebuild LSH in-memory (vài nghìn doc rebuild < 1 giây). **Không dùng** backend Redis/Cassandra/LevelDB của datasketch — plyvel (LevelDB) thiếu wheel Windows ổn định. Quy mô thư viện cá nhân (≤ vài nghìn tài liệu) cho phép cả brute-force pairwise trên signature nếu muốn đơn giản; giữ API LSH vì chi phí bằng 0.

**Bảng ngưỡng & hành động (doc-level):**

| J (Jaccard ước lượng) | Kết luận | Hành động |
|---|---|---|
| J ≥ 0.90 | Cùng tài liệu (variant scan / tái bản) | Vào version policy Lớp 3 (mục 8.5) |
| 0.75 ≤ J < 0.90 | Nghi vấn | Verify cấu trúc: so **question-item overlap** (dùng `qi_key`). Overlap ≥ 80% số câu → cùng đề → version policy; < 80% → ACCEPT + flag `partial_overlap` |
| J < 0.75 | Tài liệu độc lập | ACCEPT; Lớp 2 vẫn chạy trên chunk |

Lý do ngưỡng 0.90/0.75: hai bản scan khác chất lượng của cùng trang sau OCR + normalize thường đạt J ∈ [0.85, 0.98]; hai đề khác nhau chỉ chép chéo 30–40% câu hỏi rơi vào J ∈ [0.2, 0.6]. Vùng 0.75–0.90 là vùng cãi vã được → quyết bằng bằng chứng cấu trúc chứ không bằng J.

**Tín hiệu xác nhận rẻ — structure fingerprint**: tuple số câu per part parse được (chuẩn hiện hành 6/25/39/30/40/12/48; biến thể 100 câu của sách chiến thuật 6/25/13/10/40/12/…). Hai doc cùng đề thì fingerprint trùng khớp; lệch fingerprint + J cao → nghi đề khác Vol, cần review. Giá trị này có sẵn từ bước parse/validate (mục 6.2.5) — dedup dùng lại, không tính thêm.

## 8.3 LỚP 2 — mức chunk: qi_key + SimHash + cosine, chọn canonical

### 8.3.1 Đơn vị chunk

6 loại unit, mỗi loại có chế độ dedup riêng: `question_item`, `passage` (P6/P7), `talk` (P3/P4), `lesson`/`theory_point`, `word_entry`, `explanation` (con của question_item, không merge chéo với câu hỏi).

### 8.3.2 Chọn kỹ thuật: 3 tầng so khớp từ rẻ → đắt

**Không chọn 1 trong 2 mà xếp tầng** — mỗi tầng lọc được một lớp trùng với chi phí khác nhau:

| Tầng | Phương pháp | Chi phí | Bắt được gì |
|---|---|---|---|
| 1 | `qi_key` exact hash | O(1), µs | Câu hỏi trùng nguyên văn (bản scan sạch, file tổng hợp trích câu) |
| 2 | SimHash 64-bit Hamming | O(1), µs | Cùng nội dung + OCR noise, cùng ngôn ngữ |
| 3 | Cosine trên multilingual embedding | phải embed, ms | Near-dup biên tập lại + **duy nhất tầng bắt được trùng chéo EN↔VI** |

Vì sao không dùng cosine làm tầng duy nhất: mọi chunk kể cả junk-duplicate đều phải chạy qua model embedding (đắt nhất pipeline trên CPU). Vì sao bắt buộc phải có tầng 3 dù đã có SimHash: SimHash/RapidFuzz là so khớp lexical, **không thể** phát hiện 'giải thích tiếng Việt là bản dịch gần-trùng của bản tiếng Anh' — chỉ embedding đa ngôn ngữ bắt được cặp này. Đó là lý do kỹ thuật chốt, không phải sở thích.

### 8.3.3 Tầng 1 — `qi_key`: identity key của question item (mạnh nhất cho TOEIC)

Số câu có thể lệch khi đề biên tập lại nên **matching theo nội dung, không theo question_number**:

```
qi_key = sha1( norm(stem) + '||A:' + norm(choice_A) + '||B:' + norm(choice_B)
             + '||C:' + norm(choice_C) + '||D:' + norm(choice_D) )
# norm = normalize_for_dedup + map lỗi OCR (O0/l1/S5/B8) trên ký tự số
```

- Giữ **thứ tự A→D** (thứ tự lựa chọn có ý nghĩa, không sort); Part 2 chỉ có A–C (key 3 cột).
- **Đáp án đúng KHÔNG đưa vào key** — so riêng: cùng `qi_key` nhưng `answer` khác nhau → `answer_conflict = true` → review queue (một trong hai key sai, hoặc đề biên tập khác — không được tự chọn đáp án).
- `qi_key` lưu UNIQUE (partial index) trong SQLite. Đây là cơ chế bắt file 'tổng hợp câu Part 5 hay ra' chứa nguyên văn câu hỏi từ 3–4 đề: mọi bản trích quy về cùng 1 canonical question item.

### 8.3.4 Tầng 2 — SimHash 64-bit

- **Thư viện**: `simhash` 2.1.2 (dựa trên `mmh3` 5.3.1) — đã xác nhận dry-run resolve được cả hai trên Python 3.14/Windows x64; hoặc tự viết ~30 dòng (weighted hamming trên hash mmh3 của tokens) nếu muốn kiểm soát tokenization.
- **Tokens**: word unigram + bigram trên canonical text, weight = term frequency.
- **Ngưỡng Hamming ≤ 6 / 64-bit**: bản sao có OCR noise thường lệch ≤ 6 bit; cặp không liên quan lệch ~32 bit (đối xứng quanh n/2 — Manku et al. 2007, scale về 64-bit). Ưu điểm hơn ngưỡng lệch: không cần vùng xám cho SimHash vì tầng 3 sẽ thẩm định.
- **Ràng buộc quan trọng: chỉ áp dụng cho chunk ≥ 80 tokens.** Question item Part 5 thường 30–70 tokens — SimHash trên quá ít feature cho bit không ổn định (dao động Hamming lớn dù text giống nhau). Chunk ngắn đi thẳng tầng 1 + tầng 3.
- Lưu `simhash` là INTEGER 64-bit trong SQLite; Hamming = `(a ^ b).bit_count()` (Python ≥ 3.10; máy đang chạy 3.14).
- **Vai trò**: candidate generator + idempotency check rẻ. Mỗi cặp trúng SimHash **phải qua tầng 3 thẩm định trước khi merge** (SimHash có dương tính giả ở cặp câu cùng template).

### 8.3.5 Tầng 3 — Cosine trên multilingual embedding

- **[CHỐT HỢP NHẤT] TÁI SỬ DỤNG vector store chính của RAG — không xây index dedup riêng, không thêm model embedding phụ:** khi nạp chunk mới, embedding bge-m3 đã được tạo cho index (S10); dedup query chính collection Chroma của RAG: `collection.query(embeddings=[v], n_results=5)` → filter cosine ≥ ngưỡng → quyết. Ưu điểm: 0 chi phí index thêm, 0 lần encode thêm (P3 chọn e5-small riêng để tiết kiệm throughput — nhưng vì đã tái sử dụng vector chính, chi phí thêm bằng 0; `intfloat/multilingual-e5-small` / `sentence-transformers/LaBSE` chỉ là **option pass-2** nếu gold-set calibration cho thấy cosine bge-m3 phân tách kém trên cặp cross-language — LaBSE chuyên translation-pair detection, ~0.5–2s/cặp CPU, chạy trên rất ít cặp candidate).
- Ngưỡng cosine dưới đây đo với model e5 trong tài liệu nguồn; **bắt buộc hiệu chỉnh lại trên gold set (mục 8.7) sau khi chạy bge-m3 thực tế** — số trong `thresholds.yaml`, không hardcode.

**Bảng ngưỡng cosine (giá trị khởi điểm — PHẢI hiệu chỉnh trên gold set):**

| Cặp | Auto-merge | Review queue | Kết luận khác |
|---|---|---|---|
| Cùng ngôn ngữ | ≥ 0.97 | 0.92 – 0.97 | < 0.92 |
| Khác ngôn ngữ (EN↔VI) | ≥ 0.88 | 0.85 – 0.88 | < 0.85 |

Lý do: cùng ngôn ngữ, bản OCR-variant của cùng text thường cosine ≥ 0.97; bản dịch trung thực hiếm khi vượt 0.90–0.95 vì surface form khác hẳn → hạ ngưỡng auto-merge cho cross-language. Ngôn ngữ của chunk lấy từ metadata parse (mỗi chunk đã có `lang`). **[CHỐT HỢP NHẤT: cross-lang auto-merge 0.88 (P3) thắng 0.90 (P2) — cùng nguyên tắc "auto-merge chỉ ở ngưỡng rất cao", review zone 0.85–0.88 bắt các cặp trung gian.]**

**Ngưỡng fuzzy chunk-level hợp nhất [CHỐT HỢP NHẤT]** (hợp P1: Jaccard 0.80 + rapidfuzz 85, và P2: 0.85 + token_set_ratio 92):

| Giai đoạn | Tham số | Hành động |
|---|---|---|
| Candidate | MinHash LSH threshold **0.80** (char 5-gram, 128 perm), cùng `unit_type` + cùng `part` | Thu hẹp không gian so |
| Confirm — trùng | Jaccard ≥ **0.85** ∨ `rapidfuzz.fuzz.token_set_ratio` ≥ **92** | Canonical policy (8.4) |
| Vùng xám | 0.80 ≤ J < 0.85 (hoặc 85–92 rapidfuzz) | **Không drop** — link `similar_to` trong `chunk_links` + `dedup_matches.decision='keep_both'` |

### 8.3.6 Xử lý khi trùng: chọn canonical + merge metadata nguồn

**Chọn canonical theo điểm chất lượng** (tính 1 lần khi parse, lưu vào doc/chunk):

```
canonical_score = 0.40 × parse_completeness   # % unit parse đủ (stem + choices + answer), theo validation 200 câu
               + 0.25 × ocr_cleanliness       # alphabet_ratio + tỷ lệ token nằm trong từ điển (rapidfuzz so với 1/1000 common words + wordlist TOEIC có sẵn)
               + 0.25 × source_priority       # ets_official=1.0 | center_book=0.7 | community_explanation=0.6 | community/leak=0.5
               + 0.10 × metadata_completeness # đủ part/test/question_number/page nguồn
```

Nặng nhất cho parse_completeness vì bản scan sạch parse trọn 200 câu là nền của truy vấn 'câu 134 đề 3'; source_priority phản ánh độ tin cậy đáp án ETS.

**Không xoá — đánh dấu**: chunk thua `status='duplicate_of'`, `canonical_id=FK`; bảng `chunk_sources` (N:1) ghi **mọi** nguồn. Retrieval hiển thị: 'Nội dung này cũng có trong: ETS 2022 Test 3 (tr.45) · TongHopPart5_Hackers (tr.12) · DeNho_Forum2023' — đây chính là yêu cầu provenance của Lớp 3.

**Merge theo loại unit (khác nhau quan trọng, không merge máy móc):**

| Unit | Chính sách khi trùng |
|---|---|
| `question_item` | Giữ 1 canonical. Các **explanation** đi kèm từng bản trùng → gắn tất cả làm explanation-children của canonical (giải thích là sản phẩm biên tập riêng, **không gộp text**); chỉ dedup explanation-vs-explanation cùng ngôn ngữ cosine ≥ 0.97 (giữ bản tốt, ghi nguồn). Answer conflict → `review_queue`. |
| `passage` / `talk` | Chọn canonical block; question items của bản thua **repoint `parent_id` → canonical block** (bảo toàn liên kết cha–con, cấm flatten). |
| `word_entry` | **Merge chứ không drop**: headword + POS trùng → 1 entry `word_canon`; definitions/examples **append** có tag nguồn từng bản; giữ cả bản dịch khác nhau. |
| `explanation` | Cặp EN gốc ↔ VI dịch → **giữ cả hai**, gắn relation `translation_of` (chunk_links `translates`), không merge. |

## 8.4 LỚP 3 — chính sách khi nạp: quyết định nhận / từ chối / gộp

### 8.4.1 State machine 6 cổng — chạy theo thứ tự, dừng ở cổng đầu tiên khớp

| Cổng | Kiểm tra | Điều kiện | Hành động |
|---|---|---|---|
| 1 | `file_sha256` | Trùng bản ghi cũ | **REJECT** (`duplicate_ingest`) — trả về doc_id cũ; skip toàn bộ OCR/parse |
| 2 | `content_sha256` | Trùng | **REJECT_SOFT**: tạo alias đường dẫn mới → doc cũ, không nhân bản |
| 3 | MinHash J (doc-level) | J ≥ 0.90 | **VERSION** — vào version policy 8.5 |
| 4 | J 0.75–0.90 + qi-overlap ≥ 80% số câu | Đúng | **VERSION** |
| 5 | J 0.75–0.90 + qi-overlap < 80% | Đúng | **ACCEPT + flag `partial_overlap`** (vd. sách giải đề trích một phần đề ETS) |
| 6 | J < 0.75 | — | **ACCEPT** tài liệu mới → chunk → Lớp 2 |

Sau ACCEPT: Lớp 2 chạy trên từng chunk — chunk mới khớp chunk cũ (qi_key bằng, hoặc SimHash ≤ 6 + cosine ≥ ngưỡng) → **không tạo chunk mới**, chỉ thêm 1 row `chunk_sources`; không khớp → embed + index như thường.

### 8.4.2 Bản mới / bản sửa của cùng một đề (versioning)

- **`work_id`**: định danh trừu tượng của 'một đề/sách' độc lập với mọi file. Gom bằng `test_key = normalize(title) + structure fingerprint`. Hai bẫy phải né: (a) ETS Vol 1 vs Vol 2 có J cao do format lặp → fingerprint lệch sẽ tách ra, đúng; (b) cùng đề đổi bìa/đổi năm tái bản → fingerprint trùng + title gần nhau → tự gom, nhưng luôn đẩy 1 item xác nhận vào `review_queue` lần đầu tiên gom (người dùng xác nhận 1 lần, hệ ghi nhớ).
- **Nạp bản sửa**: INSERT document mới **cùng `work_id`**, gắn `relation ∈ {reprint, scan_variant, edition}` (bảng `provenance_edges`); kích hoạt **re-canonicalization**: chọn lại canonical version theo `canonical_score` toàn work. Index sau đó giữ: (1) chunks của version canonical + (2) **chunks 'unique-only' của version khác** (chunk không có counterpart cosine ≥ 0.97 trong canonical). Điểm mấu chốt: nếu bản sửa có thêm câu mới, câu đó vẫn vào index — không mất nội dung; câu trùng không nhân bản.
- **Audio ↔ transcript**: `work_id` cũng nối audio ZIP; map audio↔transcript theo số đoạn + duration (naming audio thường lệch; heuristic duration ≈ words/2.8 từ/s ±40%); transcript trùng của cùng audio quy về cùng rule canonical ở trên; audio dùng làm nguồn kiểm chứng transcript, không đưa vào index văn bản.

### 8.4.3 Provenance — 'tài liệu này cũng có trong nguồn nào'

```sql
chunk_sources(chunk_id, doc_id, source_path, page,
              question_number_in_source, ingested_at, ocr_engine);   -- N:1, mọi bản sao
provenance_edges(work_id, related_work_id, relation, confidence, note);
-- relation ∈ {reprint, scan_variant, edition, derived_summary, contains}
-- origin enum trên documents: ets_official | center_book | community | leak | unknown
```

Truy vấn provenance trả từ 2 bảng này lúc runtime — không hardcode vào text chunk.

### 8.4.4 Idempotent + resumable

- Checkpoint theo trang OCR (`ocr_pages`) + stage checkpoint (`ingest_jobs` với `checkpoint_json`); resume chạy tiếp từ checkpoint, không tái OCR trang đã xong.
- Toàn bộ quyết định dedup là **deterministic theo hash**: nạp lại cùng file → cùng mọi hash → cùng quyết định → idempotent đúng nghĩa.

## 8.5 Schema dedup (trích từ schema hợp nhất mục 12)

Các bảng do phân hệ dedup sở hữu: `works`, `chunk_sources`, `provenance_edges`, `dedup_matches`, `dedup_stats`, `gold_pairs`, `review_queue`, `sentinel_queries` + các cột trên `documents`/`chunks` (`minhash`, `structure_fingerprint`, `content_sha256`, `canonical_score`, `origin`, `status`, `canonical_id`, `qi_key`, `simhash`). DDL đầy đủ ở mục 12.

## 8.6 ĐO LƯỜNG — tỷ lệ trùng trước/sau + kiểm chứng không bỏ sót

### 8.6.1 Tỷ lệ trùng trước/sau dedup

**Trước dedup** (chạy offline trên corpus raw, không áp dụng chính sách):
- `doc_dup_ratio = |{doc : best_Jaccard ≥ 0.90}| / |docs|`
- `chunk_dup_ratio = |{chunk : tồn tại twin (qi_key trùng) ∨ (hamming ≤ 6) ∨ (cosine ≥ 0.97 cùng ngôn ngữ)}| / |chunks|`
- `token_wasted_ratio = Σ tokens(các chunk có twin) / Σ tokens(toàn corpus)` — đo bloat sẽ lọt vào vector index nếu không dedup.

**Sau dedup**: `reduction = 1 − |chunks_indexed| / |chunks_raw|`, breakdown theo cơ chế bắt được: exact (`qi_key`) / lexical (SimHash) / semantic same-lang (cosine) / cross-lingual. Mỗi batch nạp ghi 1 row vào `dedup_stats` → soi được xu hướng: nếu `n_dup_semantic` đột biến, kiểm OCR pipeline có lỗi sinh bản sao hàng loạt không.

### 8.6.2 Kiểm chứng dedup không bỏ sót nội dung độc lập — recall trên gold set ghép cặp thủ công

**Xây gold set ~2.500 cặp, 3 nguồn:**

1. **Neighbour mining** (tạo cặp âm chủ yếu): sample ngẫu nhiên 500 chunks stratified theo unit_type → lấy top-5 cosine neighbours mỗi chunk → 2.500 cặp.
2. **Planted duplicates** (ground truth dương chắc chắn): lấy 30 chunks thật × 5 phép biến đổi mô phỏng đúng các rủi ro của dự án: (a) noise khoảng trắng/dấu câu; (b) OCR substitution 2% ký tự; (c) đảo thứ tự dòng; (d) dịch EN→VI (người dịch hoặc model, ghi rõ trong nhãn); (e) chèn boilerplate mỗi đoạn → 150 cặp dương biết trước.
3. **Gán nhãn thủ công** 4 lớp: `DUP_SAME_LANG / DUP_TRANSLATION / PARTIAL / NOT_DUP` — người xem từng cặp, lưu vào `gold_pairs`.

**Metrics và tiêu chí chọn ngưỡng:**

- `recall = TP/(TP+FN)` tính **riêng từng tầng** (SimHash tier, cosine same-lang tier, cross-lang tier) và từng lớp nhãn (cặp translation dễ bị sót nhất — đo riêng).
- Sweep cosine threshold 0.80 → 0.99 bước 0.01 → đường precision–recall (matplotlib, local). **Tiêu chí chốt ngưỡng**: auto-merge precision ≥ 0.98 (sai merge = mất nội dung — nguy hơn lọt trùng, nhất quán nguyên tắc 8) và recall tổng của pipeline (auto-merge + review queue) ≥ 0.99.
- Các cặp nằm sát vùng ngưỡng được đề xuất → chốt ngưỡng cuối; ghi vào `config/thresholds.yaml` (một file duy nhất, dedup đọc từ đó — không hardcode số trong code).

**Sentinel retrieval check** (chống mất nội dung độc lập do merge sai): ghép tay 20 truy vấn hiếm dạng 'câu 134 đề 3 ETS Vol 2', 'conversation 7 Part 3 đề X' vào bảng `sentinel_queries`; **sau mỗi lần re-canonicalization** chạy retrieval phải trả đúng canonical — bắt được trường hợp merge sai làm biến mất câu hỏi khỏi index.

**Feedback loop liên tục**: mỗi batch nạp, sample 1% chunk mới so với toàn index; mọi cặp cosine 0.85–0.97 đẩy vào `review_queue`; nhãn người dùng quay lại hiệu chỉnh ngưỡng (2 tuần/lần đầu, sau đó 1 tháng/lần).

**Công cụ đo**: sqlite3 (stdlib) + pandas + matplotlib — toàn bộ local, không dịch vụ ngoài.

## 8.7 Nhắc lại điểm giao với ingestion (tóm tắt cho người đọc mục 6)

- S1/S4 cài **CỔNG D1** (cổng 1–2 của state machine 8.4.1: `file_sha256`, `content_sha256`).
- S8 sinh đúng 4 khóa: `text_sha256`, `minhash` (char 5-gram), `qi_key`, `simhash`.
- S9 thực thi **CỔNG D3** (Lớp 2) với ngưỡng hợp nhất 8.3.5; mọi cặp ghi `dedup_matches`.
- S10 chỉ enqueue chunk `status='canonical'` (hoặc unique-only của version khác) — chunk trùng không bao giờ được embed 2 lần.
- Re-canonicalization (8.4.2) chạy sentinel retrieval sau mỗi lần.
---

# 9. Phân hệ 4 — Truy xuất (Retrieval)

## 9.0 Kiến trúc tầng truy xuất

```
query (tiếng Việt/Anh, dạng tự do)
  │
  ├─(1) Intent Router (regex rules, fallback LLM) — 8 intent hợp nhất (bảng 9.4.1)
  │        exact_item │ vocab │ grammar_explain │ part_practice │ find_test │ similar │ strategy │ general
  │
  ├─(2a) Deterministic path: SQLite (test_alias → chunks)  ── trả ngay, bỏ qua embedding + LLM
  ├─(2b) Hybrid path:  query expansion (LLM, chỉ khi cần — query VI → keyword EN cho BM25)
  │        ├─ Dense:  Chroma toeic_child ⊕ toeic_parent (bge-m3, cosine, filter metadata)
  │        └─ Sparse: SQLite FTS5 (BM25 builtin) trên chunks_fts
  │
  ├─(3) Weighted RRF fusion (k=60, trọng số theo intent)
  ├─(4) Cross-encoder rerank (bge-reranker-v2-m3, top-20 → top-8) → gate ngưỡng
  ├─(5) Parent/neighbor expansion (SQLite join theo parent_id/part)
  └─(6) Context pack (≤ 6k token) → LLM
```

Đơn vị trung tâm là **question item kèm chunk-cha** — mọi truy vấn đều quy về question item; Part 3/4/6/7 thì question item phải giữ liên kết tham chiếu về talk/passage block, không được flatten.

## 9.1 Vector store: chốt **ChromaDB** **[CHỐT HỢP NHẤT — A1]**

### 9.1.1 So sánh cho đúng trường hợp này

| Tiêu chí | ChromaDB 1.5.x | FAISS (faiss-cpu 1.15.x) |
|---|---|---|
| Cài trên Windows | `pip install chromadb` — wheel Rust core win_amd64, chạy embedded ngay | `pip install faiss-cpu` — có wheel win_amd64, nhưng chỉ là thư viện index thuần |
| Filter metadata (part, skill, test_id) | **Native**: `where={"$and": [...]}` với `$eq/$in/$gte…` — khớp trực tiếp nhu cầu "filter theo part/skill/số đề" | Không có; phải tự quản id-map trong SQLite + tự viết `IDSelector` cho điều kiện phức tạp |
| Lưu documents + metadata | Có, cùng index | Không; chỉ vector thô |
| Persistence | Tự persist (SQLite nội bộ), mở lại bằng `PersistentClient(path=...)` | `write_index/read_index` thủ công, tự lo schema |
| Hiệu năng raw | HNSW đủ nhanh: ~ vài ms/query ở ≤ vài trăm nghìn vector | Nhanh hơn và scale tốt hơn (IVF/PQ/GPU) — chỉ đáng kể từ ~10M vector |
| Mức kiểm soát index | Đủ (M, ef_construction, ef_search) | Tinh hơn (thành phần index tự chọn) |
| Tốc độ phát triển | API cao cấp, ít plumbing | Phải tự dựng tầng store+filter+persistence |

**Quy mô dự kiến của corpus** (suy từ các loại tài liệu): ~20 bộ đề ETS × 200 câu = ~4k question items + ~2k talk/passage + lesson của sách chiến thuật + word entry (~3–5k sau dedup) + explanation chunks → tổng **~50k–200k chunk**, tức 0.2–0.8 GB vector 1024-d float32. Ở quy mô này HNSW của Chroma vô cùng dư sức; **bottleneck thật của hệ là OCR + embedding tính bằng giờ, không phải vector search tính bằng ms** — nên tiêu chí thắng là filter metadata native + tốc độ phát triển, không phải throughput FAISS.

**Chốt: ChromaDB embedded mode** (`chromadb==1.5.9` — version kiểm chứng bằng `pip index versions` trong phiên thiết kế nguồn). **Ghi chú hợp nhất:** tài liệu nguồn P1 (S10) và P5 (B2) chọn FAISS `IndexFlatIP` — quyết định đó bị thay vì lập luận của bảng trên (được P2 và P3 ủng hộ). Điều kiện chuyển sang FAISS (ghi vào code comment): >2M vector, cần IVF-PQ giảm RAM, hoặc cần GPU search — khi đó dùng `IndexHNSWFlat`/`IndexIVFFlat` + `IDSelectorBatch`, metadata vẫn nằm trong SQLite; tầng `VectorStore` interface nên bọc sớm để dễ thay.

### 9.1.2 Cấu hình cụ thể

```python
client = chromadb.PersistentClient(
    path=DATA_DIR / "chroma",
    settings=chromadb.Settings(anonymized_telemetry=False),
)
col_child = client.get_or_create_collection(
    name="toeic_child",                 # question_item, explanation, word_entry, exercise_item, image_item
    metadata={"hnsw:space": "cosine",
              "hnsw:M": 32,
              "hnsw:construction_ef": 200,
              "hnsw:search_ef": 128},   # ≥ 2× n_results — mặc định ef_search thấp, phải nâng rõ ràng
)
col_parent = client.get_or_create_collection(
    name="toeic_parent",                # passage, talk, lesson, theory_point
    metadata={"hnsw:space": "cosine", "hnsw:M": 32,
              "hnsw:construction_ef": 200, "hnsw:search_ef": 128},
)
```

- **[CHỐT HỢP NHẤT]** Tài liệu nguồn P4 dùng 1 collection `toeic_v1`; P2 dùng 2 collections child/parent — chốt **2 collections** vì small-to-big retrieval (mục 9.5) và mixed search (mục 7.3.3) cần nhúng parent riêng. Tên collection KHÔNG mang version embedding — thay vào đó đổi model ⇒ tạo collection mới với tên khác (`toeic_child_v2`) và bỏ collection cũ sau khi index lại (tránh rác cache cũ).
- Vectors luôn L2-normalized trước khi `upsert` ⇒ cosine ≡ inner product.
- **Metadata trong Chroma chỉ nhận scalar** (str/int/float/bool) — đặt tối thiểu: `unit_type, part, test_id, question_number, skill, lang, canon_group (= canonical chunk_id), parent_id, n_sources`. Mọi dữ liệu quan hệ đầy đủ (đáp án, giải thích, danh sách nguồn, đường dẫn ảnh) nằm trong SQLite và join lúc trả kết quả.
- Upsert **idempotent theo chunk_id canonical** do ingestion cấp (vd `q_ets2023_t2_p5_134`, `talk_ets2023_t2_07`): nạp lại file trùng không sinh duplicate — nối chặt với ràng buộc ingestion idempotent và dedup question-level (các bản sao đã gộp về `canon_group` trước khi tới đây).

### 9.1.3 Dữ liệu nằm ở đâu trên máy

```
E:\PROJECT\rag_toeic\            ← root ngắn, an toàn MAX_PATH 260
└─ data\
   ├─ chroma\                    # PersistentClient dir: chroma.sqlite3 + segment dirs (tên uuid)
   ├─ rag.sqlite3                # 1 file SQLite SSOT: chunks + chunks_fts + emb_cache + test_alias + word_canon + ...
   ├─ store\raw\                 # content-addressed file gốc
   ├─ store\images\              # ảnh Part 1 đã render
   └─ models\                    # (đã chuyển thành .models/hf ở root — HF_HOME)
```

- Vì sao gộp FTS5 + cache vào đúng `rag.sqlite3` mà Chroma tự có SQLite riêng: ràng buộc chỉ định "SQLite cho metadata" — một file cho toàn bộ metadata tự quản là dễ backup/migrate nhất; schema nội bộ của Chroma không đụng vào. **[CHỐT HỢP NHẤT]** `toeic.db` của P5 và `rag.sqlite3` của P4 là cùng một thứ — chốt tên `rag.sqlite3`.
- Quy ước Windows: mọi I/O dùng `pathlib`, không hardcode `/`, test_id/alias chuẩn hóa lowercase (hệ file case-insensitive), giữ mọi đường dẫn tạo ra < 200 ký tự.

## 9.2 Embedding

### 9.2.1 Chốt model: **`BAAI/bge-m3`** (dense 1024-d) **[CHỐT HỢP NHẤT — A2]**

| Model | Dim | Params | Đa ngôn ngữ | Ghi chú |
|---|---|---|---|---|
| **BAAI/bge-m3 ← chốt** | **1024** | ~568M | 100+ ngôn ngữ, cross-lingual mạnh | MIT; context 8192; không cần prefix; cùng họ với reranker bên dưới |
| intfloat/multilingual-e5-large | 1024 | ~560M | Có | Bắt buộc prefix `query:`/`passage:` — dễ quên gây sụt chất lượng; context 512. (Lựa chọn của P5 trong tài liệu nguồn — thay bởi bge-m3) |
| intfloat/multilingual-e5-base | 768 | 278M | Có | Nhẹ hơn, CPU nhanh — phương án fallback khi RAM < 8 GB, chấp nhận giảm chất lượng |
| Qwen3-Embedding-0.6B | 1024 | ~595M | Có, MTEB-multilingual cao | Instruction-aware, cần prompt format; tích hợp phức tạp hơn |
| paraphrase-multilingual-MiniLM-L12-v2 | 384 | ~118M | Có | Chỉ dùng prototype/smoke-test |

Lý do chốt bge-m3, đối chiếu ràng buộc ("embedding phải là model đa ngôn ngữ", "nội dung đề tiếng Anh, hướng dẫn/giải thích/dịch tiếng Việt"):

1. **Cross-lingual query VN ↔ content EN** là nhu cầu lõi của TOEIC-RAG (người học hỏi bằng tiếng Việt trên đề tiếng Anh) — bge-m3 được train cho mục đích này, tốt hơn hẳn model English-only.
2. Context 8192 token cho phép embed nguyên chunk-cha (talk/passage dài) nếu cần nâng `max_length`; mặc định encode `max_length=512` — chi tiết chunk nhỏ vẫn cap 512 token.
3. Không cần prefix/instruction → ít bug tích hợp; MIT license; một model sau này còn lấy được cả sparse (lexical weights) nếu muốn bỏ BM25.
4. Cùng họ `BAAI` với reranker → pipeline test đồng bộ.

**Tham số chạy:**

- Thư viện: `sentence-transformers==6.1.0` (chỉ cần dense) — `SentenceTransformer("BAAI/bge-m3", device="cpu")`, `encode(..., normalize_embeddings=True, batch_size=32)`. Dùng `FlagEmbedding` (1.4.2) chỉ khi bật sparse.
- `max_length=512` cho chunk (chunk dài hơn → chia theo mục 7.2); **cache key đưa `max_length` vào**.
- Tăng tốc CPU: ONNX Runtime int8 dynamic quantization qua `optimum` (`onnxruntime 1.30.0` có wheel cp314 — kiểm chứng dry-run); tốc độ thực phải benchmark khi ingestion lần đầu (mục 19).

**Tốc độ (ước lượng, CHƯA benchmark trong các phiên thiết kế)** — máy 16 luồng AMD Zen 3 đã kiểm chứng bằng `os.cpu_count()`:
- Encode query 1 câu: ~0.2–0.5 s.
- Batch 32 chunk × 512 token, fp32 torch CPU: ~8–20 chunk/s → corpus 100k chunk ≈ **1.5–3.5 giờ** — cùng bậc với thời gian OCR, chấp nhận được cho ingestion chạy nền; ONNX int8 kỳ vọng giảm 1.5–2.5×.
- Cần nhanh hơn khi thử nghiệm: `MiniLM-L12-v2` (384-d, ~60–120 chunk/s) chỉ để smoke-test pipeline, không dùng production.

### 9.2.2 Cache embedding

Mục đích kép, nối ràng buộc "ingestion phải resumable và idempotent":

1. Re-run ingestion (file nạp lại, checkpoint dở dang) **không re-embed** chunk đã xử lý.
2. Đổi cấu hình Chroma/index → **re-index không phải re-embed** toàn bộ.

Bảng trong `rag.sqlite3`:

```sql
CREATE TABLE emb_cache (
  key       TEXT PRIMARY KEY,   -- sha256(model_id|hf_revision|max_length|normalize|text)
  model     TEXT NOT NULL,
  dim       INTEGER NOT NULL,
  vec       BLOB NOT NULL,      -- np.float32.tobytes(), little-endian
  created_at TEXT DEFAULT (datetime('now'))
);
```

- **Key phải gồm HF revision** (commit sha, pin trong `config/settings.yaml` — lấy từ `huggingface_hub`, không hardcode nhầm): cùng text nhưng khác revision/model/max_length phải miss.
- Text đưa vào hash là **text đã qua chuẩn hóa OCR** (gộp hyphen, lọc boilerplate — `normalize_for_dedup`) — nhờ vậy hai bản scan khác chất lượng của cùng câu hỏi trùng key, không embed hai lần (đúng logic dedup-canonical).
- Dung lượng: 1024-d × 4 byte = 4 KB/chunk; 200k chunk ≈ 0.8 GB — ok trên ổ E:.
- Layer `EmbeddingFn` bọc flow: `hash → SELECT vec → miss → model.encode → INSERT` — mọi nơi (ingestion worker, query-time) đi qua layer này.
- Query-time không nhất thiết dùng cache (query mới liên tục) nhưng không hại; cache chủ yếu phục vụ ingestion.

## 9.3 Truy xuất hybrid: BM25 + vector, hòa điểm, filter

### 9.3.1 Nhánh sparse: SQLite FTS5 (đã kiểm chứng chạy được trên máy đích)

Check đã chạy trong phiên thiết kế nguồn: `python -c "... CREATE VIRTUAL TABLE t USING fts5(x, tokenize='porter unicode61 remove_diacritics 2') ..."` → `FTS5_OK 3.50.4` trên Python 3.14.6 — **không cần thêm dependency nào cho BM25**.

```sql
-- external-content FTS5: không nhân bản text
CREATE VIRTUAL TABLE chunks_fts USING fts5(
  text, text_nodiacritic,
  tokenize = 'porter unicode61 remove_diacritics 2',
  content = 'chunks', content_rowid = 'rowid'
);
```

**[CHỐT HỢP NHẤT — fold dấu tiếng Việt]:** P4 cho rằng `remove_diacritics 2` đủ cho query VN thiếu dấu; P5 chỉ ra `remove_diacritics` không fold tiếng Việt đầy đủ (vd `đ` là chữ cái riêng, không phải ký tự có dấu; tổ hợp dấu VN ngoài Latin-1). **Chốt phương án kép an toàn:** giữ `remove_diacritics 2` (fold được phần Latin phổ thông) **và** duy trì cột `text_nodiacritic` chuẩn hoá bằng Python (NFKD → bỏ combining marks → đ→d) tại ingestion (mục 6.3); query người dùng cũng được fold tương tự trước khi MATCH — đảm bảo gõ thiếu dấu vẫn khớp trong mọi trường hợp.

- Query: `SELECT chunk_id FROM chunks_fts WHERE chunks_fts MATCH :q ORDER BY rank LIMIT 100;` (FTS5 `bm25()`/`rank`: nhỏ hơn = khớp hơn — đảo chiều khi hòa điểm).
- Cú pháp MATCH: prefix `reimburs*`, phrase `"cut off"`; Escape query người dùng qua hàm dựng query (đỡ lỗi cú pháp FTS5 từ dấu `"`/`*` trong input).
- Fallback nếu môi trường khác mất FTS5: `bm25s` (numpy/scipy, in-memory đủ cho ≤ 500k chunk) — ghi decision vào `KeywordIndex` interface.

### 9.3.2 Nhánh dense: Chroma query

```python
res_child  = col_child.query(query_embeddings=[qv], n_results=100, where=where_clause)
res_parent = col_parent.query(query_embeddings=[qv], n_results=10,  where=where_clause)
# where_clause từ router, có thể None
```

### 9.3.3 Hòa điểm: **Weighted Reciprocal Rank Fusion**

Vì sao không min-max normalize: BM25 không chặn trên và phân phối phụ thuộc query; cosine thì 0–1 — normalize per-query cực nhạy cảm. RRF chỉ cần thứ hạng, bền vững:

```
RRF(d) = Σ_i  w_i / (60 + rank_i(d))     với rank bắt đầu từ 1, k = 60
w_dense = 0.6, w_bm25 = 0.4  (mặc định; trọng số theo intent ở bảng 9.4.2)
```

- Fusion trên union top-100 mỗi nhánh (+ top-10 parent) → giữ **top-20** cho rerank (mặc định; nâng 50 nếu chấp nhận latency) → **top-8** cuối.
- Kinh nghiệm vận hành: BM25 là chủ lực cho câu có thuật ngữ exact (tên ngữ pháp, từ vựng, số câu), dense là chủ lực cho câu paraphrase/suy luận; cặp trọng số 0.6/0.4 là điểm khởi đầu phải tinh chỉnh bằng golden set (mục 16), không phải chân lý.
- (Tuỳ chọn v2, tắt mặc định): thêm ranker thứ ba — sparse lexical-weights của chính bge-m3 (qua FlagEmbedding), weight 0.2 — chỉ làm nếu golden set cho thấy BM25 miss do morphological edge cases.

### 9.3.4 Filter metadata: hard khi đúng chủ đề, soft khi câu hỏi rộng

- **Hard filter** (đưa `where` vào Chroma + `WHERE` vào FTS5 qua bảng ngoài) khi router tự tin: `exact_item` → `question_number` + `test_id`; `vocab` → `unit_type='word_entry'`; `part_practice` → `part = X`; query nói rõ đề → `test_id` (qua alias, mục 9.5.1).
- **Soft boost** khi câu hỏi tổng quát: search toàn bộ, cộng thêm `w_type` vào RRF cho chunk thuộc loại ưu tiên của intent (ví dụ `grammar_explain` ưu tiên `theory_point`/`lesson` và `question_item(part=5)` +0.15).
- **Skill** bắt nguồn từ part: Part 1–4 → `listening`, 5–7 → `reading` (set lúc ingestion); nhãn `grammar`/`vocab` là nhãn mở rộng cho lesson/word_entry.
- **Filter relaxation**: nếu hard filter trả < 5 kết quả → nới bỏ filter yếu nhất (thứ tự bỏ: `topic` → `skill` → giữ `part`/`test_id`), ghi nhận vào response `"relaxed": [...]` để LLM trả lời trung thực.
- Multi-value: dùng `$in` (Chroma) / `IN` (SQLite); metadata Chroma scalar-only nên không lưu list — quan hệ phức tạp xử lý trong SQLite.

### 9.3.5 Query expansion một bước (xử lý lệch ngôn ngữ cho BM25)

Dense xử lý tốt cross-lingual, nhưng BM25 thuần VN sẽ miss content EN. Trước khi bắn FTS5, nếu query có tiếng Việt: một call LLM rẻ (Ollama local mặc định) sinh **5–8 keyword tiếng Anh + 1 paraphrase EN**, rồi FTS5 MATCH trên `(query_gốc) OR (keywords)` — giải thích trong corpus vốn song ngữ Anh-Việt nên BM25 vẫn có mặt bám được cả hai. Cloud API cho rewrite query chỉ khi `allow_cloud` bật (mục 10.5) — chỉ gửi câu hỏi người dùng, không gửi chunk.

## 9.4 Rerank

**Có, cần reranker** — hai lý do đặc thù của corpus này:

1. Lệch ngôn ngữ query-VN/content-EN khiến điểm dense đôi khi xếp sai thứ tự giữa các chunk cùng chủ đề; cross-encoder chấm đồng thời cặp (query, passage) nên bù chính xác hơn.
2. Chunk rất nhỏ (question item ~100–300 token) và dễ trùng chủ đề (hàng trăm câu Part 5 grammar cùng dạng) — điểm bi-encoder phân biệt yếu, cross-encoder phân biệt tốt.

**Model chốt: `BAAI/bge-reranker-v2-m3`** (~568M, multilingual, input 8k, Apache-2.0) — cùng họ bge-m3, hỗ trợ VN+EN. Fallback nhẹ hơn nếu CPU yếu: `BAAI/bge-reranker-base` (278M). **Không dùng** `ms-marco-MiniLM-*` vì English-only.

- Chạy qua `sentence-transformers.CrossEncoder("BAAI/bge-reranker-v2-m3")`, sigmoid score, batch 16, fp32 CPU. Cũng quantize ONNX int8 nếu cần.
- **[CHỐT HỢP NHẤT] Rerank top-20 mặc định** (P4 dùng 50, P5 dùng 20 vì CPU latency — chốt 20, cấu hình được; benchmark ở G2 trước khi nâng). `max_length 384` (chunk question_item ngắn ~200-600 ký tự), batch 8.
- **Gate chống hallucination [CHỐT HỢP NHẤT] hai mức:** score < **0.35** → loại chunk khỏi context (P4); score cao nhất của kết quả < **0.30** → cờ `low_confidence=True` (P5) → tầng generation trả lời "chưa tìm thấy nguồn đủ tin cậy" thay vì đoán. Nếu < 2 chunk vượt ngưỡng 0.35 → cũng đánh dấu `low_confidence`. Cả hai ngưỡng tunble trên golden set.

**Top-k mỗi tầng:**

| Tầng | Lấy | Chi phí (ước lượng CPU 16 luồng) |
|---|---|---|
| FTS5 + Chroma | 100 + 100 (+10 parent) | < 50 ms |
| RRF fusion | → 20 (mặc định) | < 5 ms |
| Rerank | 20 cặp → **top 8** | ~3–8 s (fp32) / ~2–5 s (ONNX int8) |
| Context pack | 8 chunk + parent/neighbor | < 20 ms |

Rerank là mắt xích đắt nhất → đặt budget: nếu muốn < 5 s end-to-end, dùng cờ `--no-rerank` (nâng top-k trực tiếp lên 12). Con số tốc độ trên là ước lượng, benchmark thật khi cài.

## 9.5 Chịu được các dạng query của người học TOEIC

### 9.5.1 Intent Router (rules trước, LLM fallback) — hợp nhất 8 intent

**[CHỐT HỢP NHẤT]** Tài liệu nguồn P4 định nghĩa 6 intent, P5 định nghĩa 5 intent với tên khác nhau (`metadata_lookup` ≡ `EXACT_ITEM`, `find_test` chưa có trong P4, `similar`/`strategy` chưa có trong P5) — hợp nhất thành 8 intent dưới đây, một bảng duy nhất cho cả CLI/API/generation:

| Intent | Rule (regex, ưu tiên từ trên xuống) | Ví dụ query |
|---|---|---|
| `exact_item` (= `metadata_lookup`) | `(câu\|question)\s*(số\s*)?(\d{1,3})` **và** `(đề\|de\|test\|vol\|bài thi)\s*(số\s*)?(\d{1,2}\|[ivxIVX]+\|\w+)`; series: `ETS\s*(?:Vol\.?\s*)?(\d)` / `ETS\s*(20\d{2})` | "giải thích câu 134 đề 3 ETS 2023", "đáp án question 134 vol 2" |
| `vocab` | từ nằm trong ngoặc kép/nháy; `nghĩa (của\|là)`, `(từ vựng\|word)\s*(chủ đề\|theo)`, `(?:từ vựng\|nghĩa của)\s*(.+)` | "reimburse nghĩa là gì", "từ vựng chủ đề meetings" |
| `grammar_explain` | `phân biệt`, `so sánh … (và\|vs)`, `giải thích` (không kèm số câu), tên điểm ngữ pháp quen (`because of`, `although`, `inversion`…) | "phân biệt although và despite" |
| `part_practice` | `part\s*[1-7]`, `(luyện\|cho)\s.*(câu\|đề)`, `bài tập part` | "cho 5 câu Part 5 khó về tense", "luyện Part 3" |
| `find_test` | `tìm\|find` + nội dung passage; query mô tả nội dung muốn tra ("thư xin việc tăng lương") | "tìm đề có thư xin việc tăng lương" |
| `similar` | "(tương tự\|giống) (câu\|câu hỏi) (này\|đó)" kèm item đang mở | "cho câu hỏi tương tự câu này" |
| `strategy` | `(cách\|chiến lược\|strategy\|làm.*part)` không kèm số câu | "cách làm Part 5 dạng paraphrase" |
| `general` | fallback | "Part 7 double passage thường hỏi gì" |

Rules miss/ambiguous → 1 call LLM (Ollama local hoặc API) phân loại vào 8 intent; router chạy **trước** mọi LLM rewrite khác để pattern số câu/đề không bị bóp méo. Router thuần regex, không gọi LLM khi rule khớp (giữ nguyên ràng buộc "B1 không gọi LLM" của P5).

### 9.5.2 Pipeline per intent

| Intent | Pipeline | Filter | Trọng số RRF (dense/bm25) |
|---|---|---|---|
| `exact_item` | **Deterministic SQL**: `test_alias` → `test_id` → chọn `chunks` theo `question_number`; trả item + đáp án + giải thích + parent. SQL miss (tên đề lạ) → hybrid với hard filter `question_number` | `test_id, question_number` | bỏ qua (không cần) |
| `vocab` | SQL exact `word_canon(word_norm)` trước; miss → hybrid | `unit_type='word_entry'` (+`lesson` khi nới) | 0.5 / 0.5 |
| `grammar_explain` | Hybrid + expansion | soft-boost `theory_point`, `lesson`, `question_item(part=5)` | 0.4 / 0.6 (thuật ngữ grammar là exact term) |
| `part_practice` | Hybrid theo chủ đề trong query + chọn mẫu; trả **chế độ luyện: ẩn đáp án/giải thích** (`reveal_answer=false`) | hard `part=X` (+`skill`) | 0.6 / 0.4 |
| `find_test` | BM25 trên chunk passage/talk → aggregate theo `test_id`, trả danh sách đề + đoạn khớp | `unit_type IN (passage, talk)` | 0.3 / 0.7 |
| `similar` | Dense-only ANN trên embedding của item hiện tại | `part` bằng item gốc, loại trừ chính nó | dense 1.0 |
| `strategy` | Hybrid + expansion trên lesson chunks | soft-boost `lesson`/`theory_point` | 0.5 / 0.5 |
| `general` | Hybrid toàn corpus + expansion | không hard filter | 0.6 / 0.4 |

### 9.5.3 Chi tiết quyết định cho từng dạng truy vấn kinh điển

- **"Giải thích câu 134 đề 3"**: bảng `test_alias(alias_lower → test_id)` gom biến thể tên đề ("ETS 2023 đề 3", "ETS Vol 2 Test 3", tên bìa VN…) — cùng đề tái bản dưới nhiều tên; alias được ingestion nuôi khi dedup về `work_id`/canon_group. Trả về đủ: câu hỏi, 4 lựa chọn, đáp án, giải thích (merge từ `n_sources` nguồn kèm ghi nguồn), và chunk-cha nếu Part 3/4/6/7.
- **Tra từ vựng**: `word_canon` là bảng entry đã merge chéo sách (dedup word-entry level, mục 8.3.6; key `(lemma.lower(), pos)`); bonus query hay dùng: "từ này xuất hiện ở câu nào" → FTS5 MATCH từ đó trên `question_item`.
- **Luyện theo Part**: trả N item (`N` từ query, mặc định 5) ngẫu nhiên có seed theo ngày; kèm 1 chunk `lesson` liên quan làm "chiến thuật"; ẩn đáp án tới khi submit.
- **Part 1 (ảnh)**: chunk mang `media_ref` (image_path); retrieval trả tham chiếu ảnh + caption/transcript để LLM mô tả; không embed ảnh trong v1.

### 9.5.4 Parent/neighbor expansion (bảo toàn cấu trúc, cấm flatten)

Sau rerank, với mỗi chunk trong top-8, SQL join theo `parent_id` / `question_number`:

| Part của item | Expansion |
|---|---|
| 1 | transcript câu + `image_ref` |
| 2 | chỉ item |
| 3, 4 | **chunk-cha = talk/transcript đầy đủ** (3 câu hỏi dùng chung 1 đoạn — tách rời là mất ngữ cảnh) |
| 5 | item + hàng xóm `question_number ± 1` cùng đề (đánh nhãn `is_context`) |
| 6, 7 | **chunk-cha = passage block** (giữ nguyên khối email/memo/bảng — không cắt theo ký tự) |

Context pack cuối: ≤ 8 item + parents, cap ~6k token cho LLM (chi tiết budget ở mục 10.3).

## 9.6 Schema tóm tắt (chi tiết DDL ở mục 12)

Các bảng phân hệ retrieval sở hữu: `chunks_fts` (FTS5 external-content), `emb_cache`, `test_alias`, `word_canon` + các cột `chunks` (`text_nodiacritic`, `canon_group`/`canonical_id`, `n_sources`).
---

# 10. Phân hệ 5 — Sinh câu trả lời (Answer Generation) + LLM local-first

## 10.0 Phạm vi và trạng thái kiểm chứng

Mọi con số hit-rate/faithfulness/latency trong chương này là **mục tiêu thiết kế kèm lý do**, chưa đo thực nghiệm — vì corpus và code chưa tồn tại. Chúng là ngưỡng khởi điểm bắt buộc calibrate ở Giai đoạn G2–G3 (mục 15), với lệnh kiểm chứng ghi kèm.

## 10.1 Pipeline trả lời — luồng chuẩn 7 bước

```
Câu hỏi (VI/EN)
   │
   ▼
[B1] QueryParser ──► QueryIntent {intent, part, test_number, question_number, series, lang}
   │                 (regex + từ điển alias, không gọi LLM khi rule khớp — bảng 9.5.1)
   ├─ intent = exact_item (metadata_lookup) ──► [ĐƯỜNG NHANH] SQLite queries.py ──► render trực tiếp (không LLM)
   ▼
[B2] Hybrid Retrieval: Chroma (cosine, bge-m3) ⊕ BM25 (SQLite FTS5) + metadata filter
   │        fuse = weighted RRF (k=60; vector 0.6 / bm25 0.4) → top-20
   ▼
[B3] CrossEncoder rerank (bge-reranker-v2-m3): top-20 → top-8, sigmoid score
   │        score < 0.35 → loại chunk; best score < 0.30 → cờ low_confidence
   ▼
[B4] Parent Expansion + Token Budget: question_item → kéo parent (passage/talk) theo parent_id;
        sắp theo rerank score, cắt ở ~6.000 token budget
   ▼
[B5] PromptBuilder: SYSTEM (rules) + NGỮ CẢNH có header nguồn [n] + CÂU HỎI + CHẾ ĐỘ
   ▼
[B6] LLMRouter.generate(): Ollama (mặc định) → model nhỏ → extractive fallback; stream token
   ▼
[B7] Postprocess: parse/validate trích dẫn [n] → render ĐÁP ÁN / GIẢI THÍCH / NGUỒN + bảng citation
```

### 10.1.1 B1 — QueryParser và QueryIntent

Mục tiêu: quy mọi truy vấn về question item (đơn vị tra cứu quan trọng nhất) và bắt đường nhanh không cần LLM. Schema intent + regex + quy tắc phân loại: xem **bảng 9.5.1** (đã hợp nhất — tránh hai định nghĩa intent lệch nhau giữa retrieval và generation).

```python
class QueryIntent(BaseModel):
    intent: Literal["exact_item", "vocab", "grammar_explain", "part_practice",
                    "find_test", "similar", "strategy", "general"]
    question_number: int | None   # 1-200
    test_number: int | None
    series: str | None            # "ETS_2023", "ETS_VOL_2", "HACKERS", ...
    part: int | None              # 1-7
    keywords: list[str]
    lang: Literal["vi", "en", "mixed"]
```

Quy tắc phân loại: khớp đủ question_number + test_number (hoặc + series) → `exact_item`; có part nhưng không có số câu → `general`/`part_practice` kèm filter part; có từ khóa từ điển → `vocab`. Không khớp gì → `general` (hybrid retrieval toàn kho).

### 10.1.2 B2 — Hybrid retrieval, tham số cụ thể

| Thành phần | Lựa chọn | Tham số & lý do |
|---|---|---|
| Embedding | `sentence-transformers` + **`BAAI/bge-m3`** (1024-d) **[CHỐT HỢP NHẤT — thay e5-large của tài liệu nguồn]** | Model đa ngôn ngữ mạnh cho cặp Anh–Việt (bắt buộc vì mỗi tài liệu trộn EN đề + VI giải thích). Không cần prefix. L2-normalize → inner product = cosine. Máy RAM < 8GB: config đổi sang `multilingual-e5-base` (768-d, nhanh ~2x, chất lượng giảm nhẹ). Encode max_length 512 |
| Vector store | **ChromaDB 1.5.9** (collections `toeic_child`/`toeic_parent`) **[CHỐT]** | Filter metadata native; cấu hình mục 9.1.2. (Tài liệu nguồn P5 dùng FAISS `IndexFlatIP` + bảng map `faiss_idx ↔ chunk_id` — thay vì Chroma; FAISS giữ lại chỉ khi >2M vector) |
| BM25 | **SQLite FTS5** (stdlib, không thêm lib) | Tokenize `porter unicode61 remove_diacritics 2`; điểm mấu chốt: fold dấu tiếng Việt phải tự làm qua cột `text_nodiacritic` (mục 9.3.1) |
| Fusion | **Weighted RRF**, `k = 60` | `score(d) = 0.6·1/(60+rank_vec) + 0.4·1/(60+rank_bm25)` — RRF không cần chuẩn hoá score hai hệ; trọng số 0.6/0.4 nghiêng vector vì truy vấn diễn đạt tự do là chính, tune lại trên golden set G2 |
| Filter | `where` Chroma + `WHERE` SQLite trước khi score | `part`, `test_id`, `question_number`, `unit_type`, `lang` — theo bảng 9.5.2 |

### 10.1.3 B3–B4 — Rerank, parent expansion, token budget

- **Reranker:** `BAAI/bge-reranker-v2-m3` qua `sentence-transformers.CrossEncoder` (multilingual, chạy CPU được). Cấu hình: rerank **top-20** (CPU latency), `max_length 384`, batch 8. Ngưỡng: score < 0.35 loại; best < 0.30 → cờ `low_confidence`, câu trả lời kèm cảnh báo. Tốc độ CPU ước tính 3-8s cho 20 cặp → cờ `--no-rerank` (nâng top-k trực tiếp lên 12) cho chế độ nhanh; đo thật ở G2 trước khi chốt mặc định.
- **Parent expansion (không được flatten):** chunk con là `question_item`; khi hit, `parent_expander.py` kéo `parent_id` (passage Part 6/7, talk Part 3/4) từ SQLite. Với Part 3/4, một talk block dùng chung 3 câu hỏi → khi dựng context phải ghép **transcript cha + toàn bộ câu hỏi cùng `group_id`/parent**; Part 6/7 ghép passage + các câu cùng passage. Lý do: tách rời câu hỏi khỏi transcript/passage là mất ngữ cảnh trả lời (cấm theo ràng buộc cấu trúc).
- **Token budget:** `num_ctx = 8192` cho model 7B; trừ system (~350 tok), câu hỏi, dự phòng output 1024 → **budget context ≈ 6.000 token**. Đếm bằng `tiktoken` `cl100k_base` xấp xỉ + margin 15% (tiếng Việt tốn thêm ~10-20% token so với tiếng Anh; chỉ cần xấp xỉ vì mục đích là budget, không phải billing — lưu ý khác đơn vị tokenizer XLM-R dùng cho chunking). Sắp chunk theo rerank score giảm dần, cắt khi vượt budget; không bao giờ cắt giữa 1 chunk (chunk `is_partial` gộp theo `(chunk_id gốc, part_index)` trước).

### 10.1.4 B5 — Prompt template (nguyên khối)

File: `config/prompts/system_qa.md` (template để file, không hardcode, cho phép chỉnh không cần sửa code).

```
### SYSTEM
Bạn là trợ lý luyện thi TOEIC L&R của một hệ thống RAG chạy trên tài liệu local.
CHỈ trả lời dựa trên các tài liệu trong mục NGỮ CẢNH bên dưới.

Quy tắc bắt buộc:
1. Mỗi khẳng định về nội dung đề thi, transcript, từ vựng, điểm ngữ pháp phải kèm trích
dẫn dạng [n] trỏ tới số thứ tự nguồn trong NGỮ CẢNH. Không trích nguồn không tồn tại.
2. KHÔNG bịa đáp án. Nếu NGỮ CẢNH có đáp án/giải thích cho câu hỏi đang xét, dùng đúng nó.
Nếu không đủ dữ kiện, viết đúng câu: "Không tìm thấy thông tin đủ trong tài liệu đã nạp."
và gợi ý 1-2 cách truy vấn khác.
3. Không dùng kiến thức bên ngoài để bổ sung nội dung đề thi. Kiến thức nền (ví dụ quy tắc
ngữ pháp chung) chỉ được dùng khi gắn nhãn rõ "(kiến thức chung)".
4. Trả lời bằng tiếng Việt; giữ thuật ngữ TOEIC bằng tiếng Anh (Part, statement, paraphrase,
distractor...); trích nguyên văn câu hỏi/lựa chọn/từ vựng bằng tiếng Anh.
5. Đúng định dạng đầu ra, không thêm phần khác.

Định dạng đầu ra:
ĐÁP ÁN: <A/B/C/D hoặc câu trả lời ngắn; không xác định được → "Không xác định từ tài liệu">
GIẢI THÍCH: <3-6 câu, mỗi bằng chứng kèm [n]>
MỞ RỘNG: <từ vựng/điểm ngữ pháp liên quan kèm [n]; bỏ trống nếu không có>
NGUỒN: <danh sách [n] đã dùng>

### USER (dựng bởi prompt_builder.py)
NGỮ CẢNH (xếp theo độ liên quan giảm dần):
[1] Nguồn: ETS 2023 | Đề: Test 2 | Part 5 | Câu: 134 | Loại: question_item | Ngôn ngữ: en | chunk_id: q_ets2023_t2_p5_134
    <chunk_text>
[2] Nguồn: File tổng hợp "chốt điểm ngữ pháp Part 5" | Part 5 | Câu: 134 (đề gốc: ETS 2023 T2) | Loại: explanation | Ngôn ngữ: vi | chunk_id: exp_coll1_0042
    <chunk_text>
[3] Nguồn: Hackers TOEIC Grammar | Lesson 7 | Loại: lesson | Ngôn ngữ: vi | chunk_id: les_hackg_7_2
    <chunk_text>

CÂU HỎI CỦA NGƯỜI DÙNG: "giải thích câu 134 đề 2 ETS 2023"
CHẾ ĐỘ: explain
```

Variant template (cùng SYSTEM, khác CHẾ ĐỘ + đuôi instruction):

- `qa` — hỏi đáp tự do: "Trả lời trực tiếp câu hỏi, ngắn gọn, có [n]."
- `explain` — giải thích 1 câu cụ thể: yêu cầu phân tích từng lựa chọn A-D sai vì sao (dựa [n]).
- `strategy` — truy vấn sách chiến lược: "Tóm tắt chiến thuật theo [n], nếu các nguồn mâu thuẫn thì nêu cả hai kèm nguồn."
- `practice_grade` — chấm bài luyện tập: đầu vào câu hỏi + đáp án người học + answer key chunk; output JSON ngắn `{"correct": true/false, "explanation": "...", "citations": [n]}` (Ollama `format: "json"`).

### 10.1.5 B7 — Postprocess citation & render

- Regex `\[(\d{1,2})\]`: index `[n]` vượt số nguồn → strip + log warning; câu trả lời không có citation nào cho phần GIẢI THÍCH → gắn cờ `citation_missing=true` (dòng metrics, không chặn người dùng).
- Render cuối: khối NGUỒN dạng bảng — `[1] ETS 2023 · Test 2 · Part 5 · Câu 134 · question_item · q_ets2023_t2_p5_134` (đúng yêu cầu trích dẫn: số đề, Part, chunk) + provenance "Nội dung này cũng có trong: …" từ `chunk_sources` (mục 8.3.6).
- Streaming: `async generator` từ Ollama SSE → API trả SSE (`/ask/stream`), CLI dùng `rich.live` hiển thị dần — first token là chỉ số UX quan trọng vì generation CPU mất 15-40s.

### 10.1.6 Đường nhanh (bypass LLM) cho metadata lookup

Truy vấn "câu 134 đề 3 ETS Vol 2" là truy vấn chính xác theo metadata → đi thẳng `queries.py`:
`SELECT ... FROM chunks WHERE unit_type='question_item' AND question_number=134 AND test_id = :tid` + JOIN explanation chunks theo `parent_id`/`question_number`. Trả về < 1s, không tốn LLM, luôn hoạt động kể cả khi Ollama chết. Đây là nền để pipeline không bao giờ "chết" hoàn toàn.

## 10.2 LLM local-first

### 10.2.1 Lựa chọn model

| Vai trò | Model (Ollama tag) | RAM yêu cầu | Lý do |
|---|---|---|---|
| Mặc định (generation) | **`qwen2.5:7b-instruct-q4_K_M`** (~4.7GB) | 8GB+ | Chất lượng tiếng Việt tốt nhất lớp 7B open-weight hiện có trên Ollama; license Apache-2.0; instruction-following đủ để giữ format + citation. |
| Chất lượng cao (máy 16GB+; đồng thời là judge eval) | **`qwen2.5:14b-instruct-q4_K_M`** (~9GB) | 16GB (thoải mái ở 32GB) | Giảm lỗi giữ format/định nghĩa; dùng cho LLM-as-judge faithfulness. |
| Dự phòng suy giảm | `qwen2.5:3b-instruct-q4_K_M` | 4GB | Chạy được khi RAM chật / model chính lỗi. |
| Phương án thay thế | `gemma2:9b` | 10GB | Multilingual tốt; đổi bằng 1 dòng settings nếu qwen2.5 tiếng Việt không đạt ở G3. |

**Cấu hình bắt buộc (dễ sai nhất):** `num_ctx: 8192` — mặc định Ollama là 2048, RAG context sẽ bị **cắt ngầm** → hallucination. Còn lại: `temperature 0.15` (QA thực tế, giảm bịa), `top_p 0.9`, `num_predict 1024`, `keep_alive "30m"` (tránh cold-start 10-30s mỗi câu hỏi). Env: `OLLAMA_NUM_PARALLEL=2`, `OLLAMA_MAX_LOADED_MODELS=2`.

### 10.2.2 Xử lý khi API/model lỗi hoặc quá tải

Lớp `llm/router.py` + `llm/breaker.py`, hành vi xác định trước:

1. **Health check:** `GET {OLLAMA_HOST}/api/tags`, timeout 2s — chạy khi start (`toeic doctor`), trước request đầu, và expose ở `/health`.
2. **Retry (thư viện `tenacity`):** retry trên `httpx.TimeoutException`, `httpx.TransportError`, HTTP 429/500/502/503/504; `wait_exponential_jitter(initial=1, max=20)`, `stop_after_attempt=4`. Timeout: connect 5s, read 180s (generation CPU dài).
3. **Circuit breaker tự viết (~60 dòng, không thêm dependency):** `failure_threshold=3`, `recovery_timeout=60s`, half-open cho phép 1 request thử lại. Trạng thái (closed/open/half-open) hiển thị ở `/health` và CLI `toeic doctor`.
4. **Quá tải:** `asyncio.Semaphore(1)` quanh generate (Ollama xử lý tuần tự mặc định; nâng thành 2 nếu đặt `OLLAMA_NUM_PARALLEL=2`). Request chờ hàng đợi > 60s → HTTP 503 kèm `Retry-After: 30` và thông điệp "hệ thống bận, thử lại sau".
5. **Thang suy giảm (degradation ladder):**
   1. Model chính (7b/14b) →
   2. Model nhỏ `qwen2.5:3b` khi model chính fail hoặc > 60s chưa có first token →
   3. **Extractive fallback (không LLM, `generation/extractive.py`):** trả nguyên văn top chunk + answer key + giải thích từ SQLite, header rõ "chế độ truy xuất thuần (LLM không khả dụng)".
6. **Thiết kế nền:** 4/6 use case chính (tra cứu câu, tra từ vựng, tìm đề, lấy đề luyện) không cần LLM → hệ thống luôn usable khi LLM lỗi; chỉ luồng giải thích tự do mới phụ thuộc LLM.

### 10.2.3 Cloud API — gate bản quyền (bắt buộc)

Ràng buộc: **KHÔNG upload tài liệu ETS/đề leak lên cloud** — local-first là ràng buộc nội dung. Thiết kế:

- `settings.llm.allow_cloud: false` (mặc định tắt hoàn toàn).
- Khi bật (per-request flag `allow_cloud=true`): `OpenAICompatProvider` (thư viện `openai`, `base_url` trỏ OpenRouter) chỉ được phép nếu **mọi chunk vào context có `cloud_ok=1`** trong SQLite. Ingestion mặc định ghi `cloud_ok=0` cho mọi nguồn; chỉ người dùng tự đánh dấu nguồn của mình là được phép.
- Use case cloud hợp lệ duy nhất ngoài việc đó: **rewrite query** — chỉ gửi câu hỏi gốc của người dùng (không gửi chunk nào) về model rẻ (`deepseek/deepseek-chat` hoặc `gpt-4o-mini`) để chuẩn hoá truy vấn; rủi ro rò rỉ gần bằng 0 vì chỉ là câu hỏi.

Cấu hình tập trung `config/settings.yaml` + env override (pydantic-settings, prefix `TOEIC_RAG_`): `ollama_host`, `gen_model`, `fallback_model`, `embed_model`, `rerank_model`, `num_ctx`, `temperature`, `top_k`, `rrf_weights`, `allow_cloud`, `data_dir`.

## 10.3 Contract với phân hệ ingestion

Phân hệ sinh câu trả lời tiêu thụ đúng schema sau; ingestion bắt buộc giao đúng (cột tương ứng trong bảng `chunks` mục 12):

```python
class Chunk(BaseModel):
    chunk_id: str            # "q_ets2023_t2_p5_134" — ổn định, sinh từ key tự nhiên (idempotent)
    doc_id: str              # nguồn: đề/sách/file tổng hợp
    unit_type: Literal["question_item","passage","passage_set","talk","transcript_cue",
                       "explanation","word_entry","lesson","theory_point","exercise_item",
                       "answer_key_entry","photo_caption","instruction","table"]
    parent_id: str | None    # BẮT BUỘC khác None cho question_item thuộc P3/4/6/7
    group_id: str | None     # nhóm talk (3 câu) / passage-set / passage bị cắt
    test_id: str | None      # "ets2023_t2"
    part: int | None
    question_number: int | None   # 1-200
    lang: Literal["en","vi","mixed"]
    text: str ; text_nodiacritic: str
    cloud_ok: bool = False   # gate gửi API cloud
```

Invariants pipeline dựa vào: đề parse thiếu câu/trùng số câu phải mang cờ `needs_review` và **không vào index**; ingestion idempotent theo hash nội dung chuẩn hoá sau OCR (nạp trùng do thao tác người dùng không sinh duplicate).

---

# 11. Giao diện sử dụng (CLI + API)

## 11.1 CLI (`typer` + `rich`) — `toeic`

| Lệnh | Việc | Đường xử lý |
|---|---|---|
| `toeic ask "..." [--mode qa\|explain\|strategy] [--part N] [--test N] [--no-rerank]` | Hỏi đáp tự do | Full pipeline (B1→B7), stream ra terminal |
| `toeic explain "câu 134 đề 2 ets 2023"` | Giải thích 1 câu cụ thể | Metadata fetch trực tiếp + hybrid tìm giải thích/giáo án liên quan → LLM tổng hợp |
| `toeic practice part 5 --count 10 [--series ets2023]` | Luyện interactive: hiện từng câu, chọn A-D, chấm + giải thích | SQLite fetch (không LLM) → chấm bằng key → giải thích có citation |
| `toeic vocab negotiate [--topic office]` | Tra từ vựng | SQLite word_canon + FTS5, merge entry trùng kèm nguồn từng phiên bản |
| `toeic find "thư xin việc tăng lương" [--part 7]` | Tìm đề/passage chứa nội dung | BM25 trên chunk passage/talk, aggregate theo `test_id`, trả danh sách đề + đoạn khớp |
| `toeic test list` / `toeic test show ets2023_t2 [--part 5]` | Duyệt kho đề + trạng thái validate (đủ 200 câu hay flag review) | SQLite |
| `toeic ingest <path>` | Nạp dữ liệu (gọi ingestion module, resumable/idempotent) | ingestion |
| `toeic eval run [--suite all] [--save]` | Chạy golden set đánh giá | eval runner |
| `toeic doctor` | Kiểm tra môi trường: Ollama reachable, model đã pull, index tồn tại, số chunk/đề | health checks |

## 11.2 API (FastAPI + `uvicorn[standard]`)

| Method | Path | Chức năng |
|---|---|---|
| `POST` | `/ask` | Body `{question, mode, top_k?, filters?}` → `{answer, citations[], confidence, mode_used, latency_ms}` |
| `POST` | `/ask/stream` | SSE: token stream; event cuối chứa citations đầy đủ |
| `GET` | `/practice/quiz?part=5&count=10&series=...` | Trả question items **không kèm đáp án** + `session_id` |
| `POST` | `/practice/submit` | `{session_id, answers:[{question_id, choice}]}` → điểm + giải thích từng câu (citation) |
| `GET` | `/vocab/{word}` · `GET /vocab/search?q=&topic=` | Word entry đã merge + ví dụ + nguồn |
| `GET` | `/tests` · `GET /tests/{test_id}/questions?part=5` | Danh sách đề (kèm cờ validate 200 câu) / câu hỏi theo đề-Part |
| `GET` | `/health` | Ollama status, breaker state, index stats (số chunk, số đề, embed model) |

Chống CORS không cần (local); chạy `uvicorn toeic_rag.api.main:app --host 127.0.0.1 --port 8300` (chỉ loopback — dữ liệu bản quyền không expose LAN).

## 11.3 Mapping use case → đường xử lý

| Use case | Cần LLM? | Chính |
|---|---|---|
| Tra "câu N đề M" | Không | SQLite metadata |
| Hỏi đáp nội dung đề | Có | hybrid + rerank + prompt |
| Giải thích 1 câu | Có (nhưng có fallback) | metadata + hybrid + LLM; extractive nếu LLM chết |
| Luyện theo Part | Không (fetch/chấm); Có (giải thích sâu) | SQLite → LLM chỉ khi xem giải thích |
| Tra từ vựng | Không | SQLite + FTS5 (+ embedding fuzzy khi không khớp chính xác) |
| Tìm đề | Không | BM25 aggregate theo test_id |
---

# 12. Schema dữ liệu hợp nhất (SQLite `data/rag.sqlite3` + Chroma)

> **[HỢP NHẤT]** Bốn tài liệu nguồn mỗi bên có một schema SQLite riêng (P1: documents/tests/chunks/index_queue…; P2: chunks level-based + parse_review + ingestion_state; P3: works/documents/chunk_sources/provenance_edges/ingest_jobs; P4: rag.sqlite3 chunks_fts/emb_cache/test_alias/word_canon; P5: toeic.db). Chốt **một file SQLite duy nhất** với DDL hợp nhất dưới đây. Ghi chú nguồn từng bảng/cột ở comment. Đặt tên cột theo chuẩn đã chốt: `chunk_id` (một cột duy nhất), `content_sha256` (= `normalized_text_sha256` của P1), `parent_id` (= `parent_chunk_id` của P1).

```sql
PRAGMA journal_mode = WAL;

-- ===== ĐỊNH DANH WORK / DOCUMENT / TEST (P1 + P3) =====
CREATE TABLE works (                          -- (P3) work = 1 đề/sách, độc lập mọi file
  id TEXT PRIMARY KEY,
  test_key TEXT UNIQUE,                       -- normalize(title) + structure fingerprint
  title_canonical TEXT,
  doc_type TEXT,                              -- official_test|mock_test|explanation_key|strategy_book|wordlist|grammar_book|community_compilation|transcript|audio_zip|other
  origin TEXT                                 -- ets_official|center_book|community|leak|unknown
);

CREATE TABLE documents (                      -- (P1 + P3 hợp nhất)
  doc_id TEXT PRIMARY KEY,                    -- uuid4 hex (P1)
  work_id TEXT REFERENCES works(id),
  source_path TEXT NOT NULL,                  -- path gốc để truy vết
  source_path_norm TEXT,                      -- (P3) lowercase key, FS case-insensitive
  store_relpath TEXT NOT NULL,                -- content-addressed: store/raw/{sha[:2]}/{sha}{ext}
  file_sha256 TEXT NOT NULL,                  -- hash byte thô (idempotency tầng file)
  content_sha256 TEXT,                        -- hash canonical text sau normalize (= normalized_text_sha256 P1)
  minhash BLOB,                               -- (P3) 128×uint64, doc-level, word 5-gram
  structure_fingerprint TEXT,                 -- (P3) JSON số câu per part
  title TEXT, source_org TEXT, edition_year INTEGER,
  doc_type TEXT NOT NULL,
  parser_profile TEXT,                        -- pdf_native|pdf_ocr_tesseract|pdf_ocr_paddle|docx|epub|txt|srt|xlsx|apkg|image_ocr|djvu
  ocr_conf_mean REAL, page_count INTEGER,
  language_primary TEXT,                      -- en|vi|mixed
  source_priority REAL,                       -- ets_official=1.0|center_book=0.7|community_explanation=0.6|community=0.5
  canonical_score REAL,                       -- (P3) công thức 0.40/0.25/0.25/0.10
  origin TEXT,
  ingest_status TEXT NOT NULL DEFAULT 'pending'
    CHECK(ingest_status IN ('pending','parsing','ocr','parsed','needs_review','indexed','failed')),
  status TEXT DEFAULT 'active',               -- (P3) active|superseded (version policy)
  error_json TEXT,                            -- {stage, message, traceback_head}
  ingest_batch_id TEXT,
  ingest_started_at TEXT, ingested_at TEXT
);
-- partial unique: file fail được nạp lại thử, file OK thì chặn nạp lại ở tầng intake (P1)
CREATE UNIQUE INDEX uq_doc_file_sha ON documents(file_sha256) WHERE ingest_status != 'failed';
CREATE UNIQUE INDEX uq_doc_content_sha ON documents(content_sha256) WHERE content_sha256 IS NOT NULL;

CREATE TABLE tests (                          -- (P1)
  test_id TEXT PRIMARY KEY,                   -- {series_key}_t{number} vd ets2023_t2 [CHỐT]
  doc_id TEXT REFERENCES documents(doc_id),
  work_id TEXT REFERENCES works(id),
  test_number INTEGER,                        -- NULL + cờ review nếu không xác định
  test_number_source TEXT,                    -- bookmark|heading|sequence|filename
  test_label TEXT,
  format TEXT,                                -- full_200 | mini_100 | mini_50 | custom
  question_count INTEGER,
  validation_status TEXT,                     -- ok | unverified | mismatch
  validation_detail TEXT                      -- JSON expected/actual/missing/duplicated
);

-- ===== CHUNKS (hợp nhất P1 + P2 + P3 + P5-contract) =====
CREATE TABLE chunks (
  chunk_id TEXT PRIMARY KEY,                  -- chuỗi ổn định dễ đọc [CHỐT]: q_ets2023_t2_p5_134 (thay uuid4 P1 / uuid5 P2)
  doc_id TEXT REFERENCES documents(doc_id),
  test_id TEXT REFERENCES tests(test_id),
  work_id TEXT,
  level INTEGER,                              -- (P2) 0 doc | 1 block | 2 parent | 3 child
  unit_type TEXT NOT NULL CHECK(unit_type IN (
    'question_item','passage','passage_set','talk','photo_caption','explanation',
    'answer_key_entry','lesson','theory_point','exercise_item','word_entry',
    'transcript_cue','instruction','table')),
  content_type TEXT NOT NULL,                 -- question|options|answer|explanation|transcript|vocabulary|strategy|instruction
  parent_id TEXT REFERENCES chunks(chunk_id), -- question → passage/talk (cấm flatten)
  group_id TEXT,                              -- (P2) double/triple passage, talk bị cắt
  part INTEGER CHECK(part BETWEEN 1 AND 7),
  skill TEXT,                                 -- listening|reading|vocab|grammar|strategy
  question_number INTEGER, question_number_end INTEGER,
  talk_no INTEGER, passage_no INTEGER,
  passage_type TEXT,                          -- email|memo|letter|notice|form|article|table|announcement|NULL
  answer TEXT, answer_source TEXT,            -- đáp án tách khỏi text (anti-leakage); nguồn: answer_key|explanation|manual
  heading_path TEXT, lesson_id TEXT, part_tag TEXT, topic_tag TEXT,   -- (P1/P2) sách chiến thuật
  lemma TEXT, pos TEXT,                       -- (P2) word_entry
  lang TEXT NOT NULL,                         -- en|vi|mixed (bắt buộc)
  text TEXT NOT NULL,
  text_nodiacritic TEXT,                      -- (P4/P5) phục vụ FTS5 fold tiếng Việt
  text_sha256 TEXT,                           -- hash NFC lowercase (dedup exact)
  qi_key TEXT,                                -- (P3) identity key question_item
  simhash INTEGER,                            -- (P3) 64-bit, chỉ chunk ≥ 80 token
  token_count INTEGER,                        -- tokenizer XLM-R
  is_partial INTEGER DEFAULT 0, part_index INTEGER, part_count INTEGER,  -- (P2) fallback vượt cap
  page_span TEXT,                             -- "12-13"
  time_span TEXT,                             -- SRT: "00:03:12,000-00:04:01,500"
  media_ref TEXT,                             -- image/audio ref: store/images/{doc_id}/p{n}.png
  ocr_conf REAL, quality_score REAL,
  status TEXT NOT NULL DEFAULT 'canonical',   -- (P3) canonical|duplicate_of|superseded|review
  canonical_id TEXT REFERENCES chunks(chunk_id),
  review_flags TEXT,                          -- JSON array cờ
  linked INTEGER,                             -- (P2) map ngược về đề gốc thành công
  cloud_ok INTEGER NOT NULL DEFAULT 0,        -- (P5) gate cloud API
  embedding_model TEXT, n_sources INTEGER DEFAULT 1,
  ingest_batch_id TEXT, created_at TEXT
);
CREATE INDEX ix_chunks_parent ON chunks(parent_id);
CREATE INDEX ix_chunks_test_part_qn ON chunks(test_id, part, question_number);
CREATE INDEX ix_chunks_unit ON chunks(unit_type);
CREATE UNIQUE INDEX uq_qi_key ON chunks(qi_key) WHERE qi_key IS NOT NULL;

CREATE TABLE chunk_links (                    -- (P1): explains|translates|audio_map|next_page|similar_to|translation_of
  chunk_id TEXT, link_type TEXT, target_chunk_id TEXT, note TEXT,
  PRIMARY KEY (chunk_id, link_type, target_chunk_id)
);

CREATE TABLE chunk_sources (                  -- (P3) provenance N:1 — mọi bản sao
  chunk_id TEXT, doc_id TEXT, source_path TEXT, page INTEGER,
  question_number_in_source INTEGER, ingested_at TEXT, ocr_engine TEXT,
  PRIMARY KEY (chunk_id, doc_id)
);

CREATE TABLE dedup_matches (                  -- (P1) audit trail mọi cặp dedup
  chunk_id_a TEXT, chunk_id_b TEXT, similarity REAL,
  method TEXT,                                -- exact_sha|qi_key|simhash|minhash|rapidfuzz|question_key|cross_lang
  decision TEXT, decided_at TEXT,             -- keep_both|drop_b|merge_explanations|canon_a
  PRIMARY KEY (chunk_id_a, chunk_id_b, method)
);

CREATE TABLE audio_files (                    -- (P1)
  doc_id TEXT, audio_relpath TEXT, sha256 TEXT,
  duration_sec REAL, mapped_test_id TEXT, mapped_question_group TEXT,
  naming_match TEXT,                          -- exact|heuristic|unmatched
  PRIMARY KEY (doc_id, audio_relpath)
);

-- ===== INGESTION CHECKPOINT (P1 + P3 hợp nhất) =====
CREATE TABLE ocr_pages (                      -- checkpoint resumable theo trang (P1)
  doc_id TEXT, page_no INTEGER, status TEXT,  -- ok|ocr_failed|skipped
  text_sha256 TEXT, conf_mean REAL, updated_at TEXT,
  PRIMARY KEY (doc_id, page_no)
);
CREATE TABLE ingest_jobs (                    -- (P3, gộp ingest_stage của P1)
  file_path_norm TEXT, file_sha256 TEXT, doc_id TEXT,
  stage TEXT,                                 -- extract|ocr_page_N|parse|dedup_l1|chunked|dedup_l2|indexed|done
  checkpoint_json TEXT, status TEXT, started_at TEXT, finished_at TEXT,
  PRIMARY KEY (file_path_norm, stage)
);

-- ===== INDEX / EMBEDDING (P1 + P4) =====
CREATE TABLE index_queue (
  chunk_id TEXT PRIMARY KEY, status TEXT,     -- queued|embedded|failed
  retry_count INTEGER DEFAULT 0, updated_at TEXT
);
CREATE TABLE emb_cache (                      -- (P4)
  key TEXT PRIMARY KEY,                       -- sha256(model_id|hf_revision|max_length|normalize|text)
  model TEXT NOT NULL, dim INTEGER NOT NULL, vec BLOB NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ===== RETRIEVAL (P4) =====
CREATE VIRTUAL TABLE chunks_fts USING fts5(   -- external-content trên chunks; sync bằng trigger
  text, text_nodiacritic,
  tokenize = 'porter unicode61 remove_diacritics 2',
  content = 'chunks', content_rowid = 'rowid'
);
CREATE TABLE test_alias (alias_lower TEXT PRIMARY KEY, test_id TEXT REFERENCES tests(test_id));
CREATE TABLE word_canon (                     -- entry wordlist đã merge (P4) — ground truth vẫn là chunk word_entry
  word_norm TEXT PRIMARY KEY,                 -- lemma.lower() (+pos trong metadata) [CHỐT: key P3 (lemma,pos), P4 word_norm]
  lemma TEXT, pos TEXT,
  merged_entries TEXT,                        -- JSON definitions/examples + sources[]
  canonical_chunk_id TEXT REFERENCES chunks(chunk_id)
);

-- ===== DEDUP MEASUREMENT / REVIEW (P3) =====
CREATE TABLE provenance_edges (work_id TEXT, related_work_id TEXT, relation TEXT, confidence REAL, note TEXT);
CREATE TABLE dedup_stats (run_id TEXT, level TEXT, n_raw INT, n_dup_exact INT,
  n_dup_lexical INT, n_dup_semantic INT, n_merged INT, n_review INT, n_unique INT);
CREATE TABLE review_queue (
  id TEXT PRIMARY KEY, kind TEXT,             -- answer_conflict|gray_zone|work_merge_confirm|needs_review
  a_id TEXT, b_id TEXT, score REAL, reason TEXT,
  created_at TEXT, resolved_status TEXT
);
CREATE TABLE gold_pairs (pair_id TEXT PRIMARY KEY, a_id TEXT, b_id TEXT, label TEXT, labeler TEXT, note TEXT);
CREATE TABLE sentinel_queries (query_id TEXT PRIMARY KEY, query_text TEXT, expected_chunk_id TEXT);
```

**Chroma (mục 9.1.2):** 2 collections `toeic_child` / `toeic_parent` — vector 1024-d L2-normalized; metadata phẳng scalar-only: `unit_type, part, test_id, question_number, skill, lang, canon_group, parent_id, n_sources`. Rebuild từ SQLite + emb_cache mà không re-embed.

---

# 13. Cấu trúc repo, cấu hình và thư viện

## 13.1 Cây thư mục (hợp nhất P4 + P5)

```
rag_toeic/
├─ pyproject.toml / requirements.txt / requirements-eval.txt
├─ config/
│  ├─ settings.yaml                 # model, retrieval, prompt params, allow_cloud, data_dir
│  ├─ thresholds.yaml               # [CHỐT] ngưỡng dedup/retrieval calibrate — MỘT file duy nhất (P3 5.2)
│  └─ prompts/ system_qa.md · system_practice.md · judge_faithfulness.md
├─ data/                            # gitignore — artifact local
│  ├─ rag.sqlite3                   # SSOT (mục 12)
│  ├─ chroma/                       # toeic_child + toeic_parent
│  ├─ store/raw/ · store/images/    # content-addressed gốc + ảnh Part 1
│  └─ cache/                        # (embedding cache nằm trong rag.sqlite3 bảng emb_cache)
├─ .models/hf                       # HF_HOME — bge-m3, bge-reranker-v2-m3, offline cache
├─ src/toeic_rag/
│  ├─ config.py · schemas.py        # Chunk, QueryIntent, Citation, AnswerResult
│  ├─ retrieval/ query_parser.py · embedder.py · vector_store.py · bm25_store.py ·
│  │              hybrid.py · reranker.py · parent_expander.py
│  ├─ generation/ prompt_builder.py · generator.py · citation.py · extractive.py
│  ├─ llm/ base.py · ollama_client.py · openai_compat.py · router.py · breaker.py
│  ├─ stores/ db.py (WAL, migrations) · queries.py
│  ├─ services/ ask_service.py · practice_service.py · vocab_service.py
│  ├─ api/ main.py · schemas.py
│  ├─ cli/ app.py (typer)
│  └─ eval/ golden.py · metrics.py · judge.py · runner.py
├─ ingestion/                       # pipeline S1–S10 (mục 6)
│  ├─ interface.py · route.py · extract/ (pdf_ocr.py · ocr_tesseract.py · ocr_paddle.py)
│  ├─ normalize.py (normalize_for_dedup dùng chung với dedup) · structure.py
│  ├─ dedup/ (l1_doc.py · l2_chunk.py · canonical.py) · enqueue.py
├─ tests/ test_query_parser.py · test_hybrid.py · test_citation.py · test_api.py (TestClient + mock LLM)
└─ eval/ golden/groupA..E.jsonl · results/run_<ts>.json
```

## 13.2 requirements.txt (có lý do từng lib)

```
# Ingestion / OCR
pymupdf>=1.24                    # PDF native + find_tables + get_text("dict")
pikepdf>=9                       # repair PDF xref đúng 1 lần
opencv-python-headless>=4.9      # tiền xử lý ảnh OCR (không dependency GUI)
pytesseract>=0.3.10              # Tesseract 5 wrapper (cài binary UB-Mannheim riêng)
paddleocr                        # OPTIONAL — fallback conf < 60 (paddlepaddle nặng ~1-2GB)
pdfplumber>=0.11                 # fallback find_tables
python-docx>=1.1 ; ebooklib>=0.18 ; beautifulsoup4>=4.12 ; lxml>=5
srt>=3.5 ; mutagen>=1.47         # SRT cues; duration audio MP3/M4A
openpyxl>=3.1                    # XLSX wordlist (pandas engine)
charset-normalizer>=3.3          # decode + heuristic TCVN3/VNI
# Chunking / Dedup
datasketch>=2.0                  # MinHash + LSH
simhash>=2.1 ; mmh3>=5.0         # SimHash 64-bit
rapidfuzz>=3.0                   # token_set_ratio / partial_ratio confirm
lingua-language-detector>=2.0    # lang detect en+vi
# Retrieval
sentence-transformers>=3.0,<4    # bge-m3 embedding + CrossEncoder rerank, CPU
chromadb==1.5.9                  # vector store (pin version — API hnsw config đang drift)
# BM25: SQLite FTS5 builtin — không thêm dependency, có persist
flagembedding / FlagEmbedding    # OPTIONAL — chỉ khi bật sparse lexical-weights của bge-m3
# LLM
httpx>=0.27                      # async client Ollama REST (stream)
openai>=1.40                     # OpenAI-compat cho API rẻ (tùy chọn, gate cloud)
tenacity>=9.0                    # retry/backoff
# App
fastapi>=0.115 ; uvicorn[standard]>=0.30
typer>=0.12 ; rich>=13.9
pydantic>=2.9 ; pydantic-settings>=2.5 ; PyYAML>=6.0
tiktoken>=0.8                    # đếm token xấp xỉ cho budget context LLM (offline)
pytest>=8.3
# requirements-eval.txt: pandas, matplotlib (đường P-R dedup). KHÔNG dùng ragas — nó kéo
# langchain nặng; metrics tự viết (deterministic) + LLM-as-judge chạy local.
```

**Lưu ý Python version (đã kiểm chứng môi trường):** máy có Python 3.14.6; khuyến nghị tạo venv **3.11 hoặc 3.12** (dry-run resolve được nhiều wheel trên 3.14 nhưng chưa test cài thực tế; 3.11/3.12 là vùng wheel đầy đủ nhất cho torch/faiss-cpu/paddlepaddle trên Windows).

---

# 14. Ràng buộc Windows & local-first (xuyên suốt mọi phân hệ)

- **pathlib toàn bộ**, không hardcode `/`; mở đường dẫn dài: helper thêm prefix `\\?\` khi vượt MAX_PATH 260; hệ file case-insensitive → lưu `source_path_norm` (lowercase) vào DB làm key, giữ original path để hiển thị; mọi đường dẫn tạo ra < 200 ký tự (content-addressed tự bảo đảm).
- **ZIP encoding** (nguồn Hàn): kiểm bit 11 (`flag_bits & 0x800`) → utf-8, ngược lại cp437; tên file Hàn garbled → thử fallback cp949. Đường dẫn giải nén lưu kèm encoding đã dùng. Tên file không làm key dedup.
- **Model cache offline**: `HF_HOME=E:\PROJECT\rag_toeic\.models\hf` — tải model embedding 1 lần, mọi lần chạy sau offline (đáp ứng local-first cho nội dung ETS/leak).
- **Tesseract binary**: cài UB-Mannheim, path thêm vào PATH; `toeic doctor` kiểm tra tồn tại trước khi ingest PDF scan.
- **Content không rời máy**: mặc định `allow_cloud=false`; gate `cloud_ok` per-chunk (mục 10.2.3); API bind 127.0.0.1 only.
- **SQLite WAL mode** cho truy cập song song CLI + API + ingestion worker.

---

# 15. Lộ trình triển khai — 6 giai đoạn, mỗi giai đoạn có kết quả kiểm chứng được

**[HỢP NHẤT]** Lộ trình gốc của P5 (G0–G6) được giữ làm khung; bổ sung công việc của ingestion/dedup (Tesseract setup, calibration ngưỡng, gold set dedup) vào đúng giai đoạn.

| Giai đoạn | Thời lượng | Kết quả | Cách kiểm chứng (lệnh → tiêu chí pass) |
|---|---|---|---|
| **G0 — Khung dự án** | 2-3 ngày | Repo skeleton, config, venv 3.11/3.12, **cài Tesseract UB-Mannheim + tessdata_best**, SQLite schema + migrations (mục 12), `/health`, `toeic doctor` | `toeic doctor` → Ollama OK, model đã pull, tesseract tồn tại, index rỗng OK; `pytest tests/` xanh (test_query_parser trước tiên) |
| **G1 — Tra cứu metadata không LLM** | Tuần 1 | QueryParser + `queries.py` + extractive render + `test_alias`; nạp tay 1 đề ETS (200 câu + key + giải thích) qua pipeline S1–S10 (OCR path) | Golden nhóm A: **30/30 truy vấn "câu N đề M" đúng câu hỏi, đúng đáp án**; `toeic explain "câu 134 đề 2"` < 1s, log xác nhận không gọi LLM; nạp lại cùng file → số chunk không đổi (idempotency) |
| **G2 — Hybrid retrieval** | Tuần 2-3 | embedder (bge-m3 + emb_cache) + Chroma 2 collections + FTS5 + RRF + rerank; ingest pilot (1 đề full + transcript + sổ 600 từ); **benchmark tốc độ encode/rerank thực tế**; calibrate trọng số RRF + ngưỡng rerank 0.35/0.30 | `toeic eval run --suite retrieval` → **hit@5 ≥ 0.80 nhóm B** (mục tiêu sau tuning 0.85-0.90); p95 retrieval < 3s (no-rerank) / < 10s (rerank) trên máy dev CPU; golden retrieval Recall@10/MRR@10 cho 3 cấu hình dense-only/bm25-only/hybrid (mục 16.2) |
| **G3 — Sinh câu trả lời** | Tuần 4 | Ollama + prompt + citation postprocess + breaker + extractive fallback | `toeic eval run --suite all` → correctness MCQ ≥ 0.85 (40 câu); abstain ≥ 0.80 nhóm E; citation_precision ≥ 0.90 trên 50 mẫu judge; first token streamed < 5s sau retrieve; calibrate judge (đồng thuận người–judge ≥ 80% trên 20 mẫu) |
| **G4 — API + luyện tập + từ vựng** | Tuần 5 | FastAPI 9 endpoint, practice/vocab services | `pytest tests/test_api.py` (TestClient) đủ endpoint schema đúng; 1 phiên `toeic practice part 5 --count 10`: chấm khớp key 10/10, mỗi giải thích có [n] |
| **G5 — Ingestion toàn corpus + dedup hardening** | Tuần 6-8 | Nạp toàn bộ nguồn; **calibrate dedup theo mục 8.6**: gold set 2.500 cặp + planted duplicates → sweep ngưỡng → chốt `thresholds.yaml`; sentinel queries; đo `doc_dup_ratio`/`chunk_dup_ratio`/`token_wasted_ratio` trước/sau | Ingest corpus **2 lần → counts (chunk/question_item/word_entry) không đổi**; kill giữa ingestion → resume không sinh duplicate (hash chuẩn hoá); dedup recall ≥ 0.99 + auto-merge precision ≥ 0.98 trên gold set; 20 sentinel queries trả đúng canonical sau re-canonicalization |
| **G6 — Eval liên tục** | Song song từ G2 | Golden set + runner + gate + feedback loop dedup (sample 1%/batch → review_queue) | Mỗi thay đổi: `toeic eval run --save`; gate chặn nếu metric chính giảm > 2 điểm tuyệt đối so run trước |

Rủi ro chính & phương án:

| Rủi ro | Phương án |
|---|---|
| Rerank CPU chậm (3-8s/20 cặp) | Cờ `--no-rerank`; đo thật ở G2 trước khi chốt mặc định; cap max_length 384 |
| OCR kém ở sách chiến lược → retrieval tệ | Chuẩn hoá văn bản của ingestion (lọc boilerplate, gộp hyphen trước khi chunk); nhóm D đặt ngưỡng thấp hơn có chủ đích |
| qwen2.5:7b tiếng Việt đôi lúc lủng củng | Nâng 14b (RAM đủ) hoặc đổi `gemma2:9b` — chỉ đổi 1 dòng settings, chạy lại golden |
| FTS5 không fold dấu tiếng Việt | Cột `text_nodiacritic` tự chuẩn hoá bằng Python (mục 9.3.1) |
| Python 3.14 thiếu wheel torch/faiss | Venv 3.11/3.12 (mục 13.2) |
| Rebuild index tốn giờ mỗi lần ingest | Embedding cache theo `hash(model|revision|max_length|text)` → chỉ encode chunk mới; ingestion tăng dần |
| Bịa đáp án khi retrieval miss | Ngưỡng rerank score + rule 2 trong SYSTEM prompt + nhóm E trong golden để đo và khóa hành vi abstain |
| Sai-merge dedup mất nội dung | Nguyên tắc "sai-merge nguy hiểm hơn trùng-lọt" (mục 8) + auto-merge precision ≥ 0.98 + sentinel queries + không bao giờ DELETE |
| MinHash/LSH false positive giữa các đề cùng template | Vùng xám 0.75–0.90 quyết bằng qi-overlap cấu trúc, không bằng J; structure fingerprint xác nhận |

---

# 16. Kế hoạch đánh giá

**[HỢP NHẤT]** Ba lớp đánh giá từ ba tài liệu nguồn: golden set QA (P5), golden retrieval (P4), gold set dedup (P3) — một chương duy nhất.

## 16.1 Golden set QA (~120 câu, JSONL `eval/golden/group*.jsonl`)

| Nhóm | Số câu | Nội dung | Metric chính (ngưỡng) |
|---|---|---|---|
| A — exact_item | 30 | "câu N đề M" (sample có seed=42 từ đề đã nạp) | accuracy = 30/30 (đường nhanh, không chấp nhận lệch) |
| B — content_qa | 40 | Câu hỏi về passage/talk/MCQ có trong đề; phân bổ Part: P1:2, P2:5, P3:6, P4:5, P5:10, P6:3, P7:9 | hit@5 ≥ 0.80; correctness ≥ 0.85; over-abstain ≤ 0.05 |
| C — vocab | 15 | Từ trong sổ đã nạp (600 Essential Words...) | hit@5 ≥ 0.90 |
| D — strategy | 15 | "Cách làm Part 5 dạng paraphrase"... | hit@5 ≥ 0.70 (OCR sách chiến lược kém — ngưỡng thấp hơn có chủ đích) + judge |
| E — unanswerable | 20 | Soạn tay, ngoài corpus | abstain ≥ 0.80 (không bịa) |

Schema 1 dòng: `{"qid":"B-017","question":"...","group":"B","expected_chunks":["talk_ets2023_t2_07"],"expected_question_key":"q_ets2023_t2_p4_31","expected_answer_letter":"B","notes":""}`.

**Chống contamination:** golden set lưu ngoài index, không nạp; câu hỏi nhóm B viết lại diễn đạt khác wording trong tài liệu (tránh "câu hỏi = nguyên văn passage" gây hit giả); nhóm E gồm câu loại "TOEIC Speaking có mấy phần?", "Ai là chủ tịch ETS?" — đúng chủ đề lân cận nhưng không có trong corpus L&R.

## 16.2 Golden retrieval (30 query)

- ~30 query (5–6 mỗi intent, copy nguyên văn kiểu người học thật, cả có dấu lẫn không dấu), expected chunk id ghi tay một lần.
- Đo **Recall@10** và **MRR@10** cho cả nhánh dense-only / bm25-only / hybrid / +rerank; script nhỏ dùng kết quả JSON của từng tầng (không cần framework).
- Dùng để: chốt trọng số RRF theo intent, ngưỡng reranker 0.35/0.30, quyết định có bật sparse của bge-m3 hay không. Mỗi lần đổi trọng số → chạy lại golden set, lưu JSON regression.

## 16.3 Gold set dedup (mục 8.6 — tóm tắt)

~2.500 cặp (neighbour mining 500 chunk × top-5 + 150 planted duplicates × biến thể noise/OCR/đảo dòng/dịch/boilerplate); nhãn 4 lớp `DUP_SAME_LANG / DUP_TRANSLATION / PARTIAL / NOT_DUP`; sweep threshold 0.80–0.99; tiêu chí: auto-merge precision ≥ 0.98, recall tổng ≥ 0.99; ngưỡng cuối ghi `thresholds.yaml`. Sentinel retrieval (20 query) sau mỗi re-canonicalization.

## 16.4 Metrics & ngưỡng

| Metric | Định nghĩa | Công cụ |
|---|---|---|
| hit@k / MRR | expected_chunks (question item hoặc chunk cha) xuất hiện trong top-k / 1/rank đầu tiên | `metrics.py` tự viết (deterministic) |
| Recall@10 | golden retrieval per intent | tự viết |
| context_precision@5 | số chunk relevant trong top-5 / 5 | tự viết |
| correctness (MCQ) | letter trả về khớp answer key | tự viết |
| **faithfulness** | supported_claims / total_claims: judge trích claim từ câu trả lời, so từng claim với chunk được trích | LLM-as-judge **qwen2.5:14b, temperature 0**, template `judge_faithfulness.md`, chạy local |
| citation_precision | số [n] trỏ đúng chunk chứa claim / tổng [n] | judge + regex |
| abstain / over-abstain | nhóm E trả "không tìm thấy" / nhóm B bị abstain oan | tự viết |
| dedup recall / auto-merge precision / reduction | mục 8.6 | sqlite3 + pandas + matplotlib |
| latency p50/p95 | theo stage: retrieve / rerank / first token / total | runner đo kèm kết quả |

**Calibrate judge:** chấm tay 20 mẫu, đồng thuận người–judge ≥ 80% thì tin kết quả judge; không đạt → sửa rubric rồi đo lại. Đây là bước bắt buộc trước khi dùng faithfulness làm gate.

## 16.5 Regression gate

Pre-commit hook local (local-first, không CI cloud): `toeic eval run --suite all --save` → `eval/results/run_<ts>.json` ghi per-group metrics + **config hash** (gen model, embed model, index build id) để truy vết regression do đổi model/index. Gate fail nếu bất kỳ metric chính (hit@5 nhóm B, correctness, faithfulness, abstain) giảm > 2 điểm tuyệt đối.

## 16.6 Bộ câu hỏi kiểm tra mẫu (trích golden set)

1. (A) "giải thích câu 134 đề 3 ETS 2022" → đúng question item + giải thích, <1s, không LLM.
2. (A) "câu 87 đề 1 thuộc Part nào, đáp án là gì?"
3. (B) "Trong email của Part 7 đề 2, người gửi yêu cầu đồng nghiệp làm gì trước thứ Sáu?"
4. (B) "Hội thoại Part 3 về phòng họp: buổi họp bị đổi sang mấy giờ và vì sao?"
5. (B) "Talk Part 4 của giám đốc thông báo thay đổi gì về lịch bảo trì?"
6. (B) "Câu Part 5 dạng từ loại 'The proposal was ___ by the committee' — đáp án và vì sao các lựa chọn còn lại sai?"
7. (C) "'negotiate' nghĩa gì, cho câu ví dụ từ sổ từ vựng đã nạp." → entry đã merge, ghi nguồn từng bản.
8. (D) "Làm sao nhận biết distractor paraphrase trong Part 5?" → trỏ lesson chunk.
9. (E) "Thi TOEIC Speaking có bao nhiêu phần?" → bắt buộc abstain (corpus chỉ có L&R).
10. (E) "Ai là CEO của ETS năm nay?" → abstain.

---

# 17. Phụ lục A — Bảng tham số khuyến nghị tổng hợp

**[HỢP NHẤT]** Gộp bảng tham số của 5 tài liệu nguồn; giá trị **[CHỐT]** đã đối chiếu ở Phụ lục B. Tất cả giá trị hiệu chỉnh được đặt trong `config/thresholds.yaml` / `settings.yaml` — không hardcode trong code.

### OCR & Extract

| Tham số | Giá trị | Lý do |
|---|---|---|
| DPI render OCR | 300 | chiều cao chữ ≥ 30px, trên ngưỡng Tesseract 20px |
| Tesseract config | `--oem 1 --psm 3` (mặc định), `--psm 6` sau tách cột, `preserve_interword_spaces=1` | LSTM chính xác hơn; psm 3 tự xử lý cột |
| Language packs | tessdata_best `eng` / `eng+vie` / `vie` | OCR chạy 1 lần + resumable → chọn chính xác hơn nhanh |
| Fallback PaddleOCR | page mean conf < 60/100 | chỉ trả chi phí nặng cho trang xấu |
| Trang fail → needs_review | > 10% trang | OCR tệ âm thầm phá dedup + retrieval |
| Probe text layer | median < 80 ký tự/trang sample | đề native luôn > 200 |
| Deskew | chỉ xoay khi \|góc\| ∈ [0.5°, 15°] | dưới 0.5° không đáng; trên 15° cần PaddleOCR |
| Binarize | Sauvola window 31, k=0.2 | scan sách có gradient sáng/tối |
| Tách cột 2-up | run trắng ≥ 4% bề rộng, ±10% tâm trang | scan 2 trang/ảnh |
| OCR multiprocessing | 2-4 worker, chỉ file > 20 trang | spawn cost với file ngắn |
| Audio check | duration ≈ words/2.8 từ/s ±40% | tốc độ đọc TOEIC ~2.5-3 từ/s |

### Structure parse

| Tham số | Giá trị | Lý do |
|---|---|---|
| Heading PDF | size > 1.3× median hoặc bold (< 100 ký tự) | tín hiệu font phổ biến sách số hoá |
| Fuzzy fingerprint Part | partial_ratio ≥ 85 | OCR sai 1-2 từ vẫn ≥ 85 |
| Boilerplate **[CHỐT]** | dòng ≤ 80 ký tự lặp ≥ **50%** trang + blacklist cứng | hợp 30/50/60% của 3 tài liệu nguồn |
| Dải câu chuẩn | 6/25/39/30/40/12/48 = 200; mini 100/50 | chuẩn ETS 2016+ |

### Chunking

| Tham số | Giá trị | Lý do |
|---|---|---|
| Encode max_length | 512 (bge-m3 hỗ trợ 8192 — nâng khi cần) | CPU + nhất quán cache + tránh pha loãng embedding |
| Budget passage/talk | nguyên khối cap 400; double cap 600 | TOEIC passage 150-350 từ |
| Split khi vượt | theo câu, `is_partial` + `part_index/count` | giữ khả năng assembly |
| Lesson chunk | target 350, max 450 token | 1 điểm chiến thuật/chunk |
| Overlap size-based **[CHỐT]** | 60 token | hợp 50/60 của P1/P2 |
| Overlap structure-based | 0 | biên ngữ nghĩa thật; bảo vệ fingerprint dedup |
| question_item | hard cap 150, không cắt | size tự nhiên 35-38 token |

### Dedup (mục 8 — nguồn chân lý)

| Tham số | Giá trị | Lý do |
|---|---|---|
| MinHash num_perm | 128 | sai số ≈ 0.044 tại J=0.5 |
| Shingle doc-level **[CHỐT]** | word 5-gram | tránh formula TOEIC; cân bằng OCR noise |
| Shingle chunk-level **[CHỐT]** | char 5-gram | OCR đổi word segmentation ở chunk ngắn |
| LSH candidate | threshold 0.80 | bắt J≈0.80 với P≈0.94 |
| Doc-level quyết **[CHỐT]** | J ≥ 0.90 version; 0.75–0.90 + qi-overlap ≥ 80% version; < 80% partial_overlap; < 0.75 accept | scan variant J ∈ [0.85, 0.98]; đề khác chép chéo J ∈ [0.2, 0.6] |
| Chunk confirm **[CHỐT]** | Jaccard ≥ 0.85 ∨ token_set_ratio ≥ 92 → dup; 0.80–0.85 similar_to | hợp P1 (0.80/85) và P2 (0.85/92) |
| SimHash | Hamming ≤ 6 / 64-bit; chỉ chunk ≥ 80 token | Manku 2007; chunk ngắn bit không ổn định |
| Cosine same-lang | auto-merge ≥ 0.97; review 0.92–0.97 | OCR-variant ≥ 0.97 |
| Cosine cross-lang **[CHỐT]** | auto-merge ≥ 0.88; review 0.85–0.88 | bản dịch hiếm vượt 0.90–0.95 (chốt 0.88 thay 0.90 của P2) |
| canonical_score | 0.40 parse / 0.25 ocr / 0.25 source / 0.10 metadata | scan sạch parse trọn 200 câu là nền |
| qi_key | sha1(norm(stem)+choices A→D), không gồm answer | số câu lệch giữa bản biên tập; answer conflict → review |
| Tiêu chí gold set | auto-merge precision ≥ 0.98, recall ≥ 0.99 | sai merge = mất nội dung |

### Retrieval

| Tham số | Giá trị | Lý do |
|---|---|---|
| Embedding | bge-m3 1024-d, L2-normalize, batch 32 | đa ngôn ngữ EN/VI, CPU-first, MIT |
| Chroma HNSW | space=cosine, M=32, construction_ef=200, search_ef=128 | search_ef ≥ 2× n_results |
| RRF | k=60, mặc định dense 0.6 / bm25 0.4 (theo intent, bảng 9.5.2) | không cần normalize score |
| Rerank **[CHỐT]** | top-20 → top-8; gate loại < 0.35; low_confidence best < 0.30; max_length 384 | CPU latency; hợp ngưỡng P4 (0.35) và P5 (0.30) |
| Parent expansion k | child k=24 → gộp parent top-4 ∪ parent-query top-2 | 3-4 child/parent |
| Context pack | ≤ 8 item + parents, cap ~6k token | num_ctx 8192 − system − output |

### LLM

| Tham số | Giá trị | Lý do |
|---|---|---|
| Generation | qwen2.5:7b-instruct-q4_K_M (14b máy 16GB+) | tiếng Việt tốt lớp 7B |
| num_ctx | 8192 (bắt buộc — mặc định Ollama 2048 cắt ngầm) | chống hallucination |
| Sampling | temperature 0.15, top_p 0.9, num_predict 1024, keep_alive 30m | QA thực tế; tránh cold-start |
| Resilience | tenacity retry ×4, breaker 3 fail/60s, ladder 7b→3b→extractive | hệ luôn usable |

---

# 18. Phụ lục B — Các mâu thuẫn đã chốt khi hợp nhất

> Mỗi dòng: chủ đề | tài liệu nguồn | quyết định chốt trong tài liệu này | vị trí tham chiếu.

| # | Chủ đề | Các tài liệu nguồn nói gì | Quyết định chốt |
|---|---|---|---|
| B1 | Vector store | P1-S10 và P5-B2: FAISS IndexFlatIP ("SQLite là SSOT, không cần Chroma"); P2-3.2 và P4-1.1: ChromaDB | **ChromaDB 1.5.9, 2 collections** — filter metadata native khớp nhu cầu lọc part/skill/test_id; quy mô 50k–200k chunk HNSW dư sức; FAISS chỉ quay lại khi >2M vector. Mục 9.1 |
| B2 | Embedding model | P1/P2: e5-base (768); P5: e5-large (1024); P4: bge-m3 (1024); P3: e5-small cho dedup | **bge-m3 dùng chung retrieval + dedup + re-index** — cross-lingual lõi, không prefix, cùng họ reranker; e5-base giữ làm fallback máy RAM < 8GB; e5-small/LaBSE là option pass-2 dedup nếu calibration cần. Mục 9.2 |
| B3 | Parent có được embed không | P2: có (toeic_parent, mixed search); P4: "chunk-cha không embed" | **Có, collection riêng** — query hướng passage trúng parent trực tiếp; parent expansion SQL vẫn giữ vai trò chính. Mục 7.3.2, 9.3.2 |
| B4 | Số collection Chroma | P4: 1 (`toeic_v1`); P2: 2 (child/parent) | **2 collections**. Mục 9.1.2 |
| B5 | MinHash shingle | P1: char 5-gram; P2/P3: word 5-gram | **Doc-level word 5-gram, chunk-level char 5-gram** — mỗi granularity có lý do riêng. Mục 8.2.2 |
| B6 | Ngưỡng fuzzy chunk-level | P1: Jaccard 0.80 + rapidfuzz 85; P2: LSH 0.85 + token_set_ratio 92 | **LSH candidate 0.80; confirm J ≥ 0.85 ∨ token_set_ratio ≥ 92; 0.80–0.85 → similar_to**. Mục 8.3.5 |
| B7 | Cosine cross-lang auto-merge | P3: 0.88 (review 0.85–0.88); P2: 0.90 | **0.88 + review zone** — cùng nguyên tắc auto-merge chỉ ở ngưỡng rất cao; calibrate gold set. Mục 8.3.5 |
| B8 | Dedup có model embedding riêng? | P3: e5-small riêng cho throughput; nhưng P3 cũng nói tái sử dụng vector store chính | **Tái sử dụng embedding bge-m3 của vector store chính** (0 chi phí thêm); e5-small/LaBSE chỉ option pass-2. Mục 8.3.5 |
| B9 | Boilerplate lặp bao nhiêu % trang | P1: ≥ 60%; P2: ≥ 50%; P3: > 30% | **≥ 50%** + blacklist cứng; cấu hình thresholds.yaml. Mục 6.4-S4, 8.1 |
| B10 | FTS5 fold dấu tiếng Việt | P4: `remove_diacritics 2` đủ; P5: không đủ (đ, dấu VN) | **Cả hai**: giữ remove_diacritics 2 VÀ cột `text_nodiacritic` tự fold — an toàn tuyệt đối. Mục 9.3.1 |
| B11 | Rerank top-k | P4: top-50 → top-8; P5: top-20 (CPU latency) | **Top-20 mặc định** (config được), benchmark G2 trước khi nâng. Mục 9.4 |
| B12 | Rerank gate | P4: < 0.35 loại; P5: best < 0.30 low_confidence | **Hai mức: loại 0.35, low_confidence 0.30** — không mâu thuẫn, bổ sung nhau. Mục 9.4, 10.1.3 |
| B13 | Intent router | P4: 6 intent; P5: 5 intent, tên khác (`metadata_lookup` vs `EXACT_ITEM`) | **8 intent hợp nhất** một bảng duy nhất cho retrieval + generation. Mục 9.5.1 |
| B14 | Tên file SQLite | P4: `rag.sqlite3`; P5: `toeic.db` | **`data/rag.sqlite3`** — một file SSOT với schema hợp nhất mục 12 |
| B15 | chunk_id format | P1: uuid4 + chunk_uid riêng; P2: uuid5; P4: `c:ets2023t3:q:134`; P5: `q_ets2023_t2_p5_134` | **Một cột `chunk_id`, chuỗi ổn định dễ đọc** `{work_key}:{unit_type}:{test_number}:{part}:{qn|seq}`. Mục 6.3 |
| B16 | test_id format | P1: uuid TEXT; P4/P5: `ets2023_t2` | **`{series_key}_t{number}`** chuỗi dễ đọc. Mục 6.2.4 |
| B17 | Overlap lesson | P1: 50 token; P2: 60 token (có đo) | **60 token**. Mục 7.2.3 |
| B18 | Passage split | P1: cửa sổ 384/overlap 64; P2: nguyên khối cap 400/600 | **Nguyên khối đến cap theo unit_type; vượt mới cắt theo câu**. Mục 7.2.2 |
| B19 | content_sha256 vs normalized_text_sha256 | P1 vs P3: hai tên một ý nghĩa | **`content_sha256`** (ghi chú alias). Mục 12 |
| B20 | parent_chunk_id vs parent_id | P1 vs P2/P4/P5 | **`parent_id`**. Mục 12 |
| B21 | ingest_stage vs ingest_jobs | P1: ingest_stage; P3: ingest_jobs(checkpoint_json) | **`ingest_jobs`** (gộp). Mục 12 |
| B22 | word_canon key | P3: (lemma.lower(), pos); P4: word_norm | **`word_norm` PRIMARY KEY + cột pos riêng**. Mục 12 |
| B23 | Embedding prefix | P1/P2/P5: e5 bắt buộc `query:`/`passage:`; P4: bge-m3 không cần | **Không cần prefix** (theo bge-m3); dòng metadata `[Part 7 \| ...]` khi embed vẫn giữ. Mục 7.4.2 |
| B24 | Tokenizer đếm | P1/P2: tokenizer embedder (XLM-R); P5: tiktoken cl100k cho budget | **Chunking: XLM-R (embedder); budget context LLM: tiktoken cl100k xấp xỉ + margin 15%** — hai mục đích khác nhau. Mục 7.2.1, 10.1.3 |
| B25 | Python venv | P1/P3/P5: khuyến nghị 3.11/3.12; P4: dry-run cho thấy 3.14 có wheel | **Khuyến nghị venv 3.11/3.12** (3.14 dry-run ≠ đã test cài). Mục 3, 13.2 |

---

# 19. Phụ lục C — Tổng hợp trạng thái kiểm chứng (đã / chưa chạy)

## 19.1 Đã chạy trực tiếp trong phiên hợp nhất này (2026-10-03, máy đích E:\PROJECT\rag_toeic)

| Lệnh | Kết quả |
|---|---|
| `python --version` | Python 3.14.6 |
| `pip --version` | pip 26.2.1 |
| `where tesseract` | Không tìm thấy → Tesseract chưa cài |
| `ls -la E:/PROJECT/rag_toeic` | Workspace trống (`.zcode/`, `.zcodeignore`) → design-only |
| `python -c` check 18 module qua `importlib.util.find_spec` | pandas/lxml/charset_normalizer/tiktoken = True; fitz, docx, ebooklib, pytesseract, paddleocr, faiss, chromadb, sentence_transformers, rapidfuzz, pikepdf, datasketch, srt, bs4, pypdf = False |

## 19.2 Đã chạy trong các phiên thiết kế nguồn (trích nguyên văn từ tài liệu nguồn, KHÔNG chạy lại trong phiên hợp nhất)

- **P1:** kiểm tra Python 3.14.6, `where tesseract`, import 18 module — khớp kết quả 19.1. Không chạy test parse thật (workspace trống).
- **P2:** `pip install tiktoken transformers` thành công; đo token 7 mẫu TOEIC-style tự soạn bằng tiktoken cl100k + tokenizer e5 (bảng ở mục 7.2.2). chromadb/faiss/datasketch/rapidfuzz chưa cài/chạy thử.
- **P3:** `pip show` (chưa có gói nào), `pip index versions` (datasketch 2.0.0, simhash 2.1.2, mmh3 5.3.1, faiss-cpu 1.15.1, chromadb 1.5.9, sentence-transformers 6.1.0, rapidfuzz 3.14.6), `pip install --dry-run --no-deps` resolve được mmh3/simhash/datasketch/RapidFuzz trên 3.14. Chưa cài thực tế; chưa test sentence-transformers/torch trên 3.14.
- **P4:** `os.cpu_count()`/`platform.processor()` → 16 logical CPU AMD Zen 3; FTS5 check tạo bảng + insert/query thành công (SQLite 3.50.4); `pip index versions` chromadb 1.5.9, sentence-transformers 6.1.0, FlagEmbedding 1.4.2, faiss-cpu 1.15.1; `pip install --dry-run --no-deps torch|onnxruntime` có wheel cp314 win_amd64 (torch 2.14.1, onnxruntime 1.30.0). Chưa cài package nào.
- **P5:** `ls -la` workspace trống; python/pip version; phát hiện pip warning cho thấy các thư viện RAG chưa cài; dọn file rác `nul` do lệnh lỗi tạo ra. Không chạy được eval (corpus/code chưa tồn tại).

## 19.3 Chưa kiểm chứng — bắt buộc calibrate khi triển khai (nêu rõ, không bịa)

1. **Ngưỡng dedup:** Jaccard 0.90/0.75 (doc), 0.85/0.80 (chunk), cosine 0.97/0.92/0.88/0.85, SimHash ≤ 6 — là giá trị khởi điểm từ kinh nghiệm, đo với model e5; **phải hiệu chỉnh trên gold set 2.500 cặp bằng bge-m3 thực tế** (G5) trước khi coi là production.
2. **Ngưỡng retrieval/rerank:** RRF 0.6/0.4 theo intent, rerank gate 0.35/0.30, k=24 child — điểm khởi đầu chờ golden set (G2).
3. **Tốc độ:** encode bge-m3, rerank bge-reranker-v2-m3, tổng thời gian ingestion — ước lượng trên 16 luồng CPU, chưa benchmark (chưa tải model).
4. **Tỷ lệ 2.8 từ/giây** cho audio-check, ngưỡng conf 60/100 Paddle fallback, ngưỡng fingerprint 85 — cần calibrate trên 3-5 file scan thật đầu tiên.
5. **Hành vi config HNSW của chromadb 1.5.9** (`metadata` kiểu cũ vs `configuration` kiểu mới) — verify lúc cài; đã pin version để chống drift.
6. **Sentence-transformers/torch trên Python 3.14** — dry-run resolve được nhưng chưa test cài; do đó khuyến nghị venv 3.11/3.12.
7. **Fingerprint OCR thủ (regex phần 6.2.2)** — viết theo dạng lỗi OCR phổ biến của đề TOEIC, chưa chạy trên corpus thật.

---

*— Hết tài liệu thiết kế hợp nhất. Nguồn: 5 tài liệu thiết kế phân hệ (Ingestion, Chunking, Dedup, Retrieval, Answer Generation + khung triển khai), hợp nhất ngày 2026-10-03.*
