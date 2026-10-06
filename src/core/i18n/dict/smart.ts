import type { NamespaceDict } from '../index'

/*
 * Từ điển namespace "smart" — nhóm màn hình "smart" (feature folder src/features/smart/):
 *  - card.*:      SuggestionCard (D14) — card "Hôm nay nên học gì" trên Home.
 *  - suggestion.*: pickSuggestion (suggestion.ts) — tiêu đề/lời gợi ý theo ưu tiên.
 *  - unit.*:      đơn vị hiển thị cạnh số liệu (lỗi sai / từ / phút).
 *  - draft.*:     soạn nháp "Ghi chú cuối ngày" (draftCompose.ts) + prompt gửi RAG.
 *  - prompt.*:    buildSuggestionPrompt — prompt xin gợi ý từ RAG.
 *  - rag.*:       ragClient — thông điệp lỗi mạng/timeout/HTTP hiển thị cho người học.
 * Giữ luật:
 *  - Key vi và en PHẢI đối xứng 1-1 (test key-parity trong src/core/i18n/i18n.test.ts).
 *  - key dạng chấm phân nhóm; biến nội suy dạng {ten}.
 *  - 'vi' là nguồn chuẩn (copy nguyên văn); 'en' tự nhiên, thân thiện theo
 *    design-system.md mục 8/12 (không tech-speak, giữ nguyên "qqlearn", số liệu,
 *    tên môn user, TOEIC/SRS).
 *  - Dùng qua hook: const { t } = useT('smart') — xem src/data/useT.ts; các hàm thuần
 *    (suggestion/draftCompose/ragClient) nhận `lang` và gọi t(lang, 'smart', …).
 */
export const dict: NamespaceDict = {
  vi: {
    'card.title': 'Gợi ý hôm nay',
    'card.tag': 'gợi ý',
    'card.loading': 'Đang xem lại sổ của bạn…',
    'card.loadFailed':
      'Chưa đọc được sổ tay nên mình chưa gợi ý được. Mở lại trang là thử lại được ngay nhé.',
    'card.empty':
      'Chưa có dữ liệu để gợi ý. Bắt đầu một buổi học ngắn hoặc thêm vài từ mới là card này biết việc ngay.',
    'card.startAction': 'Bắt đầu học',
    'card.ragSource': '— từ trợ lý học tập',
    'card.connectPrompt': 'Muốn gợi ý dựa trên tài liệu môn học?',
    'card.connectLink': 'Kết nối máy trợ lý trong Cài đặt',

    'suggestion.mistakes.title': 'Ôn lại lỗi sai',
    'suggestion.mistakes.bodyOne':
      'Bạn còn 1 lỗi sai chưa ôn lại — xem lại nguyên nhân để hôm nay không vấp lần nữa nhé.',
    'suggestion.mistakes.body':
      'Bạn còn {count} lỗi sai chưa ôn lại — xem lại nguyên nhân để hôm nay không vấp lần nữa nhé.',
    'suggestion.srs.title': 'Ôn từ vựng đến hạn',
    'suggestion.srs.bodyOne': 'Có 1 từ đến hạn ôn hôm nay — vài phút là xong, nhớ trước khi quên.',
    'suggestion.srs.body': 'Có {count} từ đến hạn ôn hôm nay — vài phút là xong, nhớ trước khi quên.',
    'suggestion.subject.titleBack': 'Mở lại môn {subject}',
    'suggestion.subject.titleBoost': 'Bổ sung môn {subject}',
    'suggestion.subject.bodyBack':
      '7 ngày qua bạn chưa chạm môn {subject} chút nào — hôm nay thử một buổi ngắn môn {subject} nhé.',
    'suggestion.subject.bodyBoost':
      '7 ngày qua môn {subject} ít được ôn nhất ({minutes} phút) — hôm nay dành một buổi cho môn {subject} nhé.',
    'suggestion.start.title': 'Bắt đầu buổi học đầu tiên',
    'suggestion.start.body':
      'Sổ của bạn đang trống — một buổi học ngắn hoặc vài từ mới là card này sẽ gợi ý được ngay.',
    'unit.mistakes': 'lỗi sai',
    'unit.words': 'từ',
    'unit.minutes': 'phút',

    'draft.subjectDeleted': 'môn đã xoá',
    'draft.subjectId': 'môn {id}',
    'subject.unassigned': 'chưa phân môn',
    'draft.mistakesSubject': '{name} ({count} câu)',
    'draft.mistakesSummary': '{count} lỗi sai — nhiều nhất ở {subjects}',
    'draft.mistakesSummaryOnly': '{count} lỗi sai',
    'draft.studied': 'Hôm nay học {minutes} phút — {names}.',
    'draft.studiedOne': 'Hôm nay học 1 phút — {names}.',
    'draft.noSessions': 'Hôm nay chưa ghi buổi học nào.',
    'draft.noSessionsShort': 'chưa ghi buổi học nào',
    'draft.wordsList': 'Từ mới: {words}.',
    'draft.wordsListMore': 'Từ mới: {words} và {rest} từ khác.',
    'draft.wordsCount': 'Từ mới: {count} từ.',
    'draft.feeling': 'Cảm nhận hôm nay: …',
    'draft.emptyIntro':
      'Hôm nay chưa có dữ liệu để soạn nháp — học một buổi ngắn, thêm vài từ mới\nhoặc ghi lỗi sai là nháp sẽ có ngay.',
    'draft.emptyHandwritten': 'Bạn vẫn có thể viết tay cảm nhận của mình vào đây nhé.',
    'draft.minutesNames': '{minutes} phút — {names}',
    'draft.promptRole': 'Bạn là trợ lý học tập đa môn. Hãy soạn NHÁP ghi chú cuối ngày',
    'draft.promptFor': '({date}) cho người học từ dữ liệu sau:',
    'draft.promptStudied': '- Đã học: {studied}',
    'draft.promptWords': '- Từ mới: {words}',
    'draft.promptMistakes': '- Lỗi sai: {mistakes}',
    'draft.promptRequire':
      'Yêu cầu: viết 3–4 dòng ngắn, tiếng Việt thân thiện (giọng sổ tay), dòng cuối gợi mở một câu "Cảm nhận hôm nay: …" cho người học điền tiếp. Không dùng emoji, không dùng Markdown.',
    'draft.promptWordsNone': 'không có từ mới',
    'draft.promptWordsList': '{count} từ ({words})',
    'draft.promptWordsCount': '{count} từ',
    'draft.promptMistakesNone': 'không có lỗi sai mới',

    'prompt.intro': 'Bạn là trợ lý học tập đa môn. Dữ liệu học của người học tính đến hôm nay:',
    'prompt.mistakesLine': '- Lỗi sai chưa ôn lại: {count} câu',
    'prompt.dueLine': '- Thẻ từ vựng đến hạn ôn: {count} từ',
    'prompt.subjectLine': '- Môn {name}: {minutes} phút trong 7 ngày qua',
    'prompt.noSubjects': '- Chưa có môn nào được định nghĩa',
    'prompt.require':
      'Hãy chọn MỘT việc nên làm tiếp theo và trả lời NGẮN (tối đa 2 câu), tiếng Việt thân thiện, cụ thể và khả thi trong một buổi học. Không dùng emoji, không dùng Markdown.',

    'rag.notConnected': 'Chưa kết nối máy trợ lý — nhập địa chỉ máy trợ lý trong Cài đặt',
    'rag.emptyQuestion': 'Bạn chưa nhập câu hỏi — gõ điều bạn muốn hỏi đã nhé.',
    'rag.serverError': 'Máy trợ lý gặp sự cố (mã {code}). Thử lại sau ít phút nhé.',
    'rag.badResponse': 'Máy trợ lý trả kết quả không đọc được. Thử lại nhé.',
    'rag.noAnswer': 'Máy trợ lý chưa trả lời được câu này. Thử hỏi cách khác nhé.',
    'rag.cancelled': 'Đã huỷ câu hỏi này.',
    'rag.timeout': 'Máy trợ lý trả lời quá lâu (quá {seconds} giây). Thử hỏi ngắn gọn hơn nhé.',
    'rag.network': 'Không kết nối được máy trợ lý. Kiểm tra máy trợ lý đã mở chưa rồi thử lại nhé.',
  },
  en: {
    'card.title': "Today's suggestion",
    'card.tag': 'suggestion',
    'card.loading': 'Looking through your journal…',
    'card.loadFailed':
      "Couldn't read your journal, so no suggestion for now. Reload the page to try again.",
    'card.empty':
      'Nothing to base a suggestion on yet. Start a short study session or add a few new words and this card will get to work.',
    'card.startAction': 'Start studying',
    'card.ragSource': '— from your study assistant',
    'card.connectPrompt': 'Want suggestions based on your subject documents?',
    'card.connectLink': 'Connect the assistant in Settings',

    'suggestion.mistakes.title': 'Review your mistakes',
    'suggestion.mistakes.bodyOne':
      "You still have 1 mistake to review — look at the cause again so it doesn't trip you up today.",
    'suggestion.mistakes.body':
      'You still have {count} mistakes to review — look at the causes again so they don\'t trip you up today.',
    'suggestion.srs.title': 'Review due vocabulary',
    'suggestion.srs.bodyOne':
      '1 word is due for review today — a few minutes is all it takes. Review it before you forget.',
    'suggestion.srs.body':
      '{count} words are due for review today — a few minutes is all it takes. Review them before you forget.',
    'suggestion.subject.titleBack': 'Reopen {subject}',
    'suggestion.subject.titleBoost': 'Give {subject} more time',
    'suggestion.subject.bodyBack':
      "You haven't touched {subject} in 7 days — try a short session today.",
    'suggestion.subject.bodyBoost':
      'Over the last 7 days {subject} got the least review ({minutes} minutes) — give it a session today.',
    'suggestion.start.title': 'Start your first study session',
    'suggestion.start.body':
      'Your journal is still empty — a short session or a few new words is all this card needs to start suggesting.',
    'unit.mistakes': 'mistakes',
    'unit.words': 'words',
    'unit.minutes': 'minutes',

    'draft.subjectDeleted': 'deleted subject',
    'draft.subjectId': 'subject {id}',
    'subject.unassigned': 'unassigned',
    'draft.mistakesSubject': '{name} ({count} questions)',
    'draft.mistakesSummary': '{count} mistakes — most in {subjects}',
    'draft.mistakesSummaryOnly': '{count} mistakes',
    'draft.studied': 'Studied {minutes} minutes today — {names}.',
    'draft.studiedOne': 'Studied 1 minute today — {names}.',
    'draft.noSessions': 'No study sessions logged today.',
    'draft.noSessionsShort': 'no sessions logged',
    'draft.wordsList': 'New words: {words}.',
    'draft.wordsListMore': 'New words: {words} and {rest} more.',
    'draft.wordsCount': 'New words: {count} words.',
    'draft.feeling': 'Reflection for today: …',
    'draft.emptyIntro':
      "Nothing to draft from today — a short study session, a few new words,\nor a logged mistake will fill it right in.",
    'draft.emptyHandwritten': 'You can still write your reflection by hand here.',
    'draft.minutesNames': '{minutes} minutes — {names}',
    'draft.promptRole': 'You are a multi-subject study assistant. Draft the end-of-day journal entry',
    'draft.promptFor': '({date}) for the learner from the data below:',
    'draft.promptStudied': '- Studied: {studied}',
    'draft.promptWords': '- New words: {words}',
    'draft.promptMistakes': '- Mistakes: {mistakes}',
    'draft.promptRequire':
      'Requirements: write 3–4 short lines in a friendly journal voice, ending with an open "Reflection for today: …" line for the learner to complete. No emoji, no Markdown.',
    'draft.promptWordsNone': 'no new words',
    'draft.promptWordsList': '{count} words ({words})',
    'draft.promptWordsCount': '{count} words',
    'draft.promptMistakesNone': 'no new mistakes',

    'prompt.intro': "You are a multi-subject study assistant. The learner's study data as of today:",
    'prompt.mistakesLine': '- Unreviewed mistakes: {count}',
    'prompt.dueLine': '- Vocabulary cards due for review: {count}',
    'prompt.subjectLine': '- Subject {name}: {minutes} minutes over the last 7 days',
    'prompt.noSubjects': '- No subjects defined yet',
    'prompt.require':
      'Pick ONE thing to do next and reply SHORT (max 2 sentences), in friendly English, concrete and doable within one study session. No emoji, no Markdown.',

    'rag.notConnected': 'Assistant not connected yet — enter the assistant address in Settings',
    'rag.emptyQuestion': "You haven't typed a question — write what you want to ask first.",
    'rag.serverError': 'The assistant hit a snag (code {code}). Try again in a few minutes.',
    'rag.badResponse': "The assistant's reply couldn't be read. Please try again.",
    'rag.noAnswer': "The assistant couldn't answer this one. Try asking in a different way.",
    'rag.cancelled': 'This question was cancelled.',
    'rag.timeout':
      'The assistant took too long to reply (over {seconds} seconds). Try a shorter question.',
    'rag.network': "Couldn't reach the assistant. Make sure it's running, then try again.",
  },
}
