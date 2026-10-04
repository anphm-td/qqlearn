/*
 * Sổ học TOEIC — domain types (LỚP CORE, thuần TypeScript).
 *
 * ⚠️ Quy tắc lớp: src/core/ KHÔNG được import React, Dexie, window/document.
 *   Mọi entity của bảng dữ liệu người dùng đều có `id` tự sinh + `updatedAt`
 *   (epoch ms) để sau này đồng bộ/merge với server.
 */

// ===== Settings (bảng singleton) =====

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
  /** Điểm mục tiêu TOEIC — vd. 700. */
  targetScore: number
  /** Ngày thi, ISO 'YYYY-MM-DD' hoặc '' nếu chưa đặt. */
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
  /** Epoch ms lần sửa cuối — phục vụ đồng bộ server. */
  updatedAt: number
}

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
  /** Part 1–7 (0 = không rõ). */
  part: number
  /** Hoạt động: 'ngữ pháp' | 'từ vựng' | 'nghe' | 'đọc' | 'luyện đề' ... */
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
  /** Các Part đã học trong ngày. */
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
  /** Part liên quan 1–7 (0 = không rõ). */
  part: number
  /** Nguồn: đề nào (vd. "ETS 2023 · Đề 2") hoặc ''. */
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
  /** Số đề (0 = không rõ). */
  testNo: number
  part: number
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

export interface Score {
  id?: number
  /** Ngày làm đề 'YYYY-MM-DD' local. */
  date: string
  /** Nhãn đề — "ETS 2023 · Đề 2". */
  testLabel: string
  listening: number
  reading: number
  /** listening + reading (5–990). */
  total: number
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
