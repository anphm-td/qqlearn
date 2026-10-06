import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import EmptyState from '@/components/ui/EmptyState'
import NoteCard from '@/components/ui/NoteCard'
import { todayISO } from '@core/date'
import { repos } from '@data'
import { useT } from '@data/useT'

import { queryRag } from './ragClient'
import {
  buildSuggestionPrompt,
  pickSuggestion,
  sumMinutesBySubject,
  weekWindowISO,
  type Suggestion,
  type SuggestionInput,
} from './suggestion'

/*
 * [ĐIỂM GHÉP CHÉO — team SMART sở hữu file này]
 * D14 — card "Hôm nay nên học gì" trên Home (Home render sẵn ở TodayPage).
 * Ưu tiên: lỗi sai chưa reviewed → thẻ SRS đến hạn hôm nay → môn ít giờ nhất
 * trong 7 ngày qua (logic thuần ở ./suggestion.ts, có test).
 * Card tự quản dữ liệu: đọc settings + sổ tay qua repos trong effect CÓ catch
 * (đọc settings qua SettingsRepo thay vì useSettings() vì hook scaffold không bắt
 * lỗi — môi trường không có IndexedDB sẽ sinh unhandled rejection làm rơi smoke test),
 * tự hỏi RAG khi ragBaseUrl đã cấu hình (RAG lỗi → im lặng fallback gợi ý tại chỗ),
 * tự hiển thị loading/empty.
 * i18n: mọi chuỗi hiển thị qua useT('smart'); lang cũng truyền xuống pickSuggestion/
 * buildSuggestionPrompt để gợi ý + prompt dịch theo ngôn ngữ hiện tại.
 * Bề rộng tự thích ứng (không khoán width) — Home desktop sẽ đặt vào cột phải.
 */

interface DayFacts {
  unreviewedMistakes: number
  dueCards: number
  minutesBySubject: Partial<Record<number, number>>
  /** Các môn đang học (đã lọc lưu trữ) — cho gợi ý "môn ít giờ nhất" + màu washi. */
  subjects: { id: number; name: string; colorHex: string }[]
}

export default function SuggestionCard() {
  const { t, lang } = useT('smart')
  const [facts, setFacts] = useState<DayFacts | null>(null)
  const [ragBaseUrl, setRagBaseUrl] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)
  const [ragText, setRagText] = useState<string | null>(null)

  // 1) Đọc sổ tay + settings một lần khi mở card — mọi lỗi dữ liệu đều bắt lại.
  // Đọc TUẦN TỰ (không Promise.all): Dexie mở DB lỗi khi nhiều op chạy đồng thời vẫn
  // nhả 1 unhandled rejection nội bộ (môi trường không có IndexedDB) làm rơi smoke test.
  useEffect(() => {
    let alive = true
    void (async () => {
      const today = todayISO()
      const { from } = weekWindowISO(today)
      try {
        const settings = await repos.settings.get()
        const mistakes = await repos.mistakes.list()
        const dueCards = await repos.srs.listDue(today)
        const sessions = await repos.sessions.listBetween(from, today)
        const subjects = await repos.subjects.list()
        if (!alive) return
        setRagBaseUrl(settings.ragBaseUrl.trim())
        setFacts({
          unreviewedMistakes: mistakes.filter((m) => !m.reviewed).length,
          dueCards: dueCards.length,
          minutesBySubject: sumMinutesBySubject(sessions),
          subjects: subjects
            .filter((s) => !s.archived && s.id != null)
            .map((s) => ({ id: s.id as number, name: s.name, colorHex: s.colorHex })),
        })
      } catch {
        // IndexedDB/đọc dữ liệu lỗi — card vẫn hiện, chỉ là không gợi ý được.
        if (!alive) return
        setLoadFailed(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const suggestion: Suggestion | null = useMemo(
    () =>
      facts
        ? pickSuggestion(
            {
              unreviewedMistakes: facts.unreviewedMistakes,
              dueCards: facts.dueCards,
              minutesBySubject: facts.minutesBySubject,
              subjects: facts.subjects,
            } satisfies SuggestionInput,
            lang,
          )
        : null,
    [facts, lang],
  )

  // 2) Khi backend RAG đã cấu hình — hỏi thêm để có gợi ý theo tài liệu.
  useEffect(() => {
    if (!ragBaseUrl || !facts) {
      setRagText(null)
      return
    }
    let alive = true
    void queryRag(ragBaseUrl, buildSuggestionPrompt(facts, todayISO(), lang)).then((outcome) => {
      if (!alive) return
      setRagText(outcome.ok && outcome.answer ? outcome.answer : null)
    })
    return () => {
      alive = false
    }
  }, [ragBaseUrl, facts, lang])

  const loading = !facts && !loadFailed

  // Washi màu theo môn được gợi ý (môn 0/không gợi ý môn → neutral).
  const suggestedSubject = facts?.subjects.find((s) => s.id === suggestion?.subjectId)

  return (
    <NoteCard washiHex={suggestedSubject?.colorHex} title={t('card.title')} tag={t('card.tag')}>
      {loading && <p className="type-body text-muted">{t('card.loading')}</p>}

      {loadFailed && (
        <EmptyState
          message={t('card.loadFailed')}
          className="w-full"
        />
      )}

      {suggestion && suggestion.kind === 'start' && (
        <EmptyState
          message={t('card.empty')}
          className="w-full"
          action={
            <Link to="/hoc" className="btn btn-primary type-body">
              {t('card.startAction')}
            </Link>
          }
        />
      )}

      {suggestion && suggestion.kind !== 'start' && (
        <>
          <p className="type-body">{suggestion.body}</p>
          {suggestion.count > 0 && (
            <p className="num mt-2 text-[18px] text-teal">
              {suggestion.count}{' '}
              <span className="type-caption font-body font-semibold text-muted">
                {suggestion.unit}
              </span>
            </p>
          )}

          {ragText ? (
            <div className="mt-2 border-t border-dashed border-rule pt-2">
              <p className="type-body whitespace-pre-wrap">{ragText}</p>
              <p className="type-caption mt-1 text-muted">{t('card.ragSource')}</p>
            </div>
          ) : (
            !ragBaseUrl && (
              <p className="type-caption mt-2 text-muted">
                {t('card.connectPrompt')}{' '}
                <Link to="/caidat" className="text-teal underline underline-offset-2">
                  {t('card.connectLink')}
                </Link>
                .
              </p>
            )
          )}
        </>
      )}
    </NoteCard>
  )
}
