// NewPage — /newpage route.
// Live preview + JSON/image editor + TTS preview + MP4 export for the Word
// Reel design (design_handoff_word_reel). Stage is 1080x1920, everything
// is a pure function of the playhead T (seconds). Cues are dynamic —
// segment durations extend to fit real audio lengths.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { AZURE_VOICES, synthesizeAzure } from '@/listening/azure'
import {
  DEFAULT_MONTHLY_QUOTA, getAzureUsage, resetAzureUsage, setAzureQuota,
  fetchAzureLiveUsage,
  type AzureUsageState, type AzureUsageResponse,
} from '@/listening/azureUsage'
import { getSpeakers, synthesizeText as vvSynth, reelEnvBlocked, type VvSpeaker } from '@/listening/voicevox'
import { encodeReelMp4, webcodecsSupported } from '@/studio/reel/encodeMp4'
import { renderFrame as renderCanvasFrame, loadImage } from './renderFrame'

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Design constants ─────────────────────────────────────────────────────
const FJP = "'Noto Sans JP','Hiragino Sans',sans-serif"
const BRAND = '#E63946'
const AMBER = '#F4A261'
const TEAL = '#2A9D8F'
const NAVY = '#1D3557'

// ── Cues (defaults from handoff; extended dynamically once TTS synthed) ─
interface Cues { Hook: number; Word: number; KaiwaA: number; KaiwaB: number; Explain: number; Replay: number; Outro: number }
// Hook extended to 5s so the opener SFX (woosh) can breathe before speakers.
const DEFAULT_CUES: Cues = { Hook: 0, Word: 5.0, KaiwaA: 9.4, KaiwaB: 13.2, Explain: 16.6, Replay: 20.8, Outro: 23.8 }
const DEFAULT_END = 26.4
const OUTRO_LEN = 2.6
const HOOK_LEN = 5.0
const HOOK_SFX_URL = '/sounds/woosh.mp3'
const LOGO_ICON_URL = '/assets/manabi/logo-1.png'
const LOGO_WORDMARK_URL = '/assets/manabi/logo-2.png'

/**
 * Sample the bottom edge of an image and return the dominant color as hex.
 * Used to auto-tint the subtitle panel so it blends into the photo above.
 * Returns null on CORS / load failure — caller should fall back to theme.
 */
function sampleImageBottomColor(src: string): Promise<string | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onerror = () => resolve(null)
    img.onload = () => {
      try {
        const w = 64, h = 64
        const c = document.createElement('canvas')
        c.width = w; c.height = h
        const ctx = c.getContext('2d')
        if (!ctx) { resolve(null); return }
        ctx.drawImage(img, 0, 0, w, h)
        // Sample bottom 18% rows.
        const yStart = Math.floor(h * 0.82)
        const data = ctx.getImageData(0, yStart, w, h - yStart).data
        let r = 0, g = 0, b = 0, n = 0
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
        }
        if (!n) { resolve(null); return }
        const rr = Math.round(r / n), gg = Math.round(g / n), bb = Math.round(b / n)
        resolve(`#${rr.toString(16).padStart(2, '0')}${gg.toString(16).padStart(2, '0')}${bb.toString(16).padStart(2, '0')}`)
      } catch { resolve(null) }
    }
    img.src = src
  })
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff }
}
function darken(hex: string, amt: number): string {
  const c = hexToRgb(hex); if (!c) return hex
  const f = 1 - amt
  const r = Math.max(0, Math.round(c.r * f))
  const g = Math.max(0, Math.round(c.g * f))
  const b = Math.max(0, Math.round(c.b * f))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
export function buildTintedBg(tint: string): { seam: string; stops: [string, string, string] } {
  return { seam: tint, stops: [tint, darken(tint, 0.35), darken(tint, 0.6)] }
}

// ── Types ─────────────────────────────────────────────────────────────────
type ThemeKey = 'indigo' | 'navy' | 'crimson' | 'forest' | 'paper' | 'black'
type Provider = 'azure' | 'voicevox'
type VoiceRole = 'word' | 'kaiwaA' | 'kaiwaB' | 'english'
type PhaseKey = 'Word' | 'KaiwaA' | 'KaiwaB' | 'Explain' | 'Replay'

interface KaiwaLine {
  speaker: string; gender?: 'male' | 'female'; role: string
  jp: string; kana: string; romaji: string; en: string; bn?: string
}
interface ReelData {
  id: string; level: string; theme: ThemeKey
  image: { src: string; alt: string }
  word: {
    jp: string; kana: string; romaji: string; en: string
    bn?: string; pos: string; theme: string; gloss: string
  }
  kaiwa: KaiwaLine[]
  explanation: { en_a: string; en_b: string; bn_a?: string }
  cta: { handle: string; line: string }
}

interface LineSpec {
  key: string
  role: VoiceRole
  phase: PhaseKey
  text: string
  lang: 'ja' | 'en'
}

const DEFAULT_REEL: ReelData = {
  id: 'n5-tanbo',
  level: 'N5',
  theme: 'indigo',
  image: { src: '/assets/newpage-sample-tanbo.png', alt: 'A boy holding a frog beside a rice paddy' },
  word: {
    jp: '田んぼ', kana: 'たんぼ', romaji: 'tanbo', en: 'Rice field',
    bn: 'ধানক্ষেত', pos: 'Noun', theme: 'Nature',
    gloss: 'A flooded paddy where rice is grown.',
  },
  kaiwa: [
    { speaker: 'A', gender: 'male', role: 'Friend', jp: '田んぼでカエルを見つけた。', kana: 'たんぼでかえるをみつけた。', romaji: 'Tanbo de kaeru o mitsuketa.', en: 'I found a frog in the rice field.', bn: 'ধানক্ষেতে একটা ব্যাঙ পেয়েছি।' },
    { speaker: 'B', gender: 'female', role: 'Reply', jp: 'えっ、田んぼにカエルがいるの？', kana: 'えっ、たんぼにかえるがいるの？', romaji: 'E, tanbo ni kaeru ga iru no?', en: 'Huh, there are frogs in the rice field?', bn: 'সত্যি? ধানক্ষেতে ব্যাঙ থাকে?' },
  ],
  explanation: {
    en_a: '田 is a field seen from above — the grid lines are the water channels.',
    en_b: 'で marks where an action happens: 田んぼで見つけた = found it at the rice field.',
    bn_a: '田 মানে উপর থেকে দেখা ক্ষেত — ভেতরের লাইনগুলো পানির নালা।',
  },
  cta: { handle: '@japanesemanabi', line: 'One Japanese word a day, explained in Bangla.' },
}

const SAMPLE_JSON = JSON.stringify(DEFAULT_REEL, null, 2)

const CLAUDE_PROMPT = `Generate a JSON object for a Japanese "word of the day" reel matching this exact schema. Return ONLY the JSON — no markdown fences, no commentary.

Requirements:
- "id": short kebab-case slug like "n5-tanbo"
- "level": one of "N5" | "N4" | "N3" | "N2" | "N1"
- "theme": one of "indigo" | "navy" | "crimson" | "forest" | "paper" | "black"
- "image.src": leave as "/assets/newpage-sample-tanbo.png" (user will replace via UI)
- "word.jp": 2-4 kanji/kana characters ideally; step down font is 5+
- "word.gloss": one-line English definition, under 90 chars
- "kaiwa": exactly TWO entries, A (Friend) + B (Reply), each JP sentence under 24 chars
- "explanation.en_a" + "en_b": two short lines; keep each under 120 chars
- "cta.handle": "@japanesemanabi"
- "cta.line": one warm brand line, under 70 chars

Schema (this is the current default reel — replace values, keep structure identical):

${SAMPLE_JSON}
`

// ── Themes (from handoff + black variant) ────────────────────────────────
interface Theme {
  label: string; bg: string; seam: string; fg: string; muted: string; faint: string; accent: string;
  chip: string; chipFg: string; card: string; cardEdge: string;
  orbs: [string, string, string] | null; petals: boolean;
}
const THEMES: Record<ThemeKey, Theme> = {
  indigo: {
    label: 'Indigo', bg: 'linear-gradient(160deg,#0a0c18 0%,#0f0d1f 55%,#14102a 100%)', seam: '#0a0c18',
    fg: '#fff', muted: 'rgba(255,255,255,.5)', faint: 'rgba(255,255,255,.42)', accent: AMBER,
    chip: 'rgba(255,255,255,.08)', chipFg: 'rgba(255,255,255,.7)',
    card: 'rgba(255,255,255,.07)', cardEdge: 'rgba(255,255,255,.1)',
    orbs: ['rgba(107,33,168,.5)', 'rgba(230,57,70,.42)', 'rgba(244,162,97,.34)'], petals: true,
  },
  navy: {
    label: 'Navy', bg: 'linear-gradient(160deg,#1D3557 0%,#16294380 55%,#101d2e 100%)', seam: '#1D3557',
    fg: '#fff', muted: 'rgba(255,255,255,.55)', faint: 'rgba(255,255,255,.45)', accent: AMBER,
    chip: 'rgba(255,255,255,.1)', chipFg: 'rgba(255,255,255,.75)',
    card: 'rgba(255,255,255,.08)', cardEdge: 'rgba(255,255,255,.14)',
    orbs: ['rgba(42,157,143,.4)', 'rgba(244,162,97,.3)', 'rgba(107,33,168,.34)'], petals: true,
  },
  crimson: {
    label: 'Crimson', bg: 'linear-gradient(160deg,#2b0f14 0%,#3a1017 55%,#48141c 100%)', seam: '#2b0f14',
    fg: '#fff', muted: 'rgba(255,255,255,.55)', faint: 'rgba(255,255,255,.45)', accent: AMBER,
    chip: 'rgba(255,255,255,.09)', chipFg: 'rgba(255,255,255,.72)',
    card: 'rgba(255,255,255,.08)', cardEdge: 'rgba(255,255,255,.12)',
    orbs: ['rgba(230,57,70,.5)', 'rgba(244,162,97,.34)', 'rgba(107,33,168,.26)'], petals: true,
  },
  forest: {
    label: 'Forest', bg: 'linear-gradient(160deg,#04211d 0%,#062a25 55%,#08322c 100%)', seam: '#04211d',
    fg: '#fff', muted: 'rgba(255,255,255,.55)', faint: 'rgba(255,255,255,.45)', accent: AMBER,
    chip: 'rgba(255,255,255,.09)', chipFg: 'rgba(255,255,255,.72)',
    card: 'rgba(255,255,255,.08)', cardEdge: 'rgba(255,255,255,.12)',
    orbs: ['rgba(42,157,143,.5)', 'rgba(244,162,97,.28)', 'rgba(230,57,70,.22)'], petals: true,
  },
  paper: {
    label: 'Paper', bg: 'linear-gradient(160deg,#FFFFFF 0%,#FAFAFA 55%,#F9FAFB 100%)', seam: '#FFFFFF',
    fg: NAVY, muted: 'rgba(29,53,87,.6)', faint: 'rgba(29,53,87,.45)', accent: BRAND,
    chip: 'rgba(29,53,87,.06)', chipFg: 'rgba(29,53,87,.7)',
    card: 'rgba(29,53,87,.04)', cardEdge: 'rgba(29,53,87,.1)',
    orbs: null, petals: false,
  },
  black: {
    label: 'Black', bg: 'linear-gradient(160deg,#000 0%,#000 55%,#000 100%)', seam: '#000',
    fg: '#fff', muted: 'rgba(255,255,255,.55)', faint: 'rgba(255,255,255,.42)', accent: AMBER,
    chip: 'rgba(255,255,255,.08)', chipFg: 'rgba(255,255,255,.72)',
    card: 'rgba(255,255,255,.06)', cardEdge: 'rgba(255,255,255,.12)',
    orbs: null, petals: true,
  },
}
const THEME_ORDER: ThemeKey[] = ['indigo', 'navy', 'crimson', 'forest', 'paper', 'black']

// ── Motion helpers (from handoff §Motion) ───────────────────────────────
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3)
const easeOutBack = (p: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2) }

const enter = (T: number, start: number, dur = 0.55) => {
  const p = easeOutCubic(clamp((T - start) / dur, 0, 1))
  return { opacity: p, transform: `translateY(${((1 - p) * 38).toFixed(1)}px)` }
}
const pop = (T: number, start: number, dur = 0.6) => {
  const raw = clamp((T - start) / dur, 0, 1)
  const p = easeOutBack(raw)
  return { opacity: clamp(raw / 0.6, 0, 1), scale: 0.84 + 0.16 * p }
}
const band = (T: number, a: number, b: number) => {
  const i = easeOutCubic(clamp((T - a) / 0.45, 0, 1))
  const o = 1 - clamp((T - (b - 0.35)) / 0.35, 0, 1)
  return { opacity: Math.min(i, o), dy: (1 - i) * 30 - (1 - o) * 14 }
}

const panelBase: React.CSSProperties = { position: 'absolute', left: 72, right: 72, top: '50%', display: 'flex', flexDirection: 'column' }
const bandStyle = (b: { opacity: number; dy: number }): React.CSSProperties => ({
  ...panelBase, opacity: b.opacity, transform: `translateY(calc(-50% + ${b.dy.toFixed(1)}px))`,
})

function Eq({ on, color }: { on: boolean; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {[0, 1, 2, 3].map(i => (
        <span key={i} style={{
          display: 'inline-block', width: 8, height: 44, borderRadius: 4, background: color,
          transformOrigin: 'center', opacity: on ? 1 : 0.26,
          transform: `scaleY(${(on ? (0.3 + 0.7 * Math.abs(Math.sin(i * 1.1 + 3))) : 0.25).toFixed(2)})`,
        }} />
      ))}
    </div>
  )
}

// ── Stage — pure function of T + data + theme + cues + endTime ──────────
function Stage({ T, theme, data, cues, endTime, bgTint, scrim }: {
  T: number; theme: ThemeKey; data: ReelData; cues: Cues; endTime: number
  bgTint?: string | null
  scrim: number
}) {
  const baseTheme = THEMES[theme]
  // If a bgTint is provided (auto-sampled from image), override seam + bg
  // so the subtitle panel picks up the image's bottom color and reads as one
  // continuous surface. All other theme tokens (fg, accent, chips) stay.
  const t = useMemo<Theme>(() => {
    if (!bgTint) return baseTheme
    const tinted = buildTintedBg(bgTint)
    return {
      ...baseTheme,
      seam: tinted.seam,
      bg: `linear-gradient(160deg,${tinted.stops[0]} 0%,${tinted.stops[1]} 55%,${tinted.stops[2]} 100%)`,
    }
  }, [baseTheme, bgTint])
  const k1 = data.kaiwa[0], k2 = data.kaiwa[1] || data.kaiwa[0]

  const AUDIO = [
    { at: cues.Word + 0.3,    until: cues.KaiwaA - 0.1,   label: 'word' },
    { at: cues.KaiwaA + 0.2,  until: cues.KaiwaB - 0.1,   label: 'speaker A' },
    { at: cues.KaiwaB + 0.2,  until: cues.Explain - 0.1,  label: 'speaker B' },
    { at: cues.Explain + 0.3, until: cues.Replay - 0.1,   label: 'english' },
    { at: cues.Replay + 0.2,  until: cues.Outro - 0.1,    label: 'recap' },
  ]
  const cue = AUDIO.find(c => T >= c.at && T < c.until) || null
  const speaking = !!cue

  const wordDim = T >= cues.KaiwaA && T < cues.Replay ? 0.5 : 1
  const pulse = speaking && T < cues.KaiwaA ? 1 + 0.03 * Math.sin((T - cue!.at) * 7) : 1
  const kb = 1.05 + 0.07 * (T / endTime)

  const jpLen = [...data.word.jp].length
  const kanjiSize = jpLen >= 6 ? 92 : jpLen === 5 ? 110 : 132

  const wp = pop(T, 0.35, 0.7)

  const bandI = band(T, 0, cues.KaiwaA)
  const bandA = band(T, cues.KaiwaA, cues.KaiwaB)
  const bandB = band(T, cues.KaiwaB, cues.Explain)
  const bandE = band(T, cues.Explain, cues.Replay)
  const bandR = band(T, cues.Replay, cues.Outro)
  const outro = easeOutCubic(clamp((T - cues.Outro) / 0.6, 0, 1))

  const kanaLine: React.CSSProperties = { fontFamily: FJP, fontSize: 32, color: t.muted, marginBottom: 8 }
  const jpLine: React.CSSProperties = { fontFamily: FJP, fontWeight: 700, fontSize: 62, lineHeight: 1.28, color: t.fg }
  const romaLine: React.CSSProperties = { fontSize: 32, color: t.faint, letterSpacing: '.05em', marginTop: 14 }
  const enLine: React.CSSProperties = { fontSize: 34, color: t.accent, fontWeight: 500, marginTop: 18 }
  const avatar: React.CSSProperties = { width: 56, height: 56, borderRadius: 999, fontSize: 28, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }
  const roleLabel: React.CSSProperties = { fontSize: 26, fontWeight: 600, color: t.muted, letterSpacing: '.12em', textTransform: 'uppercase' }

  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: 'Inter,system-ui,sans-serif', background: t.seam, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 1080, height: 1150, overflow: 'hidden', background: '#111' }}>
        <img src={data.image.src} alt={data.image.alt} crossOrigin="anonymous" style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
          transformOrigin: '50% 45%', transform: `scale(${kb.toFixed(3)})`,
        }} />
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg,rgba(10,12,24,${(scrim * 0.64).toFixed(3)}) 0%,rgba(10,12,24,0) 26%,rgba(10,12,24,0) 42%,rgba(10,12,24,${scrim.toFixed(3)}) 88%,${t.seam} 100%)` }} />

        <div style={{ position: 'absolute', top: 44, left: 44, display: 'flex', gap: 12, alignItems: 'center', ...enter(T, 0.15, 0.5) }}>
          <span style={{ padding: '10px 20px', borderRadius: 999, background: BRAND, color: '#fff', fontSize: 26, fontWeight: 700, letterSpacing: '.06em' }}>{data.level}</span>
          <span style={{ padding: '10px 20px', borderRadius: 999, background: 'rgba(255,255,255,.14)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 24, fontWeight: 600, fontFamily: FJP }}>今日のことば</span>
        </div>
        <div style={{ position: 'absolute', top: 44, right: 44, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px 10px 14px', borderRadius: 999, background: 'rgba(10,12,24,.5)', backdropFilter: 'blur(8px)', ...enter(T, 0.25, 0.5) }}>
          <img src={LOGO_ICON_URL} alt="" crossOrigin="anonymous" style={{ width: 46, height: 36, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
          <span style={{ color: '#fff', fontSize: 22, fontWeight: 700, letterSpacing: '.01em' }}>Japanese Manabi</span>
        </div>

        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 74, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: wordDim }}>
          <div style={{ opacity: wp.opacity, transform: `scale(${(wp.scale * pulse).toFixed(3)})` }}>
            <span style={{ fontFamily: FJP, fontWeight: 900, fontSize: kanjiSize, lineHeight: 1, color: '#fff', textShadow: '0 6px 30px rgba(0,0,0,.6)' }}>{data.word.jp}</span>
          </div>
          <div style={enter(T, 0.75, 0.5)}>
            <span style={{ fontFamily: FJP, fontWeight: 500, fontSize: 52, color: 'rgba(255,255,255,.82)' }}>{data.word.kana}</span>
          </div>
          <div style={enter(T, 1.05, 0.5)}>
            <span style={{ fontSize: 40, fontWeight: 500, color: 'rgba(255,255,255,.55)' }}>{data.word.en}</span>
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', top: 1150, left: 0, width: 1080, height: 770, overflow: 'hidden', background: t.bg }}>
        {t.orbs && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <div style={{ position: 'absolute', left: -120, top: 40, width: 520, height: 520, borderRadius: 999, background: `radial-gradient(circle,${t.orbs[0]},transparent 70%)`, filter: 'blur(80px)', transform: `translate(${(Math.sin(T * 0.4) * 44).toFixed(1)}px,${(Math.cos(T * 0.32) * 36).toFixed(1)}px)` }} />
            <div style={{ position: 'absolute', right: -140, bottom: -100, width: 540, height: 540, borderRadius: 999, background: `radial-gradient(circle,${t.orbs[1]},transparent 70%)`, filter: 'blur(90px)', transform: `translate(${(Math.cos(T * 0.29) * 50).toFixed(1)}px,${(Math.sin(T * 0.36) * 40).toFixed(1)}px)` }} />
            <div style={{ position: 'absolute', right: 120, top: -80, width: 360, height: 360, borderRadius: 999, background: `radial-gradient(circle,${t.orbs[2]},transparent 70%)`, filter: 'blur(80px)', transform: `translate(${(Math.sin(T * 0.5 + 2) * 38).toFixed(1)}px,0)` }} />
          </div>
        )}
        {t.petals && [0, 1, 2, 3, 4].map(i => {
          const x = [8, 26, 47, 68, 87][i], sz = [22, 16, 26, 18, 20][i], spd = [11, 14, 9.5, 12.5, 15][i], off = [0, 4, 7, 2, 9][i]
          const p = ((T + off) % spd) / spd
          return <div key={i} style={{
            position: 'absolute', left: `${x}%`, top: 0, width: sz, height: sz, borderRadius: '150% 0 150% 0',
            background: 'linear-gradient(135deg,rgba(255,182,197,.72),rgba(255,140,165,.55))',
            transform: `translate(${(Math.sin(p * 6.3 + i) * 34).toFixed(1)}px,${(-80 + p * 900).toFixed(0)}px) rotate(${(p * 320).toFixed(0)}deg)`,
          }} />
        })}

        <div style={bandStyle(bandI)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 26 }}>
            <Eq on={speaking} color={t.accent} />
            <span style={{ fontSize: 26, fontWeight: 600, color: t.muted, letterSpacing: '.1em', textTransform: 'uppercase', marginLeft: 8 }}>{cue ? cue.label : 'audio'}</span>
          </div>
          <div style={{ fontSize: 34, color: t.muted, letterSpacing: '.08em', marginBottom: 10, textTransform: 'uppercase' }}>{data.word.romaji}</div>
          <div style={{ fontSize: 40, fontWeight: 600, color: t.fg, lineHeight: 1.35, maxWidth: 900 }}>{data.word.gloss}</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 34 }}>
            <span style={{ padding: '10px 20px', borderRadius: 999, background: 'rgba(42,157,143,.18)', border: '1px solid rgba(42,157,143,.4)', color: t.petals ? '#6fe0d2' : '#1f7a70', fontSize: 26, fontWeight: 600 }}>{data.word.pos}</span>
            <span style={{ padding: '10px 20px', borderRadius: 999, background: t.chip, color: t.chipFg, fontSize: 26, fontWeight: 600 }}>{data.word.theme}</span>
          </div>
        </div>

        <div style={bandStyle(bandA)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
            <span style={{ ...avatar, background: TEAL, color: '#04211d' }}>{k1.speaker}</span>
            <span style={roleLabel}>{k1.role}</span>
          </div>
          <div style={kanaLine}>{k1.kana}</div>
          <div style={jpLine}>{k1.jp}</div>
          <div style={romaLine}>{k1.romaji}</div>
          <div style={enLine}>{k1.en}</div>
        </div>

        <div style={bandStyle(bandB)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
            <span style={{ ...avatar, background: BRAND, color: '#fff' }}>{k2.speaker}</span>
            <span style={roleLabel}>{k2.role}</span>
          </div>
          <div style={kanaLine}>{k2.kana}</div>
          <div style={jpLine}>{k2.jp}</div>
          <div style={romaLine}>{k2.romaji}</div>
          <div style={enLine}>{k2.en}</div>
        </div>

        <div style={bandStyle(bandE)}>
          <div style={{ alignSelf: 'flex-start', padding: '10px 22px', borderRadius: 999, background: 'rgba(244,162,97,.16)', border: '1px solid rgba(244,162,97,.34)', color: t.petals ? AMBER : '#b06a22', fontSize: 26, fontWeight: 700, letterSpacing: '.1em', marginBottom: 28 }}>WHY IT WORKS</div>
          <div style={{ fontSize: 42, lineHeight: 1.42, color: t.fg, fontWeight: 500, maxWidth: 930 }}>{data.explanation.en_a}</div>
          <div style={{ fontSize: 36, lineHeight: 1.45, color: t.muted, marginTop: 22, maxWidth: 930 }}>{data.explanation.en_b}</div>
        </div>

        <div style={bandStyle(bandR)}>
          <div style={{ fontSize: 26, fontWeight: 600, color: t.faint, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 26 }}>One more time</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 22, marginBottom: 26 }}>
            <span style={{ fontFamily: FJP, fontWeight: 900, fontSize: 76, color: t.fg, lineHeight: 1 }}>{data.word.jp}</span>
            <span style={{ fontSize: 34, color: t.muted }}>{data.word.en}</span>
          </div>
          <div style={{ padding: '26px 30px', borderRadius: 22, background: t.card, border: `1px solid ${t.cardEdge}` }}>
            <div style={{ fontFamily: FJP, fontWeight: 700, fontSize: 46, color: t.fg, lineHeight: 1.3 }}>{k1.jp}</div>
            <div style={{ fontSize: 28, color: t.faint, marginTop: 12, letterSpacing: '.05em' }}>{k1.romaji}</div>
          </div>
        </div>
      </div>

      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        // Last color === CTA (BRAND red) so the outro flows into the handle.
        background: `linear-gradient(160deg,#c62d3a 0%,${BRAND} 55%,#a91d29 100%)`,
        opacity: outro, transform: `scale(${(0.98 + 0.02 * outro).toFixed(3)})`, pointerEvents: 'none',
      }}>
        <img
          src={LOGO_WORDMARK_URL} alt="Japanese Manabi" crossOrigin="anonymous"
          style={{ width: 760, height: 360, objectFit: 'contain', display: 'block', filter: 'brightness(0) invert(1) drop-shadow(0 12px 40px rgba(0,0,0,.35))', marginBottom: 32 }}
        />
        <div style={{ fontSize: 36, color: 'rgba(255,255,255,.9)', marginTop: 4, textAlign: 'center', maxWidth: 760 }}>{data.cta.line}</div>
        <div style={{ marginTop: 40, padding: '22px 46px', borderRadius: 999, background: '#fff', color: BRAND, fontSize: 38, fontWeight: 800, boxShadow: '0 12px 40px rgba(0,0,0,.28)' }}>{data.cta.handle}</div>
      </div>

      <div style={{ position: 'absolute', top: 0, left: 0, height: 8, width: 1080, background: 'rgba(255,255,255,.14)' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, height: 8, width: 1080 * clamp(T / endTime, 0, 1), background: BRAND }} />
    </div>
  )
}

// ── Helpers: WebCodecs + line specs + timing ────────────────────────────
// WebCodecs support + H.264 profile selection now handled by the shared
// encoder (src/studio/reel/encodeMp4.ts).

function buildLineSpecs(d: ReelData): LineSpec[] {
  const k1 = d.kaiwa[0], k2 = d.kaiwa[1] || d.kaiwa[0]
  const enText = `${d.explanation.en_a} ${d.explanation.en_b}`.trim()
  return [
    { key: 'word-1', role: 'word', phase: 'Word', text: d.word.jp, lang: 'ja' },
    { key: 'word-2', role: 'word', phase: 'Word', text: d.word.jp, lang: 'ja' },
    { key: 'kaiwaA', role: 'kaiwaA', phase: 'KaiwaA', text: k1.jp, lang: 'ja' },
    { key: 'kaiwaB', role: 'kaiwaB', phase: 'KaiwaB', text: k2.jp, lang: 'ja' },
    { key: 'english', role: 'english', phase: 'Explain', text: enText, lang: 'en' },
    { key: 'replay-word', role: 'word', phase: 'Replay', text: d.word.jp, lang: 'ja' },
    { key: 'replay-sentence', role: 'kaiwaA', phase: 'Replay', text: k1.jp, lang: 'ja' },
  ]
}

/**
 * Compute segment cues from actual audio buffer durations. Each phase length
 * is max(designed, sum of lines-in-phase + tailGap per line). Guarantees no
 * line is cut off before its phase transitions.
 */
function computeDynamicCues(
  durations: Map<string, number>,
  tailGap: number,
): { cues: Cues; end: number } {
  const dur = (k: string, fb: number) => durations.get(k) ?? fb

  const word1 = dur('word-1', 1.7), word2 = dur('word-2', word1)
  const kaiwaA = dur('kaiwaA', 3.4), kaiwaB = dur('kaiwaB', 3.0)
  const english = dur('english', 4.0)
  const rWord = dur('replay-word', word1), rSent = dur('replay-sentence', kaiwaA)

  const hookLen = HOOK_LEN
  const wordPhase = Math.max(4.4, 0.3 + word1 + tailGap + word2 + tailGap)
  const kaiwaAPhase = Math.max(3.8, 0.2 + kaiwaA + tailGap)
  const kaiwaBPhase = Math.max(3.4, 0.2 + kaiwaB + tailGap)
  const explainPhase = Math.max(4.2, 0.3 + english + tailGap)
  const replayPhase = Math.max(3.0, 0.2 + rWord + tailGap + rSent + tailGap)

  const Hook = 0
  const Word = hookLen
  const KaiwaA = Word + wordPhase
  const KaiwaB = KaiwaA + kaiwaAPhase
  const Explain = KaiwaB + kaiwaBPhase
  const Replay = Explain + explainPhase
  const Outro = Replay + replayPhase
  const end = Outro + OUTRO_LEN
  return { cues: { Hook, Word, KaiwaA, KaiwaB, Explain, Replay, Outro }, end }
}

/**
 * Given cues + per-line audio durations, compute the absolute startAt for
 * each line. Lines within a phase play back-to-back with a tailGap between.
 */
function computeLineStarts(
  specs: LineSpec[],
  durations: Map<string, number>,
  cues: Cues,
  tailGap: number,
): Map<string, number> {
  const heads: Record<PhaseKey, number> = {
    Word: cues.Word + 0.3, KaiwaA: cues.KaiwaA + 0.2, KaiwaB: cues.KaiwaB + 0.2,
    Explain: cues.Explain + 0.3, Replay: cues.Replay + 0.2,
  }
  const cursors: Record<PhaseKey, number> = { ...heads }
  const out = new Map<string, number>()
  for (const spec of specs) {
    const startAt = cursors[spec.phase]
    out.set(spec.key, startAt)
    const dur = durations.get(spec.key) ?? 1.5
    cursors[spec.phase] = startAt + dur + tailGap
  }
  return out
}

// ── Azure TTS quota panel ────────────────────────────────────────────────
function AzureUsagePanel({ usage, onChange, disabled }: {
  usage: AzureUsageState
  onChange: (s: AzureUsageState) => void
  disabled: boolean
}) {
  const [quotaDraft, setQuotaDraft] = useState<string>(String(usage.quota))
  const [live, setLive] = useState<AzureUsageResponse | null>(null)
  const [liveErr, setLiveErr] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [showLocal, setShowLocal] = useState<boolean>(false)

  useEffect(() => { setQuotaDraft(String(usage.quota)) }, [usage.quota])

  const refresh = useCallback(async () => {
    setLoading(true); setLiveErr('')
    try { setLive(await fetchAzureLiveUsage()) }
    catch (e: any) { setLiveErr(e?.message ?? String(e)); setLive(null) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  // Live-source values (from /api/tts/azure-usage).
  const liveConfigured = live?.configured === true
  const liveChars = liveConfigured ? live.monitor?.synthesizedCharacters ?? null : null
  const liveCostQty = liveConfigured ? live.cost?.quantity ?? null : null
  const liveCostAmt = liveConfigured ? live.cost?.cost ?? null : null
  const liveCurrency = liveConfigured ? live.cost?.currency ?? 'USD' : 'USD'

  // Prefer Monitor's `SynthesizedCharacters` (real char count). Cost quantity
  // is per-meter units (e.g. millions of chars) and can't be normalized to
  // chars without MeterName/UnitOfMeasure — so it's shown as MTD spend only,
  // not used as a char fallback. Fall back to the local counter instead.
  const effectiveUsed = liveChars ?? usage.used
  const effectiveSource = liveChars != null
    ? 'Azure Monitor · SynthesizedCharacters'
    : 'Local counter (Monitor unavailable)'
  void liveCostQty

  const pct = usage.quota > 0 ? Math.min(100, (effectiveUsed / usage.quota) * 100) : 0
  const barColor = pct >= 95 ? '#ff5f6d' : pct >= 75 ? AMBER : TEAL
  const remaining = Math.max(0, usage.quota - effectiveUsed)

  const applyQuota = () => {
    const n = Number(quotaDraft.replace(/[,_\s]/g, ''))
    if (!Number.isFinite(n) || n <= 0) return
    onChange(setAzureQuota(n))
  }
  const reset = () => onChange(resetAzureUsage())

  const monthKey = liveConfigured ? live.monthKey : usage.monthKey
  const badge = liveConfigured
    ? { text: 'LIVE', color: TEAL }
    : loading
      ? { text: '…', color: 'rgba(255,255,255,.4)' }
      : { text: 'LOCAL', color: AMBER }

  return (
    <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,.06)', background: 'linear-gradient(180deg,rgba(42,157,143,.06),transparent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,.75)' }}>Azure TTS quota</div>
          <span style={{ padding: '1px 8px', borderRadius: 999, background: `${badge.color === TEAL ? 'rgba(42,157,143,.16)' : 'rgba(244,162,97,.16)'}`, color: badge.color, fontSize: 10, fontWeight: 700, letterSpacing: '.1em' }}>{badge.text}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', fontFamily: 'ui-monospace,monospace' }}>{monthKey}</span>
          <button onClick={refresh} disabled={loading} title="Re-fetch from Azure" style={{ padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.06)', color: '#fff', fontSize: 10, cursor: 'pointer' }}>↻</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{effectiveUsed.toLocaleString()}</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>/ {usage.quota.toLocaleString()} chars</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: barColor, fontWeight: 600 }}>{pct.toFixed(1)}%</span>
      </div>
      <div style={{ height: 8, background: 'rgba(255,255,255,.08)', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, transition: 'width .3s ease' }} />
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', marginBottom: 10, lineHeight: 1.5 }}>
        {remaining.toLocaleString()} chars remaining
        {liveCostAmt != null && (
          <> · <b style={{ color: '#fff' }}>{liveCostAmt.toFixed(2)} {liveCurrency}</b> billed MTD</>
        )}
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginBottom: 10, fontFamily: 'ui-monospace,monospace' }}>
        Source: {effectiveSource}
      </div>

      {liveConfigured && live.monitor?.totalTransactions != null && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>
          Transactions: <b style={{ color: '#fff' }}>{live.monitor.totalTransactions.toLocaleString()}</b>
        </div>
      )}
      {liveConfigured && live.cost?.byMeter?.length ? (
        <details style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginBottom: 10 }}>
          <summary style={{ cursor: 'pointer' }}>Meter breakdown ({live.cost.byMeter.length})</summary>
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 4 }}>
            {live.cost.byMeter.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontFamily: 'ui-monospace,monospace', fontSize: 10 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.meter}</span>
                <span style={{ color: '#fff' }}>{m.quantity.toLocaleString()} {m.unit}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {!liveConfigured && (
        <div style={{ fontSize: 11, color: '#ffd7a1', background: 'rgba(244,162,97,.08)', border: '1px solid rgba(244,162,97,.24)', padding: '8px 10px', borderRadius: 6, marginBottom: 10, lineHeight: 1.5 }}>
          {live && !live.configured ? (
            <>
              <b>Live Azure disabled.</b> Set these env vars on Vercel:
              <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: 10, marginTop: 4 }}>{live.missing.join(', ')}</div>
              <div style={{ marginTop: 4, opacity: 0.85 }}>Create a service principal + grant it Reader on the Speech resource and Cost Management Reader on the subscription.</div>
            </>
          ) : liveErr ? (
            <><b>Azure error:</b> {liveErr}</>
          ) : loading ? 'Loading live usage…' : 'Waiting…'}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <label style={{ fontSize: 11, color: 'rgba(255,255,255,.6)' }}>Quota</label>
        <input
          type="text" inputMode="numeric" value={quotaDraft}
          onChange={e => setQuotaDraft(e.target.value)}
          disabled={disabled}
          style={{ flex: 1, padding: '4px 8px', background: '#06060a', color: '#fff', border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, fontSize: 12, fontFamily: 'ui-monospace,monospace' }}
        />
        <button onClick={applyQuota} disabled={disabled} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.06)', color: '#fff', fontSize: 11, cursor: 'pointer' }}>Set</button>
      </div>
      <button
        onClick={() => setShowLocal(v => !v)}
        style={{ marginTop: 8, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: 'rgba(255,255,255,.55)', fontSize: 10, cursor: 'pointer' }}
      >
        {showLocal ? 'Hide' : 'Show'} local counter
      </button>
      {showLocal && (
        <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(255,255,255,.03)', borderRadius: 6, fontSize: 11, color: 'rgba(255,255,255,.6)' }}>
          Local: <b style={{ color: '#fff' }}>{usage.used.toLocaleString()}</b> chars this session/browser
          {usage.lastAt ? <> · last {new Date(usage.lastAt).toLocaleString()}</> : null}
          <button onClick={reset} style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.06)', color: '#fff', fontSize: 10, cursor: 'pointer' }}>Reset</button>
        </div>
      )}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 8, lineHeight: 1.5 }}>
        Default quota {DEFAULT_MONTHLY_QUOTA.toLocaleString()} = F0 free tier. Live source refreshes every ~60s (Azure caches metrics briefly).
      </div>
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────
export function NewPage() {
  const [data, setData] = useState<ReelData>(DEFAULT_REEL)
  const [theme, setTheme] = useState<ThemeKey>(DEFAULT_REEL.theme)
  const [jsonDraft, setJsonDraft] = useState(SAMPLE_JSON)
  const [jsonError, setJsonError] = useState('')
  const [imgOverride, setImgOverride] = useState<string | null>(null)
  const [playing, setPlaying] = useState(true)
  const [T, setT] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [expProgress, setExpProgress] = useState(0)
  const [expStatus, setExpStatus] = useState('')
  const [copiedMsg, setCopiedMsg] = useState('')
  const [azureUsage, setAzureUsageState] = useState<AzureUsageState>(() => getAzureUsage())
  // Auto-tinting: sampled dominant color from the image's bottom edge.
  const [autoTint, setAutoTint] = useState(true)
  const [sampledTint, setSampledTint] = useState<string | null>(null)
  // Hook SFX: play once at T=0 when user manually starts playback.
  const [hookOnPlay, setHookOnPlay] = useState(true)
  // Image scrim opacity — controls the dark gradient over the photo (top +
  // bottom). Default 0.55 was 0.86 before: user asked for a less-heavy veil.
  const [scrimOpacity, setScrimOpacity] = useState(0.55)

  // Dynamic timing
  const [cues, setCues] = useState<Cues>(DEFAULT_CUES)
  const [endTime, setEndTime] = useState<number>(DEFAULT_END)
  const [tailGap, setTailGap] = useState<number>(0.5)

  // TTS
  const [provider, setProvider] = useState<Provider>(() => reelEnvBlocked() ? 'azure' : 'voicevox')
  const [bakeAudio, setBakeAudio] = useState(true)
  const [previewingKey, setPreviewingKey] = useState<string | null>(null)
  const [ttsError, setTtsError] = useState('')
  const [azureVoices, setAzureVoices] = useState<Record<VoiceRole, string>>({
    word: 'ja-JP-NanamiNeural', kaiwaA: 'ja-JP-KeitaNeural', kaiwaB: 'ja-JP-NanamiNeural', english: 'en-US-JennyNeural',
  })
  const [vvSpeakers, setVvSpeakers] = useState<VvSpeaker[]>([])
  const [vvLoadErr, setVvLoadErr] = useState('')
  const [voicevoxVoices, setVoicevoxVoices] = useState<Record<VoiceRole, number>>({
    word: 16, kaiwaA: 11, kaiwaB: 2, english: 0,
  })

  const audioCtxRef = useRef<AudioContext | null>(null)
  const bufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map())
  const durationRef = useRef<Map<string, number>>(new Map())
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([])
  const hookSfxRef = useRef<AudioBuffer | null>(null)

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
    return audioCtxRef.current
  }, [])

  const getHookSfx = useCallback(async (): Promise<AudioBuffer | null> => {
    if (hookSfxRef.current) return hookSfxRef.current
    try {
      const res = await fetch(HOOK_SFX_URL)
      if (!res.ok) throw new Error(`hook sfx ${res.status}`)
      const arr = await res.arrayBuffer()
      const ctx = getAudioCtx()
      const buf = await ctx.decodeAudioData(arr.slice(0))
      hookSfxRef.current = buf
      return buf
    } catch (e) {
      console.warn('hook sfx load failed', e)
      return null
    }
  }, [getAudioCtx])

  const activeData: ReelData = useMemo(() => (
    imgOverride ? { ...data, image: { ...data.image, src: imgOverride } } : data
  ), [data, imgOverride])

  const lineSpecs = useMemo(() => buildLineSpecs(activeData), [activeData])

  // Sample the image's bottom-edge dominant color so the subtitle panel below
  // can inherit it (no more visible seam when the user's photo has a bg that
  // clashes with the picked theme).
  useEffect(() => {
    let dead = false
    setSampledTint(null)
    sampleImageBottomColor(activeData.image.src).then(hex => {
      if (!dead) setSampledTint(hex)
    })
    return () => { dead = true }
  }, [activeData.image.src])

  const effectiveTint = autoTint ? sampledTint : null

  // Live-sync Azure TTS quota panel — recordAzureUsage() fires this event
  // whenever /api/tts/azure succeeds, plus the `storage` event covers other
  // tabs / other studio routes.
  useEffect(() => {
    const onChange = () => setAzureUsageState(getAzureUsage())
    window.addEventListener('azure-usage-change', onChange as EventListener)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener('azure-usage-change', onChange as EventListener)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  // Reset synth cache + timing when text/voices/provider change
  useEffect(() => {
    bufferCacheRef.current.clear()
    durationRef.current.clear()
    setCues(DEFAULT_CUES)
    setEndTime(DEFAULT_END)
  }, [activeData, azureVoices, voicevoxVoices, provider])

  // Fit stage to viewport
  useEffect(() => {
    const fit = () => {
      const el = wrapRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const s = Math.min(rect.width / 1080, rect.height / 1920)
      setScale(s > 0 ? s : 1)
    }
    fit()
    const ro = new ResizeObserver(fit)
    if (wrapRef.current) ro.observe(wrapRef.current)
    window.addEventListener('resize', fit)
    return () => { ro.disconnect(); window.removeEventListener('resize', fit) }
  }, [])

  // Playback tick — loops at dynamic endTime
  useEffect(() => {
    if (!playing || exporting) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setT(prev => {
        const next = prev + dt
        return next > endTime ? 0 : next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, exporting, endTime])

  // Load voicevox speakers when provider selected
  useEffect(() => {
    if (provider !== 'voicevox') return
    if (reelEnvBlocked()) {
      setVvLoadErr('VOICEVOX only works on localhost (needs http://127.0.0.1:50021). Switch to Azure to use TTS from prod.')
      setVvSpeakers([])
      return
    }
    let dead = false
    getSpeakers().then(s => { if (!dead) { setVvSpeakers(s); setVvLoadErr('') } })
      .catch(e => { if (!dead) { setVvSpeakers([]); setVvLoadErr(String(e?.message || e)) } })
    return () => { dead = true }
  }, [provider])

  // Editors
  const applyJson = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonDraft) as ReelData
      if (!parsed.word || !parsed.kaiwa || parsed.kaiwa.length < 1) throw new Error('JSON must include word + at least one kaiwa entry')
      if (!(parsed.theme in THEMES)) throw new Error(`theme must be one of: ${THEME_ORDER.join(', ')}`)
      setData(parsed)
      setTheme(parsed.theme)
      setJsonError('')
      setT(0)
    } catch (e: any) {
      setJsonError(e.message || String(e))
    }
  }, [jsonDraft])

  const resetJson = useCallback(() => {
    setData(DEFAULT_REEL)
    setTheme(DEFAULT_REEL.theme)
    setJsonDraft(SAMPLE_JSON)
    setJsonError('')
    setImgOverride(null)
    setT(0)
  }, [])

  const onImage = useCallback((f: File) => {
    const r = new FileReader()
    r.onload = () => setImgOverride(r.result as string)
    r.readAsDataURL(f)
  }, [])

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedMsg(`Copied ${label}`)
      setTimeout(() => setCopiedMsg(''), 1600)
    } catch { setCopiedMsg('Copy failed') }
  }, [])

  // Synth one line via chosen provider. English on VOICEVOX falls back to Azure.
  const synthLine = useCallback(async (spec: LineSpec): Promise<AudioBuffer> => {
    const useAzure = provider === 'azure' || spec.lang === 'en'
    const providerTag = useAzure ? 'azure' : 'voicevox'
    const voiceLabel = useAzure ? azureVoices[spec.role] : String(voicevoxVoices[spec.role])
    const cacheKey = `${providerTag}:${spec.role}:${voiceLabel}:${spec.text}`
    const cached = bufferCacheRef.current.get(cacheKey)
    if (cached) return cached

    const ctx = getAudioCtx()
    let buf: AudioBuffer
    if (useAzure) {
      const mp3 = await synthesizeAzure(spec.text, azureVoices[spec.role], { speed: 0.95 })
      buf = await ctx.decodeAudioData(mp3.slice(0))
    } else {
      const wav = await vvSynth(spec.text, voicevoxVoices[spec.role], { speed: 0.95, volume: 1.3 })
      buf = await ctx.decodeAudioData(wav.slice(0))
    }
    bufferCacheRef.current.set(cacheKey, buf)
    durationRef.current.set(spec.key, buf.duration)
    return buf
  }, [provider, azureVoices, voicevoxVoices, getAudioCtx])

  const stopPreview = useCallback(() => {
    for (const s of activeSourcesRef.current) { try { s.stop() } catch { /* ignore */ } }
    activeSourcesRef.current = []
    setPreviewingKey(null)
  }, [])

  const previewLine = useCallback(async (spec: LineSpec) => {
    setTtsError('')
    stopPreview()
    setPreviewingKey(spec.key)
    try {
      const buf = await synthLine(spec)
      const ctx = getAudioCtx()
      if (ctx.state === 'suspended') await ctx.resume()
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(ctx.destination)
      src.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter(x => x !== src)
        setPreviewingKey(prev => prev === spec.key ? null : prev)
      }
      activeSourcesRef.current.push(src)
      src.start()
    } catch (e: any) {
      setTtsError(e?.message || String(e))
      setPreviewingKey(null)
    }
  }, [synthLine, getAudioCtx, stopPreview])

  /** Synth all lines, compute dynamic timings, return schedule map. */
  const prepareSchedule = useCallback(async (
    onStatus?: (s: string) => void,
  ): Promise<{ bufs: Map<string, AudioBuffer>; cues: Cues; end: number; starts: Map<string, number> }> => {
    const bufs = new Map<string, AudioBuffer>()
    for (const spec of lineSpecs) {
      onStatus?.(`Synth ${spec.key}…`)
      bufs.set(spec.key, await synthLine(spec))
    }
    const durs = new Map<string, number>()
    bufs.forEach((buf, key) => durs.set(key, buf.duration))
    const { cues: newCues, end } = computeDynamicCues(durs, tailGap)
    const starts = computeLineStarts(lineSpecs, durs, newCues, tailGap)
    return { bufs, cues: newCues, end, starts }
  }, [lineSpecs, synthLine, tailGap])

  const previewAll = useCallback(async () => {
    setTtsError('')
    stopPreview()
    setPreviewingKey('prewarm')
    try {
      const { bufs, cues: newCues, end, starts } = await prepareSchedule(s => setPreviewingKey(`prewarm:${s}`))
      setCues(newCues)
      setEndTime(end)
      const ctx = getAudioCtx()
      if (ctx.state === 'suspended') await ctx.resume()
      const t0 = ctx.currentTime + 0.15
      const nodes: AudioBufferSourceNode[] = []
      // Opener SFX at T=0 with reduced gain.
      const hook = await getHookSfx()
      if (hook) {
        const g = ctx.createGain(); g.gain.value = 0.75; g.connect(ctx.destination)
        const s = ctx.createBufferSource(); s.buffer = hook; s.connect(g); s.start(t0)
        nodes.push(s)
      }
      lineSpecs.forEach(spec => {
        const buf = bufs.get(spec.key)
        const start = starts.get(spec.key)
        if (!buf || start == null) return
        const src = ctx.createBufferSource()
        src.buffer = buf
        src.connect(ctx.destination)
        src.start(t0 + start)
        nodes.push(src)
      })
      const last = nodes[nodes.length - 1]
      if (last) last.onended = () => {
        activeSourcesRef.current = []
        setPreviewingKey(null)
      }
      activeSourcesRef.current = nodes
      setPreviewingKey('sequence')
      // Restart preview playhead aligned with audio start
      setPlaying(false)
      flushSync(() => setT(0))
      setTimeout(() => setPlaying(true), 150)
    } catch (e: any) {
      setTtsError(e?.message || String(e))
      setPreviewingKey(null)
    }
  }, [prepareSchedule, lineSpecs, getAudioCtx, stopPreview, getHookSfx])

  /** Bake full audio track using computed schedule + OfflineAudioContext.
   *  Also mixes the hook SFX (woosh) at T=0 with reduced gain so the opener
   *  builds tension before speakers arrive at Word (~5s).
   */
  const bakeFullAudio = useCallback(async (
    schedule: { bufs: Map<string, AudioBuffer>; starts: Map<string, number>; end: number },
  ): Promise<AudioBuffer> => {
    const sampleRate = 48000
    const oac = new OfflineAudioContext(2, Math.ceil(schedule.end * sampleRate), sampleRate)
    const hook = await getHookSfx()
    if (hook) {
      const gain = oac.createGain()
      gain.gain.value = 0.75
      gain.connect(oac.destination)
      const src = oac.createBufferSource()
      src.buffer = hook
      src.connect(gain)
      src.start(0)
    }
    for (const spec of lineSpecs) {
      const buf = schedule.bufs.get(spec.key)
      const start = schedule.starts.get(spec.key)
      if (!buf || start == null) continue
      const src = oac.createBufferSource()
      src.buffer = buf
      src.connect(oac.destination)
      src.start(start)
    }
    return oac.startRendering()
  }, [lineSpecs, getHookSfx])

  /**
   * FAST export via pure canvas 2D renderer + shared WebCodecs encoder.
   * Matches the Kanji / Reel Studio path — encodes at hardware speed
   * (~5-15s for a 25s reel) instead of DOM-snapshot-per-frame (~90s).
   */
  const exportMp4 = useCallback(async () => {
    if (!webcodecsSupported()) {
      alert('MP4 export requires WebCodecs — use Chrome/Edge/Safari 17+.')
      return
    }
    stopPreview()
    setPlaying(false)
    setExporting(true)
    setExpProgress(0)
    setExpStatus('Preparing…')

    // 1) Compute schedule + optional audio
    let audioBuf: AudioBuffer | null = null
    let exportCues: Cues = cues
    let exportEnd: number = endTime
    if (bakeAudio) {
      setExpStatus('Synthesizing narration…')
      try {
        const sched = await prepareSchedule(s => setExpStatus(s))
        exportCues = sched.cues
        exportEnd = sched.end
        setCues(exportCues)
        setEndTime(exportEnd)
        setExpStatus('Baking audio track…')
        audioBuf = await bakeFullAudio(sched)
      } catch (e: any) {
        console.warn('audio pipeline failed, exporting silent', e)
        setExpStatus(`TTS failed (${e?.message || e}) — exporting silent`)
        audioBuf = null
      }
    }

    // 2) Preload image (may be dataURL or /assets path) + brand logos.
    setExpStatus('Loading image…')
    let img: HTMLImageElement | null = null
    let logoIcon: HTMLImageElement | null = null
    let logoWordmark: HTMLImageElement | null = null
    try { img = await loadImage(activeData.image.src) } catch (e) { console.warn('image load failed, using fallback bg', e) }
    try { logoIcon = await loadImage(LOGO_ICON_URL) } catch (e) { console.warn('logo-1 load failed', e) }
    try { logoWordmark = await loadImage(LOGO_WORDMARK_URL) } catch (e) { console.warn('logo-2 load failed', e) }

    // 3) Encoder wants an AudioBuffer — synthesize silence if we skipped TTS.
    if (!audioBuf) {
      const oac = new OfflineAudioContext(1, Math.ceil(exportEnd * 48000), 48000)
      audioBuf = await oac.startRendering()
    }

    // 4) Encode via shared canvas 2D → WebCodecs → mp4-muxer path.
    try {
      const fps = 30
      const blob = await encodeReelMp4({
        width: 1080,
        height: 1920,
        fps,
        durationSec: exportEnd,
        audio: audioBuf,
        draw: (frameCtx, t) => renderCanvasFrame(
          frameCtx, t, activeData, theme, exportCues, exportEnd, img,
          { icon: logoIcon, wordmark: logoWordmark },
          effectiveTint ? buildTintedBg(effectiveTint) : null,
          scrimOpacity,
        ),
        onProgress: (ratio, note) => {
          setExpProgress(ratio)
          if (note) setExpStatus(note)
        },
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${data.id || 'reel'}.mp4`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setExpProgress(1)
      setExpStatus(audioBuf.duration > 0.5 ? 'Downloaded ✓' : 'Downloaded ✓ (silent)')
    } catch (e: any) {
      setExpStatus('Failed: ' + (e?.message || String(e)))
      console.error(e)
    } finally {
      setExporting(false)
    }
  }, [bakeAudio, prepareSchedule, bakeFullAudio, activeData, theme, cues, endTime, data.id, stopPreview, effectiveTint, scrimOpacity])

  const stageWidth = useMemo(() => 1080 * scale, [scale])
  const stageHeight = useMemo(() => 1920 * scale, [scale])

  const btn: React.CSSProperties = {
    padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)',
    background: 'rgba(255,255,255,.06)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  }
  const smallBtn: React.CSSProperties = { ...btn, padding: '4px 10px', fontSize: 12 }
  const selectStyle: React.CSSProperties = { padding: '4px 6px', background: '#06060a', color: '#fff', border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, fontSize: 12 }

  // Voice options per provider
  const jpVoiceOptions = provider === 'azure'
    ? AZURE_VOICES.map(v => ({ value: v.name, label: `${v.emoji} ${v.label} (${v.gender[0].toUpperCase()})` }))
    : vvSpeakers.flatMap(sp => sp.styles.map(st => ({ value: String(st.id), label: `${sp.name} · ${st.name} (#${st.id})` })))

  return (
    <div style={{ display: 'flex', height: '100%', background: '#0a0a0a', color: '#fff', overflow: 'hidden' }}>
      {/* Left: preview */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,.08)', flexWrap: 'wrap' }}>
          <button
            onClick={async () => {
              const willPlay = !playing
              setPlaying(willPlay)
              // Fire hook SFX when user manually kicks off playback from the
              // start — matches the exported video's opener. Silent on auto
              // loop-back so the studio isn't noisy while iterating.
              if (willPlay && hookOnPlay && T < 0.25) {
                try {
                  const buf = await getHookSfx()
                  if (!buf) return
                  const ctx = getAudioCtx()
                  if (ctx.state === 'suspended') await ctx.resume()
                  const gain = ctx.createGain(); gain.gain.value = 0.75; gain.connect(ctx.destination)
                  const src = ctx.createBufferSource(); src.buffer = buf; src.connect(gain)
                  src.start()
                } catch { /* ignore — hook is best-effort */ }
              }
            }}
            disabled={exporting}
            style={{ ...btn, background: playing ? BRAND : 'rgba(255,255,255,.08)' }}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 240 }}>
            <span style={{ fontSize: 12, fontFamily: 'ui-monospace,monospace', opacity: 0.7, minWidth: 44 }}>{T.toFixed(2)}s</span>
            <input
              type="range" min={0} max={endTime} step={0.01} value={T} disabled={exporting}
              onChange={e => { setPlaying(false); setT(parseFloat(e.target.value)) }}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 12, fontFamily: 'ui-monospace,monospace', opacity: 0.5, minWidth: 44 }}>{endTime.toFixed(2)}s</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {THEME_ORDER.map(k => (
              <button
                key={k} disabled={exporting}
                onClick={() => setTheme(k)}
                style={{
                  ...btn, padding: '6px 12px', borderRadius: 999,
                  border: theme === k ? `1px solid ${AMBER}` : '1px solid rgba(255,255,255,.15)',
                  background: theme === k ? 'rgba(244,162,97,.14)' : 'rgba(255,255,255,.05)',
                }}
              >
                {THEMES[k].label}
              </button>
            ))}
          </div>
        </div>

        <div ref={wrapRef} style={{ flex: 1, display: 'grid', placeItems: 'center', overflow: 'hidden', padding: 16 }}>
          <div style={{ width: stageWidth, height: stageHeight, position: 'relative' }}>
            <div
              ref={stageRef}
              style={{
                position: 'absolute', top: 0, left: 0, width: 1080, height: 1920,
                transform: `scale(${scale})`, transformOrigin: 'top left',
                boxShadow: '0 30px 80px rgba(0,0,0,.6)', borderRadius: 24, overflow: 'hidden',
              }}
            >
              <Stage T={T} theme={theme} data={activeData} cues={cues} endTime={endTime} bgTint={effectiveTint} scrim={scrimOpacity} />
            </div>
          </div>
        </div>
      </div>

      {/* Right: controls — SCROLLABLE (fixes prior overlap) */}
      <aside style={{ width: 420, borderLeft: '1px solid rgba(255,255,255,.08)', display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden', background: '#0e0e12' }}>
        <AzureUsagePanel
          usage={azureUsage}
          onChange={setAzureUsageState}
          disabled={exporting}
        />

        <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>1. Image</div>
          <input
            type="file" accept="image/*"
            onChange={e => { const f = e.target.files?.[0]; if (f) onImage(f) }}
            disabled={exporting}
            style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}
          />
          {imgOverride && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src={imgOverride} alt="preview" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />
              <button onClick={() => setImgOverride(null)} style={{ ...btn, padding: '4px 10px' }}>Clear</button>
            </div>
          )}
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,.75)' }}>
            <input
              type="checkbox" checked={autoTint} onChange={e => setAutoTint(e.target.checked)} disabled={exporting}
              id="auto-tint"
            />
            <label htmlFor="auto-tint" style={{ flex: 1, cursor: 'pointer' }}>Auto-tint lower panel from image</label>
            {sampledTint && (
              <span title={`Sampled ${sampledTint}`} style={{ width: 22, height: 22, borderRadius: 6, background: sampledTint, border: '1px solid rgba(255,255,255,.15)' }} />
            )}
          </div>
          <label style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,.75)' }}>
            <input type="checkbox" checked={hookOnPlay} onChange={e => setHookOnPlay(e.target.checked)} disabled={exporting} />
            Play hook SFX when I press Play (first 5s)
          </label>
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,.7)', marginBottom: 4 }}>
              <span>Image dark scrim</span><span style={{ fontFamily: 'ui-monospace,monospace' }}>{Math.round(scrimOpacity * 100)}%</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.01} value={scrimOpacity}
              onChange={e => setScrimOpacity(parseFloat(e.target.value))}
              disabled={exporting}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 4, lineHeight: 1.4 }}>
              0% = fully transparent (raw photo). Applies to preview + exported MP4.
            </div>
          </div>
        </div>

        <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>2. Content JSON</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => copyToClipboard(SAMPLE_JSON, 'sample JSON')} style={smallBtn}>Copy sample</button>
              <button onClick={() => copyToClipboard(CLAUDE_PROMPT, 'Claude prompt')} style={smallBtn}>Copy Claude prompt</button>
            </div>
          </div>
          <textarea
            value={jsonDraft} onChange={e => setJsonDraft(e.target.value)}
            spellCheck={false} disabled={exporting}
            style={{
              height: 220, width: '100%', boxSizing: 'border-box',
              background: '#06060a', color: '#e2e8ff', border: '1px solid rgba(255,255,255,.1)',
              borderRadius: 8, padding: 10, fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', fontSize: 11.5, lineHeight: 1.45, resize: 'vertical',
            }}
          />
          {jsonError && (
            <div style={{ fontSize: 12, color: '#ff9ba4', background: 'rgba(230,57,70,.1)', padding: '6px 10px', borderRadius: 6 }}>{jsonError}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={applyJson} disabled={exporting} style={{ ...btn, background: BRAND }}>Apply JSON</button>
            <button onClick={resetJson} disabled={exporting} style={btn}>Reset</button>
          </div>
          {copiedMsg && <div style={{ fontSize: 12, color: AMBER }}>{copiedMsg}</div>}
        </div>

        <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>3. Voices &amp; TTS preview</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={previewAll} disabled={exporting || !!previewingKey} style={smallBtn}>▶ Preview all</button>
              <button onClick={stopPreview} disabled={!previewingKey} style={smallBtn}>■ Stop</button>
            </div>
          </div>

          {/* Provider toggle */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {(['voicevox', 'azure'] as Provider[]).map(p => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                disabled={exporting}
                style={{
                  ...smallBtn, flex: 1,
                  border: provider === p ? `1px solid ${AMBER}` : '1px solid rgba(255,255,255,.15)',
                  background: provider === p ? 'rgba(244,162,97,.14)' : 'rgba(255,255,255,.05)',
                }}
              >
                {p === 'voicevox' ? '🎙 VOICEVOX (local, free)' : '☁️ Azure (cloud, paid)'}
              </button>
            ))}
          </div>
          {provider === 'voicevox' && (
            <div style={{ fontSize: 11, color: vvLoadErr ? '#ff9ba4' : 'rgba(255,255,255,.5)', marginBottom: 10, lineHeight: 1.4 }}>
              {vvLoadErr
                ? vvLoadErr
                : vvSpeakers.length
                  ? `${vvSpeakers.length} VOICEVOX speakers loaded. English line falls back to Azure automatically.`
                  : 'Loading VOICEVOX speakers…'}
            </div>
          )}

          {/* Voice pickers */}
          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 6, alignItems: 'center', marginBottom: 10 }}>
            {(['word', 'kaiwaA', 'kaiwaB', 'english'] as VoiceRole[]).flatMap(role => {
              const isEnglishRow = role === 'english'
              const useAzureForRow = provider === 'azure' || isEnglishRow
              const value = useAzureForRow ? azureVoices[role] : String(voicevoxVoices[role])
              const opts = useAzureForRow
                ? (isEnglishRow
                    ? [
                        { value: 'en-US-JennyNeural', label: 'en-US Jenny' },
                        { value: 'en-US-AriaNeural', label: 'en-US Aria' },
                        { value: 'en-US-GuyNeural', label: 'en-US Guy' },
                        { value: 'en-GB-SoniaNeural', label: 'en-GB Sonia' },
                      ]
                    : AZURE_VOICES.map(v => ({ value: v.name, label: `${v.emoji} ${v.label} (${v.gender[0].toUpperCase()})` })))
                : jpVoiceOptions
              const label = role === 'word' ? 'Word (JP)' : role === 'kaiwaA' ? 'Kaiwa A' : role === 'kaiwaB' ? 'Kaiwa B' : 'English'
              return [
                <label key={role + '-l'} style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>
                  {label}{!isEnglishRow && provider === 'voicevox' ? ' ·vv' : ''}
                </label>,
                <select
                  key={role + '-s'}
                  value={value}
                  disabled={exporting || (opts.length === 0)}
                  onChange={e => {
                    if (useAzureForRow) {
                      setAzureVoices(v => ({ ...v, [role]: e.target.value }))
                    } else {
                      setVoicevoxVoices(v => ({ ...v, [role]: Number(e.target.value) }))
                    }
                  }}
                  style={selectStyle}
                >
                  {opts.length === 0
                    ? <option value="">(no voices)</option>
                    : opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>,
              ]
            })}
          </div>

          {/* Line preview rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
            {lineSpecs.map(spec => {
              const active = previewingKey === spec.key
              return (
                <button
                  key={spec.key}
                  onClick={() => active ? stopPreview() : previewLine(spec)}
                  disabled={exporting}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6,
                    border: '1px solid rgba(255,255,255,.08)', background: active ? 'rgba(244,162,97,.14)' : 'rgba(255,255,255,.03)',
                    color: '#fff', textAlign: 'left', cursor: 'pointer', fontSize: 12,
                  }}
                >
                  <span style={{ color: active ? AMBER : 'rgba(255,255,255,.5)', fontSize: 11, minWidth: 100 }}>{spec.key}</span>
                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: spec.lang === 'en' ? undefined : FJP }}>{spec.text}</span>
                  <span style={{ fontSize: 11, opacity: 0.5 }}>{active ? '■' : '▶'}</span>
                </button>
              )
            })}
          </div>

          {ttsError && (
            <div style={{ fontSize: 12, color: '#ff9ba4', background: 'rgba(230,57,70,.1)', padding: '6px 10px', borderRadius: 6, marginBottom: 8 }}>{ttsError}</div>
          )}

          {/* Tail gap slider */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,.7)', marginBottom: 4 }}>
              <span>Gap between lines</span><span>{tailGap.toFixed(2)}s</span>
            </div>
            <input
              type="range" min={0.15} max={1.5} step={0.05} value={tailGap}
              onChange={e => setTailGap(parseFloat(e.target.value))}
              disabled={exporting}
              style={{ width: '100%' }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,.75)' }}>
            <input type="checkbox" checked={bakeAudio} onChange={e => setBakeAudio(e.target.checked)} disabled={exporting} />
            Bake TTS audio into exported MP4
          </label>

          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 8, lineHeight: 1.5 }}>
            Timing: total is <b>{endTime.toFixed(1)}s</b> (extends past 25s if audio is longer). Recomputed on Preview all / Export.
          </div>
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>4. Export MP4</div>
          <button
            onClick={exportMp4} disabled={exporting}
            style={{ ...btn, width: '100%', padding: '12px 14px', background: exporting ? 'rgba(255,255,255,.08)' : AMBER, color: exporting ? '#fff' : '#111', fontSize: 14 }}
          >
            {exporting ? 'Exporting…' : `Export MP4 (1080×1920, ${endTime.toFixed(1)}s${bakeAudio ? ', +audio' : ', silent'})`}
          </button>
          {exporting && (
            <div style={{ marginTop: 10 }}>
              <div style={{ height: 6, background: 'rgba(255,255,255,.08)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(expProgress * 100).toFixed(1)}%`, background: BRAND, transition: 'width .1s linear' }} />
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginTop: 6, fontFamily: 'ui-monospace,monospace' }}>{expStatus}</div>
            </div>
          )}
          {!exporting && expStatus && (
            <div style={{ fontSize: 12, color: expStatus.startsWith('Failed') ? '#ff9ba4' : AMBER, marginTop: 8 }}>{expStatus}</div>
          )}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 10, lineHeight: 1.5 }}>
            Rendered via canvas 2D → WebCodecs H.264 + AAC → mp4-muxer. Hardware-accelerated, no DOM snapshot per frame.
          </div>
        </div>
      </aside>
    </div>
  )
}
