import type { NamespaceDict } from '../index'

/*
 * Từ điển namespace "subjects" — nhóm màn hình "Môn học" (src/features/subjects/):
 * SubjectsPage.tsx (CRUD môn) + subjectView.ts (nhãn dự phòng 'chưa phân môn'/
 * 'môn đã xoá'). Lỗi từ repo (dexieSubjectRepo) trả về Error có `code`
 * ('duplicate_subject' / 'subject_in_use') — UI map code → key dưới đây, giữ
 * nguyên hành vi chặn xoá/tên trùng.
 *  - Key vi và en PHẢI đối xứng 1-1 (test key-parity trong src/core/i18n/i18n.test.ts
 *    chặn mọi lệch — chạy `npm test` sau khi sửa dict).
 *  - key dạng chấm phân nhóm; biến nội suy dạng {ten}.
 *  - 'vi' là nguồn chuẩn; 'en' tự nhiên, thân thiện theo design-system.md mục 8/12
 *    (không tech-speak, giữ nguyên "qqlearn", số liệu, tên môn user tự đặt).
 *  - Dùng qua hook: const { t } = useT('subjects') — xem src/data/useT.ts.
 */
export const dict: NamespaceDict = {
  vi: {
    'page.label': 'sổ tay · môn học',
    'page.title': 'Môn học',
    'page.add': 'Thêm môn mới',
    'page.intro':
      'Chia sổ theo từng môn bạn đang học — mỗi môn một màu riêng. Buổi học, từ vựng, lỗi sai và điểm đều gắn được vào môn.',
    'page.loadError':
      'Chưa mở được danh sách môn — có thể server PC chưa chạy hoặc máy chưa đọc được sổ cục bộ.',
    'page.reload': 'Tải lại',

    // ===== Danh sách môn =====
    'section.active': 'Các môn đang học',
    'section.archived': 'Môn đã lưu trữ',
    'label.archived': 'đã lưu trữ',
    'empty.active': 'Chưa có môn nào — thêm môn đầu tiên để bắt đầu chia sổ nhé.',

    // ===== 1 hàng môn =====
    'row.edit': 'Sửa',
    'row.archive': 'Lưu trữ',
    'row.unarchive': 'Bỏ lưu trữ',
    'row.remove': 'Xoá',
    'row.confirmRemove': 'Chắc chắn xoá?',
    'row.goalOwn': 'mục tiêu riêng: {minutes} phút/ngày',
    'row.goalShared': 'dùng mục tiêu chung',
    'row.writeFail': 'Không ghi được — thử lại nhé.',
    'row.removeFail': 'Không xoá được môn — thử lại nhé.',

    // ===== Form tạo/sửa môn =====
    'form.editAria': 'Sửa môn',
    'form.newAria': 'Thêm môn mới',
    'form.label.edit': 'sửa môn',
    'form.label.new': 'môn mới',
    'form.name': 'Tên môn',
    'form.namePlaceholder': 'vd. Toán, Tiếng Nhật, Lập trình…',
    'form.color': 'Màu môn',
    'form.colorGroupAria': 'Chọn màu môn',
    'form.colorAria': 'Màu {color}',
    'form.goalLabel': 'mục tiêu riêng mỗi ngày (tuỳ chọn — 0 = dùng mục tiêu chung)',
    'form.durationLabel': 'thời gian tự chỉnh',
    'form.save': 'Lưu thay đổi',
    'form.add': 'Thêm môn',
    'form.saving': 'Đang lưu…',
    'form.cancel': 'Bỏ qua',
    'form.saved': 'đã lưu',
    'form.invalid': 'Dữ liệu chưa hợp lệ.',
    'form.saveFail': 'Không lưu được môn — thử lại nhé.',

    // ===== Lỗi từ repo (map theo error.code) =====
    'error.duplicate': 'Đã có môn "{name}" — chọn tên khác nhé.',
    'error.inUse':
      'Môn này còn dữ liệu (buổi học, từ vựng, lỗi sai, điểm hoặc ghi chú cuối ngày) — chỉ lưu trữ được, không xoá.',

    // ===== Nhãn dự phòng subjectView =====
    'name.unassigned': 'chưa phân môn',
    'name.deleted': 'môn đã xoá',
  },
  en: {
    'page.label': 'journal · subjects',
    'page.title': 'Subjects',
    'page.add': 'Add a subject',
    'page.intro':
      'Split your journal by the subjects you’re studying — each one gets its own color. Study sessions, vocabulary, mistakes and scores can all belong to a subject.',
    'page.loadError':
      'Couldn’t load the subject list — the PC server may be off, or the local journal isn’t readable on this device.',
    'page.reload': 'Reload',

    // ===== Subject list =====
    'section.active': 'Subjects you’re studying',
    'section.archived': 'Archived subjects',
    'label.archived': 'archived',
    'empty.active': 'No subjects yet — add your first one to start splitting the journal.',

    // ===== One subject row =====
    'row.edit': 'Edit',
    'row.archive': 'Archive',
    'row.unarchive': 'Unarchive',
    'row.remove': 'Delete',
    'row.confirmRemove': 'Delete for sure?',
    'row.goalOwn': 'own goal: {minutes} min/day',
    'row.goalShared': 'uses the shared goal',
    'row.writeFail': 'Couldn’t save that — please try again.',
    'row.removeFail': 'Couldn’t delete the subject — please try again.',

    // ===== Create/edit form =====
    'form.editAria': 'Edit subject',
    'form.newAria': 'Add a subject',
    'form.label.edit': 'edit subject',
    'form.label.new': 'new subject',
    'form.name': 'Subject name',
    'form.namePlaceholder': 'e.g. Math, Japanese, Programming…',
    'form.color': 'Subject color',
    'form.colorGroupAria': 'Pick a subject color',
    'form.colorAria': 'Color {color}',
    'form.goalLabel': 'own daily goal (optional — 0 = use the shared goal)',
    'form.durationLabel': 'custom duration',
    'form.save': 'Save changes',
    'form.add': 'Add subject',
    'form.saving': 'Saving…',
    'form.cancel': 'Cancel',
    'form.saved': 'saved',
    'form.invalid': 'That data isn’t valid.',
    'form.saveFail': 'Couldn’t save the subject — please try again.',

    // ===== Repo errors (mapped by error.code) =====
    'error.duplicate': 'There’s already a subject “{name}” — please pick another name.',
    'error.inUse':
      'This subject still has data (study sessions, vocabulary, mistakes, scores or end-of-day notes) — you can archive it, but not delete it.',

    // ===== subjectView fallback labels =====
    'name.unassigned': 'unassigned',
    'name.deleted': 'deleted subject',
  },
}
