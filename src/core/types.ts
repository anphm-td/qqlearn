/*
 * qqlearn — domain types (LỚP CORE, thuần TypeScript).
 *
 * ⚠️ Quy tắc lớp: src/core/ KHÔNG được import React, Dexie, window/document.
 *   Mọi entity của bảng dữ liệu người dùng đều có `id` tự sinh + `updatedAt`
 *   (epoch ms) để sau này đồng bộ/merge với server.
 *
 * Đa môn hoá: khung Part 1–7 của TOEIC đã bỏ — mọi bản ghi học gắn `subjectId`
 * trỏ tới bảng subjects (môn học tự định nghĩa). `subjectId = 0` nghĩa là
 * "chưa phân môn".
 */

// ===== Settings (bảng singleton) =====

import type { Lang } from './i18n/index'

export interface PomodoroConfig {
  /** Phút tập trung — mặc định 25. */
  focusMin: number
  /** Phút nghỉ — mặc định 5. */
  breakMin: number
}

/** Nguồn dữ liệu của Sổ — người học chọn trong Cài đặt ("Nguồn dữ liệu"). */
export type SyncMode = 'local' | 'server'

/** Hàng duy nhất của bảng settings — luôn id = 1. */
export interface Settings {
  id: 1
  /** Mục tiêu hằng ngày (phút) — thời gian TỰ CHỈNH (design-system.md mục 3). */
  dailyGoalMinutes: number
  /**
   * Điểm mục tiêu — cột giữ lại để tương thích DB/bản sao lưu cũ, app không còn
   * hiển thị (khung TOEIC đã bỏ; điểm ghi theo từng môn ở bảng scores).
   */
  targetScore: number
  /** Cột giữ lại để tương thích, không hiển thị (trước đây là ngày thi TOEIC). */
  examDate: string
  /** Giờ nhắc học hằng ngày 'HH:mm' hoặc ''. */
  reminderTime: string
  /**
   * Hỏi giờ học khi mở app (check-in): mỗi lần mở Sổ, hỏi "vừa học bao nhiêu
   * phút" để lưu thành một buổi học thủ công vào tiến độ hôm nay.
   */
  checkinEnabled: boolean
  /** Base URL của dịch vụ RAG cho điểm ghép chéo smart (vd. http://localhost:8000). */
  ragBaseUrl: string
  /** Đã hoàn thành onboarding chưa. */
  onboardingDone: boolean
  /** Cấu hình pomodoro cho buổi học. */
  pomodoro: PomodoroConfig
  /**
   * Nguồn dữ liệu: 'local' = IndexedDB trên máy này (mặc định),
   * 'server' = qua server PC (npm run server → cổng 5178).
   * createRepos() chọn Dexie hoặc HTTP theo lựa chọn này (bản sao đồng bộ nằm
   * trong localStorage — xem src/data/dataMode.ts vì cần đọc ĐỒNG BỘ lúc khởi động).
   */
  syncMode: SyncMode
  /** Địa chỉ server PC khi syncMode = 'server' (vd. http://192.168.1.10:5178); '' = chưa đặt. */
  serverUrl: string
  /**
   * Ngôn ngữ giao diện — 'vi' MẶC ĐỊNH, 'en' tùy chọn trong Cài đặt
   * (design-system.md mục 12). Đổi → áp dụng tức thì qua useT (publish/listen).
   */
  language: Lang
  /** Epoch ms lần sửa cuối — phục vụ đồng bộ server. */
  updatedAt: number
}

// ===== Subjects (môn học tự định nghĩa) =====

/**
 * Một môn học (bảng subjects). Màu lấy từ SUBJECT_PALETTE (src/core/subjects.ts —
 * bộ pastel định sẵn của design-system.md mục 5). `goalMinutesPerDay = 0` nghĩa là
 * môn không đặt mục tiêu riêng (dùng mục tiêu hằng ngày chung).
 */
export interface Subject {
  id?: number
  /** Tên môn — duy nhất, không rỗng (vd. "TOEIC", "Toán", "Tiếng Nhật"). */
  name: string
  /** Hex 6 ký tự từ SUBJECT_PALETTE (vd. '#FFD273'). */
  colorHex: string
  /** Mục tiêu phút/ngày riêng của môn; 0 = không đặt mục tiêu riêng. */
  goalMinutesPerDay: number
  /** Lưu trữ (ẩn khỏi các trang chọn môn nhưng giữ dữ liệu) thay vì xoá. */
  archived: boolean
  /** Epoch ms tạo. */
  createdAt: number
  /** Epoch ms lần sửa cuối. */
  updatedAt: number
}

export type NewSubject = Omit<Subject, 'id' | 'createdAt' | 'updatedAt'>

// ===== Sessions =====

export interface Session {
  id?: number
  /** Ngày học THEO MÚI GIỜ LOCAL, 'YYYY-MM-DD' — dùng localDateISO() từ @core/date. */
  date: string
  /** Epoch ms bắt đầu buổi. */
  startedAt: number
  /** Epoch ms kết thúc buổi (null khi đang học). */
  endedAt: number | null
  /** Số phút đã học (làm tròn). */
  durationMin: number
  /** Môn học (id bảng subjects); 0 = chưa phân môn. */
  subjectId: number
  /** Hoạt động: 'nghe' | 'đọc' | 'ngữ pháp' | 'từ vựng' | 'luyện đề' ... */
  activity: string
  /** Nguồn tạo: timer (pomodoro) hoặc nhập tay. */
  source: 'timer' | 'manual'
  /** Ghi chú ngắn cho buổi học. */
  note: string
  /** Epoch ms lần sửa cuối. */
  updatedAt: number
}

/** Dữ liệu tạo buổi học mới — repo tự sinh id + updatedAt. */
export type NewSession = Omit<Session, 'id' | 'updatedAt'>

// ===== Daily notes (PK = date) =====

export interface DailyNote {
  /** 'YYYY-MM-DD' local — PRIMARY KEY (1 bản ghi mỗi ngày). */
  date: string
  /**
   * Các môn đã học trong ngày (id bảng subjects) — tên cột giữ nguyên từ thời
   * Part để khỏi phải migrate DB; giá trị giờ là subjectId.
   */
  partStudied: number[]
  /** Số từ mới ghi vào Sổ từ vựng hôm nay. */
  newWords: number
  /** Tóm tắt lỗi sai (text). */
  mistakesSummary: string
  /** Nhận xét của người học. */
  reflection: string
  /** Id photo trong bảng photos đính kèm ghi chú. */
  photoIds: number[]
  /** true nếu nội dung do "Soạn nháp" (RAG) sinh ra. */
  autoDrafted: boolean
  /** Epoch ms lần sửa cuối. */
  updatedAt: number
}

// ===== Vocab =====

export interface Vocab {
  id?: number
  /** vd. "commute (v/n)". */
  word: string
  /** Nghĩa tiếng Việt — "đi làm hằng ngày". */
  meaning: string
  /** Câu ví dụ. */
  example: string
  /** Môn học (id bảng subjects); 0 = chưa phân môn. */
  subjectId: number
  /** Nguồn: sách/đề nào (vd. "ETS 2023 · Đề 2") hoặc ''. */
  sourceTest: string
  /** Epoch ms tạo. */
  createdAt: number
  /** Epoch ms lần sửa cuối. */
  updatedAt: number
}

export type NewVocab = Omit<Vocab, 'id' | 'createdAt' | 'updatedAt'>

// ===== SRS (Leitner) =====

export interface SrsCard {
  id?: number
  vocabId: number
  /** Hộp Leitner 1–5. */
  box: number
  /** Ngày đến hạn ôn 'YYYY-MM-DD' local. */
  dueDate: string
  /** Epoch ms ôn cuối (null = chưa ôn). */
  lastReviewed: number | null
  correctCount: number
  /** Epoch ms lần sửa cuối. */
  updatedAt: number
}

// ===== Mistakes =====

export interface Mistake {
  id?: number
  /** Số đề/bài (0 = không rõ). */
  testNo: number
  /** Môn học (id bảng subjects); 0 = chưa phân môn. */
  subjectId: number
  questionNo: number
  myAnswer: string
  correctAnswer: string
  /** Nguyên nhân: 'từ vựng' | 'ngữ pháp' | 'đọc hiểu' | 'chăm chú' ... */
  cause: string
  /** Giải thích ngắn. */
  explanation: string
  /** Đã ôn lại chưa. */
  reviewed: boolean
  /** Epoch ms tạo. */
  createdAt: number
  /** Epoch ms lần sửa cuối. */
  updatedAt: number
}

export type NewMistake = Omit<Mistake, 'id' | 'createdAt' | 'updatedAt'>

// ===== Scores =====

/**
 * Một điểm kiểm tra/đề (bảng scores) — MỘT số điểm duy nhất theo môn, không còn
 * khung Listening/Reading của TOEIC.
 */
export interface Score {
  id?: number
  /** Ngày làm bài 'YYYY-MM-DD' local. */
  date: string
  /** Môn học (id bảng subjects); 0 = chưa phân môn. */
  subjectId: number
  /** Nhãn bài kiểm tra — "Toán — Định lí Pytago", "ETS 2023 · Đề 2". */
  label: string
  /** Điểm (một số duy nhất — thang do từng môn tự quy ước). */
  score: number
  /** Ghi chú ngắn. */
  note: string
  /** Epoch ms lần sửa cuối. */
  updatedAt: number
}

export type NewScore = Omit<Score, 'id' | 'updatedAt'>

// ===== Photos =====

export type PhotoRefType = 'session' | 'note' | 'mistake'

export interface Photo {
  id?: number
  /** Ảnh nhị phân — lưu Blob, hiển thị qua URL.createObjectURL. */
  blob: Blob
  mime: string
  /** Gắn với loại bản ghi nào. */
  refType: PhotoRefType
  /** Id bản ghi được gắn (dạng số chữ hoá hoặc date). */
  refId: string
  /** Epoch ms tạo. */
  createdAt: number
  /** Epoch ms lần sửa cuối. */
  updatedAt: number
}

// ===== Chat (RAG) =====

export interface ChatMessage {
  id?: number
  /** 1 phiên hỏi đáp với RAG. */
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  /** Epoch ms tạo. */
  createdAt: number
  /** Epoch ms lần sửa cuối. */
  updatedAt: number
}
