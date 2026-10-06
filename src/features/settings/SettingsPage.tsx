import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

import Icon from '@/components/ui/Icon'
import { PrimaryButton, SecondaryButton } from '@/components/ui/buttons'
import { cn } from '@/components/ui/cn'
import {
  applyDataMode,
  DEFAULT_SERVER_URL,
  getDataMode,
  getServerUrl,
  repos,
} from '@data'
import type { DataMode } from '@data'
import { useSettings } from '@data/useSettings'
import { useT } from '@data/useT'
import type { Lang } from '@core/i18n'
import type {
  ChatMessage,
  DailyNote,
  Mistake,
  Photo,
  PhotoRefType,
  Score,
  Session,
  Subject,
  SrsCard,
  Vocab,
} from '@core/types'

import {
  buildBackup,
  dataUrlOf,
  exportMarkdown,
  mistakesCsv,
  parseBackup,
  planRestore,
  scoresCsv,
  serializeBackup,
  sessionsCsv,
  vocabCsv,
  withBom,
} from '@/features/system/exportData'
import type { BackupData, BackupPhotoRow } from '@/features/system/exportData'
import { INSTALL_STEP_KEYS, OTHER_DEVICE_HINT_KEYS, detectPlatform } from '@/features/system/pwaInstall'
import {
  LAN_FETCH_ERROR_KEY,
  PHONE_CONNECT_STEP_KEYS,
  fetchLanInfo,
  lanSvgDataUrl,
  phoneConnectBaseUrl,
} from '@/features/system/phoneConnect'
import type { LanInfo } from '@/features/system/phoneConnect'
import { stepTime } from '@/features/system/reminderSchedule'
import { saveTextFile, stampFileName } from '@/features/system/saveFile'
import {
  DEFAULT_NOTE_REMINDER,
  loadNoteReminderTime,
  saveNoteReminderTime,
  useNotificationPermission,
} from '@/features/system/useReminders'

/**
 * /caidat — Cài đặt (nhóm D — hệ thống):
 *  - Nguồn dữ liệu (F21): "Trên máy này" (IndexedDB) / "Qua server PC"
 *    (npm run server — Express + SQLite) + ô địa chỉ server; đổi xong app tải lại.
 *  - Kết nối điện thoại: hiện mã QR + địa chỉ LAN để điện thoại cùng Wi-Fi mở Sổ
 *    (logic ở src/features/system/phoneConnect.ts, server trả GET /api/lan).
 *  - Mục tiêu hằng ngày / giờ nhắc — THỜI GIAN TỰ CHỈNH
 *    (mục 3 design-system: stepper −/+ VÀ ô nhập tự do; preset chỉ là gợi ý).
 *    (Điểm mục tiêu/ngày thi của khung TOEIC cũ đã bỏ khỏi UI — đa môn hoá.)
 *  - Nhịp học với đồng hồ (pomodoro) + địa chỉ máy trợ lý (ragBaseUrl cho chat RAG).
 *  - Nhắc lịch (C12): quyền thông báo hệ thống (banner fallback do AppLayout giữ).
 *  - Hỏi giờ học khi mở app (check-in): bật/tắt lời hỏi "vừa học bao nhiêu phút"
 *    mỗi lần mở Sổ — card hỏi do AppLayout gắn (CheckinPrompt.tsx).
 *  - Ngôn ngữ (design-system.md mục 12): chip "Tiếng Việt"/"English" — bấm là
 *    updateSettings({ language }) áp dụng NGAY toàn Sổ qua useT (publish/listen).
 *  - Dữ liệu của bạn (E18): tải sổ ghi chú (văn bản) + bảng (bảng tính, BOM tiếng Việt)
 *    + sao lưu toàn bộ / khôi phục — logic thuần ở src/features/system/exportData.ts.
 *  - Hướng dẫn cài Sổ vào máy (PWA).
 *  ≥768px: cột giữa hẹp 480–720px căn giữa (mục 10 design-system.md).
 */

// Khoảng rộng để liệt kê "tất cả" các ngày qua port listBetween (chỉ có list theo khoảng).
const WIDE_FROM = '0000-01-01'
const WIDE_TO = '9999-12-31'

interface ExportBundle {
  subjects: Subject[]
  sessions: Session[]
  dailyNotes: DailyNote[]
  vocab: Vocab[]
  srsCards: SrsCard[]
  mistakes: Mistake[]
  scores: Score[]
  photos: BackupPhotoRow[]
}

interface StatusMessage {
  kind: 'ok' | 'err'
  text: string
}

/** Bộ đổi subjectId → tên môn cho xuất CSV (môn đã xoá → số id dự phòng). */
function subjectNameOf(b: ExportBundle): (id: number) => string | undefined {
  return (id) => b.subjects.find((s) => s.id === id)?.name
}

async function photoToRow(photo: Photo): Promise<BackupPhotoRow> {
  const bytes = new Uint8Array(await photo.blob.arrayBuffer())
  return {
    id: photo.id ?? 0,
    mime: photo.mime,
    refType: photo.refType,
    refId: photo.refId,
    dataUrl: dataUrlOf(photo.mime, bytes),
  }
}

interface StepperFieldProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  /** Gợi ý nhanh — LUÔN kèm đường stepper + nhập tự do (mục 3 design-system). */
  presets?: number[]
  onCommit: (n: number) => void
}

function StepperField({ label, value, min, max, step, unit, presets, onCommit }: StepperFieldProps) {
  const { t } = useT('settings')
  const [draft, setDraft] = useState(String(value))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) setDraft(String(value))
  }, [value, editing])

  const commit = (raw: string) => {
    const n = Math.round(Number(raw))
    if (!Number.isFinite(n)) {
      setDraft(String(value))
      return
    }
    const clamped = Math.min(max, Math.max(min, n))
    setDraft(String(clamped))
    if (clamped !== value) onCommit(clamped)
  }

  return (
    <div>
      <p className="type-body">{label}</p>
      <div className="mt-2 flex items-center justify-center gap-4">
        <button
          type="button"
          className="stepper-btn"
          aria-label={t('stepper.stepDownAria', { label, step, unit })}
          onClick={() => commit(String(value - step))}
        >
          −
        </button>
        <div className="flex items-baseline gap-1">
          <input
            className="stepper-num w-14 bg-transparent text-center outline-none"
            inputMode="numeric"
            value={draft}
            aria-label={t('stepper.inputAria', { label })}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => setEditing(true)}
            onBlur={() => {
              setEditing(false)
              commit(draft)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
          />
          <span className="type-caption text-muted">{unit}</span>
        </div>
        <button
          type="button"
          className="stepper-btn"
          aria-label={t('stepper.stepUpAria', { label, step, unit })}
          onClick={() => commit(String(value + step))}
        >
          +
        </button>
      </div>
      {presets && presets.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              className={p === value ? 'part-chip part-chip--active' : 'part-chip'}
              onClick={() => commit(String(p))}
            >
              {p} {unit}
            </button>
          ))}
          <span className="type-caption text-muted">{t('stepper.presetsHint')}</span>
        </div>
      )}
    </div>
  )
}

interface TimeFieldProps {
  label: string
  value: string
  /** Giờ khởi điểm khi chưa đặt (stepper bấm lần đầu). */
  fallback: string
  onCommit: (v: string) => void
}

function TimeField({ label, value, fallback, onCommit }: TimeFieldProps) {
  const { t } = useT('settings')
  const base = value !== '' ? value : fallback
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="type-body">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="stepper-btn"
          aria-label={t('time.backAria', { label })}
          onClick={() => onCommit(stepTime(base, -15))}
        >
          −
        </button>
        <input
          type="time"
          value={value}
          aria-label={t('time.inputAria', { label })}
          onChange={(e) => onCommit(e.target.value)}
          className="num w-[84px] rounded-lg border border-rule bg-bg px-2 py-1.5 text-center text-[15px] outline-none"
        />
        <button
          type="button"
          className="stepper-btn"
          aria-label={t('time.forwardAria', { label })}
          onClick={() => onCommit(stepTime(base, 15))}
        >
          +
        </button>
      </div>
    </div>
  )
}

interface TextFieldProps {
  label: string
  hint?: string
  value: string
  placeholder: string
  onCommit: (v: string) => void
}

function TextField({ label, hint, value, placeholder, onCommit }: TextFieldProps) {
  const [draft, setDraft] = useState(value)
  const id = useId()

  useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <div>
      <label className="type-body" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const v = draft.trim()
          setDraft(v)
          if (v !== value) onCommit(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className="mt-2 w-full rounded-lg border border-rule bg-bg px-3 py-2 text-[15px] leading-[22px] outline-none"
      />
      {hint && <p className="type-caption text-muted mt-1">{hint}</p>}
    </div>
  )
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

interface DataSourceSectionProps {
  dataMode: DataMode
  onDataModeChange: (mode: DataMode) => void
  serverUrl: string
  onServerUrlChange: (url: string) => void
  onApply: () => void
  applying: boolean
}

/**
 * Phần "Nguồn dữ liệu" (F21) — tách riêng để hiện được cả khi settings không đọc
 * được (vd. server PC tắt ở chế độ server): đây là lối thoát để đổi về "Trên máy này".
 */
function DataSourceSection({
  dataMode,
  onDataModeChange,
  serverUrl,
  onServerUrlChange,
  onApply,
  applying,
}: DataSourceSectionProps) {
  const { t } = useT('settings')
  return (
    <section className="paper-card px-4 pt-3 pb-4">
      <p className="section-label">{t('ds.label')}</p>
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('ds.groupAria')}>
          {(
            [
              ['local', t('ds.local')],
              ['server', t('ds.server')],
            ] as const
          ).map(([value, lbl]) => (
            <button
              key={value}
              type="button"
              className={cn('part-chip', dataMode === value && 'part-chip--active')}
              aria-pressed={dataMode === value}
              onClick={() => onDataModeChange(value)}
            >
              {lbl}
            </button>
          ))}
        </div>

        {dataMode === 'local' ? (
          <p className="type-caption text-muted">{t('ds.localHint')}</p>
        ) : (
          <>
            <TextField
              label={t('ds.serverUrlLabel')}
              value={serverUrl}
              placeholder={DEFAULT_SERVER_URL}
              hint={t('ds.serverUrlHint')}
              onCommit={onServerUrlChange}
            />
            <p className="type-caption rounded-lg border border-coral bg-pink-soft px-3 py-2">
              {t('ds.switchWarning')}
            </p>
          </>
        )}
        <div>
          <SecondaryButton className="px-3 py-2" onClick={onApply} disabled={applying}>
            {applying ? t('ds.applying') : t('ds.apply')}
          </SecondaryButton>
        </div>
      </div>
    </section>
  )
}

type PhoneConnectPhase = 'idle' | 'loading' | 'error' | 'ready'

/**
 * Phần "Kết nối điện thoại" — hiện mã QR + địa chỉ để điện thoại cùng Wi-Fi mở Sổ.
 * Bấm "Hiện mã QR" mới hỏi server PC GET /api/lan (đi đúng đường dữ liệu của nguồn
 * đang chọn: server → serverUrl đã nhập, local → localhost:5178) — logic thuần ở
 * src/features/system/phoneConnect.ts.
 */
function PhoneConnectSection() {
  const { t } = useT('settings')
  const [phase, setPhase] = useState<PhoneConnectPhase>('idle')
  const [info, setInfo] = useState<LanInfo | null>(null)

  const load = useCallback(async () => {
    setPhase('loading')
    try {
      const data = await fetchLanInfo(phoneConnectBaseUrl(getDataMode(), getServerUrl()))
      setInfo(data)
      setPhase('ready')
    } catch {
      setInfo(null)
      setPhase('error')
    }
  }, [])

  return (
    <section className="paper-card px-4 pt-3 pb-4">
      <p className="section-label">{t('pc.label')}</p>
      <div className="mt-3 flex flex-col gap-3">
        {phase === 'idle' && (
          <>
            <p className="type-body">{t('pc.intro')}</p>
            <div>
              <SecondaryButton className="px-3 py-2" onClick={() => void load()}>
                {t('pc.showQr')}
              </SecondaryButton>
            </div>
          </>
        )}
        {phase === 'loading' && <p className="type-body text-muted">{t('pc.loading')}</p>}
        {phase === 'error' && (
          <>
            <p
              className="type-caption rounded-lg border border-coral bg-pink-soft px-3 py-2"
              role="alert"
            >
              {t(LAN_FETCH_ERROR_KEY)}
            </p>
            <div>
              <SecondaryButton className="px-3 py-2" onClick={() => void load()}>
                {t('pc.retry')}
              </SecondaryButton>
            </div>
          </>
        )}
        {phase === 'ready' && info && (
          <>
            <img
              src={lanSvgDataUrl(info.qrSvg)}
              alt={t('pc.qrAlt')}
              width={176}
              height={176}
              className="mx-auto h-44 w-44 rounded-lg border border-rule bg-white"
            />
            <p className="type-caption text-muted">{t('pc.urlsHint')}</p>
            <ul className="flex flex-col gap-1">
              {info.urls.map((url) => (
                <li key={url} className="type-body break-all">
                  {url}
                </li>
              ))}
            </ul>
            <ol className="ml-5 list-decimal space-y-1">
              {PHONE_CONNECT_STEP_KEYS.map((key) => (
                <li key={key} className="type-body">
                  {t(key)}
                </li>
              ))}
            </ol>
            <p className="type-caption text-muted">{t('pc.sameDataNote')}</p>
          </>
        )}
      </div>
    </section>
  )
}

/**
 * Phần "Ngôn ngữ" (design-system.md mục 12) — 2 chip "Tiếng Việt" / "English".
 * Bấm là updateSettings({ language }) NGAY: publish/listen của useSettings làm
 * mọi useT đang mount render lại — không cần nút áp dụng, không cần tải lại.
 * Chip dùng đúng markup part-chip của dự án (như chips "Nguồn dữ liệu" — nhận
 * click chuột thật).
 */
function LanguageSection({
  language,
  onSelect,
}: {
  language: Lang
  onSelect: (lang: Lang) => void
}) {
  const { t } = useT('settings')
  return (
    <section className="paper-card px-4 pt-3 pb-4">
      <p className="section-label">{t('lang.label')}</p>
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('lang.groupAria')}>
          {(
            [
              ['vi', t('lang.vi')],
              ['en', t('lang.en')],
            ] as const
          ).map(([value, lbl]) => (
            <button
              key={value}
              type="button"
              className={cn('part-chip', language === value && 'part-chip--active')}
              aria-pressed={language === value}
              onClick={() => onSelect(value)}
            >
              {lbl}
            </button>
          ))}
        </div>
        <p className="type-caption text-muted">{t('lang.desc')}</p>
      </div>
    </section>
  )
}

export default function SettingsPage() {
  const { settings, updateSettings, loading } = useSettings()
  const { t } = useT('settings')
  const [noteTime, setNoteTime] = useState<string>(() => loadNoteReminderTime())
  // Chỉ quản quyền thông báo — scheduler nhắc (C12) mount một lần ở AppLayout.
  const { permission, requestPermission } = useNotificationPermission()

  const [bundle, setBundle] = useState<ExportBundle | null>(null)
  const [status, setStatus] = useState<StatusMessage | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // F21 — chế độ dữ liệu: 'local' = "Trên máy này", 'server' = "Qua server PC".
  const [dataMode, setDataMode] = useState<DataMode>(() => getDataMode())
  const [serverUrl, setServerUrl] = useState<string>(() => getServerUrl())
  const [applyingMode, setApplyingMode] = useState(false)

  // Áp dụng nguồn dữ liệu: ghi lựa chọn vào bảng settings của nguồn ĐANG dùng
  // (Settings.syncMode + serverUrl — best-effort, nguồn cũ lỗi vẫn cho đổi) rồi
  // applyDataMode() lưu bản sao localStorage và tải lại app để factory dựng lại repos.
  const handleApplyDataMode = useCallback(async () => {
    setApplyingMode(true)
    try {
      await updateSettings({ syncMode: dataMode, serverUrl: serverUrl.trim() })
    } catch {
      // nguồn hiện tại không ghi được (vd. server tắt) — vẫn áp dụng lựa chọn mới
    }
    applyDataMode(dataMode, serverUrl)
  }, [dataMode, serverUrl, updateSettings])

  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null)
  const platform = useMemo(() => detectPlatform(navigator.userAgent), [])

  const loadBundle = useCallback(async (): Promise<ExportBundle> => {
    const [subjects, sessions, dailyNotes, vocab, mistakes, scores, srsCards] = await Promise.all([
      repos.subjects.list(),
      repos.sessions.listBetween(WIDE_FROM, WIDE_TO),
      repos.notes.listBetween(WIDE_FROM, WIDE_TO),
      repos.vocab.list(),
      repos.mistakes.list(),
      repos.scores.list(),
      repos.srs.listAll(),
    ])
    const photos: BackupPhotoRow[] = []
    const collect = async (refType: PhotoRefType, refId: string) => {
      for (const p of await repos.photos.listByRef(refType, refId)) {
        photos.push(await photoToRow(p))
      }
    }
    for (const s of sessions) {
      if (s.id !== undefined) await collect('session', String(s.id))
    }
    for (const m of mistakes) {
      if (m.id !== undefined) await collect('mistake', String(m.id))
    }
    for (const n of dailyNotes) await collect('note', n.date)
    return { subjects, sessions, dailyNotes, vocab, mistakes, scores, srsCards, photos }
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const b = await loadBundle()
        if (alive) setBundle(b)
      } catch {
        if (alive) setStatus({ kind: 'err', text: t('data.readFail') })
      }
    })()
    return () => {
      alive = false
    }
  }, [loadBundle, t])

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvt(e as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  // ===== Xuất dữ liệu =====

  const download = useCallback(
    async (base: string, ext: string, mime: string, okText: string, make: (b: ExportBundle) => string) => {
      setBusy(true)
      setStatus(null)
      try {
        const b = bundle ?? (await loadBundle())
        saveTextFile(`${stampFileName(base, new Date())}.${ext}`, mime, make(b))
        setStatus({ kind: 'ok', text: okText })
      } catch {
        setStatus({ kind: 'err', text: t('data.downloadFail') })
      } finally {
        setBusy(false)
      }
    },
    [bundle, loadBundle, t],
  )

  const handleExportMarkdown = () =>
    download(
      'qqlearn',
      'md',
      'text/markdown;charset=utf-8',
      t('data.markdownOk'),
      (b) => exportMarkdown(b.dailyNotes, b.sessions, new Date(), (id) => b.subjects.find((s) => s.id === id)?.name),
    )

  const handleExportCsv = (base: string, labelKey: string, make: (b: ExportBundle) => string) =>
    // BOM UTF-8 để Excel mở đúng tiếng Việt (withBom trong exportData.ts).
    download(base, 'csv', 'text/csv;charset=utf-8', t('data.csvOk', { label: t(labelKey) }), make)

  const handleBackup = async () => {
    if (!settings) return
    setBusy(true)
    setStatus(null)
    try {
      const b = bundle ?? (await loadBundle())
      // Mọi tin nhắn chat: liệt kê phiên qua ChatRepo.listSessions() rồi từng phiên.
      const chatMessages: ChatMessage[] = []
      for (const sessionId of await repos.chat.listSessions()) {
        chatMessages.push(...(await repos.chat.listBySession(sessionId)))
      }
      const data: BackupData = buildBackup(
        {
          settings: {
            dailyGoalMinutes: settings.dailyGoalMinutes,
            targetScore: settings.targetScore,
            examDate: settings.examDate,
            reminderTime: settings.reminderTime,
            ragBaseUrl: settings.ragBaseUrl,
            onboardingDone: settings.onboardingDone,
            pomodoro: settings.pomodoro,
          },
          subjects: b.subjects,
          sessions: b.sessions,
          dailyNotes: b.dailyNotes,
          vocab: b.vocab,
          srsCards: b.srsCards,
          mistakes: b.mistakes,
          scores: b.scores,
          chatMessages,
          photos: b.photos,
        },
        new Date(),
      )
      saveTextFile(`${stampFileName('sao-luc-day-du', new Date())}.json`, 'application/json', serializeBackup(data))
      setStatus({ kind: 'ok', text: t('data.backupOk') })
    } catch {
      setStatus({ kind: 'err', text: t('data.backupFail') })
    } finally {
      setBusy(false)
    }
  }

  // ===== Khôi phục từ bản sao lưu =====

  const applyRestore = useCallback(
    async (data: BackupData) => {
      const plan = planRestore(data)
      // ALL-OR-NOTHING qua RestoreRepo: xoá sạch rồi ghi lại trong MỘT transaction
      // (Dexie: db.transaction; server: POST /api/restore với BEGIN/COMMIT/ROLLBACK).
      // Lỗi giữa chừng → rollback về trạng thái trước khôi phục; chạy lại không nhân đôi.
      await repos.restore.restoreAll(plan)
    },
    [],
  )

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setStatus(null)
    try {
      const parsed = parseBackup(await file.text(), t)
      if (!parsed.ok) {
        setStatus({ kind: 'err', text: parsed.error })
        return
      }
      const proceed = window.confirm(t('data.restoreConfirm'))
      if (!proceed) return
      await applyRestore(parsed.data)
      setBundle(await loadBundle())
      setStatus({ kind: 'ok', text: t('data.restoreOk') })
    } catch {
      setStatus({ kind: 'err', text: t('data.restoreReadFail') })
    } finally {
      setBusy(false)
    }
  }

  const handleInstall = async () => {
    if (!installEvt) return
    try {
      await installEvt.prompt()
    } finally {
      setInstallEvt(null)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-[600px] flex-col gap-4">
        <p className="section-label">{t('page.label')}</p>
        <h1 className="type-display">{t('page.title')}</h1>
        <section className="paper-card px-4 py-4">
          <p className="type-body text-muted">{t('page.loading')}</p>
        </section>
      </div>
    )
  }

  if (!settings) {
    // Không đọc được settings từ nguồn đang dùng (vd. server PC tắt khi đang chế
    // độ "Qua server PC") — vẫn mở phần Nguồn dữ liệu để người học đổi về local.
    return (
      <div className="mx-auto flex w-full max-w-[600px] flex-col gap-4">
        <p className="section-label">{t('page.label')}</p>
        <h1 className="type-display">{t('page.title')}</h1>
        <p className="type-caption rounded-lg border border-coral bg-pink-soft px-3 py-2" role="alert">
          {t('page.noSettings')}
        </p>
        <DataSourceSection
          dataMode={dataMode}
          onDataModeChange={setDataMode}
          serverUrl={serverUrl}
          onServerUrlChange={setServerUrl}
          onApply={() => void handleApplyDataMode()}
          applying={applyingMode}
        />
      </div>
    )
  }

  const csvExports: { base: string; labelKey: string; make: (b: ExportBundle) => string }[] = [
    {
      base: 'buoi-hoc',
      labelKey: 'data.csv.sessions',
      make: (b) => withBom(sessionsCsv(b.sessions, subjectNameOf(b))),
    },
    {
      base: 'tu-vung',
      labelKey: 'data.csv.vocab',
      make: (b) => withBom(vocabCsv(b.vocab, subjectNameOf(b))),
    },
    {
      base: 'loi-sai',
      labelKey: 'data.csv.mistakes',
      make: (b) => withBom(mistakesCsv(b.mistakes, subjectNameOf(b))),
    },
    {
      base: 'diem',
      labelKey: 'data.csv.scores',
      make: (b) => withBom(scoresCsv(b.scores, subjectNameOf(b))),
    },
  ]

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-4">
      <p className="section-label">{t('page.label')}</p>
      <h1 className="type-display">{t('page.title')}</h1>

      {/* ===== Ngôn ngữ (design-system.md mục 12) — áp dụng ngay toàn bộ Sổ ===== */}
      <LanguageSection
        language={settings.language}
        onSelect={(lang) => void updateSettings({ language: lang })}
      />

      {/* ===== Nguồn dữ liệu (F21) ===== */}
      <DataSourceSection
        dataMode={dataMode}
        onDataModeChange={setDataMode}
        serverUrl={serverUrl}
        onServerUrlChange={setServerUrl}
        onApply={() => void handleApplyDataMode()}
        applying={applyingMode}
      />

      {/* ===== Kết nối điện thoại — quét QR để mở Sổ trên điện thoại cùng Wi-Fi ===== */}
      <PhoneConnectSection />

      {/* ===== Mục tiêu hằng ngày ===== */}
      <section className="paper-card px-4 pt-3 pb-4">
        <p className="section-label">{t('goal.label')}</p>
        <div className="mt-3 flex flex-col gap-5">
          <StepperField
            label={t('goal.field')}
            value={settings.dailyGoalMinutes}
            min={5}
            max={1440}
            step={5}
            unit={t('goal.unit')}
            presets={[15, 25, 45, 60]}
            onCommit={(n) => void updateSettings({ dailyGoalMinutes: n })}
          />
          <p className="type-caption text-muted -mt-3 text-center">{t('goal.hint')}</p>
        </div>
      </section>

      {/* ===== Nhịp học với đồng hồ (pomodoro) ===== */}
      <section className="paper-card px-4 pt-3 pb-4">
        <p className="section-label">{t('pom.label')}</p>
        <div className="mt-3 flex flex-col gap-5">
          <StepperField
            label={t('pom.focus')}
            value={settings.pomodoro.focusMin}
            min={1}
            max={240}
            step={5}
            unit={t('goal.unit')}
            presets={[15, 25, 45]}
            onCommit={(n) => void updateSettings({ pomodoro: { ...settings.pomodoro, focusMin: n } })}
          />
          <hr className="dashed-rule" />
          <StepperField
            label={t('pom.break')}
            value={settings.pomodoro.breakMin}
            min={1}
            max={120}
            step={5}
            unit={t('goal.unit')}
            presets={[5, 10, 15]}
            onCommit={(n) => void updateSettings({ pomodoro: { ...settings.pomodoro, breakMin: n } })}
          />
        </div>
      </section>

      {/* ===== Nhắc lịch (C12) ===== */}
      <section className="paper-card px-4 pt-3 pb-4">
        <p className="section-label label-dot-coral">{t('remind.label')}</p>
        <div className="mt-3 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <span className="type-body flex items-center gap-2">
              <Icon name="bell" size={18} className="text-muted" />
              {t('remind.notifTitle')}
            </span>
            {permission === 'default' && (
              <SecondaryButton className="px-3 py-2" onClick={() => void requestPermission()}>
                {t('remind.allow')}
              </SecondaryButton>
            )}
          </div>
          <p
            className={
              permission === 'granted'
                ? 'type-caption text-teal'
                : permission === 'denied'
                  ? 'type-caption text-coral'
                  : 'type-caption text-muted'
            }
          >
            {t(`remind.perm.${permission}`)}
          </p>
          {permission !== 'granted' && (
            <p className="type-caption rounded-lg border border-coral bg-pink-soft px-3 py-2">
              {t('remind.permFallback')}
            </p>
          )}
          <hr className="dashed-rule" />
          <TimeField
            label={t('remind.start')}
            value={settings.reminderTime}
            fallback="19:00"
            onCommit={(v) => void updateSettings({ reminderTime: v })}
          />
          <TimeField
            label={t('remind.note')}
            value={noteTime}
            fallback={DEFAULT_NOTE_REMINDER}
            onCommit={(v) => {
              setNoteTime(v)
              saveNoteReminderTime(v)
            }}
          />
          <p className="type-caption text-muted">{t('remind.hint')}</p>
        </div>
      </section>

      {/* ===== Hỏi giờ học khi mở app (check-in) ===== */}
      <section className="paper-card px-4 pt-3 pb-4">
        <p className="section-label">{t('checkin.label')}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="type-body flex-1">{t('checkin.desc')}</p>
          <button
            type="button"
            role="switch"
            aria-checked={settings.checkinEnabled}
            aria-label={t('checkin.aria')}
            onClick={() => void updateSettings({ checkinEnabled: !settings.checkinEnabled })}
            className={
              settings.checkinEnabled
                ? 'relative h-6 w-11 shrink-0 rounded-full border-[1.5px] border-teal bg-teal transition-colors'
                : 'relative h-6 w-11 shrink-0 rounded-full border-[1.5px] border-rule bg-bg transition-colors'
            }
          >
            <span
              className={
                settings.checkinEnabled
                  ? 'absolute top-1/2 right-0.5 h-[18px] w-[18px] -translate-y-1/2 rounded-full bg-card transition-transform'
                  : 'absolute top-1/2 left-0.5 h-[18px] w-[18px] -translate-y-1/2 rounded-full border border-rule bg-card transition-transform'
              }
            />
          </button>
        </div>
        <p className="type-caption text-muted mt-2">{t('checkin.hint')}</p>
      </section>

      {/* ===== Trợ lý hỏi đáp (RAG) ===== */}
      <section className="paper-card px-4 pt-3 pb-4">
        <p className="section-label label-dot-lavender">{t('rag.label')}</p>
        <div className="mt-3">
          <TextField
            label={t('rag.addrLabel')}
            value={settings.ragBaseUrl}
            placeholder="http://localhost:8000"
            hint={t('rag.hint')}
            onCommit={(v) => void updateSettings({ ragBaseUrl: v })}
          />
        </div>
      </section>

      {/* ===== Dữ liệu của bạn (E18) ===== */}
      <section className="paper-card px-4 pt-3 pb-4">
        <p className="section-label label-dot-mauve">{t('data.label')}</p>
        <div className="mt-3 flex flex-col gap-3">
          <PrimaryButton onClick={() => void handleBackup()} disabled={busy}>
            {t('data.backup')}
          </PrimaryButton>
          <SecondaryButton onClick={() => fileRef.current?.click()} disabled={busy}>
            {t('data.restore')}
          </SecondaryButton>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => void handleImportFile(e)}
          />
          <hr className="dashed-rule" />
          <p className="type-caption text-muted">{t('data.exportHint')}</p>
          <div className="flex flex-wrap gap-2">
            <SecondaryButton
              className="px-3 py-2"
              disabled={busy}
              onClick={() => void handleExportMarkdown()}
            >
              {t('data.notesExport')}
            </SecondaryButton>
            {csvExports.map((item) => (
              <SecondaryButton
                key={item.base}
                className="px-3 py-2"
                disabled={busy}
                onClick={() => void handleExportCsv(item.base, item.labelKey, item.make)}
              >
                {t('data.csvButton', { label: t(item.labelKey) })}
              </SecondaryButton>
            ))}
          </div>
          <p className="type-caption text-muted">{t('data.excelNote')}</p>
          {status && (
            <p
              role="status"
              className={
                status.kind === 'ok'
                  ? 'type-caption rounded-lg border border-teal bg-teal-soft px-3 py-2'
                  : 'type-caption rounded-lg border border-coral bg-pink-soft px-3 py-2'
              }
            >
              {status.text}
            </p>
          )}
        </div>
      </section>

      {/* ===== Cài Sổ vào máy (PWA) ===== */}
      <section className="paper-card px-4 pt-3 pb-4">
        <p className="section-label label-dot-butter">{t('pwa.label')}</p>
        <div className="mt-3 flex flex-col gap-3">
          {installEvt && (
            <PrimaryButton onClick={() => void handleInstall()}>{t('pwa.install')}</PrimaryButton>
          )}
          <ol className="ml-5 list-decimal space-y-1">
            {INSTALL_STEP_KEYS[platform].map((key) => (
              <li key={key} className="type-body">
                {t(key)}
              </li>
            ))}
          </ol>
          <p className="type-caption text-muted">{t(OTHER_DEVICE_HINT_KEYS[platform])}</p>
          <p className="type-caption text-muted">{t('pwa.footer')}</p>
        </div>
      </section>
    </div>
  )
}
