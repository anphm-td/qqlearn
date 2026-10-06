import type { NamespaceDict } from '../index'

/*
 * Từ điển namespace "chat" — nhóm màn hình "chat" (feature folder src/features/chat/):
 * ChatPage (D13) — trang /tro-chuyên hỏi đáp cùng trợ lý RAG.
 *  - page.*:        tiêu đề + dòng giới thiệu.
 *  - history.*:     trạng thái tải lịch + ghi chú lưu tại máy.
 *  - empty.*:       empty state mời hỏi khi lịch trống.
 *  - sending.*:     bong bóng "đang tra cứu" khi chờ trợ lý.
 *  - error.*:       phụ đề dưới cảnh báo lỗi (thân thiện).
 *  - notConnected.*: trạng thái chưa cấu hình máy trợ lý (ragBaseUrl rỗng).
 *  - composer.*:    khung soạn tin (placeholder, aria, nút Gửi, phím tắt).
 * Giữ luật:
 *  - Key vi và en PHẢI đối xứng 1-1 (test key-parity trong src/core/i18n/i18n.test.ts).
 *  - key dạng chấm phân nhóm; biến nội suy dạng {ten}.
 *  - 'vi' là nguồn chuẩn (copy nguyên văn); 'en' tự nhiên, thân thiện theo
 *    design-system.md mục 8/12 (không tech-speak, giữ nguyên "qqlearn", TOEIC/SRS).
 *  - Dùng qua hook: const { t } = useT('chat') — xem src/data/useT.ts.
 */
export const dict: NamespaceDict = {
  vi: {
    'page.kicker': 'hỏi đáp cùng trợ lý',
    'page.title': 'Trò chuyện',
    'page.intro':
      'Hỏi về bài học, ngữ pháp hay từ vựng của môn đang học — trợ lý trả lời dựa trên tài liệu đã nạp trên máy bạn.',
    'history.loading': 'Đang mở cuộc trò chuyện…',
    'history.savedLocally': 'Lịch trò chuyện được lưu ngay trên máy bạn.',
    'empty.invite':
      'Hỏi bất cứ điều gì — vd. “giải thích cách giải bài 4” hoặc “phân biệt salary và wage”.',
    'sending.status': 'đang tra cứu tài liệu…',
    'error.keepMessage': 'Tin nhắn của bạn vẫn được giữ — sửa xong nguyên nhân rồi gửi lại nhé.',
    'notConnected.message': 'Chưa kết nối máy trợ lý — nhập địa chỉ máy trợ lý trong Cài đặt',
    'notConnected.action': 'Mở Cài đặt',
    'notConnected.hint':
      'Máy trợ lý chạy trên máy tính của bạn — mở máy trợ lý rồi dán địa chỉ của nó vào Cài đặt là trò chuyện được ngay, không phải cài thêm gì trên điện thoại.',
    'composer.placeholder': 'Hỏi: giải thích câu 134 đề 3…',
    'composer.aria': 'Câu hỏi cho trợ lý',
    'composer.newChat': 'bắt đầu trò chuyện mới',
    'composer.hint': 'Enter gửi · Shift+Enter xuống dòng',
    'composer.send': 'Gửi',
  },
  en: {
    'page.kicker': 'ask your assistant',
    'page.title': 'Chat',
    'page.intro':
      'Ask about lessons, grammar or vocabulary for the subject you are studying — the assistant answers from the documents loaded on your machine.',
    'history.loading': 'Opening the conversation…',
    'history.savedLocally': 'Your chat history is saved right on your device.',
    'empty.invite':
      'Ask anything — e.g. “explain how to solve question 4” or “tell salary and wage apart”.',
    'sending.status': 'searching the documents…',
    'error.keepMessage': 'Your message is still here — fix the cause and send it again.',
    'notConnected.message': 'Assistant not connected yet — enter the assistant address in Settings',
    'notConnected.action': 'Open Settings',
    'notConnected.hint':
      'The assistant runs on your computer — start it and paste its address into Settings to chat right away, nothing to install on your phone.',
    'composer.placeholder': 'Ask: explain question 134 of test 3…',
    'composer.aria': 'Question for the assistant',
    'composer.newChat': 'start a new conversation',
    'composer.hint': 'Enter to send · Shift+Enter for a new line',
    'composer.send': 'Send',
  },
}
