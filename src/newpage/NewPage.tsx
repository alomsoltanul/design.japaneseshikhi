// NewPage — /newpage route.
// Live preview + JSON/image editor + MP4 export for the Word Reel design
// (design_handoff_word_reel). Stage is 1080x1920, everything is a pure
// function of the playhead T (seconds).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { toCanvas } from 'html-to-image'
import { Muxer, ArrayBufferTarget } from 'mp4-muxer'

/* eslint-disable @typescript-eslint/no-explicit-any */

const DURATION = 25
const CUES = { Hook: 0, Word: 3.6, KaiwaA: 8.0, KaiwaB: 11.8, Explain: 15.2, Replay: 19.4, Outro: 22.4 }

const FJP = "'Noto Sans JP','Hiragino Sans',sans-serif"
const BRAND = '#E63946'
const AMBER = '#F4A261'
const TEAL = '#2A9D8F'
const NAVY = '#1D3557'

type ThemeKey = 'indigo' | 'navy' | 'crimson' | 'forest' | 'paper' | 'black'

interface KaiwaLine {
  speaker: string
  gender?: 'male' | 'female'
  role: string
  jp: string
  kana: string
  romaji: string
  en: string
  bn?: string
}
interface ReelData {
  id: string
  level: string
  theme: ThemeKey
  image: { src: string; alt: string }
  word: {
    jp: string; kana: string; romaji: string; en: string
    bn?: string; pos: string; theme: string; gloss: string
  }
  kaiwa: KaiwaLine[]
  explanation: { en_a: string; en_b: string; bn_a?: string }
  cta: { handle: string; line: string }
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
  cta: { handle: '@japaneseshikhi', line: 'One Japanese word a day, explained in Bangla.' },
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
- "cta.handle": "@japaneseshikhi"
- "cta.line": one warm brand line, under 70 chars

Schema (this is the current default reel — replace values, keep structure identical):

${SAMPLE_JSON}
`

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
  // Solid black — pure #000 (three identical stops), no orbs, petals kept for gentle motion parity.
  black: {
    label: 'Black', bg: 'linear-gradient(160deg,#000 0%,#000 55%,#000 100%)', seam: '#000',
    fg: '#fff', muted: 'rgba(255,255,255,.55)', faint: 'rgba(255,255,255,.42)', accent: AMBER,
    chip: 'rgba(255,255,255,.08)', chipFg: 'rgba(255,255,255,.72)',
    card: 'rgba(255,255,255,.06)', cardEdge: 'rgba(255,255,255,.12)',
    orbs: null, petals: true,
  },
}

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

function Stage({ T, theme, data }: { T: number; theme: ThemeKey; data: ReelData }) {
  const t = THEMES[theme]
  const k1 = data.kaiwa[0], k2 = data.kaiwa[1] || data.kaiwa[0]

  const AUDIO = [
    { at: CUES.Word + 0.3, until: CUES.Word + 2.0, label: 'word · 1 of 2' },
    { at: CUES.Word + 2.6, until: CUES.Word + 4.3, label: 'word · 2 of 2' },
    { at: CUES.KaiwaA + 0.2, until: CUES.KaiwaA + 3.6, label: 'speaker A' },
    { at: CUES.KaiwaB + 0.2, until: CUES.KaiwaB + 3.2, label: 'speaker B' },
    { at: CUES.Explain + 0.3, until: CUES.Explain + 4.0, label: 'english' },
    { at: CUES.Replay + 0.2, until: CUES.Replay + 2.8, label: 'recap' },
  ]
  const cue = AUDIO.find(c => T >= c.at && T < c.until) || null
  const speaking = !!cue

  const wordDim = T >= CUES.KaiwaA && T < CUES.Replay ? 0.5 : 1
  const pulse = speaking && T < CUES.KaiwaA ? 1 + 0.03 * Math.sin((T - cue!.at) * 7) : 1
  const kb = 1.05 + 0.07 * (T / DURATION)

  // step-down kanji size for long words (per handoff §gotchas)
  const jpLen = [...data.word.jp].length
  const kanjiSize = jpLen >= 6 ? 92 : jpLen === 5 ? 110 : 132

  const wp = pop(T, 0.35, 0.7)

  const bandI = band(T, 0, CUES.KaiwaA)
  const bandA = band(T, CUES.KaiwaA, CUES.KaiwaB)
  const bandB = band(T, CUES.KaiwaB, CUES.Explain)
  const bandE = band(T, CUES.Explain, CUES.Replay)
  const bandR = band(T, CUES.Replay, CUES.Outro)
  const outro = easeOutCubic(clamp((T - CUES.Outro) / 0.6, 0, 1))

  const kanaLine: React.CSSProperties = { fontFamily: FJP, fontSize: 32, color: t.muted, marginBottom: 8 }
  const jpLine: React.CSSProperties = { fontFamily: FJP, fontWeight: 700, fontSize: 62, lineHeight: 1.28, color: t.fg }
  const romaLine: React.CSSProperties = { fontSize: 32, color: t.faint, letterSpacing: '.05em', marginTop: 14 }
  const enLine: React.CSSProperties = { fontSize: 34, color: t.accent, fontWeight: 500, marginTop: 18 }
  const avatar: React.CSSProperties = { width: 56, height: 56, borderRadius: 999, fontSize: 28, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }
  const roleLabel: React.CSSProperties = { fontSize: 26, fontWeight: 600, color: t.muted, letterSpacing: '.12em', textTransform: 'uppercase' }

  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: 'Inter,system-ui,sans-serif', background: t.seam, overflow: 'hidden' }}>
      {/* image panel — top 60% (1080x1150) */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: 1080, height: 1150, overflow: 'hidden', background: '#111' }}>
        <img src={data.image.src} alt={data.image.alt} crossOrigin="anonymous" style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
          transformOrigin: '50% 45%', transform: `scale(${kb.toFixed(3)})`,
        }} />
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg,rgba(10,12,24,.55) 0%,rgba(10,12,24,0) 26%,rgba(10,12,24,0) 42%,rgba(10,12,24,.86) 88%,${t.seam} 100%)` }} />

        <div style={{ position: 'absolute', top: 44, left: 44, display: 'flex', gap: 12, alignItems: 'center', ...enter(T, 0.15, 0.5) }}>
          <span style={{ padding: '10px 20px', borderRadius: 999, background: BRAND, color: '#fff', fontSize: 26, fontWeight: 700, letterSpacing: '.06em' }}>{data.level}</span>
          <span style={{ padding: '10px 20px', borderRadius: 999, background: 'rgba(255,255,255,.14)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 24, fontWeight: 600, fontFamily: FJP }}>今日のことば</span>
        </div>
        <div style={{ position: 'absolute', top: 44, right: 44, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px 10px 12px', borderRadius: 999, background: 'rgba(10,12,24,.5)', backdropFilter: 'blur(8px)', ...enter(T, 0.25, 0.5) }}>
          <span style={{ width: 40, height: 40, borderRadius: 999, background: BRAND, color: '#fff', fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FJP }}>日</span>
          <span style={{ color: '#fff', fontSize: 22, fontWeight: 600 }}>Japanese Shikhi</span>
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

      {/* subtitle panel — bottom 40% (1080x770 @ y=1150) */}
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

        {/* Hook + word beats */}
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

        {/* Kaiwa A */}
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

        {/* Kaiwa B */}
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

        {/* Explain */}
        <div style={bandStyle(bandE)}>
          <div style={{ alignSelf: 'flex-start', padding: '10px 22px', borderRadius: 999, background: 'rgba(244,162,97,.16)', border: '1px solid rgba(244,162,97,.34)', color: t.petals ? AMBER : '#b06a22', fontSize: 26, fontWeight: 700, letterSpacing: '.1em', marginBottom: 28 }}>WHY IT WORKS</div>
          <div style={{ fontSize: 42, lineHeight: 1.42, color: t.fg, fontWeight: 500, maxWidth: 930 }}>{data.explanation.en_a}</div>
          <div style={{ fontSize: 36, lineHeight: 1.45, color: t.muted, marginTop: 22, maxWidth: 930 }}>{data.explanation.en_b}</div>
        </div>

        {/* Replay */}
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

      {/* outro */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg,#0a0c18,#14102a)', opacity: outro,
        transform: `scale(${(0.98 + 0.02 * outro).toFixed(3)})`, pointerEvents: 'none',
      }}>
        <div style={{ width: 150, height: 150, borderRadius: 999, background: BRAND, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FJP, fontSize: 74, fontWeight: 900, marginBottom: 44 }}>日</div>
        <div style={{ fontFamily: "'DM Serif Display',Georgia,serif", fontSize: 82, color: '#fff', lineHeight: 1.1, textAlign: 'center' }}>Japanese <span style={{ color: AMBER }}>Shikhi</span></div>
        <div style={{ fontSize: 36, color: 'rgba(255,255,255,.6)', marginTop: 22, textAlign: 'center', maxWidth: 760 }}>{data.cta.line}</div>
        <div style={{ marginTop: 52, padding: '22px 46px', borderRadius: 999, background: BRAND, color: '#fff', fontSize: 38, fontWeight: 700 }}>{data.cta.handle}</div>
      </div>

      {/* progress hairline */}
      <div style={{ position: 'absolute', top: 0, left: 0, height: 8, width: 1080, background: 'rgba(255,255,255,.14)' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, height: 8, width: 1080 * clamp(T / DURATION, 0, 1), background: BRAND }} />
    </div>
  )
}

const THEME_ORDER: ThemeKey[] = ['indigo', 'navy', 'crimson', 'forest', 'paper', 'black']

function webcodecsSupported() {
  const g = globalThis as any
  return typeof g.VideoEncoder === 'function' && typeof g.VideoFrame === 'function'
}

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

  const activeData: ReelData = useMemo(() => (
    imgOverride ? { ...data, image: { ...data.image, src: imgOverride } } : data
  ), [data, imgOverride])

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

  useEffect(() => {
    if (!playing || exporting) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setT(prev => {
        const next = prev + dt
        return next > DURATION ? 0 : next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, exporting])

  const applyJson = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonDraft) as ReelData
      if (!parsed.word || !parsed.kaiwa || parsed.kaiwa.length < 1) {
        throw new Error('JSON must include word + at least one kaiwa entry')
      }
      if (!(parsed.theme in THEMES)) {
        throw new Error(`theme must be one of: ${THEME_ORDER.join(', ')}`)
      }
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
    } catch {
      setCopiedMsg('Copy failed')
    }
  }, [])

  const exportMp4 = useCallback(async () => {
    if (!webcodecsSupported()) {
      alert('MP4 export requires WebCodecs — use Chrome/Edge/Safari 17+.')
      return
    }
    const stage = stageRef.current
    if (!stage) return
    setPlaying(false)
    setExporting(true)
    setExpProgress(0)
    setExpStatus('Preparing…')
    const fps = 30
    const totalFrames = Math.ceil(DURATION * fps)
    const frameDur = Math.round(1e6 / fps)
    let encoder: any = null
    try {
      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        fastStart: 'in-memory',
        video: { codec: 'avc', width: 1080, height: 1920 },
      })
      const VE: any = (globalThis as any).VideoEncoder
      const VideoFrameC: any = (globalThis as any).VideoFrame
      encoder = new VE({
        output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
        error: (e: any) => { throw e },
      })
      encoder.configure({ codec: 'avc1.42001f', width: 1080, height: 1920, framerate: fps, bitrate: 8_000_000 })

      const canvas = document.createElement('canvas')
      canvas.width = 1080
      canvas.height = 1920
      const ctx = canvas.getContext('2d')!

      for (let i = 0; i < totalFrames; i++) {
        const t = i / fps
        flushSync(() => setT(t))
        // wait one paint cycle so React commits + browser paints the frame
        await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))

        const snap = await toCanvas(stage, {
          width: 1080,
          height: 1920,
          pixelRatio: 1,
          cacheBust: false,
          // strip the display-time transform:scale so snapshot is at native 1080x1920
          style: { transform: 'none', transformOrigin: 'top left' },
        })
        ctx.clearRect(0, 0, 1080, 1920)
        ctx.drawImage(snap, 0, 0, 1080, 1920)

        const vf = new VideoFrameC(canvas, { timestamp: Math.round(i * 1e6 / fps), duration: frameDur })
        encoder.encode(vf, { keyFrame: i % (fps * 2) === 0 })
        vf.close()

        if (encoder.encodeQueueSize > fps) {
          await new Promise(r => setTimeout(r, 0))
        }
        setExpProgress((i + 1) / totalFrames)
        setExpStatus(`Frame ${i + 1}/${totalFrames}`)
      }

      await encoder.flush()
      muxer.finalize()
      const { buffer } = muxer.target as ArrayBufferTarget
      const blob = new Blob([buffer], { type: 'video/mp4' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${data.id || 'reel'}.mp4`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setExpStatus('Downloaded ✓')
    } catch (e: any) {
      setExpStatus('Failed: ' + (e?.message || String(e)))
      console.error(e)
    } finally {
      try { encoder?.close?.() } catch { /* ignore */ }
      setExporting(false)
    }
  }, [data.id])

  const stageWidth = useMemo(() => 1080 * scale, [scale])
  const stageHeight = useMemo(() => 1920 * scale, [scale])

  const btn: React.CSSProperties = {
    padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)',
    background: 'rgba(255,255,255,.06)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  }

  return (
    <div style={{ display: 'flex', height: '100%', background: '#0a0a0a', color: '#fff', overflow: 'hidden' }}>
      {/* Left: preview */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,.08)', flexWrap: 'wrap' }}>
          <button onClick={() => setPlaying(p => !p)} disabled={exporting} style={{ ...btn, background: playing ? BRAND : 'rgba(255,255,255,.08)' }}>
            {playing ? 'Pause' : 'Play'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 240 }}>
            <span style={{ fontSize: 12, fontFamily: 'ui-monospace,monospace', opacity: 0.7, minWidth: 44 }}>{T.toFixed(2)}s</span>
            <input
              type="range" min={0} max={DURATION} step={0.01} value={T} disabled={exporting}
              onChange={e => { setPlaying(false); setT(parseFloat(e.target.value)) }}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 12, fontFamily: 'ui-monospace,monospace', opacity: 0.5, minWidth: 44 }}>{DURATION.toFixed(2)}s</span>
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
              <Stage T={T} theme={theme} data={activeData} />
            </div>
          </div>
        </div>
      </div>

      {/* Right: controls */}
      <aside style={{ width: 420, borderLeft: '1px solid rgba(255,255,255,.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0e0e12' }}>
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
        </div>

        <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>2. Content JSON</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => copyToClipboard(SAMPLE_JSON, 'sample JSON')} style={{ ...btn, padding: '4px 10px', fontSize: 12 }}>Copy sample</button>
              <button onClick={() => copyToClipboard(CLAUDE_PROMPT, 'Claude prompt')} style={{ ...btn, padding: '4px 10px', fontSize: 12 }}>Copy Claude prompt</button>
            </div>
          </div>
          <textarea
            value={jsonDraft} onChange={e => setJsonDraft(e.target.value)}
            spellCheck={false} disabled={exporting}
            style={{
              flex: 1, minHeight: 200, width: '100%', boxSizing: 'border-box',
              background: '#06060a', color: '#e2e8ff', border: '1px solid rgba(255,255,255,.1)',
              borderRadius: 8, padding: 10, fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', fontSize: 11.5, lineHeight: 1.45, resize: 'none',
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

        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>3. Export MP4</div>
          <button
            onClick={exportMp4} disabled={exporting}
            style={{ ...btn, width: '100%', padding: '12px 14px', background: exporting ? 'rgba(255,255,255,.08)' : AMBER, color: exporting ? '#fff' : '#111', fontSize: 14 }}
          >
            {exporting ? 'Exporting…' : 'Export MP4 (1080×1920, 25s)'}
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
            Silent MP4. Snapshots DOM per frame via html-to-image → WebCodecs. Encode takes ~30–90s per reel.
          </div>
        </div>
      </aside>
    </div>
  )
}
