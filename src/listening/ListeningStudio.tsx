import React, { useState, useRef, useEffect, useCallback } from 'react'
import { TrackProvider, useTrack } from './trackStore'
import type { TrackLine } from './types'
import { SocialExportModal } from './SocialExport'
import { VOICEVOX_SPEAKERS, getSpeakerColor, searchSpeakers } from './voicevoxSpeakers'
import type { VvSpeaker, VvStyle } from './voicevoxSpeakers'
import { getJlptProfile } from './jlptConfig'
import './listening.css'

/* ── icons ── */
const Ic = ({ d, fill, size = 14, sw = 1.5, style }: { d: string; fill?: string; size?: number; sw?: number; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ?? 'none'}
    stroke={fill ? 'none' : 'currentColor'} strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d={d} />
  </svg>
)
const Icon = {
  play:    (p: { size?: number }) => <Ic {...p} d="M6 4l14 8-14 8z" fill="currentColor" />,
  pause:   (p: { size?: number }) => <Ic {...p} d="M7 4h4v16H7zM13 4h4v16h-4z" fill="currentColor" sw={0} />,
  stop:    (p: { size?: number }) => <Ic {...p} d="M6 6h12v12H6z" fill="currentColor" sw={0} />,
  plus:    (p: { size?: number }) => <Ic {...p} d="M12 5v14M5 12h14" />,
  trash:   (p: { size?: number }) => <Ic {...p} d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" />,
  chevL:   (p: { size?: number }) => <Ic {...p} d="M15 18l-6-6 6-6" />,
  chevR:   (p: { size?: number }) => <Ic {...p} d="M9 18l6-6-6-6" />,
  chevD:   (p: { size?: number }) => <Ic {...p} d="M6 9l6 6 6-6" />,
  search:  (p: { size?: number; style?: React.CSSProperties }) => <Ic {...p} d="M11 19a8 8 0 1 1 5.3-14M21 21l-4.7-4.7" />,
  spark:   (p: { size?: number }) => <Ic {...p} d="M12 2v6m0 8v6M2 12h6m8 0h6M5 5l4 4m6 6l4 4M5 19l4-4m6-6l4-4" />,
  mic:     (p: { size?: number }) => <Ic {...p} d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />,
  wave:    (p: { size?: number }) => <Ic {...p} d="M3 12h2M7 8v8M11 4v16M15 7v10M19 10v4M21 12h.01" />,
  clock:   (p: { size?: number }) => <Ic {...p} d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2" />,
  settings:(p: { size?: number }) => <Ic {...p} d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" sw={1.2} />,
  check:   (p: { size?: number }) => <Ic {...p} d="M20 6L9 17l-5-5" />,
  brain:   (p: { size?: number }) => <Ic {...p} d="M12 4a3 3 0 0 0-3 3 3 3 0 0 0-3 3 3 3 0 0 0 1 5 3 3 0 0 0 5 2 3 3 0 0 0 5-2 3 3 0 0 0 1-5 3 3 0 0 0-3-3 3 3 0 0 0-3-3z" />,
  globe:   (p: { size?: number }) => <Ic {...p} d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a14 14 0 0 1 0 20M12 2a14 14 0 0 0 0 20" sw={1.2} />,
  download:(p: { size?: number }) => <Ic {...p} d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />,
  upload:  (p: { size?: number }) => <Ic {...p} d="M12 4v12m0-12l-4 4m4-4l4 4M4 18h16" />,
  copy:    (p: { size?: number }) => <Ic {...p} d="M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1" />,
  share:   (p: { size?: number }) => <Ic {...p} d="M16 6l-4-4-4 4M12 2v14M20 14v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5" />,
  edit:    (p: { size?: number }) => <Ic {...p} d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />,
  film:    (p: { size?: number }) => <Ic {...p} d="M7 2v20M17 2v20M2 7h20M2 17h20" />,
  x:       (p: { size?: number }) => <Ic {...p} d="M18 6L6 18M6 6l12 12" />,
  image:   (p: { size?: number }) => <Ic {...p} d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5L19 17H5l3.5-4.5z" />,
  book:    (p: { size?: number }) => <Ic {...p} d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z" />,
  tag:     (p: { size?: number }) => <Ic {...p} d="M2 12V4a2 2 0 0 1 2-2h8l10 10-10 10zM7 7h.01" />,
  folder:  (p: { size?: number }) => <Ic {...p} d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  doc:     (p: { size?: number }) => <Ic {...p} d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6" />,
  volume:  (p: { size?: number }) => <Ic {...p} d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />,
  sliders: (p: { size?: number }) => <Ic {...p} d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4" />,
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

/* ── wave viz ── */
function WaveViz({ seed = 1, n = 28, height = 18, color }: { seed?: number; n?: number; height?: number; color?: string }) {
  const bars: React.ReactNode[] = []
  let h = seed * 7919
  for (let i = 0; i < n; i++) {
    h = (h * 9301 + 49297) % 233280
    const v = 0.3 + (h / 233280) * 0.7
    bars.push(<i key={i} style={{ height: `${v * 100}%` }} />)
  }
  return <div className="wave" style={{ height, color: color ?? 'currentColor' }}>{bars}</div>
}

/* ── line card ── */
function LineCard({ line, selected, playing, dense, showBN, onSelect, onPlay, onRemove, onSynthesize }: {
  line: TrackLine; selected: boolean; playing: boolean; dense: boolean; showBN: boolean;
  onSelect: () => void; onPlay: () => void; onRemove: () => void; onSynthesize: () => void;
}) {
  const sp = VOICEVOX_SPEAKERS.find(s => s.name === line.speaker)
  const color = sp ? getSpeakerColor(sp.name) : '#999'
  const borderColor = selected ? color : (playing ? 'var(--primary)' : 'var(--border)')
  const boxShadow = selected
    ? `0 0 0 3px color-mix(in oklch, ${color} 15%, transparent), var(--shadow-1)`
    : playing ? `0 0 0 3px color-mix(in oklch, var(--primary) 15%, transparent), var(--shadow-1)` : 'var(--shadow-1)'

  return (
    <div onClick={onSelect} className={`line-card${dense ? ' dense' : ''}`}
      style={{ borderColor, borderLeftColor: color, boxShadow }}>
      <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
        <div className="col" style={{ width: 32, alignItems: 'center', gap: 4, paddingTop: 2 }}>
          <span style={{ fontSize: 16 }}>{sp?.emoji ?? '🎙️'}</span>
          <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-4)' }}>{line.id.toUpperCase()}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row gap-2" style={{ marginBottom: 4 }}>
            <span className="speaker-chip" style={{ '--chip-color': color } as React.CSSProperties}>
              <span>{line.speaker}</span>
              <span style={{ opacity: 0.7 }}>· {line.style}</span>
            </span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)', marginLeft: 'auto' }}>
              {line.audio === 'ready' ? `${(line.duration ?? 0).toFixed(1)}s` : line.audio === 'rendering' ? '…' : line.audio === 'error' ? 'err' : 'queued'}
            </span>
            <span className={`status-dot${line.audio === 'rendering' ? ' warn' : line.audio === 'queued' ? ' off' : line.audio === 'error' ? ' err' : ''}`} style={{ width: 6, height: 6 }} />
          </div>
          <div className="jp" style={{ fontSize: dense ? 13 : 15, lineHeight: 1.5, color: 'var(--ink)', fontWeight: 450 }}>{line.jp}</div>
          {showBN && <div className="bn" style={{ fontSize: dense ? 11 : 12, color: 'var(--ink-3)', marginTop: 2 }}>{line.bn}</div>}
          {!dense && (
            <div className="row gap-3" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
              <button className="btn icon" style={{ width: 24, height: 24, borderRadius: '50%', padding: 0 }} onClick={e => { e.stopPropagation(); onPlay() }}>
                {playing ? <Icon.pause size={9} /> : <Icon.play size={9} />}
              </button>
              <WaveViz seed={parseInt(line.id.slice(1))} n={48} height={16} color={color} />
              <button className="btn xs" onClick={e => { e.stopPropagation(); onSynthesize() }} title="Synthesize"><Icon.mic size={10} /></button>
              <button className="btn xs ghost" onClick={e => { e.stopPropagation(); onRemove() }} title="Remove"><Icon.trash size={10} /></button>
              <div className="row gap-2" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginLeft: 'auto' }}>
                <Icon.clock size={10} />
                <span>pause <span className="mono">{line.pauseAfter}ms</span></span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── question card ── */
function QuestionCard({ q, showBN }: { q: Track['question']; showBN: boolean }) {
  return (
    <div className="panel" style={{ marginTop: 8, padding: 14, borderColor: 'var(--secondary-50)' }}>
      <div className="row gap-2" style={{ marginBottom: 8 }}>
        <span className="pill solid" style={{ background: 'var(--secondary)' }}>問</span>
        <span className="jp" style={{ fontSize: 14, fontWeight: 500 }}>{q.jp}</span>
      </div>
      <div className="col gap-2" style={{ marginTop: 6 }}>
        {q.options.map(o => (
          <div key={o.k} className="col gap-1" style={{
            padding: '7px 10px', borderRadius: 6,
            background: o.correct ? 'color-mix(in oklch, var(--success) 8%, var(--surface))' : 'var(--surface-2)',
            border: o.correct ? '1px solid color-mix(in oklch, var(--success) 30%, transparent)' : '1px solid var(--border)',
          }}>
            <div className="row gap-3">
              <span className="mono" style={{ width: 16, fontSize: 11, fontWeight: 600, color: o.correct ? 'var(--success)' : 'var(--ink-3)' }}>{o.k}</span>
              <span className="jp" style={{ flex: 1, fontSize: 13 }}>{o.jp}</span>
              {showBN && <span className="bn" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{o.bn}</span>}
              {o.correct && <Icon.check size={12} style={{ color: 'var(--success)' }} />}
            </div>
            {o.imageUrl && (
              <div style={{ paddingLeft: 28 }}>
                <img src={o.imageUrl} alt={`Option ${o.k}`} style={{ maxHeight: 90, maxWidth: '100%', borderRadius: 4, objectFit: 'cover', border: '1px solid var(--border)' }} />
              </div>
            )}
          </div>
        ))}
      </div>
      {showBN && (
        <div className="bn" style={{ marginTop: 10, padding: 9, background: 'var(--surface-2)', borderRadius: 6, fontSize: 11.5, color: 'var(--ink-2)' }}>
          <span style={{ fontWeight: 600 }}>ব্যাখ্যা · </span>{q.explanation_bn}
        </div>
      )}
    </div>
  )
}

/* ── transport bar ── */
function Transport() {
  const { playing, playhead, track, setPlayhead, playTrack, stopPlayback, pausePlayback, resumePlayback } = useTrack()
  const onScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setPlayhead(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)))
  }
  const totalDur = track.duration
  const lineMarks: number[] = []
  let acc = 0
  track.lines.forEach(l => {
    lineMarks.push(acc / totalDur)
    acc += (l.duration ?? 2.4) + l.pauseAfter / 1000
  })

  return (
    <div className="transport">
      <button className="btn icon" style={{ width: 32, height: 32, borderRadius: '50%', padding: 0 }} onClick={() => {
        if (playing) pausePlayback(); else playTrack()
      }}>
        {playing ? <Icon.pause size={11} /> : <Icon.play size={11} />}
      </button>
      <button className="btn sm icon" onClick={stopPlayback}><Icon.stop size={9} /></button>
      <div className="col" style={{ minWidth: 80 }}>
        <span className="mono" style={{ fontSize: 11, fontWeight: 600 }}>
          {fmtTime(playhead * track.duration)} / {fmtTime(track.duration)}
        </span>
        <span style={{ fontSize: 9.5, color: 'var(--ink-4)' }}>{playing ? 'playing' : 'paused'}</span>
      </div>
      <div onClick={onScrub} style={{ flex: 1, height: 24, display: 'flex', alignItems: 'center', position: 'relative', cursor: 'pointer' }}>
        <div style={{ position: 'absolute', inset: '11px 0 11px', background: 'var(--surface-3)', borderRadius: 999 }} />
        <div style={{ position: 'absolute', left: 0, width: `${playhead * 100}%`, top: 11, bottom: 11, background: 'var(--primary)', borderRadius: 999 }} />
        {lineMarks.map((p, i) => (
          <div key={i} style={{ position: 'absolute', left: `${p * 100}%`, top: 4, bottom: 4, width: 2, background: 'var(--ink-4)', opacity: 0.5 }} />
        ))}
        <div style={{ position: 'absolute', left: `${playhead * 100}%`, top: 2, bottom: 2, width: 2, background: 'var(--primary)', borderRadius: 1, boxShadow: '0 0 0 4px color-mix(in oklch, var(--primary) 20%, transparent)' }} />
      </div>
      <div className="row gap-2">
        <button className="btn sm" onClick={playTrack}><Icon.play size={10} /> Full track</button>
      </div>
    </div>
  )
}

/* ── inspector section ── */
function InspectorSection({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
      <div className="row gap-2" style={{ marginBottom: 10, justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', margin: 0 }}>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  )
}

/* ── slider ── */
function Slider({ value = 50, onChange, min = 0, max = 100, label, display }: { value?: number; onChange?: (v: number) => void; min?: number; max?: number; label: string; display: string }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="col gap-1">
      <div className="row gap-2" style={{ whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>{label}</span>
        <div style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-2)', fontWeight: 500 }}>{display}</span>
      </div>
      <div style={{ position: 'relative', height: 14, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', inset: '6px 0', background: 'var(--surface-3)', borderRadius: 999 }} />
        <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 2, background: 'var(--primary)', borderRadius: 999 }} />
        <input type="range" min={min} max={max} value={value} onChange={e => onChange?.(Number(e.target.value))}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }} />
        <div style={{ position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)', width: 12, height: 12, borderRadius: '50%', background: 'white', border: '1.5px solid var(--primary)', boxShadow: 'var(--shadow-1)' }} />
      </div>
    </div>
  )
}

/* ── left sidebar: VOICEVOX speaker browser ── */
function SpeakerBrowser({ leftOpen }: { leftOpen: boolean }) {
  const { selectedLineId, track, assignSpeaker } = useTrack()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'female' | 'male' | 'other'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const selectedLine = track.lines.find(l => l.id === selectedLineId)
  const filtered = VOICEVOX_SPEAKERS.filter(s => {
    if (filter !== 'all' && s.gender !== filter) return false
    if (!query) return true
    const q = query.toLowerCase()
    return s.name.toLowerCase().includes(q) || s.styles.some(st => st.name.toLowerCase().includes(q))
  })

  const handleAssign = (speaker: VvSpeaker, style: VvStyle) => {
    if (!selectedLine) return
    assignSpeaker(selectedLine.id, speaker.name, style.id, style.name)
  }

  if (!leftOpen) return null

  return (
    <aside style={{ width: 256, borderRight: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Search */}
      <div style={{ padding: '10px 10px 8px' }}>
        <div style={{ position: 'relative' }}>
          <Icon.search size={12} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--ink-3)' }} />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search speakers…"
            style={{ width: '100%', padding: '6px 8px 6px 26px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 12, outline: 'none', color: 'var(--ink)' }} />
        </div>
      </div>

      {/* Gender filters */}
      <div className="row gap-1" style={{ padding: '0 10px 8px' }}>
        {(['all', 'female', 'male', 'other'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            flex: 1, padding: '3px 0', borderRadius: 4, fontSize: 9.5, fontWeight: 600, cursor: 'pointer',
            textTransform: 'capitalize', border: filter === f ? '1.5px solid var(--primary)' : '1px solid var(--border)',
            background: filter === f ? 'var(--primary-50)' : 'var(--surface-2)', color: filter === f ? 'var(--primary)' : 'var(--ink-3)',
          }}>{f === 'all' ? 'All' : f === 'female' ? '♀' : f === 'male' ? '♂' : '?'}</button>
        ))}
      </div>

      {/* Speaker list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 8px 8px' }}>
        <div style={{ padding: '4px 6px', fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          VOICEVOX · {filtered.length} voices
        </div>
        {filtered.map(sp => {
          const isExpanded = expanded === sp.name
          const isAssigned = selectedLine?.speaker === sp.name
          return (
            <div key={sp.name} style={{ marginBottom: 2 }}>
              <button onClick={() => setExpanded(isExpanded ? null : sp.name)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px', borderRadius: 6, textAlign: 'left', cursor: 'pointer',
                background: isAssigned ? 'color-mix(in oklch, var(--primary) 8%, var(--surface-2))' : 'transparent',
                border: '1px solid transparent',
                font: 'inherit', fontSize: 12,
              }}>
                <span style={{ fontSize: 16 }}>{sp.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sp.name}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--ink-3)', marginTop: 1 }}>{sp.styles.length} styles · {sp.version}</div>
                </div>
                <Icon.chevD size={12} style={{ color: 'var(--ink-3)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>
              {isExpanded && (
                <div style={{ padding: '2px 4px 4px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                  {sp.styles.map(st => {
                    const isStyleAssigned = isAssigned && selectedLine?.style === st.name
                    return (
                      <button key={st.id} onClick={() => handleAssign(sp, st)} style={{
                        padding: '4px 6px', borderRadius: 4, fontSize: 10, cursor: 'pointer',
                        textAlign: 'left', font: 'inherit', fontWeight: isStyleAssigned ? 600 : 500,
                        border: isStyleAssigned ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                        background: isStyleAssigned ? 'var(--primary-50)' : 'var(--surface-2)',
                        color: isStyleAssigned ? 'var(--primary)' : 'var(--ink-2)',
                      }}>
                        {st.name} <span className="mono" style={{ fontSize: 9, color: 'var(--ink-4)' }}>#{st.id}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Assigned hint */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--ink-3)', textAlign: 'center' }}>
        {selectedLine ? (
          <span>Assign to <strong style={{ color: 'var(--ink)' }}>{selectedLine.id.toUpperCase()}</strong></span>
        ) : (
          <span>Select a line to assign speaker</span>
        )}
      </div>
    </aside>
  )
}

/* ── level switcher component ── */
function LevelSwitcher() {
  const { track, updateTrackMeta } = useTrack()
  const levels = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
  return (
    <div className="row gap-1" style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
      {levels.map(L => (
        <button key={L} onClick={() => updateTrackMeta({ level: L })} style={{
          flex: 1, padding: '4px 0', borderRadius: 5, fontSize: 11, fontWeight: 700,
          cursor: 'pointer', letterSpacing: '0.04em',
          border: L === track.level ? '1.5px solid var(--primary)' : '1px solid var(--border)',
          background: L === track.level ? 'var(--primary-50)' : 'var(--surface-2)',
          color: L === track.level ? 'var(--primary)' : 'var(--ink-3)',
        }}>{L}</button>
      ))}
    </div>
  )
}

/* ── main studio ── */
function Studio() {
  const {
    track, tweaks, selectedLineId, setSelectedLineId,
    playing, playhead, playingLineId,
    playLine, stopPlayback, playTrack, pausePlayback,
    updateLine, addLine, removeLine, synthesizeLine, synthesizeAll,
    aiGenerateQuestion, aiRewriteN4, aiTranslateBangla, aiSuggestDistractors,
    applyJlptDefaults,
    vvConnected, updateTrackMeta, updateQuestion, exportLineAudio, setTweaks, assignSpeaker,
    publishTrack, publishedTracks, loadPublishedTrack,
    theme, setTheme,
    customMondais, addCustomMondai, removeCustomMondai,
  } = useTrack()
  const [leftOpen, setLeftOpen] = useState(true)
  const [socialOpen, setSocialOpen] = useState(false)
  const [editLineJp, setEditLineJp] = useState('')
  const [editLineBn, setEditLineBn] = useState('')
  const [editQuestion, setEditQuestion] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [activeTab, setActiveTab] = useState<'inspector' | 'tweaks' | 'publish'>('inspector')
  const [publishModalOpen, setPublishModalOpen] = useState(false)
  const [justPublished, setJustPublished] = useState<{ id: string; url: string } | null>(null)
  const [newMondaiId, setNewMondaiId] = useState('')
  const [newMondaiLabel, setNewMondaiLabel] = useState('')

  const dense = tweaks.density === 'compact'
  const selectedLine = track.lines.find(l => l.id === selectedLineId) ?? track.lines[0]
  const readyCount = track.lines.filter(l => l.audio === 'ready').length
  const spColor = selectedLine ? getSpeakerColor(selectedLine.speaker) : '#999'

  useEffect(() => {
    if (selectedLine) {
      setEditLineJp(selectedLine.jp)
      setEditLineBn(selectedLine.bn)
    }
  }, [selectedLine?.id])

  const handleSaveLineEdit = () => {
    updateLine(selectedLine.id, { jp: editLineJp, bn: editLineBn })
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Header */}
      <header className="studio-header">
        <div className="row gap-2" style={{ minWidth: 210 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--primary)', color: 'white', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 11 }}>耳</div>
          <div className="col" style={{ lineHeight: 1.1 }}>
            <span style={{ fontWeight: 600, fontSize: 12.5 }}>Listening Studio</span>
            <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>Japanese Shikhi · Admin</span>
          </div>
        </div>
        <div style={{ height: 22, width: 1, background: 'var(--border)' }} />
        <div className="row gap-2" style={{ fontSize: 12, color: 'var(--ink-2)' }}>
          <span className="level-badge mono">{track.level}</span>
          <Icon.chevR size={12} />
          <span className="jp" style={{ color: 'var(--ink)', fontWeight: 500 }}>{track.title_jp}</span>
          <span className="pill" style={{ color: track.status === 'ready' ? 'var(--success)' : track.status === 'synthesizing' ? 'var(--accent)' : 'var(--ink-3)', borderColor: 'transparent', background: `color-mix(in oklch, ${track.status === 'ready' ? 'var(--success)' : track.status === 'synthesizing' ? 'var(--accent)' : 'var(--ink-4)'} 12%, var(--surface))` }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
            {track.status}
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <div className="row gap-2" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          <span className={`status-dot${vvConnected ? '' : ' off'}`} />
          <span>VOICEVOX <span className="mono" style={{ color: vvConnected ? 'var(--success)' : 'var(--accent)' }}>{vvConnected ? 'connected' : 'offline'}</span></span>
        </div>
        <div style={{ height: 22, width: 1, background: 'var(--border)' }} />
        <button className="btn sm" onClick={() => { if (playing) pausePlayback(); else playTrack(); }}>
          {playing ? <Icon.pause size={10} /> : <Icon.play size={10} />} Preview
        </button>
        <button className="btn sm" onClick={() => setSocialOpen(true)}><Icon.film size={10} /> Export</button>
        <button className="btn sm primary" disabled={track.status !== 'ready'} onClick={() => {
          const published = publishTrack()
          setJustPublished({ id: published.id, url: `${window.location.origin}/listen/${published.id}` })
          setPublishModalOpen(true)
        }}>
          <Icon.upload size={11} /> {track.status === 'published' ? 'Published' : 'Publish'}
        </button>
      </header>

      {/* Body */}
      <div className="studio-body" style={{ gridTemplateColumns: leftOpen ? '40px 256px 1fr 348px' : '40px 0px 1fr 348px', transition: 'grid-template-columns 0.25s ease' }}>
        {/* Toggle column */}
        <div style={{ borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', gap: 12, flexShrink: 0 }}>
          <button className="btn xs ghost" onClick={() => setLeftOpen(!leftOpen)} title="Toggle speaker panel">
            <Icon.chevR size={14} style={{ transform: leftOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <div style={{ writingMode: 'vertical-rl', fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Speakers</div>
        </div>

        {/* Left: Speaker browser */}
        <SpeakerBrowser leftOpen={leftOpen} />

        {/* Center: Editor */}
        <main className="studio-center">
          {/* JLPT-style scenario illustration card */}
          {!imgError && track.scenarioImage && (
            <div style={{ padding: '14px 18px 0', flexShrink: 0, background: 'var(--surface)' }}>
              <div style={{ display: 'flex', gap: 12, border: '1.5px solid var(--border-2)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface-2)' }}>
                <div style={{ width: 160, height: 120, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                  <img
                    src={track.scenarioImage}
                    alt="Scenario"
                    onError={() => setImgError(true)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent 60%, var(--surface-2) 100%)' }} />
                </div>
                <div className="col" style={{ flex: 1, padding: '10px 12px 10px 0', justifyContent: 'center', gap: 6 }}>
                  <div className="row gap-2" style={{ alignItems: 'center' }}>
                    <span className="level-badge mono" style={{ fontSize: 10 }}>{track.level}</span>
                    <span className="pill" style={{ fontSize: 10 }}>{track.mondai}</span>
                  </div>
                  <input className="jp"
                    value={track.title_jp}
                    onChange={e => updateTrackMeta({ title_jp: e.target.value })}
                    style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', background: 'transparent', border: 'none', width: '100%', outline: 'none' }} />
                  {tweaks.showBN && (
                    <input className="bn"
                      value={track.title_bn}
                      onChange={e => updateTrackMeta({ title_bn: e.target.value })}
                      style={{ fontSize: 12, color: 'var(--ink-2)', background: 'transparent', border: 'none', width: '100%', outline: 'none' }} />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Meta bar */}
          <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
            <div className="row gap-2" style={{ marginBottom: 4 }}>
              <span className="pill"><Icon.folder size={9} /> {track.mondai}</span>
              <span className="pill"><Icon.clock size={9} /> ~{fmtTime(track.duration)}</span>
              <span className="pill dot" style={{ color: readyCount === track.lines.length ? 'var(--success)' : 'var(--accent)' }}>
                {readyCount} / {track.lines.length} ready
              </span>
              <div style={{ flex: 1 }} />
              <button className="btn xs" onClick={() => addLine()}><Icon.plus size={10} /> Add</button>
              <button className="btn xs" onClick={synthesizeAll}><Icon.mic size={10} /> Synth all</button>
            </div>
            {!track.scenarioImage && (
              <div className="row gap-3" style={{ alignItems: 'flex-end' }}>
                <div className="col" style={{ flex: 1 }}>
                  <input className="jp" value={track.title_jp} onChange={e => updateTrackMeta({ title_jp: e.target.value })}
                    style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', background: 'transparent', border: 'none', borderBottom: '1px dashed var(--border)', width: '100%', outline: 'none', padding: '2px 0' }} />
                  {tweaks.showBN && (
                    <input className="bn" value={track.title_bn} onChange={e => updateTrackMeta({ title_bn: e.target.value })}
                      style={{ fontSize: 13, color: 'var(--ink-2)', background: 'transparent', border: 'none', borderBottom: '1px dashed var(--border)', width: '100%', outline: 'none', marginTop: 4, padding: '2px 0' }} />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Script */}
          <div style={{ flex: 1, overflow: 'auto', padding: dense ? '10px 18px 80px' : '14px 18px 80px' }}>
            <div className="col" style={{ gap: dense ? 4 : 8 }}>
              {track.lines.map(line => (
                <LineCard
                  key={line.id}
                  line={line}
                  selected={selectedLineId === line.id}
                  playing={playingLineId === line.id && playing}
                  dense={dense}
                  showBN={tweaks.showBN}
                  onSelect={() => setSelectedLineId(line.id)}
                  onPlay={() => playLine(line.id)}
                  onRemove={() => removeLine(line.id)}
                  onSynthesize={() => synthesizeLine(line.id)}
                />
              ))}
            </div>

            <div style={{ height: 18 }} />
            <div className="row gap-2" style={{ marginBottom: 6 }}>
              <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>02</span>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)' }}>設問 · Question</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span className="pill" style={{ background: 'var(--primary-50)', color: 'var(--primary)', borderColor: 'transparent' }}>
                <Icon.spark size={10} /> AI draft
              </span>
            </div>
            <QuestionCard q={track.question} showBN={tweaks.showBN} />
          </div>

          <Transport />
        </main>

        {/* Right: Inspector / Tweaks / Publish */}
        <aside className="studio-right">
          {/* Tab bar */}
          <div className="row" style={{ borderBottom: '1px solid var(--border)' }}>
            {([
              { key: 'inspector', label: 'Inspector', icon: Icon.settings },
              { key: 'tweaks', label: 'Tweaks', icon: Icon.sliders },
              { key: 'publish', label: 'Publish', icon: Icon.upload },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                borderBottom: activeTab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
                color: activeTab === t.key ? 'var(--primary)' : 'var(--ink-3)',
                background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
                <t.icon size={11} /> {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'inspector' && (
            <>
              {/* Level switcher */}
              <LevelSwitcher />

              <InspectorSection title="Selected line" right={<span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{selectedLine.id.toUpperCase()}</span>}>
                {/* Speaker assignment mini */}
                <div className="row gap-2" style={{ marginBottom: 8, padding: '6px 8px', background: 'var(--surface-2)', borderRadius: 6 }}>
                  <span style={{ fontSize: 18 }}>{VOICEVOX_SPEAKERS.find(s => s.name === selectedLine.speaker)?.emoji ?? '🎙️'}</span>
                  <div className="col" style={{ flex: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{selectedLine.speaker}</span>
                    <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{selectedLine.style} · ID {selectedLine.voiceId}</span>
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: spColor }} />
                </div>

                {/* Text editors */}
                <div className="col gap-2">
                  <div className="col gap-1">
                    <span style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>Japanese</span>
                    <textarea className="jp" value={editLineJp} onChange={e => setEditLineJp(e.target.value)} onBlur={handleSaveLineEdit} rows={2}
                      style={{ width: '100%', padding: 6, borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface-2)', font: 'inherit', fontSize: 12.5, lineHeight: 1.4, resize: 'vertical', outline: 'none', color: 'var(--ink)' }} />
              </div>
              {tweaks.showBN && (
                <div className="col gap-1">
                  <span style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>Bangla</span>
                  <textarea className="bn" value={editLineBn} onChange={e => setEditLineBn(e.target.value)} onBlur={handleSaveLineEdit} rows={2}
                    style={{ width: '100%', padding: 6, borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface-2)', font: 'inherit', fontSize: 12, lineHeight: 1.4, resize: 'vertical', outline: 'none', color: 'var(--ink)' }} />
                </div>
              )}
            </div>

            <div style={{ height: 10 }} />
            <Slider label="Speed" display={`${selectedLine.speed.toFixed(2)}×`}
              value={Math.round((selectedLine.speed - 0.5) / 1.5 * 100)} min={0} max={100}
              onChange={v => updateLine(selectedLine.id, { speed: 0.5 + (v / 100) * 1.5 })} />
            <Slider label="Pitch" display={`${selectedLine.pitch >= 0 ? '+' : ''}${selectedLine.pitch.toFixed(2)}`}
              value={Math.round((selectedLine.pitch + 0.15) / 0.3 * 100)} min={0} max={100}
              onChange={v => updateLine(selectedLine.id, { pitch: -0.15 + (v / 100) * 0.3 })} />
            <Slider label="Intonation" display={selectedLine.intonation.toFixed(1)}
              value={Math.round((selectedLine.intonation - 0.5) / 1.5 * 100)} min={0} max={100}
              onChange={v => updateLine(selectedLine.id, { intonation: 0.5 + (v / 100) * 1.5 })} />
            <Slider label="Volume" display={`${(selectedLine.volume * 100).toFixed(0)}%`}
              value={Math.round(selectedLine.volume * 100)} min={0} max={200}
              onChange={v => updateLine(selectedLine.id, { volume: v / 100 })} />
            <Slider label="Pause after" display={`${selectedLine.pauseAfter}ms`}
              value={Math.min(100, selectedLine.pauseAfter / 120)}
              onChange={v => updateLine(selectedLine.id, { pauseAfter: Math.round(v * 120) })} />

            <div style={{ height: 10 }} />
            <div className="row gap-2">
              <button className="btn sm" onClick={() => playLine(selectedLine.id)} style={{ flex: 1, justifyContent: 'center' }}>
                <Icon.play size={10} /> Preview
              </button>
              <button className="btn sm icon" onClick={() => synthesizeLine(selectedLine.id)} title="Synthesize"><Icon.mic size={11} /></button>
              <button className="btn sm icon" onClick={async () => {
                const blob = await exportLineAudio(selectedLine.id); if (!blob) return
                const url = URL.createObjectURL(blob); const a = document.createElement('a')
                a.href = url; a.download = `shikhi-line-${selectedLine.id}.wav`; a.click(); URL.revokeObjectURL(url)
              }} title="Download"><Icon.download size={11} /></button>
              <button className="btn sm icon" onClick={() => removeLine(selectedLine.id)} title="Remove"><Icon.trash size={11} /></button>
            </div>

            <div style={{ height: 10 }} />
            <button className="btn sm" onClick={applyJlptDefaults} style={{ width: '100%', justifyContent: 'center' }}>
              <Icon.check size={10} /> Apply {track.level} defaults
            </button>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', textAlign: 'center' }}>
              Speed {getJlptProfile(track.level).speed.toFixed(2)}× · Pause {getJlptProfile(track.level).pauseBetweenLines}ms
            </div>
          </InspectorSection>

          <InspectorSection title="Question editor" right={
            <button className="btn xs ghost" onClick={() => setEditQuestion(!editQuestion)}><Icon.edit size={10} /> {editQuestion ? 'Done' : 'Edit'}</button>
          }>
            {editQuestion ? (
              <div className="col gap-2">
                <div className="col gap-1">
                  <span style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 500 }}>Question (JP)</span>
                  <input className="jp" value={track.question.jp} onChange={e => updateQuestion({ jp: e.target.value })}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 12, outline: 'none', color: 'var(--ink)' }} />
                </div>
                {tweaks.showBN && (
                  <div className="col gap-1">
                    <span style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 500 }}>Explanation (BN)</span>
                    <textarea className="bn" value={track.question.explanation_bn} onChange={e => updateQuestion({ explanation_bn: e.target.value })} rows={2}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 11, outline: 'none', color: 'var(--ink)', resize: 'vertical' }} />
                  </div>
                )}
                <div className="col gap-2">
                  <span style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 500 }}>Options</span>
                  {track.question.options.map((o, i) => (
                    <div key={o.k} className="col gap-1">
                      <div className="row gap-2">
                        <span className="mono" style={{ fontSize: 11, color: o.correct ? 'var(--success)' : 'var(--ink-3)', fontWeight: 600 }}>{o.k}</span>
                        <input className="jp" value={o.jp} onChange={e => {
                          const next = [...track.question.options]; next[i] = { ...next[i], jp: e.target.value }; updateQuestion({ options: next })
                        }} style={{ flex: 1, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 11, outline: 'none', color: 'var(--ink)' }} />
                        <input type="checkbox" checked={!!o.correct} onChange={e => {
                          updateQuestion({ options: track.question.options.map((opt, idx) => ({ ...opt, correct: idx === i ? e.target.checked : false })) })
                        }} />
                      </div>
                      <div className="row gap-2" style={{ paddingLeft: 20 }}>
                        {o.imageUrl ? (
                          <img src={o.imageUrl} alt={o.k} style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover', border: '1px solid var(--border)' }} />
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: 4, background: 'var(--surface-3)', border: '1px dashed var(--border-2)', display: 'grid', placeItems: 'center' }}>
                            <Icon.image size={14} style={{ color: 'var(--ink-4)' }} />
                          </div>
                        )}
                        <input
                          placeholder="Image URL (optional)"
                          value={o.imageUrl || ''}
                          onChange={e => {
                            const next = [...track.question.options]; next[i] = { ...next[i], imageUrl: e.target.value || undefined }; updateQuestion({ options: next })
                          }}
                          style={{ flex: 1, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 10.5, outline: 'none', color: 'var(--ink-2)' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                {track.question.jp}
                <div style={{ marginTop: 4, color: 'var(--ink-4)' }}>{track.question.options.length} options · {track.question.options.filter(o => o.correct).length} correct</div>
              </div>
            )}
          </InspectorSection>

          <InspectorSection title="AI assist" right={<span className="pill" style={{ background: 'var(--primary-50)', color: 'var(--primary)', borderColor: 'transparent', fontSize: 9.5 }}>claude</span>}>
            <div className="col gap-1">
              {[
                { icon: Icon.spark, label: 'Generate question', sub: 'from current script', action: aiGenerateQuestion },
                { icon: Icon.brain, label: 'Rewrite for N4', sub: 'add 〜ておく / 〜たことがある', action: aiRewriteN4 },
                { icon: Icon.globe, label: 'Translate to Bangla', sub: `${track.lines.filter(l => l.bn === '— (translate)').length} pending`, action: aiTranslateBangla },
                { icon: Icon.book, label: 'Suggest distractors', sub: 'plausible wrong answers', action: aiSuggestDistractors },
              ].map((a, i) => (
                <button key={i} className="btn" style={{ justifyContent: 'flex-start', padding: '8px 10px', textAlign: 'left' }} onClick={a.action}>
                  <a.icon size={12} style={{ color: 'var(--primary)' }} />
                  <div className="col" style={{ alignItems: 'flex-start', lineHeight: 1.2, gap: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>{a.label}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{a.sub}</span>
                  </div>
                </button>
              ))}
            </div>
          </InspectorSection>

              <InspectorSection title="Publish checklist">
                <div className="col gap-1">
                  {[
                    { ok: !!track.title_jp, label: 'Title (JP / BN)' },
                    { ok: track.lines.length > 0, label: `Script · ${track.lines.length} lines` },
                    { ok: track.lines.every(l => l.speaker && l.voiceId > 0), label: 'Speakers assigned' },
                    { ok: readyCount === track.lines.length, label: `Audio · ${track.lines.length - readyCount} queued` },
                    { ok: !!track.question.jp, label: 'Question + explanation' },
                    { ok: track.status !== 'draft', label: 'Reviewed' },
                  ].map((it, i) => (
                    <div key={i} className="row gap-2" style={{ fontSize: 11.5 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 4, background: it.ok ? 'var(--success)' : 'var(--surface-2)', border: it.ok ? 'none' : '1.5px solid var(--border-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        {it.ok && <Icon.check size={9} style={{ color: 'white' }} />}
                      </div>
                      <span style={{ color: it.ok ? 'var(--ink-3)' : 'var(--ink)', textDecorationLine: it.ok ? 'line-through' : 'none', textDecorationColor: 'var(--ink-4)' }}>{it.label}</span>
                    </div>
                  ))}
                </div>
              </InspectorSection>
            </>
          )}

          {activeTab === 'tweaks' && (
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto', flex: 1 }}>
              {/* Length selector — vibrant! */}
              <div className="col gap-2">
                <span style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Track length</span>
                <div className="row gap-2">
                  {(['short', 'medium', 'long'] as const).map(len => {
                    const active = tweaks.length === len
                    const colors = {
                      short: { bg: '#e6f4ea', border: '#34a853', text: '#137333', glow: '0 0 0 3px rgba(52,168,83,0.15)' },
                      medium: { bg: '#e8f0fe', border: '#4285f4', text: '#185abc', glow: '0 0 0 3px rgba(66,133,244,0.15)' },
                      long: { bg: '#fce8e6', border: '#ea4335', text: '#b31412', glow: '0 0 0 3px rgba(234,67,53,0.15)' },
                    }
                    const c = colors[len]
                    return (
                      <button key={len} onClick={() => setTweaks(p => ({ ...p, length: len }))} style={{
                        flex: 1, padding: '10px 4px', borderRadius: 8, cursor: 'pointer', border: active ? `2px solid ${c.border}` : '1.5px solid var(--border)',
                        background: active ? c.bg : 'var(--surface-2)', color: active ? c.text : 'var(--ink-3)',
                        boxShadow: active ? c.glow : 'none', transition: 'all 0.15s',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      }}>
                        <span style={{ fontSize: 16 }}>{len === 'short' ? '🌱' : len === 'medium' ? '🌿' : '🌳'}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{len}</span>
                        <span style={{ fontSize: 9, opacity: 0.8 }}>{len === 'short' ? '~30s' : len === 'medium' ? '~60s' : '~2m'}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Mondai type */}
              <div className="col gap-2">
                <span style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Mondai type</span>
                <div className="row gap-1" style={{ flexWrap: 'wrap' }}>
                  {([1, 2, 3, 4, 5] as const).map(m => {
                    const labels: Record<number, string> = { 1: '課題', 2: 'ポイント', 3: '概要', 4: '即応', 5: '統合' }
                    const active = tweaks.mondai === m
                    return (
                      <button key={m} onClick={() => setTweaks(p => ({ ...p, mondai: m }))} style={{
                        padding: '5px 10px', borderRadius: 5, fontSize: 11, fontWeight: active ? 700 : 500, cursor: 'pointer',
                        border: active ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                        background: active ? 'var(--primary-50)' : 'var(--surface-2)',
                        color: active ? 'var(--primary)' : 'var(--ink-3)',
                      }}>もんだい{m} · {labels[m]}</button>
                    )
                  })}
                  {customMondais.map(cm => {
                    const active = tweaks.mondai === cm.id
                    return (
                      <button key={cm.id} onClick={() => setTweaks(p => ({ ...p, mondai: cm.id }))} style={{
                        padding: '5px 10px', borderRadius: 5, fontSize: 11, fontWeight: active ? 700 : 500, cursor: 'pointer',
                        border: active ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                        background: active ? 'var(--primary-50)' : 'var(--surface-2)',
                        color: active ? 'var(--primary)' : 'var(--ink-3)',
                      }}>
                        もんだい{cm.id} · {cm.label}
                        <span onClick={e => { e.stopPropagation(); removeCustomMondai(cm.id) }} style={{ marginLeft: 6, color: 'var(--ink-4)', cursor: 'pointer', fontSize: 10 }}>×</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Custom Mondai Manager */}
              <div className="col gap-2">
                <span style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Add custom mondai</span>
                <div className="row gap-2">
                  <input
                    type="number"
                    placeholder="#"
                    value={newMondaiId}
                    onChange={e => setNewMondaiId(e.target.value)}
                    style={{ width: 50, padding: '5px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 11, outline: 'none', color: 'var(--ink)' }}
                  />
                  <input
                    placeholder="Label (e.g. 図表理解)"
                    value={newMondaiLabel}
                    onChange={e => setNewMondaiLabel(e.target.value)}
                    style={{ flex: 1, padding: '5px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 11, outline: 'none', color: 'var(--ink)' }}
                  />
                  <button className="btn sm" onClick={() => {
                    const id = parseInt(newMondaiId)
                    if (!id || id <= 0 || !newMondaiLabel.trim()) return
                    addCustomMondai({ id, label: newMondaiLabel.trim() })
                    setNewMondaiId('')
                    setNewMondaiLabel('')
                  }}><Icon.plus size={10} /> Add</button>
                </div>
              </div>

              {/* Display density */}
              <div className="col gap-2">
                <span style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Display</span>
                <div className="row gap-2">
                  {(['compact', 'comfortable'] as const).map(d => (
                    <button key={d} onClick={() => setTweaks(p => ({ ...p, density: d }))} style={{
                      flex: 1, padding: '6px 0', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      border: tweaks.density === d ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                      background: tweaks.density === d ? 'var(--primary-50)' : 'var(--surface-2)',
                      color: tweaks.density === d ? 'var(--primary)' : 'var(--ink-3)', textTransform: 'capitalize',
                    }}>{d}</button>
                  ))}
                </div>
              </div>

              {/* Theme */}
              <div className="col gap-2">
                <span style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Theme</span>
                <div className="row gap-2">
                  {(['brand', 'dark', 'zen'] as const).map(t => (
                    <button key={t} onClick={() => setTheme(t)} style={{
                      flex: 1, padding: '6px 0', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      border: theme === t ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                      background: theme === t ? 'var(--primary-50)' : 'var(--surface-2)',
                      color: theme === t ? 'var(--primary)' : 'var(--ink-3)', textTransform: 'capitalize',
                    }}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Show BN */}
              <label className="row gap-2" style={{ alignItems: 'center', cursor: 'pointer', padding: '6px 8px', background: 'var(--surface-2)', borderRadius: 6, border: '1px solid var(--border)' }}>
                <input type="checkbox" checked={tweaks.showBN} onChange={e => setTweaks(p => ({ ...p, showBN: e.target.checked }))} style={{ cursor: 'pointer' }} />
                <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--ink)' }}>Show Bangla translations</span>
              </label>

              {/* Status reset */}
              <div className="col gap-2">
                <span style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Status</span>
                <div className="row gap-2">
                  <button className="btn sm" onClick={() => setTweaks(p => ({ ...p, status: 'draft' }))} style={{ flex: 1 }}>Reset to Draft</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'publish' && (
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto', flex: 1 }}>
              <div className="col gap-2" style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>Published tracks</span>
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{publishedTracks.length} track{publishedTracks.length !== 1 ? 's' : ''} saved locally</span>
              </div>

              <div className="col gap-2" style={{ flex: 1, overflow: 'auto' }}>
                {publishedTracks.length === 0 && (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>
                    No published tracks yet.<br />Publish a track to see it here.
                  </div>
                )}
                {publishedTracks.map(pt => (
                  <div key={pt.id} style={{ padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => loadPublishedTrack(pt.id)}>
                    <div className="row gap-2" style={{ alignItems: 'center', marginBottom: 4 }}>
                      <span className="level-badge mono" style={{ fontSize: 9 }}>{pt.track.level}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pt.track.title_jp}</span>
                    </div>
                    <div className="row gap-2" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                      <span>{pt.track.lines.length} lines</span>
                      <span>·</span>
                      <span>{fmtTime(pt.track.duration)}</span>
                      <span>·</span>
                      <span className="mono">{pt.id}</span>
                    </div>
                  </div>
                ))}
              </div>

              <button className="btn sm primary" disabled={track.status !== 'ready'} onClick={() => {
                const published = publishTrack()
                setJustPublished({ id: published.id, url: `${window.location.origin}/listen/${published.id}` })
                setPublishModalOpen(true)
              }} style={{ width: '100%', justifyContent: 'center' }}>
                <Icon.upload size={11} /> Publish current track
              </button>
            </div>
          )}
        </aside>
      </div>

      {publishModalOpen && justPublished && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setPublishModalOpen(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border-2)', boxShadow: 'var(--shadow-3)', maxWidth: 420, width: '100%', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <div className="row gap-2" style={{ alignItems: 'center' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--success)', display: 'grid', placeItems: 'center' }}>
                  <Icon.check size={16} style={{ color: 'white' }} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Track Published!</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>Saved locally and ready to share</div>
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 22px' }}>
              <div className="col gap-2">
                <span style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Track preview</span>
                <div style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div className="row gap-2" style={{ alignItems: 'center', marginBottom: 6 }}>
                    <span className="level-badge mono" style={{ fontSize: 9 }}>{track.level}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title_jp}</span>
                  </div>
                  <div className="row gap-2" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
                    <span>{track.lines.length} lines</span>
                    <span>·</span>
                    <span>{fmtTime(track.duration)}</span>
                    <span>·</span>
                    <span>{readyCount} audio ready</span>
                  </div>
                </div>

                <span style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginTop: 4 }}>Share link</span>
                <div className="row gap-2">
                  <input readOnly value={justPublished.url} style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 11.5, color: 'var(--ink-2)', outline: 'none' }} />
                  <button className="btn sm" onClick={() => {
                    navigator.clipboard.writeText(justPublished.url)
                  }}><Icon.copy size={10} /> Copy</button>
                </div>

                <span style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginTop: 4 }}>Track ID</span>
                <div className="row gap-2">
                  <input readOnly value={justPublished.id} style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 11.5, color: 'var(--ink-2)', outline: 'none' }} />
                  <button className="btn sm" onClick={() => {
                    navigator.clipboard.writeText(justPublished.id)
                  }}><Icon.copy size={10} /> Copy</button>
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 22px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn sm ghost" onClick={() => setPublishModalOpen(false)}>Close</button>
              <button className="btn sm primary" onClick={() => {
                navigator.clipboard.writeText(justPublished.url)
                setPublishModalOpen(false)
              }}><Icon.check size={10} /> Copy & Close</button>
            </div>
          </div>
        </div>
      )}

      {socialOpen && <SocialExportModal track={track} onClose={() => setSocialOpen(false)} />}
    </div>
  )
}

export function ListeningStudio() {
  return (
    <TrackProvider>
      <ListeningStudioInner />
    </TrackProvider>
  )
}

function ListeningStudioInner() {
  const { theme } = useTrack()
  return (
    <div className="studio-wrap" data-theme={theme} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Studio />
      </div>
    </div>
  )
}
