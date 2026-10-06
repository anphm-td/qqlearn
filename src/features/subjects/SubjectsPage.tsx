import { useEffect, useMemo, useState } from 'react'

import { DangerButton, PrimaryButton, SecondaryButton } from '@/components/ui/buttons'
import EmptyState from '@/components/ui/EmptyState'
import HanddrawnCheck from '@/components/ui/HanddrawnCheck'
import Icon from '@/components/ui/Icon'
import { cn } from '@/components/ui/cn'
import DurationPicker from '@/features/today/DurationPicker'
import { inputCls, labelCls } from '@/features/notebook/bits'
import { repos } from '@data'
import { useT } from '@data/useT'
import { useSubjects } from '@data/useSubjects'
import { SUBJECT_PALETTE } from '@core/subjects'
import { subjectInputSchema } from '@core/schemas'
import type { Subject } from '@core/types'

/**
 * /mon-hoc — trang Môn học (đa môn hoá): CRUD môn tự định nghĩa.
 *  - Tạo/sửa môn: tên (duy nhất), chọn màu (swatch 6 pastel của SUBJECT_PALETTE —
 *    đúng bảng "Màu môn" mục 5 design-system), mục tiêu phút/ngày riêng TỰ CHỈNH
 *    (stepper ± / ô nhập tự do — mục 3), 0 = không đặt mục tiêu riêng.
 *  - Lưu trữ (archived): ẩn khỏi các trang chọn môn nhưng giữ dữ liệu.
 *  - KHÔNG xoá được môn đã có dữ liệu — chỉ archive (repo chặn bằng Error có
 *    `code`, UI map code → thông điệp dịch — xem subjectErrorText).
 *  - i18n: namespace 'subjects' (src/core/i18n/dict/subjects.ts) — dùng useT.
 * ≥768px: cột giữa hẹp ~600px căn giữa (dạng form đọc tốt khi hẹp — mục 10).
 */

type Translate = ReturnType<typeof useT>['t']

/**
 * Lỗi repo môn học (dexieSubjectRepo) ném Error có `code`:
 *  - 'duplicate_subject' → thông điệp "đã có môn {name}" (biến từ err.subjectName);
 *  - 'subject_in_use'    → thông điệp chặn xoá môn còn dữ liệu;
 *  - lỗi khác (Dexie/server…) → giữ message gốc như trước, không có message → key dự phòng.
 */
function subjectErrorText(err: unknown, t: Translate, fallbackKey: string): string {
  const code = (err as { code?: unknown } | null)?.code
  if (code === 'duplicate_subject') {
    const name = (err as { subjectName?: unknown }).subjectName
    return typeof name === 'string' && name !== '' ? t('error.duplicate', { name }) : t('error.duplicate')
  }
  if (code === 'subject_in_use') return t('error.inUse')
  return err instanceof Error && err.message !== '' ? err.message : t(fallbackKey)
}

export default function SubjectsPage() {
  const { t } = useT('subjects')
  const { subjects, reload, loadError } = useSubjects()
  const [editing, setEditing] = useState<'new' | Subject | null>(null)

  const active = useMemo(() => (subjects ?? []).filter((s) => !s.archived), [subjects])
  const archived = useMemo(() => (subjects ?? []).filter((s) => s.archived), [subjects])

  const saved = async () => {
    setEditing(null)
    await reload()
  }

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-4">
      <p className="section-label">{t('page.label')}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-display">{t('page.title')}</h1>
        {editing === null && (
          <PrimaryButton onClick={() => setEditing('new')}>
            <Icon name="plus" size={18} /> {t('page.add')}
          </PrimaryButton>
        )}
      </div>
      <p className="type-body text-muted">{t('page.intro')}</p>

      {editing !== null && (
        <SubjectForm
          initial={editing === 'new' ? null : editing}
          onSaved={() => void saved()}
          onCancel={() => setEditing(null)}
        />
      )}

      {loadError && (
        <EmptyState
          message={t('page.loadError')}
          action={
            <PrimaryButton onClick={() => void reload()}>
              <Icon name="study" size={16} /> {t('page.reload')}
            </PrimaryButton>
          }
        />
      )}

      {subjects !== null && !loadError && (
        <>
          <section aria-label={t('section.active')} className="flex flex-col gap-2">
            {active.length === 0 ? (
              <EmptyState message={t('empty.active')} />
            ) : (
              active.map((s) => (
                <SubjectRow key={s.id} subject={s} onEdit={() => setEditing(s)} onChanged={() => void reload()} />
              ))
            )}
          </section>

          {archived.length > 0 && (
            <section aria-label={t('section.archived')} className="flex flex-col gap-2">
              <p className="section-label">{t('label.archived')}</p>
              {archived.map((s) => (
                <SubjectRow key={s.id} subject={s} onEdit={() => setEditing(s)} onChanged={() => void reload()} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}

// ===== 1 hàng môn: nhãn màu + mục tiêu + sửa / lưu trữ / xoá =====

function SubjectRow({
  subject,
  onEdit,
  onChanged,
}: {
  subject: Subject
  onEdit: () => void
  onChanged: () => Promise<void> | void
}) {
  const { t } = useT('subjects')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const toggleArchive = async () => {
    if (subject.id == null) return
    setBusy(true)
    setError('')
    try {
      await repos.subjects.update(subject.id, { archived: !subject.archived })
      await onChanged()
    } catch {
      setError(t('row.writeFail'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (subject.id == null) return
    if (!confirming) {
      setConfirming(true)
      return
    }
    setBusy(true)
    setError('')
    try {
      await repos.subjects.remove(subject.id)
      await onChanged()
    } catch (err) {
      setConfirming(false)
      setError(subjectErrorText(err, t, 'row.removeFail'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="paper-card flex flex-col gap-2 px-4 py-3">
      <span className="washi" style={{ background: subject.colorHex }} aria-hidden="true" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-full border border-rule"
            style={{ background: subject.colorHex }}
          />
          <span className="type-h2">{subject.name}</span>
          {subject.archived && <span className="type-caption text-muted">{t('label.archived')}</span>}
        </div>
        <span className="num type-caption text-muted">
          {subject.goalMinutesPerDay > 0
            ? t('row.goalOwn', { minutes: subject.goalMinutesPerDay })
            : t('row.goalShared')}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SecondaryButton className="px-3 py-1.5 text-[13px]" onClick={onEdit}>
          <Icon name="pen" size={14} /> {t('row.edit')}
        </SecondaryButton>
        <SecondaryButton className="px-3 py-1.5 text-[13px]" onClick={() => void toggleArchive()} disabled={busy}>
          {subject.archived ? t('row.unarchive') : t('row.archive')}
        </SecondaryButton>
        <DangerButton className="px-3 py-1.5 text-[13px]" onClick={() => void remove()} disabled={busy}>
          {confirming ? t('row.confirmRemove') : t('row.remove')}
        </DangerButton>
      </div>
      {error && (
        <p className="type-caption rounded-lg border border-coral bg-pink-soft px-3 py-2 text-coral" role="alert">
          {error}
        </p>
      )}
    </article>
  )
}

// ===== Form tạo/sửa môn (validate subjectInputSchema) =====

interface SubjectFormProps {
  initial: Subject | null
  onSaved: () => Promise<void> | void
  onCancel: () => void
}

function SubjectForm({ initial, onSaved, onCancel }: SubjectFormProps) {
  const { t } = useT('subjects')
  const [name, setName] = useState(initial?.name ?? '')
  const [colorHex, setColorHex] = useState(initial?.colorHex ?? SUBJECT_PALETTE[0]!.colorHex)
  const [goal, setGoal] = useState(initial?.goalMinutesPerDay ?? 0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSaved(false)
  }, [name, colorHex, goal])

  const submit = async () => {
    setError('')
    const parsed = subjectInputSchema.safeParse({
      name: name.trim(),
      colorHex,
      goalMinutesPerDay: goal,
      archived: initial?.archived ?? false,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('form.invalid'))
      return
    }
    setSaving(true)
    try {
      if (initial?.id != null) {
        await repos.subjects.update(initial.id, parsed.data)
      } else {
        await repos.subjects.create(parsed.data)
      }
      setSaved(true)
      await onSaved()
    } catch (err) {
      setError(subjectErrorText(err, t, 'form.saveFail'))
    } finally {
      setSaving(false)
    }
  }

  const editing = initial?.id != null

  return (
    <section className="paper-card flex flex-col gap-4 px-4 py-4" aria-label={editing ? t('form.editAria') : t('form.newAria')}>
      <div className="flex items-center justify-between gap-2">
        <p className="section-label">{editing ? t('form.label.edit') : t('form.label.new')}</p>
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelCls} htmlFor="subject-name">
          {t('form.name')}
        </label>
        <input
          id="subject-name"
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('form.namePlaceholder')}
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelCls}>{t('form.color')}</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('form.colorGroupAria')}>
          {SUBJECT_PALETTE.map((c) => (
            <button
              key={c.colorHex}
              type="button"
              aria-label={t('form.colorAria', { color: c.colorHex })}
              aria-pressed={colorHex === c.colorHex}
              onClick={() => setColorHex(c.colorHex)}
              className={cn(
                'h-8 w-8 rounded-full border-2 transition-transform',
                colorHex === c.colorHex ? 'border-ink scale-110' : 'border-rule',
              )}
              style={{ background: c.colorHex }}
            />
          ))}
        </div>
      </div>

      <div>
        <p className={cn(labelCls, 'mb-2')}>{t('form.goalLabel')}</p>
        <DurationPicker
          value={goal}
          onChange={setGoal}
          presets={[15, 25, 45, 60]}
          min={0}
          max={1440}
          step={5}
          label={t('form.durationLabel')}
        />
      </div>

      {error && <p className="type-caption text-coral">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <PrimaryButton onClick={() => void submit()} disabled={saving}>
          {saving ? t('form.saving') : editing ? t('form.save') : t('form.add')}
        </PrimaryButton>
        <SecondaryButton onClick={onCancel}>{t('form.cancel')}</SecondaryButton>
        {saved && (
          <span className="type-caption inline-flex items-center gap-1 text-teal">
            <HanddrawnCheck size={14} /> {t('form.saved')}
          </span>
        )}
      </div>
    </section>
  )
}
