import { useCallback, useEffect, useState } from 'react'
import { buildReel, type ReelProgress } from './reel/buildReel'
import type { VoiceSettings } from './reel/voiceSettings'
import type { LevelQuestion } from './levels'

const BRAND = '#E63946'

/* One-click animated reel (voice + scenes) → MP4 (WebCodecs) or WebM fallback.
   Previews the result in-page. Requires the VOICEVOX app for narration. */
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

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const base = `${level.toLowerCase()}_t${test}_m${mondai}_q${question.question_number}_reel`

  const run = useCallback(async () => {
    setBusy(true)
    setErr(null)
    setProg({ stage: 'voice', ratio: 0, note: 'Starting…' })
    try {
      const { video: blob, ext } = await buildReel(question, level, settings, setProg)
      setVideo({ blob, ext })
      setPreviewUrl(URL.createObjectURL(blob))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
      setProg(null)
    }
  }, [question, level, settings])

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
        onClick={run}
        disabled={busy}
        title="Needs the VOICEVOX app running for the Japanese voice"
        style={{
          background: '#111827', color: '#fff', border: `1px solid ${BRAND}`, borderRadius: 8,
          padding: '8px 16px', fontWeight: 700, cursor: busy ? 'progress' : 'pointer', whiteSpace: 'nowrap', minWidth: 150,
        }}
      >
        {label}
      </button>
      {err && <span style={{ fontSize: 11, color: BRAND, maxWidth: 220, textAlign: 'right' }}>{err}</span>}

      {previewUrl && (
        <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <video src={previewUrl} controls autoPlay loop style={{ height: '78vh', aspectRatio: '9 / 16', borderRadius: 16, background: '#000', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} />
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

function btn(bg: string, border: string): React.CSSProperties {
  return { background: bg, color: '#fff', border: `1px solid ${border}`, borderRadius: 10, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' }
}

export default ReelButton
