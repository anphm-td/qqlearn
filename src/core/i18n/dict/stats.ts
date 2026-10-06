import type { NamespaceDict } from '../index'

/*
 * Từ điển namespace "stats" — nhóm màn hình thống kê (feature folder
 * src/features/stats/): StatsPage (/thongke), ScoresPage (/thongke/diem),
 * WeekPage (/thongke/tuan) + hàm thuần statsAgg.ts (nhãn thứ/tháng) và
 * weekReport.ts (describeDelta — câu so với tuần trước).
 * Nhóm key:
 *  - page./range.:      khung trang + nhãn khoảng tuần.
 *  - link.:             2 thẻ dẫn tới Sổ điểm / Báo cáo tuần.
 *  - gran./chart.:      biểu đồ cột giờ học + nút ngày/tuần/tháng.
 *  - subject.:          phân bổ giờ học theo môn.
 *  - heat./bubble.:     heatmap tháng + title từng ô bubble (dùng chung WeekPage).
 *  - label./unit./stat.:
 *                       nhãn số liệu lớn, đơn vị, dòng "tuần trước: …".
 *  - compare./days./streak.:
 *                       khối so với tuần trước, từng ngày, streak (WeekPage).
 *  - scores./error.:    Sổ điểm — form, đồ thị, danh sách, lỗi nhập.
 *  - delta.:            describeDelta (weekReport.ts) — câu so sánh tự động.
 *  - weekday./month.:   nhãn thứ (CN..T7) và tháng (T1..T12 / Jan..Dec) cho
 *                       statsAgg (aggregateBuckets, weekdayLabelsMon).
 * Giữ luật:
 *  - Key vi và en PHẢI đối xứng 1-1 (test key-parity trong src/core/i18n/i18n.test.ts).
 *  - key dạng chấm phân nhóm; biến nội suy dạng {ten}.
 *  - 'vi' là nguồn chuẩn (copy nguyên văn); 'en' tự nhiên, thân thiện theo
 *    design-system.md mục 8/12 (không tech-speak, giữ nguyên "qqlearn", số liệu,
 *    tên môn user, TOEIC/SRS).
 *  - UI dùng qua hook: const { t, lang } = useT('stats'); hàm thuần nhận `lang`
 *    (mặc định 'vi') rồi gọi t(lang, 'stats', …).
 */
export const dict: NamespaceDict = {
  vi: {
    'page.label': 'thống kê',
    'page.title': 'Thống kê',
    'page.loadError': 'Không mở được sổ thống kê. Bạn thử tải lại trang nhé!',

    'range.thisWeek': 'tuần này',

    'link.scoresLabel': 'sổ điểm',
    'link.scoresCaption': 'điểm kiểm tra của từng môn',
    'link.weekLabel': 'báo cáo tuần',
    'link.weekStreakOne': 'streak 1 ngày',
    'link.weekStreak': 'streak {days} ngày',

    'gran.day': 'ngày',
    'gran.week': 'tuần',
    'gran.month': 'tháng',
    'gran.dayCaption': '7 ngày gần nhất',
    'gran.weekCaption': '8 tuần gần nhất',
    'gran.monthCaption': '6 tháng gần nhất',

    'chart.label': 'giờ học',
    'chart.unitCaption': 'đơn vị: giờ · {range}',
    'chart.loading': 'đang mở sổ…',
    'chart.empty': 'Chưa có buổi học nào để vẽ biểu đồ. Bắt đầu một buổi 25 phút nhé?',
    'chart.aria': 'Biểu đồ giờ học',

    'subject.chartLabel': 'mỗi môn học bao lâu',
    'subject.caption': 'phân bổ giờ học theo môn',
    'subject.empty': 'Chưa có dữ liệu môn. Chọn môn cho buổi học để thấy phân bổ nhé!',
    'subject.aria': 'Phân bổ giờ học theo môn',
    'subject.uncategorized': 'chưa phân môn',
    'subject.deleted': 'môn đã xoá',
    'subject.hoursSuffix': '{hours} giờ',

    'heat.label': 'lịch học theo tháng',
    'heat.prevAria': 'Tháng trước',
    'heat.nextAria': 'Tháng sau',
    'heat.monthCaption': 'tháng {month}/{year}',
    'heat.less': 'ít',
    'heat.more': 'nhiều',
    'heat.goal': 'mục tiêu {goal} phút mỗi ngày',

    'bubble.empty': '{date}: chưa học',
    'bubble.minutes': '{date}: {minutes} phút',

    'report.label': 'báo cáo tuần này',

    'label.hours': 'giờ học',
    'label.newWords': 'từ mới',
    'label.mistakes': 'lỗi sai',
    'label.streakDays': 'học liên tiếp',
    'label.totalHours': 'tổng giờ học',
    'label.sessions': 'buổi học',
    'label.daysStudied': 'ngày có học',

    'unit.hours': 'giờ',
    'unit.words': 'từ',
    'unit.mistakes': 'lỗi',
    'unit.days': 'ngày',
    'unit.minutes': 'phút',
    'unit.sessions': 'buổi',
    'unit.points': 'điểm',

    'stat.prevHours': 'tuần trước: {hours}',
    'stat.prevWords': 'tuần trước: {count}',
    'stat.prevMistakes': 'tuần trước: {count}',
    'stat.asOfToday': 'tính đến hôm nay',
    'stat.daysOutOf7': '{count}/7 ngày',

    'compare.label': 'so với tuần trước',
    'compare.unchanged': 'không đổi',
    'compare.sourceNote': 'báo cáo tự tổng hợp từ sổ buổi học, ghi chú cuối ngày và sổ lỗi sai của bạn',
    'compare.emptyWeek': 'Tuần này chưa có dữ liệu — cứ học và ghi sổ, báo cáo sẽ tự đầy dần nhé!',

    'days.label': 'từng ngày trong tuần',
    'days.caption': 'số phút mỗi ngày (bubble đầy = đạt mục tiêu)',

    'streak.caption': 'chuỗi ngày học liên tiếp (mục tiêu {goal} phút mỗi ngày)',

    'week.pageLabel': 'thống kê · tuần',
    'week.title': 'Báo cáo tuần',
    'week.loadError': 'Không mở được sổ báo cáo. Bạn thử tải lại trang nhé!',
    'week.prevAria': 'Tuần trước',
    'week.nextAria': 'Tuần sau',
    'week.loading': 'đang tổng hợp sổ…',

    'scores.pageLabel': 'thống kê · điểm',
    'scores.title': 'Sổ điểm',
    'scores.formLabel': 'nhập bài kiểm tra vừa làm',
    'scores.dateLabel': 'ngày kiểm tra',
    'scores.linkLabel': 'nhãn bài kiểm tra',
    'scores.labelPlaceholder': 'vd. Toán — Định lí Pytago',
    'scores.subjectLabel': 'môn',
    'scores.scoreLabel': 'điểm (0–1000)',
    'scores.noteLabel': 'ghi chú (tuỳ chọn)',
    'scores.notePlaceholder': 'vd. sai bài 4 vì quên đổi đơn vị',
    'scores.savedCaption': 'điểm sẽ lưu',
    'scores.saveButton': 'Lưu vào sổ điểm',
    'scores.progressLabel': 'tiến bộ điểm số',
    'scores.progressCaption': 'điểm theo từng lần kiểm tra gần nhất',
    'scores.chartEmpty': 'Chưa có điểm nào để vẽ đồ thị. Nhập bài kiểm tra đầu tiên ở trên nhé!',
    'scores.chartAria': 'Đồ thị tiến bộ điểm kiểm tra',
    'scores.pointTitle': '{date} · {score} điểm',
    'scores.latestCaption': 'lần gần nhất: {score} điểm ({date})',
    'scores.listEmpty': 'Sổ điểm còn trang trắng. Lần kiểm tra đầu tiên sẽ mở đầu cho đường tiến bộ đó!',
    'scores.removeButton': 'xóa',
    'scores.removeConfirm': 'Xóa lần kiểm tra này khỏi sổ điểm?',
    'scores.defaultLabel': 'Bài kiểm tra',
    'scores.stepperDownAria': 'Giảm 1 điểm',
    'scores.stepperUpAria': 'Tăng 1 điểm',

    'error.enterScore': 'Bạn nhập điểm trước đã nhé.',
    'error.scoreRange': 'Điểm nằm trong khoảng 0–1000.',
    'error.labelEmpty': 'Nhãn bài kiểm tra không được để trống.',
    'error.dateInvalid': 'Ngày kiểm tra không hợp lệ.',
    'error.generic': 'Thông tin chưa hợp lệ, bạn kiểm tra lại nhé.',

    'delta.prefix': 'so với tuần trước: {parts}',
    'delta.hoursSame': 'giờ học giữ nguyên',
    'delta.hoursMore': 'học nhiều hơn {count} phút',
    'delta.hoursMoreOne': 'học nhiều hơn 1 phút',
    'delta.hoursLess': 'học kém hơn {count} phút',
    'delta.hoursLessOne': 'học kém hơn 1 phút',
    'delta.wordsSame': 'từ mới giữ nguyên',
    'delta.wordsMore': 'thêm {count} từ mới',
    'delta.wordsMoreOne': 'thêm 1 từ mới',
    'delta.wordsLess': 'bớt {count} từ mới',
    'delta.wordsLessOne': 'bớt 1 từ mới',
    'delta.mistakesSame': 'lỗi sai giữ nguyên',
    'delta.mistakesMore': 'nhiều hơn {count} lỗi',
    'delta.mistakesMoreOne': 'nhiều hơn 1 lỗi',
    'delta.mistakesLess': 'ít hơn {count} lỗi',
    'delta.mistakesLessOne': 'ít hơn 1 lỗi',

    'weekday.0': 'CN',
    'weekday.1': 'T2',
    'weekday.2': 'T3',
    'weekday.3': 'T4',
    'weekday.4': 'T5',
    'weekday.5': 'T6',
    'weekday.6': 'T7',

    'month.1': 'T1',
    'month.2': 'T2',
    'month.3': 'T3',
    'month.4': 'T4',
    'month.5': 'T5',
    'month.6': 'T6',
    'month.7': 'T7',
    'month.8': 'T8',
    'month.9': 'T9',
    'month.10': 'T10',
    'month.11': 'T11',
    'month.12': 'T12',
  },
  en: {
    'page.label': 'stats',
    'page.title': 'Stats',
    'page.loadError': "Couldn't open the stats journal. Try reloading the page!",

    'range.thisWeek': 'this week',

    'link.scoresLabel': 'score log',
    'link.scoresCaption': 'test scores for each subject',
    'link.weekLabel': 'weekly report',
    'link.weekStreakOne': '1-day streak',
    'link.weekStreak': '{days}-day streak',

    'gran.day': 'day',
    'gran.week': 'week',
    'gran.month': 'month',
    'gran.dayCaption': 'last 7 days',
    'gran.weekCaption': 'last 8 weeks',
    'gran.monthCaption': 'last 6 months',

    'chart.label': 'study hours',
    'chart.unitCaption': 'unit: hours · {range}',
    'chart.loading': 'Opening your journal…',
    'chart.empty': 'No study sessions to chart yet. How about a 25-minute session?',
    'chart.aria': 'Study hours chart',

    'subject.chartLabel': 'time per subject',
    'subject.caption': 'study time by subject',
    'subject.empty': 'No subject data yet. Pick a subject for your sessions to see the breakdown!',
    'subject.aria': 'Study time by subject',
    'subject.uncategorized': 'no subject',
    'subject.deleted': 'deleted subject',
    'subject.hoursSuffix': '{hours} hrs',

    'heat.label': 'monthly study calendar',
    'heat.prevAria': 'Previous month',
    'heat.nextAria': 'Next month',
    'heat.monthCaption': '{month}/{year}',
    'heat.less': 'less',
    'heat.more': 'more',
    'heat.goal': '{goal} min daily goal',

    'bubble.empty': '{date}: not studied',
    'bubble.minutes': '{date}: {minutes} min',

    'report.label': "this week's report",

    'label.hours': 'study hours',
    'label.newWords': 'new words',
    'label.mistakes': 'mistakes',
    'label.streakDays': 'days in a row',
    'label.totalHours': 'total study hours',
    'label.sessions': 'sessions',
    'label.daysStudied': 'days studied',

    'unit.hours': 'hrs',
    'unit.words': 'words',
    'unit.mistakes': 'mistakes',
    'unit.days': 'days',
    'unit.minutes': 'min',
    'unit.sessions': 'sessions',
    'unit.points': 'pts',

    'stat.prevHours': 'last week: {hours}',
    'stat.prevWords': 'last week: {count}',
    'stat.prevMistakes': 'last week: {count}',
    'stat.asOfToday': 'as of today',
    'stat.daysOutOf7': '{count}/7 days',

    'compare.label': 'vs last week',
    'compare.unchanged': 'unchanged',
    'compare.sourceNote': 'This report adds up your study sessions, end-of-day notes and mistake log automatically.',
    'compare.emptyWeek': 'No data for this week yet — keep studying and logging, and the report will fill in!',

    'days.label': 'each day this week',
    'days.caption': 'minutes per day (a full bubble = goal met)',

    'streak.caption': 'days in a row (goal: {goal} min a day)',

    'week.pageLabel': 'stats · week',
    'week.title': 'Weekly report',
    'week.loadError': "Couldn't open the report journal. Try reloading the page!",
    'week.prevAria': 'Previous week',
    'week.nextAria': 'Next week',
    'week.loading': 'Adding up your journal…',

    'scores.pageLabel': 'stats · scores',
    'scores.title': 'Score log',
    'scores.formLabel': 'log a test you just took',
    'scores.dateLabel': 'test date',
    'scores.linkLabel': 'test label',
    'scores.labelPlaceholder': 'e.g. Math — Pythagorean theorem',
    'scores.subjectLabel': 'subject',
    'scores.scoreLabel': 'score (0–1000)',
    'scores.noteLabel': 'note (optional)',
    'scores.notePlaceholder': 'e.g. missed question 4 — forgot to convert units',
    'scores.savedCaption': 'score to save',
    'scores.saveButton': 'Save to score log',
    'scores.progressLabel': 'score progress',
    'scores.progressCaption': 'score for each recent test',
    'scores.chartEmpty': 'No scores to chart yet. Enter your first test above!',
    'scores.chartAria': 'Test score progress chart',
    'scores.pointTitle': '{date} · {score} pts',
    'scores.latestCaption': 'latest: {score} pts ({date})',
    'scores.listEmpty': 'Your score log is a blank page — your first test will draw the first dot!',
    'scores.removeButton': 'remove',
    'scores.removeConfirm': 'Remove this test from the score log?',
    'scores.defaultLabel': 'Test',
    'scores.stepperDownAria': 'Decrease by 1 point',
    'scores.stepperUpAria': 'Increase by 1 point',

    'error.enterScore': 'Enter a score first.',
    'error.scoreRange': 'The score must be between 0 and 1000.',
    'error.labelEmpty': 'The test label cannot be empty.',
    'error.dateInvalid': 'The test date is invalid.',
    'error.generic': "Something's off with your input — please double-check it.",

    'delta.prefix': 'vs last week: {parts}',
    'delta.hoursSame': 'study hours unchanged',
    'delta.hoursMore': '{count} more minutes studied',
    'delta.hoursMoreOne': '1 more minute studied',
    'delta.hoursLess': '{count} fewer minutes studied',
    'delta.hoursLessOne': '1 fewer minute studied',
    'delta.wordsSame': 'new words unchanged',
    'delta.wordsMore': '{count} more new words',
    'delta.wordsMoreOne': '1 more new word',
    'delta.wordsLess': '{count} fewer new words',
    'delta.wordsLessOne': '1 fewer new word',
    'delta.mistakesSame': 'mistakes unchanged',
    'delta.mistakesMore': '{count} more mistakes',
    'delta.mistakesMoreOne': '1 more mistake',
    'delta.mistakesLess': '{count} fewer mistakes',
    'delta.mistakesLessOne': '1 fewer mistake',

    'weekday.0': 'Sun',
    'weekday.1': 'Mon',
    'weekday.2': 'Tue',
    'weekday.3': 'Wed',
    'weekday.4': 'Thu',
    'weekday.5': 'Fri',
    'weekday.6': 'Sat',

    'month.1': 'Jan',
    'month.2': 'Feb',
    'month.3': 'Mar',
    'month.4': 'Apr',
    'month.5': 'May',
    'month.6': 'Jun',
    'month.7': 'Jul',
    'month.8': 'Aug',
    'month.9': 'Sep',
    'month.10': 'Oct',
    'month.11': 'Nov',
    'month.12': 'Dec',
  },
}
