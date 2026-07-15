// Kanji Mind Map → video. Pure-canvas re-render of the reveal sequence with the
// same timings/easing as the DOM component, mixed with the synthesized SFX and
// encoded via WebCodecs MP4 (WebM MediaRecorder fallback).
import { encodeReelMp4, webcodecsSupported } from '../studio/reel/encodeMp4'
import { kanjiReveal, pillPops, nodeReveal, chime } from './sfx'
import { toBn } from './KanjiMindMap'
import type { KanjiEntry } from './types'
import { getKanjiTheme, type KanjiTheme, type PillTokens } from './themes'

export type KanjiAspect = 'reel' | 'fb' | 'youtube'

export const KANJI_ASPECTS: { id: KanjiAspect; label: string; size: string }[] = [
  { id: 'reel', label: 'Reel · 9:16', size: '1080×1920' },
  { id: 'fb', label: 'FB Post · 4:5', size: '1080×1350' },
  { id: 'youtube', label: 'YouTube · 16:9', size: '1920×1080' },
]

const FPS = 30
const FJP = "'Noto Sans JP','Hiragino Sans','Yu Gothic',sans-serif"
const FUI = "Inter,'Helvetica Neue',Arial,sans-serif"
const FBN = "'Noto Sans Bengali','Hind Siliguri',Arial,sans-serif"

interface KLayout {
  W: number; H: number
  hub: { x: number; y: number }
  rx: number; ry: number
  inset: number
  headerTop: number
  footerBottom: number
}

const LAYOUTS: Record<KanjiAspect, KLayout> = {
  fb: { W: 1080, H: 1350, hub: { x: 540, y: 700 }, rx: 400, ry: 430, inset: 64, headerTop: 48, footerBottom: 44 },
  reel: { W: 1080, H: 1920, hub: { x: 540, y: 985 }, rx: 420, ry: 620, inset: 64, headerTop: 110, footerBottom: 100 },
  youtube: { W: 1920, H: 1080, hub: { x: 960, y: 540 }, rx: 640, ry: 330, inset: 80, headerTop: 40, footerBottom: 36 },
}

export function getKanjiCanvasSize(aspect: KanjiAspect) {
  const l = LAYOUTS[aspect]
  return { width: l.W, height: l.H }
}

function nodePoints(l: KLayout): [number, number][] {
  const pts: [number, number][] = []
  for (let k = 0; k < 8; k++) {
    const a = ((22.5 + 45 * k) * Math.PI) / 180
    pts.push([l.hub.x + l.rx * Math.sin(a), l.hub.y - l.ry * Math.cos(a)])
  }
  return pts
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const easeOutQuint = (x: number) => 1 - Math.pow(1 - x, 5)

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function pill(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, fill: string, stroke: string) {
  rr(ctx, cx - w / 2, cy - h / 2, w, h, h / 2)
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke() }
}

export interface KanjiVideoOptions {
  aspect: KanjiAspect
  secondsPerWord: number
  sfxVolume: number
  holdSeconds?: number
  themeId?: string
}

export interface KanjiVideoProgress {
  stage: 'audio' | 'encode'
  ratio: number
  note?: string
}

export interface KanjiVideoResult {
  video: Blob
  mime: string
  ext: 'mp4' | 'webm'
  durationSec: number
}

interface Timeline {
  tHub: number
  tPills: number
  tNode: number[]
  tChime: number
  total: number
}

function buildTimeline(pace: number, hold: number): Timeline {
  const lead = 0.9
  const tHub = lead
  const tPills = lead + pace
  const tNode = Array.from({ length: 8 }, (_, i) => lead + pace * (2 + i))
  const tLast = tNode[7]
  return { tHub, tPills, tNode, tChime: tLast + 0.7, total: tLast + hold }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => resolve(null)
    im.src = src
  })
}

async function ensureFonts(entry: KanjiEntry) {
  const probes = [
    `700 148px ${FJP}`, `500 17px ${FJP}`, `600 21px ${FUI}`,
    `700 14px ${FUI}`, `600 14px ${FBN}`, `700 14px ${FBN}`,
  ]
  try {
    await Promise.all(probes.map(f => document.fonts.load(f, entry.kanji + 'শেখা Inter')))
  } catch { /* draw with fallbacks */ }
}

export async function buildKanjiVideo(
  entry: KanjiEntry,
  opts: KanjiVideoOptions,
  onProgress: (p: KanjiVideoProgress) => void,
): Promise<KanjiVideoResult> {
  const l = LAYOUTS[opts.aspect]
  const T = getKanjiTheme(opts.themeId)
  const pts = nodePoints(l)
  const tl = buildTimeline(opts.secondsPerWord, opts.holdSeconds ?? 2.6)
  const vol = opts.sfxVolume
  const data = entry.compounds.slice(0, 8)

  await ensureFonts(entry)
  const logo = await loadImage(T.logo)

  // ── audio ──
  onProgress({ stage: 'audio', ratio: 0.2, note: 'Mixing sound effects' })
  const sampleRate = 48000
  const octx = new OfflineAudioContext({ numberOfChannels: 1, length: Math.ceil((tl.total + 0.3) * sampleRate), sampleRate })
  kanjiReveal(octx, octx.destination, tl.tHub, vol)
  pillPops(octx, octx.destination, tl.tPills, vol)
  tl.tNode.forEach((t, i) => nodeReveal(octx, octx.destination, t, i, vol))
  chime(octx, octx.destination, tl.tChime, vol)
  const audio = await octx.startRendering()

  // ── frame drawer ──
  const draw = (ctx: CanvasRenderingContext2D, t: number) => {
    ctx.clearRect(0, 0, l.W, l.H)
    if (T.stageStops) {
      const g = ctx.createLinearGradient(0, 0, 0, l.H)
      T.stageStops.forEach((c, i) => g.addColorStop(i / (T.stageStops!.length - 1), c))
      ctx.fillStyle = g
    } else {
      ctx.fillStyle = T.stage
    }
    ctx.fillRect(0, 0, l.W, l.H)

    // connector lines (under cards)
    for (let i = 0; i < 8; i++) {
      const p = easeOutQuint(clamp01((t - tl.tNode[i]) / 0.6))
      if (p <= 0) continue
      const [nx, ny] = pts[i]
      ctx.strokeStyle = T.connector
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(l.hub.x, l.hub.y)
      ctx.lineTo(l.hub.x + (nx - l.hub.x) * p, l.hub.y + (ny - l.hub.y) * p)
      ctx.stroke()
    }

    drawHeader(ctx, l, entry, T)
    drawFooter(ctx, l, logo, T)
    drawHub(ctx, l, entry, t, tl, T)
    for (let i = 0; i < 8; i++) drawNode(ctx, pts[i], data[i], clamp01((t - (tl.tNode[i] + 0.15)) / 0.45), T)
  }

  const durationSec = tl.total
  if (webcodecsSupported()) {
    const mp4 = await encodeReelMp4({
      width: l.W, height: l.H, fps: FPS, durationSec, draw, audio,
      onProgress: (r, note) => onProgress({ stage: 'encode', ratio: r, note }),
    })
    return { video: mp4, mime: 'video/mp4', ext: 'mp4', durationSec }
  }
  const webm = await recordWebm(draw, audio, durationSec, l.W, l.H, (r, note) => onProgress({ stage: 'encode', ratio: r, note }))
  return { video: webm, mime: 'video/webm', ext: 'webm', durationSec }
}

// ── drawing pieces ────────────────────────────────────────

function drawHeader(ctx: CanvasRenderingContext2D, l: KLayout, entry: KanjiEntry, T: KanjiTheme) {
  const cy = l.headerTop + 15
  ctx.save()
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = `600 13px ${FUI}`
  ctx.fillStyle = T.sub
  try { (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '1.8px' } catch { /* older browsers */ }
  ctx.fillText('KANJI MIND MAP', l.inset, cy)
  try { (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px' } catch { /* ignore */ }

  // right pills: word count (teal) + JLPT level (red)
  const jlptText = `JLPT ${entry.jlpt}`
  const wordsText = `⚡ ${toBn(8)}টি শব্দ`
  ctx.font = `700 14px ${FUI}`
  const jlptW = ctx.measureText(jlptText).width + 32
  ctx.font = `700 14px ${FBN}`
  const wordsW = ctx.measureText(wordsText).width + 32
  const h = 30
  let x = l.W - l.inset - jlptW / 2
  pill(ctx, x, cy, jlptW, h, T.redPill.bg, T.redPill.border)
  ctx.textAlign = 'center'
  ctx.font = `700 14px ${FUI}`
  ctx.fillStyle = T.redPill.text
  ctx.fillText(jlptText, x, cy + 1)
  x -= jlptW / 2 + 10 + wordsW / 2
  pill(ctx, x, cy, wordsW, h, T.tealPill.bg, T.tealPill.border)
  ctx.font = `700 14px ${FBN}`
  ctx.fillStyle = T.tealPill.text
  ctx.fillText(wordsText, x, cy + 1)
  ctx.restore()
}

function drawFooter(ctx: CanvasRenderingContext2D, l: KLayout, logo: HTMLImageElement | null, T: KanjiTheme) {
  const cy = l.H - l.footerBottom - 13
  ctx.save()
  if (logo) {
    const h = 26
    const w = (logo.width / logo.height) * h
    ctx.drawImage(logo, l.inset, cy - h / 2, w, h)
  }
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'right'
  ctx.font = `500 14px ${FBN}`
  ctx.fillStyle = T.sub
  ctx.fillText('প্রতিদিন একটি কাঞ্জি 🎌', l.W - l.inset, cy)
  ctx.restore()
}

const HUB_W = 330
const HUB_H = 358

function drawHub(ctx: CanvasRenderingContext2D, l: KLayout, entry: KanjiEntry, t: number, tl: Timeline, T: KanjiTheme) {
  const p = easeOutQuint(clamp01((t - tl.tHub) / 0.55))
  if (p <= 0) return
  const scale = 0.6 + 0.4 * p
  ctx.save()
  ctx.globalAlpha = p
  ctx.translate(l.hub.x, l.hub.y)
  ctx.scale(scale, scale)

  // card
  ctx.save()
  if (!T.glassy) {
    ctx.shadowColor = 'rgba(0,0,0,0.12)'
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 10
  }
  rr(ctx, -HUB_W / 2, -HUB_H / 2, HUB_W, HUB_H, 24)
  ctx.fillStyle = T.card
  ctx.fill()
  ctx.restore()
  rr(ctx, -HUB_W / 2, -HUB_H / 2, HUB_W, HUB_H, 24)
  ctx.strokeStyle = T.cardBorder
  ctx.lineWidth = 1
  ctx.stroke()

  // content — stack from card top
  let y = -HUB_H / 2 + 30
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.font = `700 148px ${FJP}`
  ctx.fillStyle = T.heading
  ctx.fillText(entry.kanji, 0, y - 8)
  y += 148 + 10
  ctx.font = `600 21px ${FUI}`
  ctx.fillStyle = T.enStrong
  ctx.fillText(entry.meaningEn, 0, y)
  y += 26 + 10
  ctx.font = `400 18px ${FBN}`
  ctx.fillStyle = T.bn
  ctx.fillText(entry.meaningBn, 0, y)
  y += 26 + 8

  // reading pills
  const pp = easeOutQuint(clamp01((t - tl.tPills) / 0.45))
  if (pp > 0) {
    ctx.save()
    ctx.globalAlpha = p * pp
    ctx.translate(0, (1 - pp) * 10)
    drawReadingPill(ctx, y + 16, '音 ON', entry.onYomi, T.onPill)
    drawReadingPill(ctx, y + 16 + 33 + 8, '訓 KUN', entry.kunYomi, T.kunPill)
    ctx.restore()
  }
  ctx.restore()
}

function drawReadingPill(ctx: CanvasRenderingContext2D, cy: number, tag: string, reading: string, tokens: PillTokens) {
  ctx.font = `700 11px ${FUI}`
  const tagW = ctx.measureText(tag).width
  ctx.font = `500 17px ${FJP}`
  const readW = ctx.measureText(reading).width
  const w = 16 + tagW + 8 + readW + 16
  pill(ctx, 0, cy, w, 33, tokens.bg, tokens.border)
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = tokens.text
  let x = -w / 2 + 16
  ctx.font = `700 11px ${FUI}`
  ctx.fillText(tag, x, cy + 1)
  x += tagW + 8
  ctx.font = `500 17px ${FJP}`
  ctx.fillText(reading, x, cy + 1)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
}

const NODE_W = 208
const NODE_H = 126

function drawNode(
  ctx: CanvasRenderingContext2D,
  pt: [number, number],
  d: { word: string; kana: string; en: string; bn: string },
  raw: number,
  T: KanjiTheme,
) {
  const p = easeOutQuint(raw)
  if (p <= 0) return
  const scale = 0.7 + 0.3 * p
  ctx.save()
  ctx.globalAlpha = p
  ctx.translate(pt[0], pt[1])
  ctx.scale(scale, scale)

  ctx.save()
  if (!T.glassy) {
    ctx.shadowColor = 'rgba(0,0,0,0.07)'
    ctx.shadowBlur = 6
    ctx.shadowOffsetY = 2
  }
  rr(ctx, -NODE_W / 2, -NODE_H / 2, NODE_W, NODE_H, 16)
  ctx.fillStyle = T.card
  ctx.fill()
  ctx.restore()
  rr(ctx, -NODE_W / 2, -NODE_H / 2, NODE_W, NODE_H, 16)
  ctx.strokeStyle = T.cardBorder
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  let y = -NODE_H / 2 + 14
  ctx.font = `700 30px ${FJP}`
  ctx.fillStyle = T.heading
  ctx.fillText(d.word, 0, y)
  y += 36 + 2
  ctx.font = `500 15px ${FJP}`
  ctx.fillStyle = T.kana
  ctx.fillText(d.kana, 0, y)
  y += 18 + 6
  ctx.font = `600 14px ${FUI}`
  ctx.fillStyle = T.en
  ctx.fillText(d.en, 0, y)
  y += 17 + 2
  ctx.font = `400 14px ${FBN}`
  ctx.fillStyle = T.bn
  ctx.fillText(d.bn, 0, y)
  ctx.restore()
}

// ── WebM fallback (no WebCodecs) ──────────────────────────

function pickMime(): string {
  const c = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  for (const m of c) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m
  return 'video/webm'
}

async function recordWebm(
  draw: (ctx: CanvasRenderingContext2D, t: number) => void,
  mixed: AudioBuffer,
  total: number,
  width: number,
  height: number,
  onProgress: (r: number, note?: string) => void,
): Promise<Blob> {
  const actx = new AudioContext()
  const dest = actx.createMediaStreamDestination()
  const src = actx.createBufferSource()
  src.buffer = mixed
  src.connect(dest)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  draw(ctx, 0)
  const stream = canvas.captureStream(FPS)
  const combined = new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()])
  const rec = new MediaRecorder(combined, { mimeType: pickMime(), videoBitsPerSecond: 6_000_000 })
  const chunks: BlobPart[] = []
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }

  return new Promise<Blob>((resolve, reject) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }))
    rec.onerror = () => reject(new Error('MediaRecorder failed'))
    const T0 = actx.currentTime + 0.15
    src.start(T0)
    rec.start(100)
    const tick = () => {
      const t = actx.currentTime - T0
      if (t >= total) { try { rec.stop() } catch { /* ignore */ } void actx.close(); return }
      draw(ctx, Math.max(0, t))
      onProgress(t / total, `Recording ${Math.round(t)}s`)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}
