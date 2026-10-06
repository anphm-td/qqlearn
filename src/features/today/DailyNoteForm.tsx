import { useEffect, useRef, useState } from 'react'

import HanddrawnCheck from '@/components/ui/HanddrawnCheck'
import Icon from '@/components/ui/Icon'
import SubjectChip from '@/components/ui/SubjectChip'
import { DangerButton, PrimaryButton, SecondaryButton } from '@/components/ui/buttons'
import { cn } from '@/components/ui/cn'
import { buildDailyDraft } from '@/features/smart/dailyDraft'
import { summarizeDay } from '@/features/today/todayLogic'
import { clampInt } from '@/features/today/todayLogic'
import { repos, todayISO } from '@data'
import { useSubjects } from '@data/useSubjects'
import { useT } from '@data/useT'
import { dailyNoteSchema } from '@core/schemas'
import type { DailyNote, Session } from '@core/types'

/*
 * Form "Hôm nay học được gì?" — ghi chú cuối ngày (A3), lưu bảng dailyNotes.
 * Dùng ở Home (cột phải) — điểm ghép chéo: nút "Soạn nháp" gọi buildDailyDraft()
 * từ src/features/smart/dailyDraft.ts (team smart sở hữu, chỉ gọi giữ nguyên chữ ký).
 * i18n: mọi chuỗi hiển thị qua useT('today'); lỗi giữ KEY dict và dịch lúc render
 * (đổi ngôn ngữ là dòng lỗi đổi theo). Nháp từ buildDailyDraft() do team smart dịch.
 */

const inputCls =
  'w-full rounded-[8px] border border-rule bg-card px-3 py-2 type-body text-ink outline-none transition-colors focus:border-teal placeholder:text-muted'

interface DailyNoteFormProps {
  /** 'YYYY-MM-DD' local — todayISO(). */
  date: string
  /** Buổi học hôm nay (để prefill môn đã học + số phút cho soạn nháp). */
  todaySessions: Session[]
  className?: string
}

export default function DailyNoteForm({ date, todaySessions, className }: DailyNoteFormProps) {
  const { t } = useT('today')
  const { subjects } = useSubjects()
  const activeSubjects = (subjects ?? []).filter((s) => !s.archived)
  const subjectById = (id: number) => (subjects ?? []).find((s) => s.id === id)
  const [existing, setExisting] = useState<DailyNote | undefined>()
  const [subjectIds, setSubjectIds] = useState<number[]>([])
  const [newWordsText, setNewWordsText] = useState('0')
  const [mistakesSummary, setMistakesSummary] = useState('')
  const [reflection, setReflection] = useState('')
  const [autoDrafted, setAutoDrafted] = useState(false)
  const [mistakeCount, setMistakeCount] = useState<number | null>(null)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [drafting, setDrafting] = useState(false)
  /** KEY dict 'today' của lỗi đang hiện ('' = không có lỗi) — dịch lúc render. */
  const [errorKey, setErrorKey] = useState('')

  // Prefill MỘT LẦN mỗi lần gắn form (tránh ghi đè chữ người dùng khi Home tải lại danh sách).
  const prefilledRef = useRef(false)
  const sessionsRef = useRef(todaySessions)
  sessionsRef.current = todaySessions

  useEffect(() => {
    let alive = true
    prefilledRef.current = false
    void (async () => {
      try {
        const note = await repos.notes.get(date)
        const [vocabList, mistakeList] = await Promise.all([repos.vocab.list(), repos.mistakes.list()])
        if (!alive || prefilledRef.current) return
        const createdToday = (ts: number) => todayISO(new Date(ts)) === date
        setExisting(note)
        setSubjectIds(note ? note.partStudied : summarizeDay(sessionsRef.current).subjectsStudied)
        setNewWordsText(String(note ? note.newWords : vocabList.filter((v) => createdToday(v.createdAt)).length))
        setMistakesSummary(note ? note.mistakesSummary : '')
        setReflection(note ? note.reflection : '')
        setAutoDrafted(note ? note.autoDrafted : false)
        setMistakeCount(mistakeList.filter((m) => createdToday(m.createdAt)).length)
        prefilledRef.current = true
      } catch {
        if (alive) setErrorKey('note.loadError')
      }
    })()
    return () => {
      alive = false
    }
  }, [date])

  const toggleSubject = (id: number) => {
    setSubjectIds((cur) => (cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id].sort((a, b) => a - b)))
  }

  const buildInput = (photoIds: number[]) => ({
    date,
    partStudied: subjectIds,
    newWords: clampInt(newWordsText, 0, 100_000, 0),
    mistakesSummary: mistakesSummary.trim(),
    reflection: reflection.trim(),
    photoIds,
    autoDrafted,
    updatedAt: existing?.updatedAt ?? Date.now(),
  })

  const handleSave = async () => {
    // photoIds KHÔNG do form quản (khối đính ảnh gắn/gỡ ngoài form): đọc lại ghi
    // chú hiện hành trong sổ lúc lưu — nếu dùng bản chốt ở mount, ảnh vừa đính
    // sau đó sẽ bị ghi đè mất khỏi ghi chú (thành ảnh mồ côi).
    let currentPhotoIds: number[] = []
    try {
      currentPhotoIds = (await repos.notes.get(date))?.photoIds ?? []
    } catch {
      // Không đọc lại được thì giữ danh sách lúc mount — vẫn tốt hơn ghi rỗng.
      currentPhotoIds = existing?.photoIds ?? []
    }
    const parsed = dailyNoteSchema.safeParse(buildInput(currentPhotoIds))
    if (!parsed.success) {
      setErrorKey('note.invalidError')
      return
    }
    setStatus('saving')
    setErrorKey('')
    try {
      const saved = await repos.notes.upsert(parsed.data)
      setExisting(saved)
      setStatus('saved')
    } catch {
      setStatus('idle')
      setErrorKey('note.saveError')
    }
  }

  const handleDraft = async () => {
    setDrafting(true)
    setErrorKey('')
    try {
      const draft = await buildDailyDraft({
        date,
        subjectIds,
        minutesStudied: summarizeDay(sessionsRef.current).totalMinutes,
        newWords: clampInt(newWordsText, 0, 100_000, 0),
        mistakesSummary: mistakesSummary.trim(),
      })
      setReflection((cur) => (cur.trim() === '' ? draft.text : `${cur}\n\n${draft.text}`))
      setAutoDrafted(draft.autoDrafted)
      setStatus('idle')
    } catch {
      setErrorKey('note.draftError')
    } finally {
      setDrafting(false)
    }
  }

  const busy = status === 'saving' || drafting

  return (
    <section className={cn('paper-card px-4 pt-4 pb-4', className)} aria-label={t('note.sectionAria')}>
      <span
        className="washi"
        style={{ background: subjectById(subjectIds[0] ?? 0)?.colorHex ?? 'var(--rule)' }}
        aria-hidden="true"
      />

      <div className="flex items-center justify-between gap-2">
        <p className="section-label">{t('note.label')}</p>
        {existing && <span className="type-caption text-muted">{t('note.hasNote')}</span>}
      </div>
      <h2 className="type-h2 mt-1">{t('note.title')}</h2>

      <div className="mt-3 flex flex-col gap-3">
        <div>
          <p className="type-caption mb-1 text-muted">{t('note.subjectsLabel')}</p>
          <div className="flex flex-wrap gap-1.5">
            {activeSubjects.map((s) => (
              <SubjectChip
                key={s.id}
                name={s.name}
                colorHex={s.colorHex}
                active={subjectIds.includes(s.id!)}
                onClick={() => toggleSubject(s.id!)}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="daily-note-new-words" className="type-caption mb-1 block text-muted">
              {t('note.newWordsLabel')}
            </label>
            <input
              id="daily-note-new-words"
              className={cn(inputCls, 'num')}
              inputMode="numeric"
              autoComplete="off"
              value={newWordsText}
              onChange={(e) => setNewWordsText(e.target.value.replace(/\D/g, '').slice(0, 5))}
            />
          </div>
          <div>
            <label htmlFor="daily-note-mistakes" className="type-caption mb-1 block text-muted">
              {t('note.mistakesLabel')}
            </label>
            <input
              id="daily-note-mistakes"
              className={inputCls}
              placeholder={t('note.mistakesPlaceholder')}
              value={mistakesSummary}
              onChange={(e) => setMistakesSummary(e.target.value)}
            />
            {mistakeCount !== null && mistakeCount > 0 && (
              <p className="num type-caption mt-1 text-muted">{t('note.mistakesToday', { count: mistakeCount })}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="daily-note-reflection" className="type-caption mb-1 block text-muted">
            {t('note.reflectionLabel')}
          </label>
          <textarea
            id="daily-note-reflection"
            className={cn(inputCls, 'min-h-[96px] resize-y')}
            placeholder={t('note.reflectionPlaceholder')}
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
          />
          {autoDrafted && (
            <p className="type-caption mt-1 flex items-center gap-1 text-teal">
              <Icon name="pen" size={12} /> {t('note.draftedHint')}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SecondaryButton onClick={() => void handleDraft()} disabled={busy}>
            <Icon name="pen" size={16} />
            {drafting ? t('note.drafting') : t('note.draftButton')}
          </SecondaryButton>
          <PrimaryButton onClick={() => void handleSave()} disabled={busy}>
            <Icon name="book" size={16} />
            {status === 'saving' ? t('note.saving') : t('note.saveButton')}
          </PrimaryButton>
          {status === 'saved' && (
            <span className="type-caption inline-flex items-center gap-1 text-teal">
              <HanddrawnCheck size={14} /> {t('note.saved')}
            </span>
          )}
        </div>

        {errorKey && (
          <p className="type-caption flex items-center justify-between gap-2 text-coral" role="alert">
            {t(errorKey)}
            <DangerButton className="px-2 py-1 text-[12px]" onClick={() => setErrorKey('')}>
              {t('note.dismissError')}
            </DangerButton>
          </p>
        )}
      </div>
    </section>
  )
}
