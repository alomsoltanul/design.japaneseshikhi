import { useCallback, useEffect, useState } from 'react'
import { buildReel, type ReelProgress } from './reel/buildReel'
import type { VoiceSettings } from './reel/voiceSettings'
import type { Aspect } from './reel/render'
import type { LevelQuestion } from './levels'
import type { TtsProvider } from '@/listening/types'

const BRAND = '#E63946'
const PREFS_KEY = 'js-reel-export-prefs-v2'

type SpeedPreset = 'slow' | 'normal' | 'fast'

interface ExportPrefs {
  aspect: Aspect
  speed: SpeedPreset
  transitions: boolean
  ticks: boolean
  /** TTS backend. 'azure' works on prod HTTPS; 'voicevox' is localhost-only. */
  provider: TtsProvider
}

const defaultProvider = (): TtsProvider => {
  if (typeof window === 'undefined') return 'azure'
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
  return isLocal ? 'voicevox' : 'azure'
}

const DEFAULT_PREFS: ExportPrefs = { aspect: 'reel', speed: 'normal', transitions: true, ticks: true, provider: defaultProvider() }

function loadPrefs(): ExportPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}
function savePrefs(p: ExportPrefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)) } catch { /* ignore */ }
}

/** Multiplier applied to settings.speed when the user picks a SpeedPreset. */
const SPEED_MULT: Record<SpeedPreset, number> = { slow: 0.88, normal: 1.0, fast: 1.15 }

/* One-click animated reel (voice + scenes) → MP4 (WebCodecs) or WebM fallback.
   Pre-export picker lets the user choose aspect (9:16 / 1:1) and voice speed.
   Requires the VOICEVOX app for narration. */
export function ReelButton({
  question,
  level,
  test,
  mondai,
  settings,
}: {
  question: LevelQuestion
  level: string
  test: number
  mondai: number
  settings: VoiceSettings
}) {
  const [busy, setBusy] = useState(false)
  const [prog, setProg] = useState<ReelProgress | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [video, setVideo] = useState<{ blob: Blob; ext: string } | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [prefs, setPrefs] = useState<ExportPrefs>(loadPrefs)

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const base = `${level.toLowerCase()}_t${test}_m${mondai}_q${question.question_number}_reel_${prefs.aspect === 'square' ? '1x1' : '9x16'}`

  const run = useCallback(async () => {
    setBusy(true)
    setErr(null)
    setProg({ stage: 'voice', ratio: 0, note: 'Starting…' })
    try {
      const adjusted: VoiceSettings = { ...settings, provider: prefs.provider, speed: settings.speed * SPEED_MULT[prefs.speed] }
      const { video: blob, ext } = await buildReel(question, level, adjusted, setProg, {
        aspect: prefs.aspect,
        noTransitionSfx: !prefs.transitions,
        noCountdownTicks: !prefs.ticks,
      })
      setVideo({ blob, ext })
      setPreviewUrl(URL.createObjectURL(blob))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
      setProg(null)
    }
  }, [question, level, settings, prefs])

  const openPicker = () => { setPickerOpen(true); setErr(null) }
  const startBuild = () => { setPickerOpen(false); savePrefs(prefs); void run() }

  const downloadVideo = () => {
    if (!video) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(video.blob)
    a.download = `${base}.${video.ext}`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const close = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setVideo(null)
  }

  const pct = prog ? Math.round(prog.ratio * 100) : 0
  const label = busy
    ? prog?.stage === 'voice'
      ? prog.note ?? 'Voice…'
      : `Rendering ${pct}%`
    : '🎬 Build Reel'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button
        onClick={openPicker}
        disabled={busy}
        title="Pick aspect + speed, then build the animated reel"
        style={{
          background: '#111827', color: '#fff', border: `1px solid ${BRAND}`, borderRadius: 8,
          padding: '8px 16px', fontWeight: 700, cursor: busy ? 'progress' : 'pointer', whiteSpace: 'nowrap', minWidth: 150,
        }}
      >
        {label}
      </button>
      {err && <span style={{ fontSize: 11, color: BRAND, maxWidth: 220, textAlign: 'right' }}>{err}</span>}

      {pickerOpen && (
        <ExportPicker
          prefs={prefs}
          onChange={setPrefs}
          onCancel={() => setPickerOpen(false)}
          onBuild={startBuild}
        />
      )}

      {previewUrl && (
        <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <video
              src={previewUrl}
              controls
              autoPlay
              loop
              style={{
                height: '78vh',
                aspectRatio: prefs.aspect === 'square' ? '1 / 1' : '9 / 16',
                borderRadius: 16,
                background: '#000',
                boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              }}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={downloadVideo} style={btn(BRAND, BRAND)}>⬇ Download {video?.ext.toUpperCase()}</button>
              <button onClick={close} style={btn('transparent', 'rgba(255,255,255,0.3)')}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ExportPicker({
  prefs, onChange, onCancel, onBuild,
}: {
  prefs: ExportPrefs
  onChange: (p: ExportPrefs) => void
  onCancel: () => void
  onBuild: () => void
}) {
  const setA = (aspect: Aspect) => onChange({ ...prefs, aspect })
  const setS = (speed: SpeedPreset) => onChange({ ...prefs, speed })
  const setT = (transitions: boolean) => onChange({ ...prefs, transitions })
  const setK = (ticks: boolean) => onChange({ ...prefs, ticks })
  const setP = (provider: TtsProvider) => onChange({ ...prefs, provider })

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 420, maxWidth: '90vw', background: '#0f111a', color: '#fff',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 22,
          boxShadow: '0 30px 80px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', gap: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🎬</span>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Reel export options</h3>
        </div>

        <Section title="Voice engine">
          <div style={{ display: 'flex', gap: 8 }}>
            <Pill active={prefs.provider === 'azure'} onClick={() => setP('azure')}>☁️ Azure Neural</Pill>
            <Pill active={prefs.provider === 'voicevox'} onClick={() => setP('voicevox')}>🖥️ VOICEVOX (local)</Pill>
          </div>
          <div style={{ fontSize: 11, opacity: 0.55, marginTop: 6 }}>
            Azure works from the live site. VOICEVOX only works when running <code>npm run dev</code> locally with the VOICEVOX app open.
          </div>
        </Section>

        <Section title="Aspect ratio">
          <div style={{ display: 'flex', gap: 10 }}>
            <Choice active={prefs.aspect === 'reel'} onClick={() => setA('reel')}>
              <div style={{ width: 28, height: 50, border: '2px solid currentColor', borderRadius: 4 }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>Reel · 9:16</div>
                <div style={{ fontSize: 11, opacity: 0.65 }}>TikTok · Reels · Shorts (1080×1920)</div>
              </div>
            </Choice>
            <Choice active={prefs.aspect === 'square'} onClick={() => setA('square')}>
              <div style={{ width: 44, height: 44, border: '2px solid currentColor', borderRadius: 4 }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>Square · 1:1</div>
                <div style={{ fontSize: 11, opacity: 0.65 }}>Instagram feed · X (1080×1080)</div>
              </div>
            </Choice>
          </div>
        </Section>

        <Section title="Voice speed">
          <div style={{ display: 'flex', gap: 8 }}>
            <Pill active={prefs.speed === 'slow'} onClick={() => setS('slow')}>🐢 Slow · 0.88×</Pill>
            <Pill active={prefs.speed === 'normal'} onClick={() => setS('normal')}>🎯 Normal · 1.0×</Pill>
            <Pill active={prefs.speed === 'fast'} onClick={() => setS('fast')}>⚡ Fast · 1.15×</Pill>
          </div>
          <div style={{ fontSize: 11, opacity: 0.55, marginTop: 6 }}>
            Multiplies the JLPT-level speed preset (currently {`${(prefs.speed === 'normal' ? 1 : prefs.speed === 'slow' ? 0.88 : 1.15).toFixed(2)}×`}).
          </div>
        </Section>

        <Section title="Sound design">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Toggle checked={prefs.transitions} onChange={setT} label="Scene transition whooshes" hint="Subtle filtered-noise sweeps at each scene change." />
            <Toggle checked={prefs.ticks} onChange={setK} label="Countdown ticks" hint="1Hz beeps during the think timer; final tick is a brighter 'go'." />
          </div>
        </Section>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button onClick={onCancel} style={btn('transparent', 'rgba(255,255,255,0.25)')}>Cancel</button>
          <button onClick={onBuild} style={btn(BRAND, BRAND)}>Build reel →</button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>{title}</div>
      {children}
    </div>
  )
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
        background: active ? `${BRAND}22` : 'rgba(255,255,255,0.04)',
        color: active ? '#fff' : 'rgba(255,255,255,0.85)',
        border: `1.5px solid ${active ? BRAND : 'rgba(255,255,255,0.12)'}`,
        borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, fontSize: 13, fontWeight: 700,
        background: active ? BRAND : 'rgba(255,255,255,0.06)',
        color: active ? '#fff' : 'rgba(255,255,255,0.8)',
        border: `1.5px solid ${active ? BRAND : 'rgba(255,255,255,0.12)'}`,
        borderRadius: 99, padding: '9px 6px', cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', padding: '6px 0' }}>
      <span
        role="switch"
        aria-checked={checked}
        onClick={e => { e.preventDefault(); onChange(!checked) }}
        style={{
          width: 36, height: 22, borderRadius: 99, position: 'relative', flexShrink: 0,
          background: checked ? BRAND : 'rgba(255,255,255,0.18)',
          transition: 'background 0.15s',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: checked ? 17 : 3, width: 16, height: 16, borderRadius: '50%',
          background: '#fff', transition: 'left 0.15s',
        }} />
      </span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ display: 'none' }} />
      <span>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2 }}>{hint}</div>}
      </span>
    </label>
  )
}

function btn(bg: string, border: string): React.CSSProperties {
  return { background: bg, color: '#fff', border: `1px solid ${border}`, borderRadius: 10, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' }
}

export default ReelButton
