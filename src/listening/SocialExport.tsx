import React, { useState, useCallback } from 'react'
import { toPng } from 'html-to-image'
import { useTrack } from './trackStore'
import type { Track, TrackLine } from './types'
import { VOICEVOX_SPEAKERS, getSpeakerColor } from './voicevoxSpeakers'

/* ═══════════════════════════════════════════════
   Social Export Card Components
   Renders beautiful platform-optimized graphics
   ═══════════════════════════════════════════════ */

function getSpeakerMeta(speakerName: string) {
  const sp = VOICEVOX_SPEAKERS.find(s => s.name === speakerName)
  const color = getSpeakerColor(speakerName)
  return {
    label: speakerName,
    color,
    bg: color + '18',
    emoji: sp?.emoji ?? '🎙️',
  }
}

const PLATFORM_PRESETS = {
  ig_post:   { w: 1080, h: 1080, label: 'Instagram Post',   ratio: '1:1',   icon: '📷' },
  ig_story:  { w: 1080, h: 1920, label: 'Instagram Story',  ratio: '9:16',  icon: '📱' },
  ig_reel:   { w: 1080, h: 1920, label: 'Instagram Reel',   ratio: '9:16',  icon: '🎬' },
  tiktok:    { w: 1080, h: 1920, label: 'TikTok',           ratio: '9:16',  icon: '🎵' },
  yt_short:  { w: 1080, h: 1920, label: 'YouTube Short',    ratio: '9:16',  icon: '▶️' },
  twitter:   { w: 1200, h: 675,  label: 'X / Twitter',      ratio: '16:9',  icon: '🐦' },
  fb_post:   { w: 1200, h: 630,  label: 'Facebook',         ratio: '1.9:1', icon: '👍' },
}

type PlatformKey = keyof typeof PLATFORM_PRESETS

/* ── waveform svg ── */
function WaveformSVG({ color = '#E63946', bars = 40, seed = 1 }: { color?: string; bars?: number; seed?: number }) {
  const arr: number[] = []
  let h = seed * 7919
  for (let i = 0; i < bars; i++) {
    h = (h * 9301 + 49297) % 233280
    arr.push(0.25 + (h / 233280) * 0.75)
  }
  const gap = 2
  const barW = (100 - gap * (bars - 1)) / bars
  return (
    <svg viewBox="0 0 100 24" width="100%" height="24" preserveAspectRatio="none">
      {arr.map((v, i) => (
        <rect
          key={i}
          x={i * (barW + gap)}
          y={12 - v * 12}
          width={Math.max(barW, 0.5)}
          height={v * 24}
          rx={1}
          fill={color}
          opacity={0.7 + (i % 3) * 0.1}
        />
      ))}
    </svg>
  )
}

/* ── single dialogue bubble for card ── */
function DialogueBubble({ line, idx }: { line: TrackLine; idx: number }) {
  const meta = getSpeakerMeta(line.speaker)
  const isNarrator = line.speaker === '春日部つむぎ'
  return (
    <div style={{
      display: 'flex',
      flexDirection: isNarrator ? 'row' : (idx % 2 === 0 ? 'row' : 'row-reverse'),
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: 10,
      width: '100%',
    }}>
      {/* Avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: meta.bg,
        color: meta.color,
        display: 'grid', placeItems: 'center',
        fontSize: 14, flexShrink: 0,
        border: `2px solid ${meta.color}20`,
      }}>
        {meta.emoji}
      </div>
      {/* Bubble */}
      <div style={{
        background: isNarrator ? '#1D355715' : meta.bg,
        border: `1px solid ${isNarrator ? '#1D355730' : meta.color + '25'}`,
        borderRadius: isNarrator ? 8 : 12,
        padding: '8px 12px',
        maxWidth: '78%',
        position: 'relative',
      }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: meta.color, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {meta.label}
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a', lineHeight: 1.45, fontFamily: "'Noto Sans JP', sans-serif" }}>
          {line.jp}
        </div>
        <div style={{ fontSize: 10, color: '#797a7f', marginTop: 3, lineHeight: 1.35, fontFamily: "'Noto Sans Bengali', sans-serif" }}>
          {line.bn}
        </div>
        {/* Mini waveform */}
        <div style={{ marginTop: 6, opacity: 0.6 }}>
          <WaveformSVG color={meta.color} bars={24} seed={idx + 1} />
        </div>
      </div>
    </div>
  )
}

/* ── card: conversation preview ── */
function ConversationCard({
  track,
  lines,
  platform,
  themeColor = '#E63946',
  bgStyle = 'gradient',
}: {
  track: Track
  lines: TrackLine[]
  platform: PlatformKey
  themeColor?: string
  bgStyle?: 'gradient' | 'dark' | 'zen' | 'minimal'
}) {
  const preset = PLATFORM_PRESETS[platform]
  const isVertical = preset.h > preset.w

  const bgMap = {
    gradient: `linear-gradient(160deg, ${themeColor}08 0%, #ffffff 40%, #fafaf7 100%)`,
    dark: `linear-gradient(160deg, #0e0f12 0%, #16181d 100%)`,
    zen: `linear-gradient(160deg, #f5f1e8 0%, #fbf8f1 100%)`,
    minimal: '#ffffff',
  }
  const textColor = bgStyle === 'dark' ? '#f3f4f7' : '#1a1a1a'
  const subColor = bgStyle === 'dark' ? '#8a8f9a' : '#797a7f'
  const cardBg = bgStyle === 'dark' ? '#ffffff10' : '#ffffff'
  const cardBorder = bgStyle === 'dark' ? '#ffffff15' : '#e4e2db'

  return (
    <div
      id={`card-${platform}`}
      style={{
        width: preset.w,
        height: preset.h,
        background: bgMap[bgStyle],
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Decorative top bar */}
      <div style={{
        height: 4,
        background: `linear-gradient(90deg, ${themeColor}, ${themeColor}80, ${themeColor})`,
      }} />

      {/* Decorative shapes */}
      <div style={{
        position: 'absolute', top: -60, right: -60,
        width: 220, height: 220, borderRadius: '50%',
        background: `${themeColor}10`,
        filter: 'blur(40px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -40, left: -40,
        width: 160, height: 160, borderRadius: '50%',
        background: `${themeColor}08`,
        filter: 'blur(30px)',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ padding: isVertical ? '28px 24px 16px' : '20px 20px 12px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: themeColor,
            color: '#fff',
            display: 'grid', placeItems: 'center',
            fontSize: 16, fontWeight: 700,
            boxShadow: `0 4px 14px ${themeColor}40`,
          }}>
            耳
          </div>
          <div>
            <div style={{ fontSize: isVertical ? 15 : 13, fontWeight: 700, color: textColor, lineHeight: 1.2 }}>
              {track.title_jp}
            </div>
            <div style={{ fontSize: isVertical ? 11 : 9, color: subColor, marginTop: 2, fontFamily: "'Noto Sans Bengali', sans-serif" }}>
              {track.title_bn}
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
              background: `${themeColor}15`, color: themeColor,
              padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase',
            }}>
              {track.level}
            </span>
          </div>
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', gap: 12, fontSize: 10, color: subColor, marginBottom: 4 }}>
          <span>{lines.length} lines</span>
          <span>·</span>
          <span>{Math.round(track.duration)}s</span>
          <span>·</span>
          <span style={{ color: themeColor, fontWeight: 600 }}>{track.mondai}</span>
        </div>
      </div>

      {/* Dialogue Area */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        padding: isVertical ? '0 24px 20px' : '0 20px 16px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: 14,
          padding: isVertical ? '16px 18px' : '12px 14px',
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: bgStyle === 'dark' ? 'none' : '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          {/* Dialogue lines */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {lines.slice(0, isVertical ? 6 : 4).map((line, i) => (
              <DialogueBubble key={line.id} line={line} idx={i} />
            ))}
          </div>

          {/* Bottom branding */}
          <div style={{
            borderTop: `1px solid ${cardBorder}`,
            paddingTop: 10,
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 20, height: 20, borderRadius: 5,
                background: themeColor,
                display: 'grid', placeItems: 'center',
                color: '#fff', fontSize: 9, fontWeight: 800,
              }}>JS</div>
              <span style={{ fontSize: 9, fontWeight: 600, color: subColor, letterSpacing: '0.04em' }}>
                japaneseshikhi.com
              </span>
            </div>
            <span style={{ fontSize: 9, color: subColor, opacity: 0.7 }}>
              {PLATFORM_PRESETS[platform].label}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom wave decoration */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, opacity: 0.12, pointerEvents: 'none' }}>
        <WaveformSVG color={themeColor} bars={60} seed={99} />
      </div>
    </div>
  )
}

/* ── card: single-line quote card ── */
function QuoteCard({
  line,
  track,
  platform,
  themeColor = '#E63946',
  bgStyle = 'gradient',
}: {
  line: TrackLine
  track: Track
  platform: PlatformKey
  themeColor?: string
  bgStyle?: 'gradient' | 'dark' | 'zen' | 'minimal'
}) {
  const preset = PLATFORM_PRESETS[platform]
  const meta = getSpeakerMeta(line.speaker)
  const isVertical = preset.h > preset.w

  const bgMap = {
    gradient: `linear-gradient(155deg, ${themeColor}12 0%, #ffffff 50%, #fafaf7 100%)`,
    dark: `linear-gradient(155deg, #0e0f12 0%, #16181d 100%)`,
    zen: `linear-gradient(155deg, #f5f1e8 0%, #fbf8f1 100%)`,
    minimal: '#ffffff',
  }
  const textColor = bgStyle === 'dark' ? '#f3f4f7' : '#1a1a1a'
  const subColor = bgStyle === 'dark' ? '#8a8f9a' : '#797a7f'

  return (
    <div
      id={`quote-${platform}-${line.id}`}
      style={{
        width: preset.w,
        height: preset.h,
        background: bgMap[bgStyle],
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
        justifyContent: 'center',
        alignItems: 'center',
        padding: isVertical ? '40px 32px' : '32px 40px',
      }}
    >
      {/* Large decorative bg text */}
      <div style={{
        position: 'absolute', top: '10%', left: '-5%',
        fontSize: isVertical ? 180 : 140,
        fontWeight: 900,
        color: `${themeColor}08`,
        lineHeight: 1,
        pointerEvents: 'none',
        userSelect: 'none',
        fontFamily: "'Noto Sans JP', sans-serif",
      }}>
        日
      </div>
      <div style={{
        position: 'absolute', bottom: '5%', right: '-5%',
        fontSize: isVertical ? 160 : 120,
        fontWeight: 900,
        color: `${themeColor}06`,
        lineHeight: 1,
        pointerEvents: 'none',
        userSelect: 'none',
        fontFamily: "'Noto Sans JP', sans-serif",
      }}>
        本
      </div>

      {/* Quote mark */}
      <div style={{
        fontSize: isVertical ? 72 : 56,
        color: `${themeColor}25`,
        lineHeight: 1,
        fontFamily: "Georgia, serif",
        marginBottom: isVertical ? 16 : 10,
      }}>"</div>

      {/* Speaker avatar */}
      <div style={{
        width: isVertical ? 56 : 44,
        height: isVertical ? 56 : 44,
        borderRadius: '50%',
        background: meta.bg,
        border: `3px solid ${meta.color}30`,
        display: 'grid',
        placeItems: 'center',
        fontSize: isVertical ? 28 : 22,
        marginBottom: isVertical ? 20 : 14,
        boxShadow: `0 8px 24px ${meta.color}25`,
      }}>
        {meta.emoji}
      </div>

      {/* Japanese text */}
      <div style={{
        fontSize: isVertical ? 26 : 20,
        fontWeight: 700,
        color: textColor,
        textAlign: 'center',
        lineHeight: 1.5,
        fontFamily: "'Noto Sans JP', sans-serif",
        maxWidth: '90%',
        position: 'relative',
        zIndex: 1,
      }}>
        {line.jp}
      </div>

      {/* Bangla translation */}
      <div style={{
        fontSize: isVertical ? 15 : 12,
        color: subColor,
        textAlign: 'center',
        marginTop: isVertical ? 14 : 10,
        lineHeight: 1.45,
        fontFamily: "'Noto Sans Bengali', sans-serif",
        maxWidth: '85%',
        position: 'relative',
        zIndex: 1,
      }}>
        {line.bn}
      </div>

      {/* Waveform */}
      <div style={{ width: '60%', marginTop: isVertical ? 24 : 16, opacity: 0.5 }}>
        <WaveformSVG color={meta.color} bars={40} seed={parseInt(line.id.slice(1))} />
      </div>

      {/* Speaker label */}
      <div style={{
        marginTop: isVertical ? 20 : 14,
        fontSize: 10,
        fontWeight: 700,
        color: meta.color,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        background: `${meta.color}12`,
        padding: '4px 12px',
        borderRadius: 99,
      }}>
        {meta.label} · {track.level}
      </div>

      {/* Bottom branding */}
      <div style={{
        position: 'absolute',
        bottom: isVertical ? 32 : 24,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        opacity: 0.6,
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 5,
          background: themeColor,
          display: 'grid', placeItems: 'center',
          color: '#fff', fontSize: 8, fontWeight: 800,
        }}>JS</div>
        <span style={{ fontSize: 10, fontWeight: 600, color: subColor }}>japaneseshikhi.com</span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   SocialExportModal — Main Component
   ═══════════════════════════════════════════════ */

export function SocialExportModal({ track, onClose }: { track: Track; onClose: () => void }) {
  const { exportTrackAudio } = useTrack()
  const [activeTab, setActiveTab] = useState<'audio' | 'captions' | 'graphics' | 'quotes'>('graphics')
  const [platform, setPlatform] = useState<PlatformKey>('ig_reel')
  const [bgStyle, setBgStyle] = useState<'gradient' | 'dark' | 'zen' | 'minimal'>('gradient')
  const [themeColor, setThemeColor] = useState('#E63946')
  const [exporting, setExporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [selectedLineId, setSelectedLineId] = useState(track.lines[0]?.id)

  const selectedLine = track.lines.find(l => l.id === selectedLineId) ?? track.lines[0]
  const captions = generateCaptions(track)

  const downloadCard = useCallback(async (id: string, name: string) => {
    const el = document.getElementById(id)
    if (!el) return
    setExporting(true)
    try {
      await document.fonts.ready
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        cacheBust: true,
        skipFonts: false,
      })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = name
      a.click()
    } catch (e) {
      console.error(e)
      alert('Export failed. Try again.')
    }
    setExporting(false)
  }, [])

  const handleCopyCaptions = () => {
    navigator.clipboard.writeText(captions.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const preset = PLATFORM_PRESETS[platform]
  const previewScale = Math.min(360 / preset.w, 520 / preset.h, 1)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        width: 840, maxWidth: '94vw', maxHeight: '92vh',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, boxShadow: 'var(--shadow-2)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="row" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row gap-2" style={{ alignItems: 'center' }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--primary)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13 }}>📤</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Social Media Export</div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>{track.title_jp} · {track.lines.length} lines</div>
            </div>
          </div>
          <button className="btn xs ghost" onClick={onClose}><IconX size={12} /></button>
        </div>

        {/* Tabs */}
        <div className="row gap-1" style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
          {([
            { k: 'graphics' as const, label: 'Graphics', icon: '🎨' },
            { k: 'quotes' as const, label: 'Quote Cards', icon: '💬' },
            { k: 'audio' as const, label: 'Audio', icon: '🎙️' },
            { k: 'captions' as const, label: 'Captions', icon: '📝' },
          ]).map(t => (
            <button key={t.k} onClick={() => setActiveTab(t.k)} className="btn xs" style={{
              background: activeTab === t.k ? 'var(--primary-50)' : 'transparent',
              borderColor: activeTab === t.k ? 'var(--primary)' : 'transparent',
              color: activeTab === t.k ? 'var(--primary)' : 'var(--ink-3)',
              fontWeight: activeTab === t.k ? 600 : 500,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Left: Controls */}
          <div style={{ width: 260, borderRight: '1px solid var(--border)', padding: 16, overflow: 'auto', flexShrink: 0 }}>

            {/* Platform */}
            {(activeTab === 'graphics' || activeTab === 'quotes') && (
              <div className="col gap-2" style={{ marginBottom: 18 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Platform</span>
                <div className="col gap-1">
                  {(Object.entries(PLATFORM_PRESETS) as [PlatformKey, typeof PLATFORM_PRESETS['ig_post']][]).map(([k, p]) => (
                    <button key={k} onClick={() => setPlatform(k)} className="btn xs" style={{
                      justifyContent: 'flex-start',
                      background: platform === k ? 'var(--primary-50)' : 'var(--surface-2)',
                      borderColor: platform === k ? 'var(--primary)' : 'var(--border)',
                      color: platform === k ? 'var(--primary)' : 'var(--ink-2)',
                      fontWeight: platform === k ? 600 : 500,
                      fontSize: 11,
                    }}>
                      <span style={{ fontSize: 13 }}>{p.icon}</span>
                      <span>{p.label}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--ink-4)' }}>{p.ratio}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Theme */}
            {(activeTab === 'graphics' || activeTab === 'quotes') && (
              <div className="col gap-2" style={{ marginBottom: 18 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Style</span>
                <div className="row gap-1" style={{ flexWrap: 'wrap' }}>
                  {([
                    { v: 'gradient' as const, label: 'Gradient', bg: 'linear-gradient(135deg, #E63946, #6B21A8)' },
                    { v: 'dark' as const, label: 'Dark', bg: '#16181d' },
                    { v: 'zen' as const, label: 'Zen', bg: '#fbf8f1' },
                    { v: 'minimal' as const, label: 'Clean', bg: '#ffffff' },
                  ]).map(s => (
                    <button key={s.v} onClick={() => setBgStyle(s.v)} style={{
                      padding: '4px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600,
                      border: bgStyle === s.v ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                      background: bgStyle === s.v ? 'var(--primary-50)' : 'var(--surface-2)',
                      color: bgStyle === s.v ? 'var(--primary)' : 'var(--ink-3)',
                      cursor: 'pointer',
                    }}>
                      {s.label}
                    </button>
                  ))}
                </div>

                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>Accent</span>
                <div className="row gap-1" style={{ flexWrap: 'wrap' }}>
                  {['#E63946', '#2A9D8F', '#F4A261', '#1D3557', '#8b5cf6', '#65a30d'].map(c => (
                    <button key={c} onClick={() => setThemeColor(c)} style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: c,
                      border: themeColor === c ? '2px solid var(--ink)' : '2px solid transparent',
                      boxShadow: themeColor === c ? `0 0 0 2px ${c}40` : 'none',
                      cursor: 'pointer',
                    }} />
                  ))}
                </div>
              </div>
            )}

            {/* Line picker for quotes */}
            {activeTab === 'quotes' && (
              <div className="col gap-2" style={{ marginBottom: 18 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Select Line</span>
                <div className="col gap-1" style={{ maxHeight: 200, overflow: 'auto' }}>
                  {track.lines.map(l => (
                    <button key={l.id} onClick={() => setSelectedLineId(l.id)} style={{
                      padding: '6px 8px', borderRadius: 5, textAlign: 'left',
                      fontSize: 10.5, lineHeight: 1.35, cursor: 'pointer',
                      fontFamily: "'Noto Sans JP', sans-serif",
                      border: selectedLineId === l.id ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                      background: selectedLineId === l.id ? 'var(--primary-50)' : 'var(--surface-2)',
                      color: selectedLineId === l.id ? 'var(--primary)' : 'var(--ink-2)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {l.jp}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Audio tab controls */}
            {activeTab === 'audio' && (
              <div className="col gap-2">
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Audio Export</span>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  Export the full track as a WAV file ready for upload to any platform.
                </div>
              </div>
            )}

            {/* Captions tab controls */}
            {activeTab === 'captions' && (
              <div className="col gap-2">
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Captions</span>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  Download subtitle files or copy plain text for manual editing.
                </div>
              </div>
            )}
          </div>

          {/* Right: Preview */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg)' }}>
            {/* Preview label */}
            <div className="row" style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>
                Preview · {preset.w}×{preset.h}px · {preset.ratio}
              </span>
              <span style={{ fontSize: 10, color: 'var(--ink-4)' }}>
                {activeTab === 'graphics' ? 'Conversation card' : activeTab === 'quotes' ? 'Quote card' : activeTab === 'audio' ? 'Audio file' : 'Caption file'}
              </span>
            </div>

            {/* Preview canvas */}
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              {activeTab === 'graphics' && (
                <div style={{
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top center',
                  boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
                  borderRadius: 6,
                  overflow: 'hidden',
                }}>
                  <ConversationCard
                    track={track}
                    lines={track.lines}
                    platform={platform}
                    themeColor={themeColor}
                    bgStyle={bgStyle}
                  />
                </div>
              )}
              {activeTab === 'quotes' && selectedLine && (
                <div style={{
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top center',
                  boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
                  borderRadius: 6,
                  overflow: 'hidden',
                }}>
                  <QuoteCard
                    line={selectedLine}
                    track={track}
                    platform={platform}
                    themeColor={themeColor}
                    bgStyle={bgStyle}
                  />
                </div>
              )}
              {activeTab === 'audio' && (
                <div className="col gap-3" style={{ maxWidth: 380, width: '100%' }}>
                  <div className="panel" style={{ padding: 20, textAlign: 'center' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🎙️</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{track.title_jp}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{track.lines.length} lines · ~{Math.round(track.duration)}s · {track.level}</div>
                    <div style={{ marginTop: 16, display: 'flex', gap: 4, justifyContent: 'center' }}>
                      {track.lines.slice(0, 5).map((l, i) => (
                        <div key={i} style={{
                          width: 4, height: 16 + Math.random() * 24,
                          background: getSpeakerColor(l.speaker),
                          borderRadius: 2, opacity: 0.6,
                        }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'captions' && (
                <div className="col gap-3" style={{ maxWidth: 440, width: '100%' }}>
                  <pre style={{
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: 14, fontSize: 10.5, lineHeight: 1.6,
                    maxHeight: 300, overflow: 'auto', color: 'var(--ink-2)',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {captions.text}
                  </pre>
                </div>
              )}
            </div>

            {/* Action bar */}
            <div className="row gap-2" style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', justifyContent: 'flex-end' }}>
              {activeTab === 'graphics' && (
                <button className="btn primary" disabled={exporting} onClick={() => {
                  downloadCard(`card-${platform}`, `shikhi-${track.id}-${platform}.png`)
                }}>
                  <IconDownload size={11} />
                  {exporting ? 'Rendering…' : `Download ${preset.ratio} PNG`}
                </button>
              )}
              {activeTab === 'quotes' && selectedLine && (
                <button className="btn primary" disabled={exporting} onClick={() => {
                  downloadCard(`quote-${platform}-${selectedLine.id}`, `shikhi-quote-${selectedLine.id}-${platform}.png`)
                }}>
                  <IconDownload size={11} />
                  {exporting ? 'Rendering…' : `Download Quote PNG`}
                </button>
              )}
              {activeTab === 'audio' && (
                <button className="btn primary" disabled={exporting} onClick={async () => {
                  setExporting(true)
                  const blob = await exportTrackAudio()
                  setExporting(false)
                  if (blob) downloadBlob(blob, `japanese-shikhi-${track.id}.wav`)
                }}>
                  <IconDownload size={11} />
                  {exporting ? 'Rendering…' : 'Download WAV'}
                </button>
              )}
              {activeTab === 'captions' && (
                <div className="row gap-2">
                  <button className="btn sm" onClick={() => downloadBlob(new Blob([captions.srt], { type: 'text/plain' }), `shikhi-${track.id}.srt`)}>
                    <IconDownload size={10} /> SRT
                  </button>
                  <button className="btn sm" onClick={() => downloadBlob(new Blob([captions.vtt], { type: 'text/plain' }), `shikhi-${track.id}.vtt`)}>
                    <IconDownload size={10} /> VTT
                  </button>
                  <button className="btn sm" onClick={handleCopyCaptions}>
                    <IconCopy size={10} /> {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── helpers ── */
function generateCaptions(track: Track) {
  const srtLines: string[] = []
  const vttLines: string[] = ['WEBVTT\n']
  const textLines: string[] = []
  let t = 0
  track.lines.forEach((line, i) => {
    const dur = line.duration ?? 2.4
    const start = t
    const end = t + dur
    const ts = (s: number) => {
      const m = Math.floor(s / 60)
      const sec = Math.floor(s % 60)
      const ms = Math.floor((s % 1) * 1000)
      return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}`
    }
    const vttTs = (s: number) => {
      const m = Math.floor(s / 60)
      const sec = Math.floor(s % 60)
      const ms = Math.floor((s % 1) * 1000)
      return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
    }
    srtLines.push(`${i + 1}\n${ts(start)} --> ${ts(end)}\n${line.jp}\n${line.bn}\n`)
    vttLines.push(`${vttTs(start)} --> ${vttTs(end)}\n${line.jp}\n${line.bn}\n`)
    textLines.push(`${line.jp} / ${line.bn}`)
    t = end + line.pauseAfter / 1000
  })
  return { srt: srtLines.join('\n'), vtt: vttLines.join('\n'), text: textLines.join('\n') }
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function IconX({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

function IconDownload({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
    </svg>
  )
}

function IconCopy({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1" />
    </svg>
  )
}
