import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { DangerButton, PrimaryButton } from '@/components/ui/buttons'
import EmptyState from '@/components/ui/EmptyState'
import HanddrawnCheck from '@/components/ui/HanddrawnCheck'
import PartChip from '@/components/ui/PartChip'
import { repos, todayISO } from '@data/index'
import type { SrsCard, Vocab } from '@core/types'

import { daysUntil, nextBox, sortByDue } from './srs'

/**
 * /sotay/tu-vung/on-tap — Ôn tập từ vựng giãn cách SRS Leitner (B5).
 * Thẻ đến hạn hôm nay (repos.srs.listDue(todayISO())) → lật đáp án →
 * "Nhớ đúng" tăng hộp / "Chưa nhớ" về hộp 1; ghi lại bằng repos.srs.review().
 * Luật hộp + hạn ôn tách file thuần srs.ts (có test riêng).
 */
type Phase = 'loading' | 'front' | 'back' | 'feedback' | 'empty' | 'done' | 'error'

export default function VocabReviewPage() {
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
      setAnswerError('Chưa ghi được kết quả ôn — thử lại nhé.')
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
      <p className="section-label">sổ tay · ôn tập</p>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="type-display">Ôn tập từ vựng</h1>
        {(phase === 'front' || phase === 'back' || phase === 'feedback') && (
          <p className="type-caption text-muted">
            thẻ <span className="num">{idx + 1}</span>/<span className="num">{queue.length}</span>
          </p>
        )}
      </div>

      {phase === 'loading' && <p className="type-body text-muted">Đang lấy thẻ đến hạn…</p>}

      {phase === 'error' && (
        <EmptyState
          message="Chưa lấy được thẻ đến hạn — có thể server PC chưa chạy hoặc máy chưa đọc được sổ cục bộ."
          action={
            <PrimaryButton onClick={() => void load()}>Tải lại</PrimaryButton>
          }
        />
      )}

      {phase === 'empty' && (
        <EmptyState
          message="Không có thẻ nào đến hạn ôn hôm nay. Thêm từ mới vào sổ, hoặc quay lại vào ngày mai nhé."
          action={
            <Link to="/sotay/tu-vung" className="btn btn-primary type-body">
              Về sổ từ vựng
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
            word={vocab?.word ?? '(từ đã xoá khỏi sổ)'}
            meaning={vocab?.meaning ?? ''}
            example={vocab?.example ?? ''}
            part={vocab?.part ?? 0}
            sourceTest={vocab?.sourceTest ?? ''}
            box={card.box}
            revealed={phase === 'back'}
            onReveal={() => setPhase('back')}
            onAnswer={(correct) => void answer(correct)}
          />
        </>
      )}

      {phase === 'feedback' && card && (
        <section className="paper-card flex flex-col items-center gap-3 px-4 py-6 text-center" aria-label="Kết quả thẻ">
          {lastCorrect ? (
            <>
              <HanddrawnCheck size={44} />
              <p className="type-h2">Chính xác!</p>
              <p className="type-body text-muted">
                Thẻ lên hộp <span className="num">{nextBox(card.box, true)}</span>/5
                {lastDays != null && (
                  <>
                    {' '}· ôn lại sau <span className="num">{lastDays}</span> ngày
                  </>
                )}
              </p>
            </>
          ) : (
            <>
              <p className="type-h2">Chưa nhớ — không sao.</p>
              <p className="type-body text-muted">
                Thẻ về hộp <span className="num">1</span>, mai ôn lại tiếp nhé.
              </p>
            </>
          )}
          <PrimaryButton onClick={nextCard}>Thẻ tiếp theo</PrimaryButton>
        </section>
      )}

      {phase === 'done' && (
        <section className="paper-card flex flex-col items-center gap-2 px-4 py-6 text-center" aria-label="Tổng kết ôn tập">
          <p className="type-h2">Xong rồi!</p>
          <p className="type-body">
            <span className="num">{stats.correct}</span> đúng ·{' '}
            <span className="num">{stats.wrong}</span> chưa nhớ
          </p>
          <p className="type-caption text-muted">
            Quay lại vào ngày mai để ôn tiếp theo lịch giãn cách.
          </p>
          <Link to="/sotay/tu-vung" className="btn btn-primary type-body mt-2">
            Về sổ từ vựng
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
  part: number
  sourceTest: string
  box: number
  revealed: boolean
  onReveal: () => void
  onAnswer: (correct: boolean) => void
}

function Flashcard({ word, meaning, example, part, sourceTest, box, revealed, onReveal, onAnswer }: FlashcardProps) {
  return (
    <section className="paper-card flex flex-col gap-3 px-4 py-6" aria-label="Thẻ ôn tập">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="type-caption text-muted">
          hộp <span className="num">{box}</span>/<span className="num">5</span>
        </p>
        {part > 0 && <PartChip part={part} />}
      </div>

      <p className="type-display break-words">{word}</p>
      {sourceTest && <p className="type-caption text-muted">Nguồn: {sourceTest}</p>}

      {revealed ? (
        <>
          <hr className="dashed-rule" />
          <p className="type-h2">{meaning || <span className="text-muted">Chưa ghi nghĩa.</span>}</p>
          {example && <p className="type-body text-muted">“{example}”</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <PrimaryButton onClick={() => onAnswer(true)}>Nhớ đúng</PrimaryButton>
            <DangerButton onClick={() => onAnswer(false)}>Chưa nhớ</DangerButton>
          </div>
        </>
      ) : (
        <div className="mt-2">
          <PrimaryButton onClick={onReveal}>Lật đáp án</PrimaryButton>
        </div>
      )}
    </section>
  )
}
