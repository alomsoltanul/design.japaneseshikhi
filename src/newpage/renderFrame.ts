// Canvas 2D renderer for the Word Reel design — pure function of the
// playhead T (seconds). Matches the DOM layout in NewPage.tsx as closely
// as canvas 2D can. Used for MP4 export so encoding is fast (no DOM
// snapshotting per frame).

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ThemeKey = 'indigo' | 'navy' | 'crimson' | 'forest' | 'paper' | 'black'

export interface Cues { Hook: number; Word: number; KaiwaA: number; KaiwaB: number; Explain: number; Replay: number; Outro: number }

export interface KaiwaLine {
  speaker: string; gender?: 'male' | 'female'; role: string
  jp: string; kana: string; romaji: string; en: string; bn?: string
}
export interface ReelData {
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

const FJP = "'Noto Sans JP','Hiragino Sans',sans-serif"
const FUI = "Inter,system-ui,sans-serif"
const FSERIF = "'DM Serif Display',Georgia,serif"
const BRAND = '#E63946'
const AMBER = '#F4A261'
const TEAL = '#2A9D8F'
const NAVY = '#1D3557'

interface Theme {
  label: string; bgStops: [string, string, string]; seam: string
  fg: string; muted: string; faint: string; accent: string
  chip: string; chipFg: string; card: string; cardEdge: string
  orbs: [string, string, string] | null; petals: boolean
}
const THEMES: Record<ThemeKey, Theme> = {
  indigo:  { label: 'Indigo',  bgStops: ['#0a0c18', '#0f0d1f', '#14102a'], seam: '#0a0c18', fg: '#fff', muted: 'rgba(255,255,255,.5)',  faint: 'rgba(255,255,255,.42)', accent: AMBER, chip: 'rgba(255,255,255,.08)', chipFg: 'rgba(255,255,255,.7)',  card: 'rgba(255,255,255,.07)', cardEdge: 'rgba(255,255,255,.1)',  orbs: ['rgba(107,33,168,.5)','rgba(230,57,70,.42)','rgba(244,162,97,.34)'], petals: true },
  navy:    { label: 'Navy',    bgStops: ['#1D3557', '#162943', '#101d2e'], seam: '#1D3557', fg: '#fff', muted: 'rgba(255,255,255,.55)', faint: 'rgba(255,255,255,.45)', accent: AMBER, chip: 'rgba(255,255,255,.1)',  chipFg: 'rgba(255,255,255,.75)', card: 'rgba(255,255,255,.08)', cardEdge: 'rgba(255,255,255,.14)', orbs: ['rgba(42,157,143,.4)','rgba(244,162,97,.3)','rgba(107,33,168,.34)'], petals: true },
  crimson: { label: 'Crimson', bgStops: ['#2b0f14', '#3a1017', '#48141c'], seam: '#2b0f14', fg: '#fff', muted: 'rgba(255,255,255,.55)', faint: 'rgba(255,255,255,.45)', accent: AMBER, chip: 'rgba(255,255,255,.09)', chipFg: 'rgba(255,255,255,.72)', card: 'rgba(255,255,255,.08)', cardEdge: 'rgba(255,255,255,.12)', orbs: ['rgba(230,57,70,.5)','rgba(244,162,97,.34)','rgba(107,33,168,.26)'], petals: true },
  forest:  { label: 'Forest',  bgStops: ['#04211d', '#062a25', '#08322c'], seam: '#04211d', fg: '#fff', muted: 'rgba(255,255,255,.55)', faint: 'rgba(255,255,255,.45)', accent: AMBER, chip: 'rgba(255,255,255,.09)', chipFg: 'rgba(255,255,255,.72)', card: 'rgba(255,255,255,.08)', cardEdge: 'rgba(255,255,255,.12)', orbs: ['rgba(42,157,143,.5)','rgba(244,162,97,.28)','rgba(230,57,70,.22)'],  petals: true },
  paper:   { label: 'Paper',   bgStops: ['#FFFFFF', '#FAFAFA', '#F9FAFB'], seam: '#FFFFFF', fg: NAVY,   muted: 'rgba(29,53,87,.6)',    faint: 'rgba(29,53,87,.45)',   accent: BRAND, chip: 'rgba(29,53,87,.06)',   chipFg: 'rgba(29,53,87,.7)',    card: 'rgba(29,53,87,.04)',   cardEdge: 'rgba(29,53,87,.1)',   orbs: null, petals: false },
  black:   { label: 'Black',   bgStops: ['#000000', '#000000', '#000000'], seam: '#000',    fg: '#fff', muted: 'rgba(255,255,255,.55)', faint: 'rgba(255,255,255,.42)', accent: AMBER, chip: 'rgba(255,255,255,.08)', chipFg: 'rgba(255,255,255,.72)', card: 'rgba(255,255,255,.06)', cardEdge: 'rgba(255,255,255,.12)', orbs: null, petals: true },
}

// Easings
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3)
const easeOutBack = (p: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2) }

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function wrapChars(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []
  let line = ''
  for (const ch of text) {
    if (line && ctx.measureText(line + ch).width > maxW) {
      out.push(line); line = ch
    } else { line += ch }
  }
  if (line) out.push(line)
  return out
}
function wrapWords(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/)
  const out: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? line + ' ' + w : w
    if (line && ctx.measureText(next).width > maxW) { out.push(line); line = w }
    else line = next
  }
  if (line) out.push(line)
  return out
}

// Draw text with letter-spacing (canvas 2D doesn't natively support it).
function drawTextSpaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: CanvasTextAlign = 'left') {
  if (!spacing) { ctx.textAlign = align; ctx.fillText(text, x, y); return }
  const totalWidth = [...text].reduce((s, ch) => s + ctx.measureText(ch).width, 0) + spacing * (text.length - 1)
  let cx = x
  if (align === 'center') cx = x - totalWidth / 2
  else if (align === 'right') cx = x - totalWidth
  ctx.textAlign = 'left'
  for (const ch of text) {
    ctx.fillText(ch, cx, y)
    cx += ctx.measureText(ch).width + spacing
  }
}

// Motion helpers
const enter = (T: number, start: number, dur = 0.55) => {
  const p = easeOutCubic(clamp((T - start) / dur, 0, 1))
  return { alpha: p, ty: (1 - p) * 38 }
}
const pop = (T: number, start: number, dur = 0.6) => {
  const raw = clamp((T - start) / dur, 0, 1)
  const p = easeOutBack(raw)
  return { alpha: clamp(raw / 0.6, 0, 1), scale: 0.84 + 0.16 * p }
}
const band = (T: number, a: number, b: number) => {
  const i = easeOutCubic(clamp((T - a) / 0.45, 0, 1))
  const o = 1 - clamp((T - (b - 0.35)) / 0.35, 0, 1)
  return { alpha: Math.min(i, o), dy: (1 - i) * 30 - (1 - o) * 14 }
}

// Draw a pill with padding-fit text. Returns pill width.
interface PillOpts {
  bg: string
  fg: string
  font: string
  padX?: number
  padY?: number
  spacing?: number
  border?: string
}
function drawPill(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, opts: PillOpts): number {
  const padX = opts.padX ?? 20, padY = opts.padY ?? 10
  ctx.font = opts.font
  const textW = opts.spacing
    ? [...text].reduce((s, ch) => s + ctx.measureText(ch).width, 0) + opts.spacing * (text.length - 1)
    : ctx.measureText(text).width
  // Approximate height from font-size (parse px)
  const fontPx = parseFloat(opts.font.match(/(\d+)px/)?.[1] ?? '20')
  const h = fontPx + padY * 2
  const w = textW + padX * 2
  ctx.fillStyle = opts.bg
  roundRect(ctx, x, y, w, h, 999)
  ctx.fill()
  if (opts.border) {
    ctx.strokeStyle = opts.border
    ctx.lineWidth = 1
    ctx.stroke()
  }
  ctx.fillStyle = opts.fg
  ctx.textBaseline = 'middle'
  drawTextSpaced(ctx, text, x + w / 2, y + h / 2 + 1, opts.spacing ?? 0, 'center')
  return w
}

// ── Image cache ──────────────────────────────────────────────────────────
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = e => reject(e)
    img.src = src
  })
}

/**
 * Return an offscreen canvas containing the source image tinted to `color`,
 * preserving alpha. Used to render brand logos as solid-white on dark bgs
 * without needing a separate white PNG file.
 */
const _tintCache = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>()
export function tintedImage(img: HTMLImageElement, color: string): HTMLCanvasElement {
  let perImg = _tintCache.get(img)
  if (!perImg) { perImg = new Map(); _tintCache.set(img, perImg) }
  const hit = perImg.get(color)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const cx = c.getContext('2d')!
  cx.drawImage(img, 0, 0)
  cx.globalCompositeOperation = 'source-in'
  cx.fillStyle = color
  cx.fillRect(0, 0, c.width, c.height)
  perImg.set(color, c)
  return c
}

// ── Region drawers ───────────────────────────────────────────────────────
export interface BrandLogos { icon: HTMLImageElement | null; wordmark: HTMLImageElement | null }

function drawImagePanel(ctx: CanvasRenderingContext2D, T: number, data: ReelData, t: Theme, img: HTMLImageElement | null, endTime: number, wordDim: number, pulse: number, logos?: BrandLogos) {
  ctx.save()
  // clip to top 60%
  ctx.beginPath(); ctx.rect(0, 0, 1080, 1150); ctx.clip()
  // fallback bg
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, 1080, 1150)

  // Ken Burns: scale from 1.05 → 1.12 over full duration, origin 50% 45%
  if (img) {
    const kb = 1.05 + 0.07 * (T / endTime)
    const iw = img.naturalWidth, ih = img.naturalHeight
    // cover fit to 1080x1150
    const scale = Math.max(1080 / iw, 1150 / ih)
    const dW = iw * scale * kb
    const dH = ih * scale * kb
    // origin 50% 45%
    const cx = 1080 / 2
    const cy = 1150 * 0.45
    const dx = cx - dW / 2
    const dy = cy - dH * 0.45
    ctx.drawImage(img, dx, dy, dW, dH)
  }

  // seam scrim gradient
  const scrim = ctx.createLinearGradient(0, 0, 0, 1150)
  scrim.addColorStop(0.00, 'rgba(10,12,24,.55)')
  scrim.addColorStop(0.26, 'rgba(10,12,24,0)')
  scrim.addColorStop(0.42, 'rgba(10,12,24,0)')
  scrim.addColorStop(0.88, 'rgba(10,12,24,.86)')
  scrim.addColorStop(1.00, t.seam)
  ctx.fillStyle = scrim
  ctx.fillRect(0, 0, 1080, 1150)

  // Level pill + 今日のことば (top-left)
  const enterL = enter(T, 0.15, 0.5)
  ctx.save()
  ctx.globalAlpha = enterL.alpha
  ctx.translate(0, enterL.ty)
  let lx = 44
  const lvlW = drawPill(ctx, lx, 44, data.level, { bg: BRAND, fg: '#fff', font: `700 26px ${FUI}`, spacing: 1.5 })
  lx += lvlW + 12
  drawPill(ctx, lx, 44, '今日のことば', { bg: 'rgba(255,255,255,.14)', fg: '#fff', font: `600 24px ${FJP}` })
  ctx.restore()

  // Brand pill (top-right) — semi-transparent dark plate + white logo + text
  const enterR = enter(T, 0.25, 0.5)
  ctx.save()
  ctx.globalAlpha = enterR.alpha
  ctx.translate(0, enterR.ty)
  ctx.font = `700 22px ${FUI}`
  const brandText = 'Japanese Manabi'
  const brandTextW = ctx.measureText(brandText).width
  const brandPadL = 14, brandPadR = 20, brandPadY = 10
  const iconW = 46, iconH = 36, brandGap = 12
  const contentH = Math.max(iconH, 22)
  const brandW = brandPadL + iconW + brandGap + brandTextW + brandPadR
  const brandH = contentH + brandPadY * 2
  const brandX = 1080 - 44 - brandW
  const brandY = 44
  ctx.fillStyle = 'rgba(10,12,24,.5)'
  roundRect(ctx, brandX, brandY, brandW, brandH, 999)
  ctx.fill()
  if (logos?.icon) {
    const tinted = tintedImage(logos.icon, '#ffffff')
    ctx.drawImage(tinted, brandX + brandPadL, brandY + (brandH - iconH) / 2, iconW, iconH)
  } else {
    ctx.fillStyle = BRAND
    ctx.beginPath()
    ctx.arc(brandX + brandPadL + iconW / 2, brandY + brandH / 2, iconH / 2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 22px ${FUI}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(brandText, brandX + brandPadL + iconW + brandGap, brandY + brandH / 2 + 1)
  ctx.restore()

  // Word block (bottom of panel)
  const jpLen = [...data.word.jp].length
  const kanjiSize = jpLen >= 6 ? 92 : jpLen === 5 ? 110 : 132
  const wp = pop(T, 0.35, 0.7)
  ctx.save()
  ctx.globalAlpha = wordDim
  // English (bottom-most)
  const enterEn = enter(T, 1.05, 0.5)
  ctx.save()
  ctx.globalAlpha *= enterEn.alpha
  ctx.translate(0, enterEn.ty)
  ctx.fillStyle = 'rgba(255,255,255,.55)'
  ctx.font = `500 40px ${FUI}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(data.word.en, 1080 / 2, 1150 - 74)
  ctx.restore()
  // Kana (above English)
  const enterKn = enter(T, 0.75, 0.5)
  ctx.save()
  ctx.globalAlpha *= enterKn.alpha
  ctx.translate(0, enterKn.ty)
  ctx.fillStyle = 'rgba(255,255,255,.82)'
  ctx.font = `500 52px ${FJP}`
  ctx.textAlign = 'center'
  ctx.fillText(data.word.kana, 1080 / 2, 1150 - 74 - 40 - 12)
  ctx.restore()
  // Kanji (top of stack) with pop + pulse + shadow
  ctx.save()
  ctx.globalAlpha *= wp.alpha
  const scale = wp.scale * pulse
  const kanjiY = 1150 - 74 - 40 - 12 - 52 - 12 - kanjiSize * 0.15
  ctx.translate(1080 / 2, kanjiY)
  ctx.scale(scale, scale)
  ctx.shadowColor = 'rgba(0,0,0,.6)'
  ctx.shadowBlur = 30
  ctx.shadowOffsetY = 6
  ctx.fillStyle = '#fff'
  ctx.font = `900 ${kanjiSize}px ${FJP}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(data.word.jp, 0, 0)
  ctx.restore()
  ctx.restore()

  ctx.restore()
}

function drawSubtitlePanel(ctx: CanvasRenderingContext2D, T: number, data: ReelData, t: Theme, cues: Cues) {
  const panelY = 1150, panelH = 770
  ctx.save()
  ctx.beginPath(); ctx.rect(0, panelY, 1080, panelH); ctx.clip()
  // linear-gradient(160deg, stop0, stop1@55%, stop2@100%)
  // Approximate 160deg direction: rotate slightly.
  const g = ctx.createLinearGradient(1080 * 0.5, panelY, 1080 * 0.5 + Math.sin((160 - 90) * Math.PI / 180) * 1080, panelY + panelH)
  g.addColorStop(0, t.bgStops[0])
  g.addColorStop(0.55, t.bgStops[1])
  g.addColorStop(1, t.bgStops[2])
  ctx.fillStyle = g
  ctx.fillRect(0, panelY, 1080, panelH)

  // Orbs (drifting radial gradients)
  if (t.orbs) {
    const drawOrb = (cx: number, cy: number, r: number, color: string) => {
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      rg.addColorStop(0, color)
      rg.addColorStop(0.7, color.replace(/,[.\d]+\)$/, ',0)'))
      rg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = rg
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
    }
    // Positions per handoff — offset within panel
    drawOrb(-120 + 260 + Math.sin(T * 0.4) * 44, panelY + 40 + 260 + Math.cos(T * 0.32) * 36, 260, t.orbs[0])
    drawOrb(1080 + 140 - 270 + Math.cos(T * 0.29) * 50, panelY + panelH + 100 - 270 + Math.sin(T * 0.36) * 40, 270, t.orbs[1])
    drawOrb(1080 - 120 - 180 + Math.sin(T * 0.5 + 2) * 38, panelY - 80 + 180, 180, t.orbs[2])
  }

  // Petals (5, falling)
  if (t.petals) {
    for (let i = 0; i < 5; i++) {
      const x = [8, 26, 47, 68, 87][i] / 100 * 1080
      const sz = [22, 16, 26, 18, 20][i]
      const spd = [11, 14, 9.5, 12.5, 15][i]
      const off = [0, 4, 7, 2, 9][i]
      const p = ((T + off) % spd) / spd
      const px = x + Math.sin(p * 6.3 + i) * 34
      const py = panelY - 80 + p * 900
      const rot = p * 320 * Math.PI / 180
      ctx.save()
      ctx.translate(px + sz / 2, py + sz / 2)
      ctx.rotate(rot)
      const petalGrad = ctx.createLinearGradient(-sz / 2, -sz / 2, sz / 2, sz / 2)
      petalGrad.addColorStop(0, 'rgba(255,182,197,.72)')
      petalGrad.addColorStop(1, 'rgba(255,140,165,.55)')
      ctx.fillStyle = petalGrad
      // approximate teardrop shape with quadratic curves
      ctx.beginPath()
      ctx.moveTo(-sz / 2, -sz / 2)
      ctx.quadraticCurveTo(sz / 2, -sz / 2, sz / 2, sz / 2)
      ctx.quadraticCurveTo(-sz / 2, sz / 2, -sz / 2, -sz / 2)
      ctx.fill()
      ctx.restore()
    }
  }

  // Bands — pick the one active enough to draw. Draw all in cross-fade.
  drawBandI(ctx, T, data, t, cues, panelY, panelH)
  drawBandA(ctx, T, data, t, cues, panelY, panelH)
  drawBandB(ctx, T, data, t, cues, panelY, panelH)
  drawBandE(ctx, T, data, t, cues, panelY, panelH)
  drawBandR(ctx, T, data, t, cues, panelY, panelH)

  ctx.restore()
}

function withBand(ctx: CanvasRenderingContext2D, T: number, a: number, b: number, panelY: number, panelH: number, draw: () => void) {
  const bd = band(T, a, b)
  if (bd.alpha <= 0.001) return
  ctx.save()
  ctx.globalAlpha = bd.alpha
  ctx.translate(0, bd.dy)
  // Content anchor: center-Y of panel (panelY + panelH/2)
  ctx.translate(72, panelY + panelH / 2)
  draw()
  ctx.restore()
}

function drawBandI(ctx: CanvasRenderingContext2D, T: number, data: ReelData, t: Theme, cues: Cues, panelY: number, panelH: number) {
  withBand(ctx, T, 0, cues.KaiwaA, panelY, panelH, () => {
    let y = 0
    // Cue label row
    const speaking = T >= cues.Word + 0.3 && T < cues.KaiwaA - 0.1
    // Eq bars
    for (let i = 0; i < 4; i++) {
      const scaleY = speaking ? (0.3 + 0.7 * Math.abs(Math.sin(i * 1.1 + 3))) : 0.25
      const barH = 44 * scaleY
      ctx.fillStyle = t.accent
      ctx.globalAlpha *= speaking ? 1 : 0.26
      roundRect(ctx, i * 16, y - barH / 2, 8, barH, 4)
      ctx.fill()
      ctx.globalAlpha /= speaking ? 1 : 0.26
    }
    // "AUDIO" / cue label to the right of Eq
    ctx.fillStyle = t.muted
    ctx.font = `600 26px ${FUI}`
    ctx.textBaseline = 'middle'
    drawTextSpaced(ctx, speaking ? 'WORD' : 'AUDIO', 4 * 16 + 8, y, 2.6, 'left')
    y += 26 + 26

    // Romaji (uppercase)
    ctx.fillStyle = t.muted
    ctx.font = `400 34px ${FUI}`
    ctx.textBaseline = 'alphabetic'
    drawTextSpaced(ctx, data.word.romaji.toUpperCase(), 0, y, 2.7, 'left')
    y += 34 + 10

    // Gloss (up to maxW-ish, wrap words)
    ctx.fillStyle = t.fg
    ctx.font = `600 40px ${FUI}`
    const glossLines = wrapWords(ctx, data.word.gloss, 900)
    for (const line of glossLines) { ctx.fillText(line, 0, y + 40); y += 40 * 1.35 }
    y += 34 - 40 * 0.35

    // Two tag pills
    ctx.font = `600 26px ${FUI}`
    const posW = drawPill(ctx, 0, y, data.word.pos, {
      bg: 'rgba(42,157,143,.18)', fg: t.petals ? '#6fe0d2' : '#1f7a70',
      font: `600 26px ${FUI}`, border: 'rgba(42,157,143,.4)',
    })
    drawPill(ctx, posW + 12, y, data.word.theme, {
      bg: t.chip, fg: t.chipFg, font: `600 26px ${FUI}`,
    })
    // Center the panel content vertically — we drew from top-of-anchor; shift
    // whole draw up so it sits centered. Since translate already moved to
    // center, and we drew downward, offset by -y/2. Approximate here by
    // shifting the layer earlier (accept slight anchor drift).
  }, )
}

function drawKaiwaBand(ctx: CanvasRenderingContext2D, T: number, k: KaiwaLine, t: Theme, _cues: Cues, phaseA: number, phaseB: number, panelY: number, panelH: number, avatarBg: string, avatarFg: string) {
  withBand(ctx, T, phaseA, phaseB, panelY, panelH, () => {
    let y = -180 // rough center-up offset
    // Avatar circle + role label
    ctx.fillStyle = avatarBg
    ctx.beginPath()
    ctx.arc(28, y + 28, 28, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = avatarFg
    ctx.font = `700 28px ${FUI}`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(k.speaker, 28, y + 28 + 1)
    ctx.textAlign = 'left'
    ctx.fillStyle = t.muted
    ctx.font = `600 26px ${FUI}`
    drawTextSpaced(ctx, k.role.toUpperCase(), 56 + 16, y + 28, 3, 'left')
    y += 56 + 22

    // Kana
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = t.muted
    ctx.font = `400 32px ${FJP}`
    ctx.fillText(k.kana, 0, y + 32); y += 32 + 8

    // JP (bold, big)
    ctx.fillStyle = t.fg
    ctx.font = `700 62px ${FJP}`
    const jpLines = wrapChars(ctx, k.jp, 900)
    for (const line of jpLines) { ctx.fillText(line, 0, y + 62); y += 62 * 1.28 }

    y += 14
    // Romaji
    ctx.fillStyle = t.faint
    ctx.font = `400 32px ${FUI}`
    drawTextSpaced(ctx, k.romaji, 0, y + 32, 1.6, 'left')
    y += 32 + 18

    // English
    ctx.fillStyle = t.accent
    ctx.font = `500 34px ${FUI}`
    ctx.fillText(k.en, 0, y + 34)
  })
}

function drawBandA(ctx: CanvasRenderingContext2D, T: number, data: ReelData, t: Theme, cues: Cues, panelY: number, panelH: number) {
  drawKaiwaBand(ctx, T, data.kaiwa[0], t, cues, cues.KaiwaA, cues.KaiwaB, panelY, panelH, TEAL, '#04211d')
}
function drawBandB(ctx: CanvasRenderingContext2D, T: number, data: ReelData, t: Theme, cues: Cues, panelY: number, panelH: number) {
  drawKaiwaBand(ctx, T, data.kaiwa[1] || data.kaiwa[0], t, cues, cues.KaiwaB, cues.Explain, panelY, panelH, BRAND, '#fff')
}

function drawBandE(ctx: CanvasRenderingContext2D, T: number, data: ReelData, t: Theme, cues: Cues, panelY: number, panelH: number) {
  withBand(ctx, T, cues.Explain, cues.Replay, panelY, panelH, () => {
    let y = -160
    // WHY IT WORKS pill
    drawPill(ctx, 0, y, 'WHY IT WORKS', {
      bg: 'rgba(244,162,97,.16)', fg: t.petals ? AMBER : '#b06a22',
      font: `700 26px ${FUI}`, border: 'rgba(244,162,97,.34)', spacing: 2.6, padX: 22,
    })
    y += 26 + 20 + 28

    ctx.fillStyle = t.fg
    ctx.font = `500 42px ${FUI}`
    ctx.textBaseline = 'alphabetic'
    const aLines = wrapWords(ctx, data.explanation.en_a, 930)
    for (const line of aLines) { ctx.fillText(line, 0, y + 42); y += 42 * 1.42 }
    y += 22

    ctx.fillStyle = t.muted
    ctx.font = `400 36px ${FUI}`
    const bLines = wrapWords(ctx, data.explanation.en_b, 930)
    for (const line of bLines) { ctx.fillText(line, 0, y + 36); y += 36 * 1.45 }
  })
}

function drawBandR(ctx: CanvasRenderingContext2D, T: number, data: ReelData, t: Theme, cues: Cues, panelY: number, panelH: number) {
  withBand(ctx, T, cues.Replay, cues.Outro, panelY, panelH, () => {
    let y = -180
    ctx.fillStyle = t.faint
    ctx.font = `600 26px ${FUI}`
    ctx.textBaseline = 'alphabetic'
    drawTextSpaced(ctx, 'ONE MORE TIME', 0, y + 26, 3.6, 'left')
    y += 26 + 26

    // Kanji + English inline
    ctx.fillStyle = t.fg
    ctx.font = `900 76px ${FJP}`
    const kanjiW = ctx.measureText(data.word.jp).width
    ctx.fillText(data.word.jp, 0, y + 76)
    ctx.fillStyle = t.muted
    ctx.font = `400 34px ${FUI}`
    ctx.fillText(data.word.en, kanjiW + 22, y + 76 - 6)
    y += 76 + 26

    // Recap card
    const cardW = 1080 - 72 * 2, cardH = 46 * 1.3 + 28 + 12 + 26
    ctx.fillStyle = t.card
    roundRect(ctx, 0, y, cardW, cardH + 30, 22)
    ctx.fill()
    ctx.strokeStyle = t.cardEdge
    ctx.lineWidth = 1
    roundRect(ctx, 0, y, cardW, cardH + 30, 22)
    ctx.stroke()
    ctx.fillStyle = t.fg
    ctx.font = `700 46px ${FJP}`
    ctx.fillText(data.kaiwa[0].jp, 30, y + 30 + 46)
    ctx.fillStyle = t.faint
    ctx.font = `400 28px ${FUI}`
    drawTextSpaced(ctx, data.kaiwa[0].romaji, 30, y + 30 + 46 * 1.3 + 28 + 6, 1.4, 'left')
  })
}

function drawOutro(ctx: CanvasRenderingContext2D, T: number, data: ReelData, cues: Cues, logos?: BrandLogos) {
  const outro = easeOutCubic(clamp((T - cues.Outro) / 0.6, 0, 1))
  if (outro <= 0.001) return
  ctx.save()
  ctx.globalAlpha = outro
  const scale = 0.98 + 0.02 * outro
  ctx.translate(1080 / 2, 1920 / 2)
  ctx.scale(scale, scale)
  ctx.translate(-1080 / 2, -1920 / 2)

  // BRAND red gradient — outro "last color" matches the CTA handle so the
  // subtitle panel (lower 40%) hands off cleanly regardless of theme.
  const g = ctx.createLinearGradient(1080 * 0.5, 0, 1080 * 0.5 + Math.sin((160 - 90) * Math.PI / 180) * 1080, 1920)
  g.addColorStop(0, '#c62d3a')
  g.addColorStop(0.55, BRAND)
  g.addColorStop(1, '#a91d29')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 1080, 1920)

  const cx = 1080 / 2, cy = 1920 / 2

  // Transparent logo tinted white so it reads against BRAND red.
  const logoBoxW = 760, logoBoxH = 360
  const logoBoxX = cx - logoBoxW / 2, logoBoxY = cy - 300
  if (logos?.wordmark) {
    const wm = logos.wordmark
    const tinted = tintedImage(wm, '#ffffff')
    const s = Math.min(logoBoxW / wm.naturalWidth, logoBoxH / wm.naturalHeight)
    const dw = wm.naturalWidth * s, dh = wm.naturalHeight * s
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,.35)'
    ctx.shadowBlur = 30
    ctx.shadowOffsetY = 12
    ctx.drawImage(tinted, logoBoxX + (logoBoxW - dw) / 2, logoBoxY + (logoBoxH - dh) / 2, dw, dh)
    ctx.restore()
  } else {
    ctx.fillStyle = '#fff'
    ctx.font = `400 82px ${FSERIF}`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText('Japanese Manabi', cx, logoBoxY + logoBoxH / 2)
  }

  // CTA line
  ctx.fillStyle = 'rgba(255,255,255,.92)'
  ctx.font = `400 36px ${FUI}`
  const lineLines = wrapWords(ctx, data.cta.line, 760)
  let ly = logoBoxY + logoBoxH + 60
  ctx.textAlign = 'center'
  for (const line of lineLines) { ctx.fillText(line, cx, ly); ly += 44 }

  // Handle pill — inverted (white bg, red text) so it pops against the red bg.
  ctx.font = `800 38px ${FUI}`
  const handleTextW = ctx.measureText(data.cta.handle).width
  const pillW = handleTextW + 92
  const pillH = 38 + 44
  const pillX = cx - pillW / 2
  const pillY = ly + 30
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,.3)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 10
  ctx.fillStyle = '#fff'
  roundRect(ctx, pillX, pillY, pillW, pillH, 999)
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = BRAND
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(data.cta.handle, cx, pillY + pillH / 2)

  ctx.restore()
}

/**
 * Draw one frame at time T (seconds).
 * ctx must be sized 1080x1920. Not required to clear beforehand — this
 * function overwrites every pixel.
 */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  T: number,
  data: ReelData,
  themeKey: ThemeKey,
  cues: Cues,
  endTime: number,
  img: HTMLImageElement | null,
  logos?: BrandLogos,
) {
  const t = THEMES[themeKey]
  // seam background covers everything (image scrim bottom + subtitle panel bg
  // both build on top of this baseline).
  ctx.fillStyle = t.seam
  ctx.fillRect(0, 0, 1080, 1920)

  const wordDim = T >= cues.KaiwaA && T < cues.Replay ? 0.5 : 1
  const speaking = (T >= cues.Word + 0.3 && T < cues.KaiwaA - 0.1)
  const pulse = speaking ? 1 + 0.03 * Math.sin((T - (cues.Word + 0.3)) * 7) : 1

  drawImagePanel(ctx, T, data, t, img, endTime, wordDim, pulse, logos)
  drawSubtitlePanel(ctx, T, data, t, cues)
  drawOutro(ctx, T, data, cues, logos)

  // Progress hairline (top 8px)
  ctx.fillStyle = 'rgba(255,255,255,.14)'
  ctx.fillRect(0, 0, 1080, 8)
  ctx.fillStyle = BRAND
  ctx.fillRect(0, 0, 1080 * clamp(T / endTime, 0, 1), 8)
}
