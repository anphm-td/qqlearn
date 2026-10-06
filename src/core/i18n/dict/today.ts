import type { NamespaceDict } from '../index'

/*
 * Từ điển namespace "today" — nhóm màn hình "vòng lặp học hằng ngày" (feature folder
 * src/features/today/):
 *  - home.*:      TodayPage (A4) — tiêu đề, lời chào + mục tiêu, banner server, onboarding.
 *  - greeting.*:  greeting() (todayLogic.ts) — lời chào theo giờ.
 *  - weekday.*:   weekdayShort()/formatDayShort()/buildWeek() — nhãn thứ ngắn.
 *  - progress.*:  vòng tiến độ ProgressBubble trên Home.
 *  - week.*:      tuần 7 BubbleCheck.
 *  - streak.*:    dòng streak trên Home.
 *  - sessions.*:  danh sách buổi học hôm nay trên Home.
 *  - note.*:      DailyNoteForm (A3) — ghi chú cuối ngày.
 *  - checkin.*:   CheckinPrompt — "Hỏi giờ học khi mở app".
 *  - picker.*:    DurationPicker — bộ chọn thời lượng tự chỉnh (dùng chung qua prop unit).
 *  - unit.*:      đơn vị hiển thị (phút).
 * Giữ luật:
 *  - Key vi và en PHẢI đối xứng 1-1 (test key-parity trong src/core/i18n/i18n.test.ts).
 *  - key dạng chấm phân nhóm; biến nội suy dạng {ten}.
 *  - 'vi' là nguồn chuẩn (copy nguyên văn); 'en' tự nhiên, thân thiện theo
 *    design-system.md mục 8/12 (không tech-speak, giữ nguyên "qqlearn", số liệu,
 *    tên môn user, TOEIC/SRS).
 *  - Dùng qua hook: const { t } = useT('today') — xem src/data/useT.ts; các hàm thuần
 *    (greeting/weekdayShort/formatDayShort/buildWeek) nhận `lang` (mặc định 'vi')
 *    và gọi t(lang, 'today', …).
 */
export const dict: NamespaceDict = {
  vi: {
    'home.title': 'Hôm nay',
    'home.goalCaption': '{greeting} — mục tiêu {goal} phút mỗi ngày.',
    'home.serverBanner': 'Dữ liệu qua server PC — {url}',
    'home.onboardingPrompt': 'Đặt mục tiêu học mỗi ngày để theo dõi tiến độ nhé.',
    'home.onboardingSetup': 'Thiết lập',
    'home.startStudy': 'Bắt đầu học',

    'greeting.morning': 'Chào buổi sáng',
    'greeting.afternoon': 'Chào buổi chiều',
    'greeting.evening': 'Chào buổi tối',

    'weekday.sun': 'CN',
    'weekday.mon': 'T2',
    'weekday.tue': 'T3',
    'weekday.wed': 'T4',
    'weekday.thu': 'T5',
    'weekday.fri': 'T6',
    'weekday.sat': 'T7',

    'progress.sectionAria': 'Tiến độ hôm nay',
    'progress.label': 'tiến độ hôm nay',
    'progress.caption': '{done}/{goal} phút',

    'week.label': 'tuần này',
    'week.bubbleAria': '{weekday} {date}: {minutes} phút',

    'streak.label': 'streak {days} ngày',

    'sessions.sectionAria': 'Buổi học hôm nay',
    'sessions.label': 'buổi học hôm nay',
    'sessions.countOne': '1 buổi',
    'sessions.count': '{count} buổi',
    'sessions.loading': 'Đang mở sổ…',
    'sessions.loadError': 'Chưa mở được dữ liệu cục bộ. Thử tải lại trang nhé.',
    'sessions.empty': 'Hôm nay chưa có buổi học nào. Vài chục phút là mở được một mục mới đấy.',
    'sessions.start25': 'Học 25 phút',
    'sessions.retry': 'Tải lại',
    'sessions.minutesShort': '{minutes} phút',
    'sessions.subjectDeleted': 'môn đã xoá',
    'sessions.sourceTimer': 'bấm giờ',
    'sessions.sourceManual': 'nhập tay',

    'note.sectionAria': 'Ghi chú cuối ngày',
    'note.label': 'ghi chú cuối ngày',
    'note.hasNote': 'đã có ghi chú hôm nay',
    'note.title': 'Hôm nay học được gì?',
    'note.subjectsLabel': 'môn đã học',
    'note.newWordsLabel': 'từ mới',
    'note.mistakesLabel': 'lỗi sai',
    'note.mistakesPlaceholder': 'vd. bài 4 quên đổi đơn vị',
    'note.mistakesToday': '{count} mục hôm nay',
    'note.reflectionLabel': 'nhận xét',
    'note.reflectionPlaceholder': 'Bạn vừa học được gì?',
    'note.draftedHint': 'nháp vừa được soạn — chỉnh rồi lưu nhé',
    'note.draftButton': 'Soạn nháp',
    'note.drafting': 'Đang soạn…',
    'note.saveButton': 'Lưu vào sổ',
    'note.saving': 'Đang lưu…',
    'note.saved': 'đã lưu vào sổ',
    'note.dismissError': 'Ẩn',
    'note.loadError': 'Không đọc được ghi chú hôm nay — thử tải lại trang nhé.',
    'note.invalidError': 'Ghi chú chưa hợp lệ — kiểm tra lại số từ mới và các trường đã điền.',
    'note.saveError': 'Không lưu được ghi chú — thử lại nhé.',
    'note.draftError': 'Không soạn được nháp — thử lại nhé.',

    'checkin.sectionAria': 'Hỏi giờ học khi mở app',
    'checkin.label': 'hỏi giờ học',
    'checkin.question': 'Bạn vừa học được bao nhiêu phút?',
    'checkin.saveButton': 'Lưu vào sổ',
    'checkin.saving': 'Đang lưu…',
    'checkin.skip': 'Bỏ qua',
    'checkin.saveError': 'Chưa lưu được vào sổ — thử lại nhé.',

    'picker.stepDownAria': 'Bớt {step} {unit}',
    'picker.stepUpAria': 'Thêm {step} {unit}',
    'picker.inputAria': 'Nhập số {unit}',
    'picker.quickLabel': 'gợi ý nhanh:',
    'picker.quickAria': 'Chọn {value} {unit}',
    'picker.hint': 'Bạn có thể tự chỉnh con số này bất cứ lúc nào.',

    'unit.minutes': 'phút',
  },
  en: {
    'home.title': 'Today',
    'home.goalCaption': '{greeting} — {goal} minutes a day is your goal.',
    'home.serverBanner': 'Data is served from your PC server — {url}',
    'home.onboardingPrompt': 'Set a daily study goal to keep track of your progress.',
    'home.onboardingSetup': 'Set it up',
    'home.startStudy': 'Start studying',

    'greeting.morning': 'Good morning',
    'greeting.afternoon': 'Good afternoon',
    'greeting.evening': 'Good evening',

    'weekday.sun': 'Sun',
    'weekday.mon': 'Mon',
    'weekday.tue': 'Tue',
    'weekday.wed': 'Wed',
    'weekday.thu': 'Thu',
    'weekday.fri': 'Fri',
    'weekday.sat': 'Sat',

    'progress.sectionAria': "Today's progress",
    'progress.label': "today's progress",
    'progress.caption': '{done}/{goal} min',

    'week.label': 'this week',
    'week.bubbleAria': '{weekday} {date}: {minutes} min',

    'streak.label': '{days}-day streak',

    'sessions.sectionAria': "Today's study sessions",
    'sessions.label': "today's study sessions",
    'sessions.countOne': '1 session',
    'sessions.count': '{count} sessions',
    'sessions.loading': 'Opening your journal…',
    'sessions.loadError': "Couldn't open your local data. Try reloading the page.",
    'sessions.empty': 'No study sessions today yet. Half an hour or so is enough to make today count.',
    'sessions.start25': 'Study for 25 minutes',
    'sessions.retry': 'Reload',
    'sessions.minutesShort': '{minutes} min',
    'sessions.subjectDeleted': 'deleted subject',
    'sessions.sourceTimer': 'timer',
    'sessions.sourceManual': 'manual',

    'note.sectionAria': 'End-of-day note',
    'note.label': 'end-of-day note',
    'note.hasNote': 'already noted today',
    'note.title': 'What did you learn today?',
    'note.subjectsLabel': 'subjects studied',
    'note.newWordsLabel': 'new words',
    'note.mistakesLabel': 'mistakes',
    'note.mistakesPlaceholder': 'e.g. lesson 4 — forgot to convert units',
    'note.mistakesToday': '{count} logged today',
    'note.reflectionLabel': 'reflection',
    'note.reflectionPlaceholder': 'What did you just learn?',
    'note.draftedHint': 'Draft is ready — tweak it and save.',
    'note.draftButton': 'Draft',
    'note.drafting': 'Drafting…',
    'note.saveButton': 'Save to journal',
    'note.saving': 'Saving…',
    'note.saved': 'saved to your journal',
    'note.dismissError': 'Hide',
    'note.loadError': "Couldn't load today's note — try reloading the page.",
    'note.invalidError': "Something's off with this note — check the new-words count and the fields you filled in.",
    'note.saveError': "Couldn't save the note — please try again.",
    'note.draftError': "Couldn't draft the note — please try again.",

    'checkin.sectionAria': 'Study check-in when the app opens',
    'checkin.label': 'study check-in',
    'checkin.question': 'How many minutes did you just study?',
    'checkin.saveButton': 'Save to journal',
    'checkin.saving': 'Saving…',
    'checkin.skip': 'Skip',
    'checkin.saveError': "Couldn't save that to your journal — please try again.",

    'picker.stepDownAria': 'Decrease by {step} {unit}',
    'picker.stepUpAria': 'Increase by {step} {unit}',
    'picker.inputAria': 'Enter {unit}',
    'picker.quickLabel': 'quick picks:',
    'picker.quickAria': 'Pick {value} {unit}',
    'picker.hint': 'You can adjust this number any time.',

    'unit.minutes': 'minutes',
  },
}
