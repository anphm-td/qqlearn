import type { NamespaceDict } from '../index'

/*
 * Từ điển namespace "study" — nhóm màn hình học/buổi học (feature folder
 * src/features/study/): StudyPage (/hoc) và SessionPage (/hoc/buoi-hoc — bấm giờ
 * pomodoro + form nhập tay). sessionRecovery.ts chỉ lưu/đọc sessionStorage, không
 * có chuỗi hiển thị nào cho người dùng.
 * Nhóm key:
 *  - page./header.:    khung trang (/hoc và /hoc/buoi-hoc).
 *  - setup./duration.: khối "chuẩn bị buổi học" + nhãn bộ chọn thời lượng
 *                      (DurationPicker nhận `label` qua prop từ người gọi).
 *  - subject.:         chọn môn + nút "＋ môn mới".
 *  - activity.:        5 hoạt động học (giá trị LƯU DB giữ nguyên 'nghe'… —
 *                      key chỉ để HIỂN THỊ) + aria của pill.
 *  - goal.:            dòng mục tiêu hôm nay.
 *  - action./hint.:    nút vào buổi/nhập tay/nghỉ… + chú thích.
 *  - phase./progress./clock./live.:
 *                      trạng thái bấm giờ, dòng hoạt động/môn khi đang học.
 *  - break.:           khối giờ nghỉ giữa các vòng.
 *  - save./cancel./error.:
 *                      kết thúc & lưu, huỷ buổi, lỗi lưu.
 *  - manual.:          form nhập tay buổi học.
 * Giữ luật:
 *  - Key vi và en PHẢI đối xứng 1-1 (test key-parity trong src/core/i18n/i18n.test.ts).
 *  - key dạng chấm phân nhóm; biến nội suy dạng {ten}.
 *  - 'vi' là nguồn chuẩn (copy nguyên văn); 'en' tự nhiên, thân thiện theo
 *    design-system.md mục 8/12 (không tech-speak, giữ nguyên "qqlearn", số liệu,
 *    tên môn user, TOEIC/SRS).
 *  - UI dùng qua hook: const { t } = useT('study').
 */
export const dict: NamespaceDict = {
  vi: {
    'page.label': 'bắt đầu buổi học',
    'page.title': 'Học',

    'header.backAria': 'Về tab Học',
    'header.label': 'buổi học',
    'header.title': 'Bấm giờ học',

    'setup.aria': 'Chuẩn bị buổi học',
    'duration.label': 'thời lượng tự chỉnh',

    'subject.label': 'chọn môn',
    'subject.addNew': '＋ môn mới',
    'subject.labelShort': 'môn',

    'activity.label': 'hoạt động',
    'activity.listening': 'nghe',
    'activity.reading': 'đọc',
    'activity.grammar': 'ngữ pháp',
    'activity.vocabulary': 'từ vựng',
    'activity.practice': 'luyện đề',
    'activity.aria': 'Hoạt động {name}',

    'goal.today': 'mục tiêu hôm nay: {done}/{total} phút ({pct}%)',
    'goal.todayShort': 'hôm nay: {done}/{total} phút ({pct}%)',

    'action.start': 'Vào buổi học',
    'action.manual': 'Nhập tay buổi học',
    'action.startNow': 'Bắt đầu học ngay',
    'action.pause': 'Tạm nghỉ',
    'action.resume': 'Tiếp tục',
    'action.extend': 'Học thêm 5 phút',
    'action.takeBreak': 'Nghỉ {break} phút',

    'hint.timerNote': 'Buổi học dùng bấm giờ theo thời lượng đã chọn, lưu vào sổ khi kết thúc.',
    'hint.breakNote': 'Nghỉ {break} phút sau mỗi vòng — hẹn giờ nghỉ tự hiện khi đủ thời lượng.',

    'phase.running': 'đang tập trung',
    'phase.paused': 'tạm nghỉ',
    'phase.done': 'đã xong vòng học',
    'running.aria': 'Đang học',

    'progress.done': 'đã học {minutes} phút',
    'progress.remaining': 'còn {time}',

    'clock.aria': 'Đồng hồ đếm ngược',

    'live.activityLine': 'hoạt động: {activity} — {subject} (đổi được tới khi lưu)',
    'live.subjectNamed': 'môn {name}',
    'live.noSubject': 'chưa chọn môn',

    'break.done': 'Hết giờ nghỉ!',
    'break.remaining': 'Nghỉ {break} phút — còn {time}',
    'break.next': 'Học tiếp vòng nữa',
    'break.skip': 'Bỏ qua nghỉ',

    'save.button': 'Kết thúc & lưu',
    'save.saving': 'Đang lưu…',

    'cancel.button': 'Huỷ buổi',
    'cancel.confirm': 'Chắc chắn huỷ?',

    'error.tooShort': 'Buổi chưa đủ một phút — học thêm hoặc hủy nhé.',
    'error.tooShortInline': 'Buổi chưa đủ một phút để lưu — học thêm hoặc hủy nhé.',
    'error.invalid': 'Dữ liệu buổi học chưa hợp lệ — kiểm tra lại môn và thời lượng.',
    'error.save': 'Không lưu được buổi học — thử lại nhé.',

    'manual.aria': 'Nhập tay buổi học',
    'manual.label': 'nhập tay buổi học',
    'manual.hint': 'Học ngoài app? Ghi lại sau cho đủ sổ.',
    'manual.dateLabel': 'ngày học',
    'manual.timeLabel': 'giờ bắt đầu',
    'manual.noteLabel': 'ghi chú ngắn (tuỳ chọn)',
    'manual.notePlaceholder': 'vd. luyện Pair 3, sai 2 câu',
    'manual.save': 'Lưu buổi học',
    'manual.savedPrefix': 'đã lưu —',
    'manual.seeToday': 'xem trang Hôm nay',
    'manual.invalid': 'Chưa hợp lệ — kiểm tra ngày, giờ và thời lượng.',
    'manual.saveError': 'Không lưu được — thử lại nhé.',
  },
  en: {
    'page.label': 'start a session',
    'page.title': 'Study',

    'header.backAria': 'Back to Study',
    'header.label': 'session',
    'header.title': 'Study timer',

    'setup.aria': 'Prepare a session',
    'duration.label': 'Adjustable duration',

    'subject.label': 'pick subjects',
    'subject.addNew': '＋ new subject',
    'subject.labelShort': 'subject',

    'activity.label': 'activity',
    'activity.listening': 'listening',
    'activity.reading': 'reading',
    'activity.grammar': 'grammar',
    'activity.vocabulary': 'vocabulary',
    'activity.practice': 'practice tests',
    'activity.aria': 'Activity: {name}',

    'goal.today': "Today's goal: {done}/{total} min ({pct}%)",
    'goal.todayShort': 'today: {done}/{total} min ({pct}%)',

    'action.start': 'Start a session',
    'action.manual': 'Log a session manually',
    'action.startNow': 'Start studying now',
    'action.pause': 'Pause',
    'action.resume': 'Resume',
    'action.extend': 'Study 5 more minutes',
    'action.takeBreak': 'Take a {break}-minute break',

    'hint.timerNote': 'The session runs on a timer for the duration you picked, and is saved to your journal when it ends.',
    'hint.breakNote': 'A {break}-minute break follows each round — the break timer shows up on its own.',

    'phase.running': 'focusing',
    'phase.paused': 'paused',
    'phase.done': 'round finished',
    'running.aria': 'Studying',

    'progress.done': 'studied {minutes} min',
    'progress.remaining': '{time} left',

    'clock.aria': 'Countdown timer',

    'live.activityLine': 'activity: {activity} — {subject} (you can change it until you save)',
    'live.subjectNamed': 'subject {name}',
    'live.noSubject': 'no subject picked',

    'break.done': 'Break is over!',
    'break.remaining': '{break}-minute break — {time} left',
    'break.next': 'Do another round',
    'break.skip': 'Skip the break',

    'save.button': 'Finish & save',
    'save.saving': 'Saving…',

    'cancel.button': 'Cancel session',
    'cancel.confirm': 'Really cancel?',

    'error.tooShort': 'The session is under a minute — study a little more or cancel.',
    'error.tooShortInline': 'The session is under a minute — study a little more or cancel.',
    'error.invalid': "The session data isn't valid — check the subject and duration.",
    'error.save': "Couldn't save the session — please try again.",

    'manual.aria': 'Log a session manually',
    'manual.label': 'log a session manually',
    'manual.hint': 'Studied outside the app? Log it after the fact so your journal stays complete.',
    'manual.dateLabel': 'study date',
    'manual.timeLabel': 'start time',
    'manual.noteLabel': 'short note (optional)',
    'manual.notePlaceholder': 'e.g. practiced Pair 3, missed 2 questions',
    'manual.save': 'Save session',
    'manual.savedPrefix': 'saved —',
    'manual.seeToday': 'see the Today page',
    'manual.invalid': 'Not valid — check the date, time and duration.',
    'manual.saveError': "Couldn't save — please try again.",
  },
}
