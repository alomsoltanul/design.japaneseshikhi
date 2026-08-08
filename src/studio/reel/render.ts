// Canvas renderer for the animated reel.
// Aspects: 'reel' (1080×1920, 9:16) or 'square' (1080×1080, 1:1).
// Design: Japanese Shikhi listening reel — indigo hero + drifting orbs +
// falling sakura, persistent image panel with numbered badges, caption cards,
// ring countdown, teal correct-answer reveal, explanation, CTA.
// System fonts → Japanese OK. All motion is derived from the global playhead
// so frames are seek-/export-accurate.
import type { LevelQuestion } from '../levels'

export type Aspect = 'reel' | 'square'

const BRAND = '#E63946'
const TEAL = '#2A9D8F'
const FJP = "'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP','Yu Gothic',sans-serif"
const FUI = "Inter,'Helvetica Neue',Arial,sans-serif"
const FBN = "'Hind Siliguri','Noto Sans Bengali','Kohinoor Bangla',Arial,sans-serif"
const FSERIF = "'DM Serif Display','Hoefler Text',Georgia,serif"

// Default reel dims (kept for back-compat with consumers that import W/H).
export const W = 1080
export const H = 1920

export interface Layout {
  W: number
  H: number
  panelS: number
  panelTop: number
  captionTop: number
  /** square vs reel — controls font sizing */
  sq: boolean
}

export function getLayout(aspect: Aspect): Layout {
  if (aspect === 'square') {
    const panelS = 470
    const panelTop = 132
    return { W: 1080, H: 1080, panelS, panelTop, captionTop: panelTop + panelS + 40, sq: true }
  }
  const panelS = 720
  const panelTop = 224
  return { W: 1080, H: 1920, panelS, panelTop, captionTop: panelTop + panelS + 96, sq: false }
}

export function getCanvasSize(aspect: Aspect): { width: number; height: number } {
  const l = getLayout(aspect)
  return { width: l.W, height: l.H }
}

export type SceneKind = 'question' | 'listen' | 'think' | 'answer' | 'feedback' | 'outro'

export interface SceneMeta {
  speaker?: 'male' | 'female' | 'narrator'
  jpText?: string
}

export interface ReelMedia {
  single?: HTMLImageElement | null
  panels?: (HTMLImageElement | null)[]
}

const SPEAKERS = {
  female: { jp: '女の人', emoji: '👩', color: '#ff5a67' },
  male:   { jp: '男の人', emoji: '🧑', color: '#22d3a6' },
  narrator: { jp: 'ナレーター', emoji: '🎙️', color: '#cfd6e4' },
} as const

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const easeOutBack = (t: number) => {
  const c1 = 1.70158, c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
const rise = (lt: number, delay: number, dur: number) => {
  const t = clamp((lt - delay) / dur, 0, 1)
  const e = easeOutBack(t)
  return { opacity: clamp((lt - delay) / (dur * 0.7), 0, 1), ty: (1 - e) * 46, scale: 0.86 + 0.14 * e }
}
const fade = (lt: number, delay: number, dur: number) => clamp((lt - delay) / dur, 0, 1)

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

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []
  for (const raw of text.split('\n')) {
    let line = ''
    for (const ch of raw) {
      if (line && ctx.measureText(line + ch).width > maxW) {
        out.push(line)
        line = ch
      } else {
        line += ch
      }
    }
    out.push(line)
  }
  return out
}

// ── background: indigo gradient + soft orbs + drifting sakura ──
const PETALS = Array.from({ length: 14 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin((i + 1) * (n * 12.9898)) * 43758.5453
    return x - Math.floor(x)
  }
  return {
    x0: r(1),
    size: 14 + r(2) * 20,
    speed: 34 + r(3) * 44,
    sway: 28 + r(4) * 66,
    swaySpd: 0.5 + r(5) * 0.9,
    phase: r(6) * 6.28,
    rotSpd: 30 + r(7) * 90,
    off: r(8) * 2000,
    opacity: 0.4 + r(9) * 0.4,
  }
})

function bg(ctx: CanvasRenderingContext2D, lay: Layout, time: number) {
  const { W, H } = lay
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#0a0c18')
  g.addColorStop(0.45, '#0f0d1f')
  g.addColorStop(1, '#14102a')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const orb = (cx: number, cy: number, size: number, col: string, sx: number, sy: number, spd: number, ph: number) => {
    const x = cx + Math.sin(time * spd + ph) * sx
    const y = cy + Math.cos(time * spd * 0.8 + ph) * sy
    const s = size * (1 + 0.12 * Math.sin(time * spd + ph))
    const rg = ctx.createRadialGradient(x, y, 0, x, y, s / 2)
    rg.addColorStop(0, col)
    rg.addColorStop(0.7, col.replace(/[\d.]+\)/, '0)'))
    rg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = rg
    ctx.fillRect(x - s, y - s, s * 2, s * 2)
  }
  orb(W * 0.18, H * 0.14, 760, 'rgba(124,58,237,0.55)', 70, 50, 0.18, 0)
  orb(W * 0.88, H * 0.28, 680, 'rgba(230,57,70,0.45)', 60, 70, 0.14, 2)
  orb(W * 0.15, H * 0.84, 700, 'rgba(244,162,97,0.4)', 80, 55, 0.12, 4)
  orb(W * 0.9, H * 0.9, 660, 'rgba(42,157,143,0.42)', 65, 60, 0.16, 1)

  for (const p of PETALS) {
    const y = ((time * p.speed + p.off) % (H + 160)) - 120
    const x = p.x0 * W + Math.sin(time * p.swaySpd + p.phase) * p.sway
    const rot = ((time * p.rotSpd + p.off) % 360) * Math.PI / 180
    ctx.save()
    ctx.translate(x + p.size / 2, y + p.size / 2)
    ctx.rotate(rot)
    const lg = ctx.createLinearGradient(-p.size / 2, -p.size / 2, p.size / 2, p.size / 2)
    lg.addColorStop(0, `rgba(255,182,197,${0.85 * p.opacity})`)
    lg.addColorStop(1, `rgba(255,140,165,${0.62 * p.opacity})`)
    ctx.fillStyle = lg
    ctx.beginPath()
    ctx.moveTo(-p.size / 2, p.size / 2)
    ctx.bezierCurveTo(-p.size / 2, -p.size / 2, -p.size / 2, -p.size / 2, p.size / 2, -p.size / 2)
    ctx.bezierCurveTo(p.size / 2, p.size / 2, p.size / 2, p.size / 2, -p.size / 2, p.size / 2)
    ctx.fill()
    ctx.restore()
  }

  const vg = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, Math.max(W, H) * 0.75)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(0.42, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.5)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, W, H)
}

function topBar(ctx: CanvasRenderingContext2D, lay: Layout, level: string) {
  const top = 50, left = 54
  ctx.save()
  ctx.shadowColor = 'rgba(230,57,70,0.4)'
  ctx.shadowBlur = 26
  ctx.shadowOffsetY = 8
  roundRect(ctx, left, top, 58, 58, 16)
  ctx.fillStyle = BRAND
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = '#fff'
  ctx.font = `800 24px ${FUI}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('JS', left + 29, top + 31)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#fff'
  ctx.font = `700 22px ${FUI}`
  ctx.fillText('Japanese Shikhi', left + 74, top + 22)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = `400 15px ${FBN}`
  ctx.fillText('JLPT লিসেনিং প্র্যাকটিস', left + 74, top + 44)

  const label = level
  ctx.font = `800 18px ${FUI}`
  const lw = ctx.measureText(label).width + 30
  const bx = lay.W - 54 - lw
  const by = top + 4
  ctx.fillStyle = 'rgba(230,57,70,0.13)'
  roundRect(ctx, bx, by, lw, 36, 12)
  ctx.fill()
  ctx.strokeStyle = 'rgba(230,57,70,0.4)'
  ctx.lineWidth = 1.5
  roundRect(ctx, bx, by, lw, 36, 12)
  ctx.stroke()
  ctx.fillStyle = BRAND
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, bx + lw / 2, by + 19)
}

function bottomBug(ctx: CanvasRenderingContext2D, lay: Layout) {
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = `600 19px ${FUI}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('japaneseshikhi.com  ·  🎧 N5 → N1', lay.W / 2, lay.H - 44)
}

function imagePanel(
  ctx: CanvasRenderingContext2D,
  lay: Layout,
  q: LevelQuestion,
  panels: (HTMLImageElement | null)[] | undefined,
  single: HTMLImageElement | null | undefined,
  reveal: boolean,
  revealP: number,
  enter: { opacity: number; ty: number; scale: number },
) {
  const S = lay.panelS
  const x = (lay.W - S) / 2
  const y = lay.panelTop

  ctx.save()
  ctx.globalAlpha = enter.opacity
  ctx.translate(x + S / 2, y + S / 2 + 20)
  ctx.scale(enter.scale, enter.scale)
  ctx.translate(-S / 2, -S / 2 + enter.ty)

  ctx.fillStyle = BRAND
  ctx.font = `800 ${lay.sq ? 13 : 15}px ${FUI}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('CHOOSE THE PICTURE', 2, -22)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = `400 ${lay.sq ? 14 : 16}px ${FBN}`
  ctx.fillText('৪টি ছবির একটি', lay.sq ? 200 : 240, -22)

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 70
  ctx.shadowOffsetY = 26
  roundRect(ctx, 0, 0, S, S, 28)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = 'rgba(230,57,70,0.2)'
  ctx.lineWidth = 3
  roundRect(ctx, 0, 0, S, S, 28)
  ctx.stroke()

  ctx.save()
  roundRect(ctx, 0, 0, S, S, 28)
  ctx.clip()

  const half = S / 2
  const hasPanels = !!panels && panels.length > 0 && panels.some(Boolean)
  const hasSingle = !!single && single.complete && single.naturalWidth > 0

  if (hasPanels) {
    for (let i = 0; i < 4; i++) {
      const im = panels![i]
      const col = i % 2, row = Math.floor(i / 2)
      const qx = col * half, qy = row * half
      if (im && im.complete && im.naturalWidth > 0) {
        const s = Math.max(half / im.naturalWidth, half / im.naturalHeight)
        const iw = im.naturalWidth * s, ih = im.naturalHeight * s
        ctx.drawImage(im, qx + (half - iw) / 2, qy + (half - ih) / 2, iw, ih)
      } else {
        ctx.fillStyle = i % 2 === 0 ? '#f4f0eb' : '#ece7e0'
        ctx.fillRect(qx, qy, half, half)
        ctx.fillStyle = '#15151c'
        ctx.font = `700 ${lay.sq ? 22 : 28}px ${FJP}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const lines = wrapLines(ctx, q.options[i]?.text ?? '', half - 32)
        const lh = lay.sq ? 28 : 36
        const y0 = qy + half / 2 - ((lines.length - 1) * lh) / 2
        lines.forEach((l, j) => ctx.fillText(l, qx + half / 2, y0 + j * lh))
      }
    }
  } else if (hasSingle) {
    const im = single!
    const s = Math.max(S / im.naturalWidth, S / im.naturalHeight)
    const iw = im.naturalWidth * s, ih = im.naturalHeight * s
    ctx.drawImage(im, (S - iw) / 2, (S - ih) / 2, iw, ih)
  } else {
    ctx.fillStyle = '#fafafa'
    ctx.fillRect(0, 0, S, S)
    for (let i = 0; i < 4; i++) {
      const col = i % 2, row = Math.floor(i / 2)
      const qx = col * half, qy = row * half
      ctx.fillStyle = '#15151c'
      ctx.font = `700 ${lay.sq ? 24 : 32}px ${FJP}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(q.options[i]?.text ?? '', qx + half / 2, qy + half / 2)
    }
  }

  ctx.strokeStyle = 'rgba(15,13,31,0.08)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(half, 4); ctx.lineTo(half, S - 4)
  ctx.moveTo(4, half); ctx.lineTo(S - 4, half)
  ctx.stroke()

  const badge = S * 0.072
  const pad = S * 0.035
  const NUMS = ['①', '②', '③', '④']
  const slots = [
    { x: pad, y: pad },
    { x: half + pad, y: pad },
    { x: pad, y: half + pad },
    { x: half + pad, y: half + pad },
  ]
  slots.forEach((s, i) => {
    ctx.fillStyle = 'rgba(15,13,31,0.86)'
    roundRect(ctx, s.x, s.y, badge, badge, 14)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `700 ${badge * 0.62}px ${FJP}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(NUMS[i], s.x + badge / 2, s.y + badge / 2)
  })

  if (reveal && revealP > 0) {
    const correctIdx = Math.max(0, q.options.findIndex(o => o.id === q.correct_option_id))
    const col = correctIdx % 2, row = Math.floor(correctIdx / 2)
    const qx = col * half, qy = row * half
    ctx.fillStyle = `rgba(42,157,143,${0.18 * revealP})`
    ctx.fillRect(qx, qy, half, half)
    ctx.strokeStyle = TEAL
    ctx.lineWidth = 8 * revealP
    roundRect(ctx, qx + 4, qy + 4, half - 8, half - 8, 18)
    ctx.stroke()
    const dr = badge * 0.55
    const dx = qx + half - dr - 14
    const dy = qy + half - dr - 14
    ctx.save()
    ctx.shadowColor = 'rgba(42,157,143,0.6)'
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 8
    ctx.beginPath()
    ctx.arc(dx, dy, dr * easeOutBack(revealP), 0, Math.PI * 2)
    ctx.fillStyle = TEAL
    ctx.fill()
    ctx.restore()
    ctx.fillStyle = '#fff'
    ctx.font = `800 ${dr * 1.1}px ${FJP}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('✓', dx, dy + 2)
  }

  ctx.restore()
  ctx.restore()
}

function waveform(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  time: number, active: boolean, color: string,
) {
  const bars = 22
  const gap = 4
  const bw = (w - gap * (bars - 1)) / bars
  for (let i = 0; i < bars; i++) {
    const base = 0.28 + 0.5 * Math.abs(Math.sin(i * 1.7 + 0.6))
    const pulse = active ? (0.55 + 0.45 * Math.sin(time * 11 + i * 0.9)) : 0.16
    const v = clamp(base * pulse, 0.07, 1)
    const bh = Math.max(3, v * h)
    ctx.fillStyle = color
    ctx.globalAlpha = active ? 0.92 : 0.4
    roundRect(ctx, x + i * (bw + gap), y + (h - bh) / 2, bw, bh, bw / 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function captionCard(
  ctx: CanvasRenderingContext2D,
  lay: Layout,
  top: number,
  height: number,
  draw: (innerW: number, innerH: number, padX: number, padY: number) => void,
  enter: { opacity: number; ty: number },
) {
  const left = lay.sq ? 40 : 60
  const w = lay.W - left * 2
  const padX = lay.sq ? 30 : 38
  const padY = lay.sq ? 26 : 34
  ctx.save()
  ctx.globalAlpha = enter.opacity
  ctx.translate(left, top + enter.ty)
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 70
  ctx.shadowOffsetY = 24
  roundRect(ctx, 0, 0, w, height, 30)
  ctx.fillStyle = 'rgba(255,255,255,0.97)'
  ctx.fill()
  ctx.restore()
  draw(w - padX * 2, height - padY * 2, padX, padY)
  ctx.restore()
}

// dialogueCaption removed — the `listen` scene now uses the top-60/bottom-40
// convoOverlay layout instead of the centered card.

function questionCaption(ctx: CanvasRenderingContext2D, lay: Layout, q: LevelQuestion, tLocal: number) {
  const enter = rise(tLocal, 0, 0.5)
  const jpSize = lay.sq ? 40 : 50
  const lineH = lay.sq ? 60 : 78
  const left = lay.sq ? 40 : 60
  const padX = lay.sq ? 30 : 38
  const padY = lay.sq ? 26 : 34
  const innerW = lay.W - left * 2 - padX * 2
  ctx.font = `700 ${jpSize}px ${FJP}`
  const lines = wrapLines(ctx, q.question_text, innerW - 16)
  const jpH = lines.length * lineH
  const enLines = q.question_text_en ? wrapLines((() => { ctx.font = `500 ${lay.sq ? 22 : 26}px ${FUI}`; return ctx })(), q.question_text_en, innerW) : []
  const enH = enLines.length * (lay.sq ? 30 : 34)
  const cardH = padY + 56 + 18 + jpH + enH + padY

  captionCard(ctx, lay, lay.captionTop, cardH, (_innerW2, _innerH, px, py) => {
    ctx.fillStyle = BRAND
    ctx.font = `800 ${lay.sq ? 14 : 15}px ${FUI}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('● QUESTION', px, py + 14)
    ctx.fillStyle = '#9aa0ad'
    ctx.font = `400 ${lay.sq ? 14 : 16}px ${FBN}`
    ctx.fillText('সঠিক ছবিটি বেছে নিন', px + (lay.sq ? 130 : 150), py + 14)

    ctx.fillStyle = '#15151c'
    ctx.font = `700 ${jpSize}px ${FJP}`
    ctx.textBaseline = 'alphabetic'
    let cy = py + 56 + jpSize
    for (const l of lines) {
      ctx.fillText(l, px, cy)
      cy += lineH
    }

    if (enLines.length) {
      ctx.fillStyle = '#3a3d45'
      ctx.font = `500 ${lay.sq ? 22 : 26}px ${FUI}`
      for (const l of enLines) {
        ctx.fillText(l, px, cy)
        cy += lay.sq ? 30 : 34
      }
    }
  }, enter)
}

function thinkRing(ctx: CanvasRenderingContext2D, lay: Layout, tLocal: number, dur: number) {
  const enter = rise(tLocal, 0, 0.4)
  const remain = Math.max(0, Math.ceil(dur - tLocal - 0.001))
  const prog = clamp(tLocal / dur, 0, 1)
  const cx = lay.W / 2
  // Push the ring further from the panel so the "かんがえて！ভাবুন!" label
  // doesn't crash into the panel/eyebrow above. Bigger offset on square,
  // where vertical room between panel bottom and bottom-bug is tight.
  const cy = lay.captionTop + (lay.sq ? 190 : 250)
  const R = lay.sq ? 90 : 120
  const tick = 1 + 0.12 * Math.abs(Math.sin(tLocal * Math.PI))

  ctx.save()
  ctx.globalAlpha = enter.opacity
  ctx.translate(0, enter.ty)

  ctx.fillStyle = '#fff'
  ctx.font = `700 ${lay.sq ? 28 : 38}px ${FJP}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Label sits in the gap above the ring; -36 keeps it close to the ring
  // rather than to the panel above.
  ctx.fillText('かんがえて！', cx - (lay.sq ? 60 : 90), cy - R - 36)
  ctx.fillStyle = BRAND
  ctx.font = `700 ${lay.sq ? 28 : 38}px ${FBN}`
  ctx.fillText('ভাবুন!', cx + (lay.sq ? 70 : 100), cy - R - 36)

  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.lineWidth = 14
  ctx.stroke()
  ctx.beginPath()
  const start = -Math.PI / 2
  const end = start + (1 - prog) * Math.PI * 2
  ctx.arc(cx, cy, R, start, end)
  ctx.strokeStyle = BRAND
  ctx.lineWidth = 14
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.lineCap = 'butt'

  ctx.fillStyle = '#fff'
  ctx.font = `800 ${Math.round((lay.sq ? 80 : 110) * tick)}px ${FUI}`
  ctx.textBaseline = 'middle'
  ctx.fillText(String(remain || 0), cx, cy + 6)
  ctx.restore()
}

function answerPill(ctx: CanvasRenderingContext2D, lay: Layout, q: LevelQuestion, tLocal: number) {
  const enter = rise(tLocal, 0.2, 0.5)
  const correct = q.options.find(o => o.id === q.correct_option_id)
  const idx = Math.max(0, q.options.findIndex(o => o.id === q.correct_option_id))
  const NUMS = ['①', '②', '③', '④']
  const label = `🎉 Correct: ${NUMS[idx] ?? ''} — ${correct?.text ?? ''}`

  ctx.save()
  ctx.globalAlpha = enter.opacity
  ctx.translate(0, enter.ty)
  ctx.font = `700 ${lay.sq ? 32 : 40}px ${FJP}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const tw = ctx.measureText(label).width
  const pw = tw + (lay.sq ? 64 : 88)
  const ph = lay.sq ? 68 : 84
  const px = (lay.W - pw) / 2
  const py = lay.captionTop + (lay.sq ? 50 : 80)
  ctx.save()
  ctx.shadowColor = 'rgba(42,157,143,0.5)'
  ctx.shadowBlur = 50
  ctx.shadowOffsetY = 16
  roundRect(ctx, px, py, pw, ph, 99)
  ctx.fillStyle = 'rgba(42,157,143,0.95)'
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = '#fff'
  ctx.fillText(label, lay.W / 2, py + ph / 2 + 2)
  ctx.restore()
}

function explainScene(
  ctx: CanvasRenderingContext2D,
  lay: Layout,
  q: LevelQuestion,
  tLocal: number,
  panels: (HTMLImageElement | null)[] | undefined,
  single: HTMLImageElement | null | undefined,
) {
  const head = rise(tLocal, 0.1, 0.5)
  const thumb = rise(tLocal, 0.3, 0.5)

  ctx.save()
  ctx.globalAlpha = head.opacity
  ctx.translate(0, head.ty)
  ctx.fillStyle = BRAND
  ctx.font = `800 ${lay.sq ? 20 : 24}px ${FUI}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('💡 EXPLANATION', lay.W / 2, lay.sq ? 200 : 320)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = `500 ${lay.sq ? 24 : 30}px ${FBN}`
  ctx.fillText('Key takeaway · কেন এই উত্তর সঠিক?', lay.W / 2, lay.sq ? 232 : 360)
  ctx.restore()

  const T = lay.sq ? 220 : 340
  const tx = (lay.W - T) / 2
  const ty = lay.sq ? 270 : 420
  const correctIdx = Math.max(0, q.options.findIndex(o => o.id === q.correct_option_id))
  const NUMS = ['①', '②', '③', '④']

  ctx.save()
  ctx.globalAlpha = thumb.opacity
  ctx.translate(0, thumb.ty)
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 60
  ctx.shadowOffsetY = 20
  roundRect(ctx, tx, ty, T, T, 26)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.restore()
  ctx.save()
  roundRect(ctx, tx, ty, T, T, 26)
  ctx.clip()
  const im = panels?.[correctIdx]
  if (im && im.complete && im.naturalWidth > 0) {
    const s = Math.max(T / im.naturalWidth, T / im.naturalHeight)
    const iw = im.naturalWidth * s, ih = im.naturalHeight * s
    ctx.drawImage(im, tx + (T - iw) / 2, ty + (T - ih) / 2, iw, ih)
  } else if (single && single.complete && single.naturalWidth > 0) {
    const sw = single.naturalWidth / 2, sh = single.naturalHeight / 2
    const sx = (correctIdx % 2) * sw
    const sy = Math.floor(correctIdx / 2) * sh
    ctx.drawImage(single, sx, sy, sw, sh, tx, ty, T, T)
  } else {
    ctx.fillStyle = '#15151c'
    ctx.font = `700 ${lay.sq ? 28 : 36}px ${FJP}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const lines = wrapLines(ctx, q.options[correctIdx]?.text ?? '', T - 40)
    const lh = lay.sq ? 36 : 44
    const y0 = ty + T / 2 - ((lines.length - 1) * lh) / 2
    lines.forEach((l, j) => ctx.fillText(l, tx + T / 2, y0 + j * lh))
  }
  ctx.restore()
  ctx.strokeStyle = TEAL
  ctx.lineWidth = 4
  roundRect(ctx, tx, ty, T, T, 26)
  ctx.stroke()
  ctx.save()
  ctx.shadowColor = 'rgba(42,157,143,0.6)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 8
  ctx.beginPath()
  ctx.arc(tx + T - 36, ty + T - 36, 28, 0, Math.PI * 2)
  ctx.fillStyle = TEAL
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = '#fff'
  ctx.font = `800 30px ${FJP}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('✓', tx + T - 36, ty + T - 34)
  roundRect(ctx, tx + 14, ty + 14, 48, 48, 14)
  ctx.fillStyle = 'rgba(15,13,31,0.86)'
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = `700 28px ${FJP}`
  ctx.fillText(NUMS[correctIdx] ?? '', tx + 38, ty + 40)
  ctx.restore()

  const expRows: { jp: string; text: string }[] = [
    { jp: 'こたえ', text: q.feedback.advice },
    { jp: 'ヒント', text: `💡 ${q.feedback.hint}` },
    { jp: 'なぜ', text: q.feedback.reason },
  ].filter(r => r.text)
  const STEP = 1.5
  const rowTop = ty + T + (lay.sq ? 24 : 60)
  const rowW = lay.W - (lay.sq ? 100 : 140)
  const minRowH = lay.sq ? 80 : 110
  const rowGap = lay.sq ? 14 : 20
  const txtSize = lay.sq ? 22 : 28
  // Pre-measure each row so multi-line rows don't bleed into the next box.
  ctx.font = `500 ${txtSize}px ${FUI}`
  const rowLayout = expRows.map(row => {
    const lines = wrapLines(ctx, row.text, rowW - 200)
    const dynH = Math.max(minRowH, 44 + lines.length * (txtSize + 8) + 28)
    return { row, lines, dynH }
  })
  // Cumulative y per row using actual heights, not fixed minRowH.
  let yAcc = 0
  const rowYs = rowLayout.map(({ dynH }, i) => {
    const y = yAcc
    yAcc += dynH + (i < rowLayout.length - 1 ? rowGap : 0)
    return y
  })
  rowLayout.forEach(({ row, lines, dynH }, i) => {
    const r = rise(tLocal, 1.0 + i * STEP, 0.5)
    ctx.save()
    ctx.globalAlpha = r.opacity
    ctx.translate((lay.W - rowW) / 2, rowTop + rowYs[i] + r.ty)
    roundRect(ctx, 0, 0, rowW, dynH, 22)
    ctx.fillStyle = 'rgba(255,255,255,0.07)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'
    ctx.lineWidth = 1.5
    roundRect(ctx, 0, 0, rowW, dynH, 22)
    ctx.stroke()
    ctx.fillStyle = BRAND
    ctx.font = `700 ${lay.sq ? 24 : 30}px ${FJP}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(row.jp, 26, 46)
    ctx.fillStyle = '#fff'
    ctx.font = `500 ${txtSize}px ${FUI}`
    let cy2 = 82
    for (const l of lines) {
      ctx.fillText(l, 26, cy2)
      cy2 += txtSize + 8
    }
    ctx.restore()
  })
}

function ctaScene(ctx: CanvasRenderingContext2D, lay: Layout, tLocal: number) {
  const a = rise(tLocal, 0.1, 0.6)
  const b = rise(tLocal, 0.5, 0.6)
  const c = rise(tLocal, 0.95, 0.55)
  const pulse = 1 + 0.045 * Math.sin(tLocal * 3.5)
  const cy = lay.H / 2

  ctx.save()
  ctx.globalAlpha = a.opacity
  ctx.translate(0, a.ty)
  const T = lay.sq ? 110 : 150
  ctx.save()
  ctx.shadowColor = 'rgba(230,57,70,0.5)'
  ctx.shadowBlur = 60
  ctx.shadowOffsetY = 20
  roundRect(ctx, (lay.W - T) / 2, cy - (lay.sq ? 220 : 320), T * pulse, T * pulse, 36)
  ctx.fillStyle = BRAND
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = '#fff'
  ctx.font = `800 ${lay.sq ? 48 : 64}px ${FUI}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('JS', lay.W / 2, cy - (lay.sq ? 220 : 320) + (T * pulse) / 2)
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = b.opacity
  ctx.translate(0, b.ty)
  ctx.fillStyle = '#fff'
  ctx.font = `400 ${lay.sq ? 60 : 78}px ${FSERIF}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('আরও শিখুন', lay.W / 2, cy - (lay.sq ? 80 : 120))
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.font = `500 ${lay.sq ? 28 : 36}px ${FBN}`
  ctx.fillText('প্রতিদিন নতুন JLPT লিসেনিং প্র্যাকটিস', lay.W / 2, cy - (lay.sq ? 36 : 60))
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = c.opacity
  ctx.translate(0, c.ty)
  ctx.font = `700 ${lay.sq ? 32 : 40}px ${FUI}`
  const label = 'japaneseshikhi.com  →'
  const tw = ctx.measureText(label).width
  const pw = tw + (lay.sq ? 80 : 110)
  const ph = lay.sq ? 78 : 96
  const px = (lay.W - pw) / 2
  const py = cy + (lay.sq ? 50 : 100)
  ctx.save()
  ctx.shadowColor = 'rgba(230,57,70,0.5)'
  ctx.shadowBlur = 56
  ctx.shadowOffsetY = 18
  roundRect(ctx, px, py, pw, ph, 99)
  ctx.fillStyle = BRAND
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, lay.W / 2, py + ph / 2 + 2)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = `400 ${lay.sq ? 22 : 26}px ${FBN}`
  ctx.fillText('🇧🇩 বাংলায় জাপানি শিখুন · N5 থেকে N1', lay.W / 2, cy + (lay.sq ? 170 : 250))
  ctx.restore()
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  scene: SceneKind,
  q: LevelQuestion,
  level: string,
  tLocal: number,
  dur: number,
  media?: ReelMedia,
  meta?: SceneMeta,
  tGlobal: number = tLocal,
  aspect: Aspect = 'reel',
) {
  const lay = getLayout(aspect)

  const panels = media?.panels
  const single = media?.single ?? null

  // NEW conversation layout applies only to `listen` scenes: top 60% =
  // scenario image (full-bleed), bottom 40% = dialogue overlay. Other scenes
  // keep the original quiz layout so we don't regress the answer/feedback/CTA.
  if (scene === 'listen') {
    convoBackground(ctx, lay)
    const sp = meta?.speaker ?? 'narrator'
    const jp = meta?.jpText ?? ''
    convoImageBand(ctx, lay, single, panels, tGlobal)
    topBar(ctx, lay, level)
    convoOverlay(ctx, lay, sp, jp, tLocal, dur, tGlobal)
    return
  }

  bg(ctx, lay, tGlobal)
  topBar(ctx, lay, level)
  bottomBug(ctx, lay)

  const showPanel = scene === 'question' || scene === 'think' || scene === 'answer'
  if (showPanel) {
    const enter = rise(tGlobal, 0, 0.55)
    const reveal = scene === 'answer'
    const revealP = reveal ? clamp(tLocal / 0.5, 0, 1) : 0
    imagePanel(ctx, lay, q, panels, single, reveal, revealP, enter)
  }

  if (scene === 'question') return questionCaption(ctx, lay, q, tLocal)
  if (scene === 'think') return thinkRing(ctx, lay, tLocal, dur)
  if (scene === 'answer') return answerPill(ctx, lay, q, tLocal)
  if (scene === 'feedback') return explainScene(ctx, lay, q, tLocal, panels, single)
  if (scene === 'outro') return ctaScene(ctx, lay, tLocal)
}

// ── conversation layout (new) ───────────────────────────────────────────────
// Split canvas 60/40: full-bleed image on top, dialogue overlay panel below.
// Speaker chip is inside the overlay. Both regions animate on scene enter.

function convoBackground(ctx: CanvasRenderingContext2D, lay: Layout) {
  // Solid ink so black bars behind cover-cropped images look intentional.
  ctx.fillStyle = '#0a0c18'
  ctx.fillRect(0, 0, lay.W, lay.H)
}

function convoImageBand(
  ctx: CanvasRenderingContext2D,
  lay: Layout,
  single: HTMLImageElement | null | undefined,
  panels: (HTMLImageElement | null)[] | undefined,
  tGlobal: number,
) {
  const bandH = Math.round(lay.H * 0.6)
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, lay.W, bandH)
  ctx.clip()

  // Pick the best source: scenario single, else first non-null panel, else nothing.
  const im = (single && single.complete && single.naturalWidth > 0)
    ? single
    : (panels?.find(p => p && p.complete && p.naturalWidth > 0) ?? null)

  if (im) {
    // subtle Ken Burns — 1.00 → 1.06 over ~10s, wraps
    const t = (tGlobal % 12) / 12
    const scale = 1.02 + t * 0.06
    const s = Math.max(lay.W / im.naturalWidth, bandH / im.naturalHeight) * scale
    const iw = im.naturalWidth * s
    const ih = im.naturalHeight * s
    ctx.drawImage(im, (lay.W - iw) / 2, (bandH - ih) / 2, iw, ih)
  } else {
    const g = ctx.createLinearGradient(0, 0, lay.W, bandH)
    g.addColorStop(0, '#1a1735')
    g.addColorStop(1, '#0f0d1f')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, lay.W, bandH)
  }

  // Fade to ink at the split so the overlay reads cleanly on any image.
  const fadeH = Math.round(bandH * 0.24)
  const fade = ctx.createLinearGradient(0, bandH - fadeH, 0, bandH)
  fade.addColorStop(0, 'rgba(10,12,24,0)')
  fade.addColorStop(1, 'rgba(10,12,24,0.85)')
  ctx.fillStyle = fade
  ctx.fillRect(0, bandH - fadeH, lay.W, fadeH)
  ctx.restore()
}

function convoOverlay(
  ctx: CanvasRenderingContext2D,
  lay: Layout,
  speaker: 'male' | 'female' | 'narrator',
  jpText: string,
  tLocal: number,
  dur: number,
  time: number,
) {
  const sp = SPEAKERS[speaker] ?? SPEAKERS.narrator
  const bandTop = Math.round(lay.H * 0.6)
  const bandH = lay.H - bandTop
  const active = tLocal > 0.25 && tLocal < dur - 0.45
  const enter = rise(tLocal, 0, 0.45)
  const textFade = fade(tLocal, 0.18, 0.4)

  ctx.save()
  ctx.globalAlpha = enter.opacity
  ctx.translate(0, enter.ty * 0.4)

  // Overlay background: rich ink with brand-tinted top border.
  const g = ctx.createLinearGradient(0, bandTop, 0, lay.H)
  g.addColorStop(0, '#12142a')
  g.addColorStop(1, '#0a0c18')
  ctx.fillStyle = g
  ctx.fillRect(0, bandTop, lay.W, bandH)
  ctx.fillStyle = sp.color
  ctx.fillRect(0, bandTop, lay.W, 4)

  const padX = lay.sq ? 40 : 60
  const padY = lay.sq ? 28 : 40
  const innerW = lay.W - padX * 2
  const contentX = padX
  const contentY = bandTop + padY

  // Speaker row: avatar + role label + waveform.
  const avR = lay.sq ? 30 : 38
  const avX = contentX + avR
  const avY = contentY + avR
  ctx.beginPath()
  ctx.arc(avX, avY, avR, 0, Math.PI * 2)
  ctx.fillStyle = sp.color + '2e'
  ctx.fill()
  ctx.strokeStyle = sp.color
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.font = `400 ${lay.sq ? 32 : 40}px ${FJP}`
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(sp.emoji, avX, avY + 2)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#fff'
  ctx.font = `700 ${lay.sq ? 24 : 30}px ${FJP}`
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(sp.jp, contentX + avR * 2 + 16, contentY + avR - 4)
  ctx.fillStyle = sp.color
  ctx.font = `600 ${lay.sq ? 16 : 20}px ${FUI}`
  const roleLbl = speaker === 'female' ? 'Female speaker' : speaker === 'male' ? 'Male speaker' : 'Narrator'
  ctx.fillText(roleLbl, contentX + avR * 2 + 16, contentY + avR + 24)

  const wfW = lay.sq ? 160 : 240
  const wfH = lay.sq ? 32 : 44
  waveform(ctx, contentX + innerW - wfW, contentY + avR - wfH / 2, wfW, wfH, time, active, sp.color)

  // Japanese line — big, wrapped, fade in slightly after enter.
  const jpSize = lay.sq ? 42 : 56
  const jpLineH = lay.sq ? 62 : 84
  ctx.font = `700 ${jpSize}px ${FJP}`
  const lines = wrapLines(ctx, jpText, innerW - 8)
  const jpTop = contentY + avR * 2 + (lay.sq ? 30 : 44)

  ctx.save()
  ctx.globalAlpha = enter.opacity * textFade
  ctx.fillStyle = '#fff'
  ctx.font = `700 ${jpSize}px ${FJP}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  let cy = jpTop + jpSize
  for (const l of lines) {
    ctx.fillText(l, contentX, cy)
    cy += jpLineH
  }
  ctx.restore()

  // Bottom bug lives inside the overlay so it doesn't collide with dialogue.
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = `600 ${lay.sq ? 16 : 18}px ${FUI}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('japaneseshikhi.com  ·  🎧 N5 → N1', lay.W / 2, lay.H - (lay.sq ? 22 : 30))

  ctx.restore()
}
