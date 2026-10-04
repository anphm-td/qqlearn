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
import type {
  ChatMessage,
  DailyNote,
  Mistake,
  Photo,
  PhotoRefType,
  Score,
  Session,
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
import { INSTALL_STEPS, OTHER_DEVICE_HINTS, detectPlatform } from '@/features/system/pwaInstall'
import { stepTime } from '@/features/system/reminderSchedule'
import { saveTextFile, stampFileName } from '@/features/system/saveFile'
import {
  DEFAULT_NOTE_REMINDER,
  loadNoteReminderTime,
  saveNoteReminderTime,
  useNotificationPermission,
} from '@/features/system/useReminders'
import type { ReminderPermission } from '@/features/system/useReminders'

/**
 * /caidat — Cài đặt (nhóm D — hệ thống):
 *  - Nguồn dữ liệu (F21): "Trên máy này" (IndexedDB) / "Qua server PC"
 *    (npm run server — Express + SQLite) + ô địa chỉ server; đổi xong app tải lại.
 *  - Mục tiêu hằng ngày / điểm mục tiêu / ngày thi / giờ nhắc — THỜI GIAN TỰ CHỈNH
 *    (mục 3 design-system: stepper −/+ VÀ ô nhập tự do; preset chỉ là gợi ý).
 *  - Nhịp học với đồng hồ (pomodoro) + địa chỉ máy trợ lý (ragBaseUrl cho chat RAG).
 *  - Nhắc lịch (C12): quyền thông báo hệ thống (banner fallback do AppLayout giữ).
 *  - Hỏi giờ học khi mở app (check-in): bật/tắt lời hỏi "vừa học bao nhiêu phút"
 *    mỗi lần mở Sổ — card hỏi do AppLayout gắn (CheckinPrompt.tsx).
 *  - Dữ liệu của bạn (E18): tải sổ ghi chú (văn bản) + bảng (bảng tính, BOM tiếng Việt)
 *    + sao lưu toàn bộ / khôi phục — logic thuần ở src/features/system/exportData.ts.
 *  - Hướng dẫn cài Sổ vào máy (PWA).
 *  ≥768px: cột giữa hẹp 480–720px căn giữa (mục 10 design-system.md).
 */

// Khoảng rộng để liệt kê "tất cả" các ngày qua port listBetween (chỉ có list theo khoảng).
const WIDE_FROM = '0000-01-01'
const WIDE_TO = '9999-12-31'

interface ExportBundle {
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
          aria-label={`Giảm ${label} ${step} ${unit}`}
          onClick={() => commit(String(value - step))}
        >
          −
        </button>
        <div className="flex items-baseline gap-1">
          <input
            className="stepper-num w-14 bg-transparent text-center outline-none"
            inputMode="numeric"
            value={draft}
            aria-label={`${label} — nhập số`}
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
          aria-label={`Tăng ${label} ${step} ${unit}`}
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
          <span className="type-caption text-muted">chỉ là gợi ý — nhập số tùy ý ở trên</span>
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
  const base = value !== '' ? value : fallback
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="type-body">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="stepper-btn"
          aria-label={`Lùi ${label} 15 phút`}
          onClick={() => onCommit(stepTime(base, -15))}
        >
          −
        </button>
        <input
          type="time"
          value={value}
          aria-label={`${label} — chọn giờ`}
          onChange={(e) => onCommit(e.target.value)}
          className="num w-[84px] rounded-lg border border-rule bg-bg px-2 py-1.5 text-center text-[15px] outline-none"
        />
        <button
          type="button"
          className="stepper-btn"
          aria-label={`Gia hạn ${label} 15 phút`}
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

const PERMISSION_TEXT: Record<ReminderPermission, string> = {
  granted: 'Đã cấp quyền — Sổ sẽ nhắc qua thông báo hệ thống.',
  default: 'Chưa cấp quyền nhắc.',
  denied: 'Quyền nhắc đang bị chặn — bật lại trong phần quyền thông báo của trình duyệt.',
  unsupported: 'Trình duyệt này chưa hỗ trợ thông báo hệ thống — Sổ sẽ nhắc ngay trong app.',
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
  return (
    <section className="paper-card px-4 pt-3 pb-4">
      <p className="section-label">nguồn dữ liệu</p>
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chọn nguồn dữ liệu">
          {(
            [
              ['local', 'Trên máy này'],
              ['server', 'Qua server PC'],
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
          <p className="type-caption text-muted">
            Sổ lưu ngay trên máy này — học offline vẫn vào được, không cần mạng.
          </p>
        ) : (
          <>
            <TextField
              label="Địa chỉ server PC"
              value={serverUrl}
              placeholder={DEFAULT_SERVER_URL}
              hint="Chạy “npm run server” trên máy tính — Sổ sẽ đọc/ghi sổ qua server đó. Điện thoại dùng địa chỉ LAN hiện khi server khởi động (vd. http://192.168.1.10:5178)."
              onCommit={onServerUrlChange}
            />
            <p className="type-caption rounded-lg border border-coral bg-pink-soft px-3 py-2">
              Khi chuyển nguồn, Sổ đọc/ghi theo nơi đã chọn — dữ liệu hai nơi không tự trộn.
            </p>
          </>
        )}
        <div>
          <SecondaryButton className="px-3 py-2" onClick={onApply} disabled={applying}>
            {applying ? 'Đang áp dụng…' : 'Áp dụng và tải lại Sổ'}
          </SecondaryButton>
        </div>
      </div>
    </section>
  )
}

export default function SettingsPage() {
  const { settings, updateSettings, loading } = useSettings()
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
    const [sessions, dailyNotes, vocab, mistakes, scores, srsCards] = await Promise.all([
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
    return { sessions, dailyNotes, vocab, mistakes, scores, srsCards, photos }
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const b = await loadBundle()
        if (alive) setBundle(b)
      } catch {
        if (alive) setStatus({ kind: 'err', text: 'Chưa đọc được dữ liệu trong Sổ để xuất.' })
      }
    })()
    return () => {
      alive = false
    }
  }, [loadBundle])

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
        setStatus({ kind: 'err', text: 'Chưa tải được — thử lại nhé.' })
      } finally {
        setBusy(false)
      }
    },
    [bundle, loadBundle],
  )

  const handleExportMarkdown = () =>
    download(
      'so-hoc-toeic',
      'md',
      'text/markdown;charset=utf-8',
      'Đã tải sổ ghi chú (tệp văn bản) về máy.',
      (b) => exportMarkdown(b.dailyNotes, b.sessions, new Date()),
    )

  const handleExportCsv = (base: string, label: string, make: (b: ExportBundle) => string) =>
    // BOM UTF-8 để Excel mở đúng tiếng Việt (withBom trong exportData.ts).
    download(base, 'csv', 'text/csv;charset=utf-8', `Đã tải bảng ${label} về máy.`, make)

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
      setStatus({ kind: 'ok', text: 'Đã lưu bản sao lưu đầy đủ về máy.' })
    } catch {
      setStatus({ kind: 'err', text: 'Chưa tạo được bản sao lưu — thử lại nhé.' })
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
      const parsed = parseBackup(await file.text())
      if (!parsed.ok) {
        setStatus({ kind: 'err', text: parsed.error })
        return
      }
      const proceed = window.confirm(
        'Khôi phục sẽ THAY THẾ toàn bộ dữ liệu hiện tại bằng dữ liệu trong bản sao lưu (nguồn dữ liệu đang chọn không đổi). Tiếp tục?',
      )
      if (!proceed) return
      await applyRestore(parsed.data)
      setBundle(await loadBundle())
      setStatus({ kind: 'ok', text: 'Đã khôi phục xong từ bản sao lưu.' })
    } catch {
      setStatus({ kind: 'err', text: 'Không đọc được tệp bản sao lưu.' })
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
        <p className="section-label">cài đặt</p>
        <h1 className="type-display">Cài đặt</h1>
        <section className="paper-card px-4 py-4">
          <p className="type-body text-muted">đang mở Sổ…</p>
        </section>
      </div>
    )
  }

  if (!settings) {
    // Không đọc được settings từ nguồn đang dùng (vd. server PC tắt khi đang chế
    // độ "Qua server PC") — vẫn mở phần Nguồn dữ liệu để người học đổi về local.
    return (
      <div className="mx-auto flex w-full max-w-[600px] flex-col gap-4">
        <p className="section-label">cài đặt</p>
        <h1 className="type-display">Cài đặt</h1>
        <p className="type-caption rounded-lg border border-coral bg-pink-soft px-3 py-2" role="alert">
          Chưa đọc được cài đặt từ nguồn dữ liệu đang dùng. Có thể server PC đã tắt —
          hãy mở server trên máy tính hoặc chuyển tạm về "Trên máy này".
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

  const csvExports: { base: string; label: string; make: (b: ExportBundle) => string }[] = [
    { base: 'buoi-hoc', label: 'buổi học', make: (b) => withBom(sessionsCsv(b.sessions)) },
    { base: 'tu-vung', label: 'từ vựng', make: (b) => withBom(vocabCsv(b.vocab)) },
    { base: 'loi-sai', label: 'lỗi sai', make: (b) => withBom(mistakesCsv(b.mistakes)) },
    { base: 'diem', label: 'điểm luyện đề', make: (b) => withBom(scoresCsv(b.scores)) },
  ]

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-4">
      <p className="section-label">cài đặt</p>
      <h1 className="type-display">Cài đặt</h1>

      {/* ===== Nguồn dữ liệu (F21) ===== */}
      <DataSourceSection
        dataMode={dataMode}
        onDataModeChange={setDataMode}
        serverUrl={serverUrl}
        onServerUrlChange={setServerUrl}
        onApply={() => void handleApplyDataMode()}
        applying={applyingMode}
      />

      {/* ===== Mục tiêu hằng ngày ===== */}
      <section className="paper-card px-4 pt-3 pb-4">
        <p className="section-label">mục tiêu hằng ngày</p>
        <div className="mt-3 flex flex-col gap-5">
          <StepperField
            label="Học mỗi ngày"
            value={settings.dailyGoalMinutes}
            min={5}
            max={1440}
            step={5}
            unit="phút"
            presets={[15, 25, 45, 60]}
            onCommit={(n) => void updateSettings({ dailyGoalMinutes: n })}
          />
          <p className="type-caption text-muted -mt-3 text-center">
            Bấm − / + mỗi lần 5 phút, hoặc chạm vào số để nhập tùy ý.
          </p>
          <hr className="dashed-rule" />
          <StepperField
            label="Điểm mục tiêu TOEIC"
            value={settings.targetScore}
            min={10}
            max={990}
            step={5}
            unit="điểm"
            presets={[450, 600, 740]}
            onCommit={(n) => void updateSettings({ targetScore: n })}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="type-body">Ngày thi</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={settings.examDate}
                aria-label="Ngày thi"
                onChange={(e) => void updateSettings({ examDate: e.target.value })}
                className="num rounded-lg border border-rule bg-bg px-2 py-1.5 text-center text-[15px] outline-none"
              />
              {settings.examDate !== '' && (
                <button
                  type="button"
                  className="type-caption text-muted underline"
                  onClick={() => void updateSettings({ examDate: '' })}
                >
                  bỏ
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===== Nhịp học với đồng hồ (pomodoro) ===== */}
      <section className="paper-card px-4 pt-3 pb-4">
        <p className="section-label">nhịp học với đồng hồ</p>
        <div className="mt-3 flex flex-col gap-5">
          <StepperField
            label="Một phiên tập trung"
            value={settings.pomodoro.focusMin}
            min={1}
            max={240}
            step={5}
            unit="phút"
            presets={[15, 25, 45]}
            onCommit={(n) => void updateSettings({ pomodoro: { ...settings.pomodoro, focusMin: n } })}
          />
          <hr className="dashed-rule" />
          <StepperField
            label="Nghỉ giữa hai phiên"
            value={settings.pomodoro.breakMin}
            min={1}
            max={120}
            step={5}
            unit="phút"
            presets={[5, 10, 15]}
            onCommit={(n) => void updateSettings({ pomodoro: { ...settings.pomodoro, breakMin: n } })}
          />
        </div>
      </section>

      {/* ===== Nhắc lịch (C12) ===== */}
      <section className="paper-card px-4 pt-3 pb-4">
        <p className="section-label label-dot-coral">nhắc lịch</p>
        <div className="mt-3 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <span className="type-body flex items-center gap-2">
              <Icon name="bell" size={18} className="text-muted" />
              Thông báo hệ thống
            </span>
            {permission === 'default' && (
              <SecondaryButton className="px-3 py-2" onClick={() => void requestPermission()}>
                Cho phép nhắc
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
            {PERMISSION_TEXT[permission]}
          </p>
          {permission !== 'granted' && (
            <p className="type-caption rounded-lg border border-coral bg-pink-soft px-3 py-2">
              Khi chưa cấp quyền, lời nhắc vẫn hiện ngay trong app khi Sổ đang mở.
            </p>
          )}
          <hr className="dashed-rule" />
          <TimeField
            label="Nhắc bắt đầu học"
            value={settings.reminderTime}
            fallback="19:00"
            onCommit={(v) => void updateSettings({ reminderTime: v })}
          />
          <TimeField
            label="Nhắc ghi chú cuối ngày"
            value={noteTime}
            fallback={DEFAULT_NOTE_REMINDER}
            onCommit={(v) => {
              setNoteTime(v)
              saveNoteReminderTime(v)
            }}
          />
          <p className="type-caption text-muted">
            Bấm − / + để chỉnh 15 phút một lần. Lời nhắc chạy khi Sổ đang mở trên máy này.
          </p>
        </div>
      </section>

      {/* ===== Hỏi giờ học khi mở app (check-in) ===== */}
      <section className="paper-card px-4 pt-3 pb-4">
        <p className="section-label">hỏi giờ học khi mở app</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="type-body flex-1">
            Mỗi lần mở app, hỏi bạn vừa học bao nhiêu phút để lưu vào sổ.
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={settings.checkinEnabled}
            aria-label="Hỏi giờ học khi mở app"
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
        <p className="type-caption text-muted mt-2">
          Bỏ qua hoặc lưu đều được — Sổ không hỏi lại ngay trong 15 phút.
        </p>
      </section>

      {/* ===== Trợ lý hỏi đáp (RAG) ===== */}
      <section className="paper-card px-4 pt-3 pb-4">
        <p className="section-label label-dot-lavender">trợ lý hỏi đáp</p>
        <div className="mt-3">
          <TextField
            label="Địa chỉ máy trợ lý"
            value={settings.ragBaseUrl}
            placeholder="http://localhost:8000"
            hint="Trang Trò chuyện sẽ hỏi đáp với trợ lý tại địa chỉ này — bỏ trống nếu chưa dùng."
            onCommit={(v) => void updateSettings({ ragBaseUrl: v })}
          />
        </div>
      </section>

      {/* ===== Dữ liệu của bạn (E18) ===== */}
      <section className="paper-card px-4 pt-3 pb-4">
        <p className="section-label label-dot-mauve">dữ liệu của bạn</p>
        <div className="mt-3 flex flex-col gap-3">
          <PrimaryButton onClick={() => void handleBackup()} disabled={busy}>
            Sao lưu toàn bộ vào máy
          </PrimaryButton>
          <SecondaryButton onClick={() => fileRef.current?.click()} disabled={busy}>
            Khôi phục từ bản sao lưu
          </SecondaryButton>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => void handleImportFile(e)}
          />
          <hr className="dashed-rule" />
          <p className="type-caption text-muted">Tải một phần dữ liệu ra tệp riêng:</p>
          <div className="flex flex-wrap gap-2">
            <SecondaryButton
              className="px-3 py-2"
              disabled={busy}
              onClick={() => void handleExportMarkdown()}
            >
              sổ ghi chú (văn bản)
            </SecondaryButton>
            {csvExports.map((item) => (
              <SecondaryButton
                key={item.base}
                className="px-3 py-2"
                disabled={busy}
                onClick={() => void handleExportCsv(item.base, item.label, item.make)}
              >
                {item.label} (bảng)
              </SecondaryButton>
            ))}
          </div>
          <p className="type-caption text-muted">
            Bảng tải về mở thẳng được bằng Excel. Mọi ghi chú và thời gian học nằm ngay trên máy
            này — sao lưu thường xuyên để không mất dữ liệu nhé.
          </p>
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
        <p className="section-label label-dot-butter">cài sổ vào máy</p>
        <div className="mt-3 flex flex-col gap-3">
          {installEvt && (
            <PrimaryButton onClick={() => void handleInstall()}>Cài ngay vào máy</PrimaryButton>
          )}
          <ol className="ml-5 list-decimal space-y-1">
            {INSTALL_STEPS[platform].map((step) => (
              <li key={step} className="type-body">
                {step}
              </li>
            ))}
          </ol>
          <p className="type-caption text-muted">{OTHER_DEVICE_HINTS[platform]}</p>
          <p className="type-caption text-muted">
            Cài xong, Sổ mở như một ứng dụng riêng — học ở đâu cũng vào nhanh.
          </p>
        </div>
      </section>
    </div>
  )
}
