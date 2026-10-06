import type { NamespaceDict } from '../index'

/*
 * Từ điển trang Cài đặt (src/features/settings/SettingsPage.tsx) + các field con
 * của trang (StepperField, TimeField, DataSourceSection, PhoneConnectSection…)
 * VÀ các chuỗi hiển thị của nhóm feature system (src/features/system/): banner
 * nhắc (useReminders), hướng dẫn PWA/kết nối điện thoại (pwaInstall, phoneConnect),
 * lỗi đọc tệp sao lưu (exportData.parseBackup — trả key + biến, UI tra qua t()).
 * Riêng TÊN TỆP tải về (backup .json/csv) giữ nguyên, không dịch.
 * Quy tắc dịch: design-system.md mục 2/8/12 — giọng chủ động, thân thiện.
 */
export const dict: NamespaceDict = {
  vi: {
    'page.label': 'cài đặt',
    'page.title': 'Cài đặt',
    'page.loading': 'đang mở Sổ…',
    'page.noSettings':
      'Chưa đọc được cài đặt từ nguồn dữ liệu đang dùng. Có thể server PC đã tắt — hãy mở server trên máy tính hoặc chuyển tạm về "Trên máy này".',

    // ===== Nguồn dữ liệu (F21) =====
    'ds.label': 'nguồn dữ liệu',
    'ds.groupAria': 'Chọn nguồn dữ liệu',
    'ds.local': 'Trên máy này',
    'ds.server': 'Qua server PC',
    'ds.localHint': 'Sổ lưu ngay trên máy này — học offline vẫn vào được, không cần mạng.',
    'ds.serverUrlLabel': 'Địa chỉ server PC',
    'ds.serverUrlHint':
      'Chạy “npm run server” trên máy tính — Sổ sẽ đọc/ghi sổ qua server đó. Điện thoại dùng địa chỉ LAN hiện khi server khởi động (vd. http://192.168.1.10:5178).',
    'ds.switchWarning': 'Khi chuyển nguồn, Sổ đọc/ghi theo nơi đã chọn — dữ liệu hai nơi không tự trộn.',
    'ds.applying': 'Đang áp dụng…',
    'ds.apply': 'Áp dụng và tải lại Sổ',

    // ===== Ngôn ngữ (design-system.md mục 12) =====
    'lang.label': 'ngôn ngữ',
    'lang.groupAria': 'Chọn ngôn ngữ',
    'lang.vi': 'Tiếng Việt',
    'lang.en': 'English',
    'lang.desc': 'Đổi ngôn ngữ toàn bộ Sổ — áp dụng ngay.',

    // ===== Kết nối điện thoại =====
    'pc.label': 'kết nối điện thoại',
    'pc.intro': 'Mở Sổ trên điện thoại bằng cách quét mã QR.',
    'pc.showQr': 'Hiện mã QR',
    'pc.loading': 'Đang lấy địa chỉ…',
    'pc.retry': 'Thử lại',
    'pc.qrAlt': 'Mã QR dẫn tới Sổ trên máy tính',
    'pc.urlsHint': 'Mở một trong các địa chỉ sau trên điện thoại:',
    'pc.sameDataNote':
      'Điện thoại thấy cùng dữ liệu với máy tính khi server PC đang chạy (qqlearn.cmd) và nguồn dữ liệu đang chọn là "Qua server PC".',
    // Chuỗi cũ của features/system/phoneConnect.ts (LAN_FETCH_ERROR, PHONE_CONNECT_STEPS)
    // → key, UI tra qua t() (SettingsPage chỉ đổi đúng chỗ import các hằng đó).
    'pc.lanFetchError': 'Không lấy được địa chỉ — hãy chắc chắn qqlearn.cmd đang chạy trên PC.',
    'pc.step.1': 'Nối điện thoại vào cùng Wi-Fi với máy tính.',
    'pc.step.2': 'Mở địa chỉ hiện dưới mã QR bằng trình duyệt trên điện thoại.',
    'pc.step.3': 'Mở menu trình duyệt rồi chọn "Thêm vào Màn hình chính" để cài Sổ.',

    // ===== Mục tiêu hằng ngày =====
    'goal.label': 'mục tiêu hằng ngày',
    'goal.field': 'Học mỗi ngày',
    'goal.unit': 'phút',
    'goal.hint': 'Bấm − / + mỗi lần 5 phút, hoặc chạm vào số để nhập tùy ý.',

    // ===== Nhịp học với đồng hồ (pomodoro) =====
    'pom.label': 'nhịp học với đồng hồ',
    'pom.focus': 'Một phiên tập trung',
    'pom.break': 'Nghỉ giữa hai phiên',

    // ===== Stepper / chọn giờ — dùng chung các field của trang =====
    'stepper.stepDownAria': 'Giảm {label} {step} {unit}',
    'stepper.stepUpAria': 'Tăng {label} {step} {unit}',
    'stepper.inputAria': '{label} — nhập số',
    'stepper.presetsHint': 'chỉ là gợi ý — nhập số tùy ý ở trên',
    'time.backAria': 'Lùi {label} 15 phút',
    'time.forwardAria': 'Gia hạn {label} 15 phút',
    'time.inputAria': '{label} — chọn giờ',

    // ===== Nhắc lịch (C12) =====
    'remind.label': 'nhắc lịch',
    'remind.notifTitle': 'Thông báo hệ thống',
    'remind.allow': 'Cho phép nhắc',
    'remind.perm.granted': 'Đã cấp quyền — Sổ sẽ nhắc qua thông báo hệ thống.',
    'remind.perm.default': 'Chưa cấp quyền nhắc.',
    'remind.perm.denied': 'Quyền nhắc đang bị chặn — bật lại trong phần quyền thông báo của trình duyệt.',
    'remind.perm.unsupported': 'Trình duyệt này chưa hỗ trợ thông báo hệ thống — Sổ sẽ nhắc ngay trong app.',
    'remind.permFallback': 'Khi chưa cấp quyền, lời nhắc vẫn hiện ngay trong app khi Sổ đang mở.',
    'remind.start': 'Nhắc bắt đầu học',
    'remind.note': 'Nhắc ghi chú cuối ngày',
    'remind.hint': 'Bấm − / + để chỉnh 15 phút một lần. Lời nhắc chạy khi Sổ đang mở trên máy này.',
    // Chuỗi banner/nhắc cũ của features/system/useReminders.ts (REMINDER_JOBS) → key;
    // hook useReminders tự tra theo ngôn ngữ hiện tại (banner fallback trong app).
    'remind.job.study.title': 'Đã đến giờ học!',
    'remind.job.study.body': 'Mở Sổ và bắt đầu một phiên học nhỏ nhé.',
    'remind.job.note.title': 'Ghi lại hôm nay nhé',
    'remind.job.note.body': 'Bạn vừa học được gì? Ghi nhanh vài dòng trước khi ngủ.',

    // ===== Hỏi giờ học khi mở app (check-in) =====
    'checkin.label': 'hỏi giờ học khi mở app',
    'checkin.desc': 'Mỗi lần mở app, hỏi bạn vừa học bao nhiêu phút để lưu vào sổ.',
    'checkin.aria': 'Hỏi giờ học khi mở app',
    'checkin.hint': 'Bỏ qua hoặc lưu đều được — Sổ không hỏi lại ngay trong 15 phút.',

    // ===== Trợ lý hỏi đáp (RAG) =====
    'rag.label': 'trợ lý hỏi đáp',
    'rag.addrLabel': 'Địa chỉ máy trợ lý',
    'rag.hint': 'Trang Trò chuyện sẽ hỏi đáp với trợ lý tại địa chỉ này — bỏ trống nếu chưa dùng.',

    // ===== Dữ liệu của bạn (E18) =====
    'data.label': 'dữ liệu của bạn',
    'data.backup': 'Sao lưu toàn bộ vào máy',
    'data.restore': 'Khôi phục từ bản sao lưu',
    'data.exportHint': 'Tải một phần dữ liệu ra tệp riêng:',
    'data.notesExport': 'sổ ghi chú (văn bản)',
    'data.csvButton': '{label} (bảng)',
    'data.csv.sessions': 'buổi học',
    'data.csv.vocab': 'từ vựng',
    'data.csv.mistakes': 'lỗi sai',
    'data.csv.scores': 'điểm',
    'data.markdownOk': 'Đã tải sổ ghi chú (tệp văn bản) về máy.',
    'data.csvOk': 'Đã tải bảng {label} về máy.',
    'data.backupOk': 'Đã lưu bản sao lưu đầy đủ về máy.',
    'data.downloadFail': 'Chưa tải được — thử lại nhé.',
    'data.backupFail': 'Chưa tạo được bản sao lưu — thử lại nhé.',
    'data.readFail': 'Chưa đọc được dữ liệu trong Sổ để xuất.',
    'data.restoreConfirm':
      'Khôi phục sẽ THAY THẾ toàn bộ dữ liệu hiện tại bằng dữ liệu trong bản sao lưu (nguồn dữ liệu đang chọn không đổi). Tiếp tục?',
    'data.restoreOk': 'Đã khôi phục xong từ bản sao lưu.',
    'data.restoreReadFail': 'Không đọc được tệp bản sao lưu.',
    'data.excelNote':
      'Bảng tải về mở thẳng được bằng Excel. Mọi ghi chú và thời gian học nằm ngay trên máy này — sao lưu thường xuyên để không mất dữ liệu nhé.',
    // Lỗi đọc tệp sao lưu — trả về từ parseBackup (features/system/exportData.ts) dạng
    // key + biến, UI tra qua t() (tên tệp tải về KHÔNG dịch).
    'data.backup.notBackup': 'Tệp này không đọc được — chưa phải bản sao lưu của Sổ.',
    'data.backup.missingField': 'Bản sao lưu thiếu hoặc sai mục "{where}" — không khôi phục được.',
    'data.backup.where.content': 'nội dung',

    // ===== Cài Sổ vào máy (PWA) =====
    'pwa.label': 'cài sổ vào máy',
    'pwa.install': 'Cài ngay vào máy',
    'pwa.footer': 'Cài xong, Sổ mở như một ứng dụng riêng — học ở đâu cũng vào nhanh.',
    // Chuỗi cũ của features/system/pwaInstall.ts (INSTALL_STEPS, OTHER_DEVICE_HINTS)
    // → key theo nền, UI tra qua t() (SettingsPage chỉ đổi đúng chỗ import các hằng đó).
    'pwa.step.ios.1': 'Mở Sổ bằng trình duyệt Safari',
    'pwa.step.ios.2': 'Bấm nút Chia sẻ (hình ô vuông có mũi tên hướng lên)',
    'pwa.step.ios.3': 'Cuộn xuống chọn "Thêm vào Màn hình chính" rồi bấm "Thêm"',
    'pwa.step.android.1': 'Mở Sổ bằng Chrome',
    'pwa.step.android.2': 'Bấm biểu tượng ba chấm ở góc phải màn hình',
    'pwa.step.android.3': 'Chọn "Thêm vào Màn hình chính" (hoặc "Cài đặt ứng dụng") rồi bấm "Cài đặt"',
    'pwa.step.desktop.1': 'Mở Sổ trên Chrome hoặc Edge',
    'pwa.step.desktop.2': 'Nhìn đầu thanh địa chỉ (bên phải) — bấm biểu tượng cài đặt',
    'pwa.step.desktop.3': 'Chọn "Cài đặt" — Sổ sẽ mở thành cửa sổ riêng như một ứng dụng',
    'pwa.otherDevice.ios':
      'Trên máy tính hoặc Android: mở Sổ bằng Chrome/Edge rồi chọn "Cài đặt" tại thanh địa chỉ hoặc menu ba chấm.',
    'pwa.otherDevice.android':
      'Trên iPhone: Safari → Chia sẻ → "Thêm vào Màn hình chính". Trên máy tính: biểu tượng cài đặt ở thanh địa chỉ.',
    'pwa.otherDevice.desktop':
      'Trên iPhone: Safari → Chia sẻ → "Thêm vào Màn hình chính". Trên Android: Chrome → menu ba chấm → "Thêm vào Màn hình chính".',
  },
  en: {
    'page.label': 'settings',
    'page.title': 'Settings',
    'page.loading': 'opening your journal…',
    'page.noSettings':
      'Couldn’t read your settings from the current data source. The PC server may be off — start it on your computer, or switch to “On this device” for now.',

    // ===== Data source (F21) =====
    'ds.label': 'data source',
    'ds.groupAria': 'Choose a data source',
    'ds.local': 'On this device',
    'ds.server': 'Via the PC server',
    'ds.localHint': 'Your journal lives on this device — studying offline works just fine, no internet needed.',
    'ds.serverUrlLabel': 'PC server address',
    'ds.serverUrlHint':
      'Run “npm run server” on your computer — the journal will read and write through that server. On your phone, use the LAN address shown when the server starts (e.g. http://192.168.1.10:5178).',
    'ds.switchWarning':
      'When you switch sources, the journal reads and writes to the place you picked — data in the two places never mixes on its own.',
    'ds.applying': 'Applying…',
    'ds.apply': 'Apply and reload the journal',

    // ===== Language (design-system.md section 12) =====
    'lang.label': 'language',
    'lang.groupAria': 'Choose a language',
    'lang.vi': 'Tiếng Việt',
    'lang.en': 'English',
    'lang.desc': 'Switch the whole journal — applies instantly.',

    // ===== Phone connection =====
    'pc.label': 'phone connection',
    'pc.intro': 'Open the journal on your phone by scanning the QR code.',
    'pc.showQr': 'Show QR code',
    'pc.loading': 'Getting the address…',
    'pc.retry': 'Try again',
    'pc.qrAlt': 'QR code that opens the journal on your computer',
    'pc.urlsHint': 'Open one of these addresses on your phone:',
    'pc.sameDataNote':
      'Your phone sees the same data as your computer when the PC server is running (qqlearn.cmd) and the data source is set to “Via the PC server”.',
    'pc.lanFetchError': 'Couldn’t get the address — make sure qqlearn.cmd is running on the PC.',
    'pc.step.1': 'Connect your phone to the same Wi-Fi as your computer.',
    'pc.step.2': 'Open the address shown under the QR code in your phone’s browser.',
    'pc.step.3': 'Open the browser menu and choose “Add to Home Screen” to install the journal.',

    // ===== Daily goal =====
    'goal.label': 'daily goal',
    'goal.field': 'Study each day',
    'goal.unit': 'min',
    'goal.hint': 'Tap − / + to move 5 minutes at a time, or tap the number to type any amount.',

    // ===== Study rhythm with the timer (pomodoro) =====
    'pom.label': 'study rhythm with the timer',
    'pom.focus': 'One focus session',
    'pom.break': 'Break between sessions',

    // ===== Stepper / time picking — shared by the fields on this page =====
    'stepper.stepDownAria': 'Decrease {label} by {step} {unit}',
    'stepper.stepUpAria': 'Increase {label} by {step} {unit}',
    'stepper.inputAria': '{label} — type a number',
    'stepper.presetsHint': 'just suggestions — type any number above',
    'time.backAria': 'Move {label} back 15 minutes',
    'time.forwardAria': 'Move {label} forward 15 minutes',
    'time.inputAria': '{label} — pick a time',

    // ===== Reminders (C12) =====
    'remind.label': 'reminders',
    'remind.notifTitle': 'System notifications',
    'remind.allow': 'Allow reminders',
    'remind.perm.granted': 'Allowed — the journal will remind you through system notifications.',
    'remind.perm.default': 'Reminders aren’t allowed yet.',
    'remind.perm.denied': 'Notifications are blocked — turn them back on in your browser’s notification settings.',
    'remind.perm.unsupported': 'This browser doesn’t support system notifications yet — the journal will remind you inside the app.',
    'remind.permFallback': 'While reminders aren’t allowed, they still show up inside the journal while it’s open.',
    'remind.start': 'Remind me to start studying',
    'remind.note': 'End-of-day note reminder',
    'remind.hint': 'Tap − / + to adjust 15 minutes at a time. Reminders run while the journal is open on this device.',
    'remind.job.study.title': 'Time to study!',
    'remind.job.study.body': 'Open your journal and start a small study session.',
    'remind.job.note.title': 'Capture today in a note',
    'remind.job.note.body': 'What did you just study? Jot down a few lines before bed.',

    // ===== Ask study time on opening (check-in) =====
    'checkin.label': 'ask study time on opening',
    'checkin.desc': 'Each time you open the app, it asks how long you just studied and saves it to your journal.',
    'checkin.aria': 'Ask study time when opening the app',
    'checkin.hint': 'Skipping or saving are both fine — the app won’t ask again for 15 minutes.',

    // ===== Study assistant (RAG) =====
    'rag.label': 'study assistant',
    'rag.addrLabel': 'Assistant address',
    'rag.hint': 'The Chat page talks with your assistant at this address — leave it empty if you’re not using it yet.',

    // ===== Your data (E18) =====
    'data.label': 'your data',
    'data.backup': 'Back up everything to this device',
    'data.restore': 'Restore from a backup',
    'data.exportHint': 'Download parts of your data as separate files:',
    'data.notesExport': 'journal notes (text)',
    'data.csvButton': '{label} (sheet)',
    'data.csv.sessions': 'study sessions',
    'data.csv.vocab': 'vocabulary',
    'data.csv.mistakes': 'mistakes',
    'data.csv.scores': 'scores',
    'data.markdownOk': 'Downloaded your journal notes (text file).',
    'data.csvOk': 'Downloaded the {label} sheet.',
    'data.backupOk': 'Saved a full backup to this device.',
    'data.downloadFail': 'Couldn’t download it — please try again.',
    'data.backupFail': 'Couldn’t create the backup — please try again.',
    'data.readFail': 'Couldn’t read the data in your journal to export.',
    'data.restoreConfirm':
      'Restoring will REPLACE everything you have now with the data in the backup (your current data source stays as is). Continue?',
    'data.restoreOk': 'All restored from the backup.',
    'data.restoreReadFail': 'Couldn’t read the backup file.',
    'data.excelNote':
      'Downloaded sheets open straight in Excel. Every note and study minute stays on this device — back up often so nothing gets lost.',
    'data.backup.notBackup': 'Couldn’t read this file — it isn’t a journal backup.',
    'data.backup.missingField': 'The backup is missing or has a problem at “{where}” — it can’t be restored.',
    'data.backup.where.content': 'contents',

    // ===== Install the journal (PWA) =====
    'pwa.label': 'install the journal',
    'pwa.install': 'Install it now',
    'pwa.footer': 'Once installed, the journal opens like its own app — your studies are always one tap away.',
    'pwa.step.ios.1': 'Open the journal in the Safari browser',
    'pwa.step.ios.2': 'Tap the Share button (the square with an arrow pointing up)',
    'pwa.step.ios.3': 'Scroll down, choose “Add to Home Screen” and tap “Add”',
    'pwa.step.android.1': 'Open the journal in Chrome',
    'pwa.step.android.2': 'Tap the three-dot icon on the right of the screen',
    'pwa.step.android.3': 'Choose “Add to Home screen” (or “Install app”) and confirm the installation',
    'pwa.step.desktop.1': 'Open the journal in Chrome or Edge',
    'pwa.step.desktop.2': 'Look at the far end of the address bar (on the right) — tap the install icon',
    'pwa.step.desktop.3': 'Choose “Install” — the journal opens in its own window like a separate app',
    'pwa.otherDevice.ios':
      'On a computer or Android: open the journal in Chrome/Edge and choose “Install” in the address bar or the three-dot menu.',
    'pwa.otherDevice.android':
      'On iPhone: Safari → Share → “Add to Home Screen”. On a computer: the install icon in the address bar.',
    'pwa.otherDevice.desktop':
      'On iPhone: Safari → Share → “Add to Home Screen”. On Android: Chrome → three-dot menu → “Add to Home screen”.',
  },
}
