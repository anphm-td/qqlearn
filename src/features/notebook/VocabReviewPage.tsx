import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { DangerButton, PrimaryButton } from '@/components/ui/buttons'
import EmptyState from '@/components/ui/EmptyState'
import HanddrawnCheck from '@/components/ui/HanddrawnCheck'
import SubjectChip from '@/components/ui/SubjectChip'
import { repos, todayISO } from '@data/index'
import { useSubjects } from '@data/useSubjects'
import { useT } from '@data/useT'
import type { SrsCard, Vocab } from '@core/types'

import { daysUntil, nextBox, sortByDue } from './srs'

/**
 * /sotay/tu-vung/on-tap — Ôn tập từ vựng giãn cách SRS Leitner (B5).
 * Thẻ đến hạn hôm nay (repos.srs.listDue(todayISO())) → lật đáp án →
 * "Nhớ đúng" tăng hộp / "Chưa nhớ" về hộp 1; ghi lại bằng repos.srs.review().
 * Luật hộp + hạn ôn tách file thuần srs.ts (có test riêng).
 * i18n: mọi chuỗi hiển thị qua useT('notebook') — dict ở src/core/i18n/dict/notebook.ts.
 */
type Phase = 'loading' | 'front' | 'back' | 'feedback' | 'empty' | 'done' | 'error'

export default function VocabReviewPage() {
  const { t } = useT('notebook')
  const { subjects } = useSubjects()
  const subjectById = (id: number) => (subjects ?? []).find((s) => s.id === id)
  const [phase, setPhase] = useState<Phase>('loading')
  const [queue, setQueue] = useState<SrsCard[]>([])
  const [vocabMap, setVocabMap] = useState<Map<number, Vocab>>(new Map())
  const [idx, setIdx] = useState(0)
  const [stats, setStats] = useState({ correct: 0, wrong: 0 })
  const [lastCorrect, setLastCorrect] = useState(false)
  const [lastDays, setLastDays] = useState<number | null>(null)
  const [answerError, setAnswerError] = useState('')

  const load = useCallback(async () => {
    try {
      const today = todayISO()
      const vocabs = await repos.vocab.list()
      const vocabIds = new Set(vocabs.map((v) => v.id).filter((id): id is number => id != null))

      // Đồng bộ thẻ: từ cũ chưa có thẻ (trước khi có luồng tự tạo) → tạo hộp 1
      const all = await repos.srs.listAll()
      const have = new Set(all.map((c) => c.vocabId))
      for (const id of vocabIds) {
        if (!have.has(id)) await repos.srs.createForVocab(id, today)
      }

      setVocabMap(new Map(vocabs.filter((v) => v.id != null).map((v) => [v.id as number, v])))
      // listDue đã lọc sẵn thẻ mồ côi (từ đã xoá) — không phải lọc lại ở đây.
      const due = sortByDue(await repos.srs.listDue(today))
      setQueue(due)
      setIdx(0)
      setStats({ correct: 0, wrong: 0 })
      setPhase(due.length === 0 ? 'empty' : 'front')
    } catch {
      // Server PC không trạm được / IndexedDB lỗi — hiện lỗi + nút thử lại,
      // không kẹt "Đang lấy thẻ đến hạn…" vĩnh viễn.
      setPhase('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const card = queue[idx]
  const vocab = card ? vocabMap.get(card.vocabId) : undefined

  const answer = async (correct: boolean) => {
    if (!card?.id) return
    setAnswerError('')
    try {
      const updated = await repos.srs.review(card.id, correct, todayISO())
      setLastCorrect(correct)
      setLastDays(updated ? daysUntil(todayISO(), updated.dueDate) : null)
      setStats((s) => (correct ? { ...s, correct: s.correct + 1 } : { ...s, wrong: s.wrong + 1 }))
      setPhase('feedback')
    } catch {
      // Ghi kết quả không thành công — giữ nguyên thẻ để người học trả lời lại.
      setAnswerError(t('review.saveError'))
    }
  }

  const nextCard = () => {
    if (idx + 1 >= queue.length) {
      setPhase('done')
      return
    }
    setIdx(idx + 1)
    setPhase('front')
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="section-label">{t('section.review')}</p>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="type-display">{t('review.title')}</h1>
        {(phase === 'front' || phase === 'back' || phase === 'feedback') && (
          <p className="type-caption text-muted">{t('review.counter', { current: idx + 1, total: queue.length })}</p>
        )}
      </div>

      {phase === 'loading' && <p className="type-body text-muted">{t('review.loading')}</p>}

      {phase === 'error' && (
        <EmptyState
          message={t('review.loadError')}
          action={
            <PrimaryButton onClick={() => void load()}>{t('common.reload')}</PrimaryButton>
          }
        />
      )}

      {phase === 'empty' && (
        <EmptyState
          message={t('review.empty')}
          action={
            <Link to="/sotay/tu-vung" className="btn btn-primary type-body">
              {t('review.backToVocab')}
            </Link>
          }
        />
      )}

      {(phase === 'front' || phase === 'back') && card && (
        <>
          {answerError && (
            <p className="type-caption rounded-lg border border-coral bg-pink-soft px-3 py-2" role="alert">
              {answerError}
            </p>
          )}
          <Flashcard
            word={vocab?.word ?? t('review.deletedWord')}
            meaning={vocab?.meaning ?? ''}
            example={vocab?.example ?? ''}
            subjectName={vocab && vocab.subjectId > 0 ? subjectById(vocab.subjectId)?.name ?? t('common.deletedSubject') : undefined}
            subjectColor={vocab ? subjectById(vocab.subjectId)?.colorHex : undefined}
            sourceTest={vocab?.sourceTest ?? ''}
            box={card.box}
            revealed={phase === 'back'}
            onReveal={() => setPhase('back')}
            onAnswer={(correct) => void answer(correct)}
          />
        </>
      )}

      {phase === 'feedback' && card && (
        <section className="paper-card flex flex-col items-center gap-3 px-4 py-6 text-center" aria-label={t('review.feedbackAria')}>
          {lastCorrect ? (
            <>
              <HanddrawnCheck size={44} />
              <p className="type-h2">{t('review.correct.title')}</p>
              <p className="type-body text-muted">
                {t('review.correct.moved', { box: nextBox(card.box, true) })}
                {lastDays != null && (
                  <>
                    {' · '}
                    {t('review.correct.again', { days: lastDays })}
                  </>
                )}
              </p>
            </>
          ) : (
            <>
              <p className="type-h2">{t('review.wrong.title')}</p>
              <p className="type-body text-muted">{t('review.wrong.body', { box: 1 })}</p>
            </>
          )}
          <PrimaryButton onClick={nextCard}>{t('review.nextCard')}</PrimaryButton>
        </section>
      )}

      {phase === 'done' && (
        <section className="paper-card flex flex-col items-center gap-2 px-4 py-6 text-center" aria-label={t('review.doneAria')}>
          <p className="type-h2">{t('review.done.title')}</p>
          <p className="type-body">{t('review.done.score', { correct: stats.correct, wrong: stats.wrong })}</p>
          <p className="type-caption text-muted">{t('review.done.hint')}</p>
          <Link to="/sotay/tu-vung" className="btn btn-primary type-body mt-2">
            {t('review.backToVocab')}
          </Link>
        </section>
      )}
    </div>
  )
}

// ===== Flashcard: mặt trước (từ) → lật → mặt sau (nghĩa, ví dụ) → trả đúng/sai =====

interface FlashcardProps {
  word: string
  meaning: string
  example: string
  subjectName?: string
  subjectColor?: string
  sourceTest: string
  box: number
  revealed: boolean
  onReveal: () => void
  onAnswer: (correct: boolean) => void
}

function Flashcard({ word, meaning, example, subjectName, subjectColor, sourceTest, box, revealed, onReveal, onAnswer }: FlashcardProps) {
  const { t } = useT('notebook')
  return (
    <section className="paper-card flex flex-col gap-3 px-4 py-6" aria-label={t('review.cardAria')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="type-caption text-muted">{t('review.box', { box })}</p>
        {subjectName && <SubjectChip name={subjectName} colorHex={subjectColor} />}
      </div>

      <p className="type-display break-words">{word}</p>
      {sourceTest && <p className="type-caption text-muted">{t('vocab.source', { source: sourceTest })}</p>}

      {revealed ? (
        <>
          <hr className="dashed-rule" />
          <p className="type-h2">{meaning || <span className="text-muted">{t('vocab.noMeaning')}</span>}</p>
          {example && <p className="type-body text-muted">“{example}”</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <PrimaryButton onClick={() => onAnswer(true)}>{t('review.answer.correct')}</PrimaryButton>
            <DangerButton onClick={() => onAnswer(false)}>{t('review.answer.wrong')}</DangerButton>
          </div>
        </>
      ) : (
        <div className="mt-2">
          <PrimaryButton onClick={onReveal}>{t('review.reveal')}</PrimaryButton>
        </div>
      )}
    </section>
  )
}
