/* eslint-disable @typescript-eslint/no-explicit-any */
// Subtitle Studio video export.
// MP4 path: WebCodecs (VideoEncoder + AudioEncoder) + mp4-muxer. Offline, per-frame seek.
// WebM path: MediaRecorder over canvas.captureStream + video audio track. Realtime fallback.

import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import { buildTimeline, parseJP, parseVocab, activeIndices, type Line, type Timeline, type TimelineLine } from './timeline'

const WIDTH = 1080
const HEIGHT = 1920
const FPS = 30
const VIDEO_HALF = HEIGHT / 2 // 960

const COL_ACTIVE = '#E63946'
const COL_PAST = '#1D3557'
const COL_FUT = '#C0C6D0'
const COL_RT_ACT = 'rgba(230,57,70,.85)'
const COL_RT_DIM = '#9CA3AF'
const COL_BG_TOP = '#0b0b14'
const COL_BOTTOM = '#FFFFFF'
const COL_FG_2 = '#374151'
const COL_FG_3 = '#6B7280'
const COL_FG_4 = '#9CA3AF'
const COL_BORDER_SUB = '#EDEFF3'

const FONT_JP = "700 80px 'Noto Sans JP', system-ui, sans-serif"
const FONT_JP_RT = "500 34px 'Noto Sans JP', system-ui, sans-serif"
const FONT_ROMAJI = "500 40px 'Inter', system-ui, sans-serif"
const FONT_BANGLA = "600 52px 'Noto Sans Bengali', system-ui, sans-serif"
const FONT_VOCAB_JP = "700 36px 'Noto Sans JP', system-ui, sans-serif"
const FONT_VOCAB_BN = "500 30px 'Noto Sans Bengali', system-ui, sans-serif"
const FONT_LABEL = "700 24px 'Inter', system-ui, sans-serif"
const FONT_LEVEL = "700 26px 'Inter', system-ui, sans-serif"
const FONT_BRAND = "700 28px 'Inter', system-ui, sans-serif"
const FONT_BRAND_JP = "900 30px 'Noto Sans JP', system-ui, sans-serif"

export type VideoFit = 'cover' | 'contain' | 'fill'
export type VideoTransform = { fit: VideoFit; zoom: number; offsetX: number; offsetY: number }

export type ExportSource =
  | { kind: 'frame' }
  | { kind: 'video'; url: string; isFile: boolean; transform?: VideoTransform }

export type ExportOpts = {
  source: ExportSource
  lines: Line[]
  level: string
  onProgress?: (ratio: number, note?: string) => void
  signal?: AbortSignal
}

export function webcodecsAvailable(): boolean {
  return (
    typeof (globalThis as any).VideoEncoder === 'function' &&
    typeof (globalThis as any).AudioEncoder === 'function' &&
    typeof (globalThis as any).VideoFrame === 'function' &&
    typeof (globalThis as any).AudioData === 'function'
  )
}

async function ensureFonts() {
  try {
    if (document.fonts) {
      await Promise.all([
        document.fonts.load(FONT_JP),
        document.fonts.load(FONT_ROMAJI),
        document.fonts.load(FONT_BANGLA),
        document.fonts.load(FONT_LABEL),
      ])
      await document.fonts.ready
    }
  } catch { /* fonts fallback silently */ }
}

function loadVideoElement(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video')
    v.src = url
    v.crossOrigin = 'anonymous'
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    v.style.position = 'fixed'
    v.style.left = '-99999px'
    v.style.top = '0'
    v.style.width = '1px'
    v.style.height = '1px'
    v.style.opacity = '0'
    v.style.pointerEvents = 'none'
    document.body.appendChild(v)
    const onMeta = () => { v.removeEventListener('loadedmetadata', onMeta); v.removeEventListener('error', onErr); resolve(v) }
    const onErr = () => { v.removeEventListener('loadedmetadata', onMeta); v.removeEventListener('error', onErr); reject(new Error('video load failed')) }
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('error', onErr)
  })
}

function detachVideo(v: HTMLVideoElement) {
  v.pause()
  v.removeAttribute('src')
  v.load()
  if (v.parentNode) v.parentNode.removeChild(v)
}

function seekVideo(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise(resolve => {
    if (Math.abs(v.currentTime - t) < 1e-4) { resolve(); return }
    const onSeeked = () => { v.removeEventListener('seeked', onSeeked); resolve() }
    v.addEventListener('seeked', onSeeked)
    try { v.currentTime = t } catch { resolve() }
  })
}

async function decodeAudioFromUrl(url: string, targetSampleRate = 48000): Promise<AudioBuffer> {
  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext
  const tmp = new AC()
  try {
    const decoded: AudioBuffer = await new Promise((resolve, reject) => {
      tmp.decodeAudioData(buf.slice(0), resolve, reject)
    })
    // resample to targetSampleRate via OfflineAudioContext for encoder compatibility
    if (decoded.sampleRate === targetSampleRate) return decoded
    const OAC: any = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext
    const off = new OAC(Math.min(2, decoded.numberOfChannels), Math.ceil(decoded.duration * targetSampleRate), targetSampleRate)
    const src = off.createBufferSource()
    src.buffer = decoded
    src.connect(off.destination)
    src.start(0)
    const rendered: AudioBuffer = await off.startRendering()
    return rendered
  } finally {
    try { await tmp.close() } catch { /* noop */ }
  }
}

async function makeSilentBuffer(durationSec: number, sampleRate = 48000): Promise<AudioBuffer> {
  const OAC: any = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext
  const off = new OAC(2, Math.max(1, Math.ceil(durationSec * sampleRate)), sampleRate)
  return await off.startRendering()
}

// ---------- canvas drawing helpers ----------

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, Math.min(w, h) / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}

function drawVideoBg(ctx: CanvasRenderingContext2D, v: HTMLVideoElement | null, transform?: VideoTransform) {
  if (v && v.videoWidth && v.videoHeight) {
    const boxW = WIDTH, boxH = VIDEO_HALF
    const tf = transform || { fit: 'cover' as VideoFit, zoom: 1, offsetX: 0, offsetY: 0 }
    let dw: number, dh: number
    if (tf.fit === 'fill') {
      dw = boxW * tf.zoom
      dh = boxH * tf.zoom
    } else {
      const base = tf.fit === 'contain'
        ? Math.min(boxW / v.videoWidth, boxH / v.videoHeight)
        : Math.max(boxW / v.videoWidth, boxH / v.videoHeight)
      dw = v.videoWidth * base * tf.zoom
      dh = v.videoHeight * base * tf.zoom
    }
    const dx = (boxW - dw) / 2 + tf.offsetX * boxW
    const dy = (boxH - dh) / 2 + tf.offsetY * boxH
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, boxW, boxH)
    ctx.clip()
    ctx.fillStyle = COL_BG_TOP
    ctx.fillRect(0, 0, boxW, boxH)
    ctx.drawImage(v, dx, dy, dw, dh)
    ctx.restore()
  } else {
    // still-frame gradient
    const g = ctx.createLinearGradient(0, 0, WIDTH, VIDEO_HALF)
    g.addColorStop(0, '#1D3557')
    g.addColorStop(1, COL_BG_TOP)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, WIDTH, VIDEO_HALF)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = "600 32px 'Inter', system-ui, sans-serif"
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('STILL FRAME', WIDTH / 2, VIDEO_HALF / 2)
  }

  // top scrim
  const gt = ctx.createLinearGradient(0, 0, 0, 240)
  gt.addColorStop(0, 'rgba(8,9,18,.55)')
  gt.addColorStop(1, 'rgba(8,9,18,0)')
  ctx.fillStyle = gt
  ctx.fillRect(0, 0, WIDTH, 240)

  // bottom scrim
  const gb = ctx.createLinearGradient(0, VIDEO_HALF - 320, 0, VIDEO_HALF)
  gb.addColorStop(0, 'rgba(8,9,18,0)')
  gb.addColorStop(1, 'rgba(8,9,18,.8)')
  ctx.fillStyle = gb
  ctx.fillRect(0, VIDEO_HALF - 320, WIDTH, 320)
}

function drawTopChrome(ctx: CanvasRenderingContext2D, level: string) {
  // level pill (top-left)
  ctx.font = FONT_LEVEL
  ctx.textBaseline = 'middle'
  const lvW = ctx.measureText(level).width + 60
  ctx.fillStyle = COL_ACTIVE
  roundRect(ctx, 40, 40, lvW, 60, 30)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.fillText(level, 40 + lvW / 2, 40 + 32)

  // brand pill (top-right)
  const brandText = 'Japanese Shikhi'
  ctx.font = FONT_BRAND
  const bw = ctx.measureText(brandText).width + 24 + 60 + 20
  const bx = WIDTH - 40 - bw
  ctx.fillStyle = 'rgba(255,255,255,.18)'
  roundRect(ctx, bx, 40, bw, 60, 30)
  ctx.fill()
  ctx.fillStyle = COL_ACTIVE
  roundRect(ctx, bx + 10, 50, 40, 40, 10)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = FONT_BRAND_JP
  ctx.textAlign = 'center'
  ctx.fillText('あ', bx + 30, 40 + 34)
  ctx.font = FONT_BRAND
  ctx.textAlign = 'left'
  ctx.fillText(brandText, bx + 60, 40 + 32)
}

function drawSubtitleZone(
  ctx: CanvasRenderingContext2D,
  phMs: number,
  timeline: Timeline,
  lines: Line[],
  level: string,
) {
  const zoneY = VIDEO_HALF
  const zoneH = HEIGHT - VIDEO_HALF
  const padX = 60
  const padTop = 54

  // white bg
  ctx.fillStyle = COL_BOTTOM
  ctx.fillRect(0, zoneY, WIDTH, zoneH)

  const { li, aw } = activeIndices(timeline, phMs)
  const L: TimelineLine = timeline.lines[li] || { toks: [], wordStarts: [], start: 0, end: 1 }
  const wordCount = L.toks.length
  const wordPos = Math.max(0, Math.min(wordCount, aw + 1))
  const lineElapsed = Math.max(0, (phMs - L.start) / 1000)
  const lineTotal = Math.max(0, (L.end - L.start) / 1000)

  // ---- header row ----
  const headerY = zoneY + padTop
  ctx.textBaseline = 'middle'

  // Level pill (left)
  ctx.font = "800 26px 'Inter', system-ui, sans-serif"
  const lvW = ctx.measureText(level).width + 32
  ctx.fillStyle = COL_ACTIVE
  roundRect(ctx, padX, headerY - 22, lvW, 44, 22)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.fillText(level, padX + lvW / 2, headerY + 1)

  // 日本語 · Nihongo
  ctx.textAlign = 'left'
  let hx = padX + lvW + 16
  ctx.font = "700 30px 'Noto Sans JP', system-ui, sans-serif"
  ctx.fillStyle = COL_PAST
  ctx.fillText('日本語', hx, headerY)
  hx += ctx.measureText('日本語').width + 12
  ctx.font = "700 20px 'Inter', system-ui, sans-serif"
  ctx.fillStyle = COL_FG_4
  ctx.fillText('· NIHONGO', hx, headerY + 2)

  // Right meta: Line / Word / time
  const metaRight = `Line ${lines.length ? `${li + 1}/${lines.length}` : '0/0'}   ·   Word ${wordPos}/${wordCount || 0}   ·   ${lineElapsed.toFixed(1)}s / ${lineTotal.toFixed(1)}s`
  ctx.font = "700 22px 'Inter', system-ui, sans-serif"
  ctx.fillStyle = COL_FG_3
  ctx.textAlign = 'right'
  ctx.fillText(metaRight, WIDTH - padX, headerY)

  // progress bar
  const barY = headerY + 30
  const barX = padX
  const barW = WIDTH - padX * 2
  const barH = 10
  ctx.fillStyle = COL_BORDER_SUB
  roundRect(ctx, barX, barY, barW, barH, barH / 2)
  ctx.fill()
  const linePct = Math.min(1, Math.max(0, (phMs - L.start) / Math.max(1, (L.end - L.start))))
  if (linePct > 0) {
    const grad = ctx.createLinearGradient(barX, 0, barX + barW * linePct, 0)
    grad.addColorStop(0, COL_ACTIVE)
    grad.addColorStop(1, '#F4A261')
    ctx.fillStyle = grad
    roundRect(ctx, barX, barY, barW * linePct, barH, barH / 2)
    ctx.fill()
  }

  // word progress dots row
  if (wordCount > 0) {
    const dotsY = barY + barH + 14
    const dotH = 6
    const dotGap = 8
    const totalGap = dotGap * (wordCount - 1)
    const dotW = Math.max(6, (barW - totalGap) / wordCount)
    for (let k = 0; k < wordCount; k++) {
      const state = aw >= wordCount || k < aw ? 'past' : (k === aw ? 'active' : 'future')
      const dx = barX + k * (dotW + dotGap)
      ctx.fillStyle = state === 'active' ? COL_ACTIVE : state === 'past' ? COL_PAST : COL_BORDER_SUB
      roundRect(ctx, dx, dotsY, dotW, dotH, dotH / 2)
      ctx.fill()
    }
  }

  if (!lines.length) {
    ctx.fillStyle = COL_FG_4
    ctx.font = "500 36px 'Inter', system-ui, sans-serif"
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Add subtitle lines to see them here.', WIDTH / 2, zoneY + zoneH / 2)
    return
  }

  const lineData = lines[li] || { romaji: '', bangla: '', vocab: '' } as Line
  const toks = L.toks || []

  // token layout — wrap into lines
  const contentX = padX
  const contentW = WIDTH - padX * 2
  const jpFontSize = 80
  const jpRtSize = 34
  const jpLineH = jpFontSize + jpRtSize + 18
  const tokenWidths = toks.map(tk => {
    ctx.font = FONT_JP
    const sw = ctx.measureText(tk.s).width
    let fw = 0
    if (tk.f) {
      ctx.font = FONT_JP_RT
      fw = ctx.measureText(tk.f).width
    }
    return Math.max(sw, fw)
  })
  ctx.font = FONT_JP
  const wrappedRows: number[][] = []
  {
    let row: number[] = []
    let rowW = 0
    for (let i = 0; i < toks.length; i++) {
      const w = tokenWidths[i] + 20
      if (rowW + w > contentW && row.length) {
        wrappedRows.push(row)
        row = []
        rowW = 0
      }
      row.push(i)
      rowW += w
    }
    if (row.length) wrappedRows.push(row)
  }

  let y = barY + 60 + jpFontSize / 2 + jpRtSize + 10
  for (const row of wrappedRows) {
    // center row horizontally
    const rowW = row.reduce((s, i) => s + tokenWidths[i] + 20, 0) - 20
    let x = contentX + (contentW - rowW) / 2
    for (const i of row) {
      const state = (aw >= toks.length || i < aw) ? 'past' : (i === aw ? 'active' : 'future')
      const col = state === 'active' ? COL_ACTIVE : state === 'past' ? COL_PAST : COL_FUT
      const rtCol = state === 'active' ? COL_RT_ACT : COL_RT_DIM
      const w = tokenWidths[i]
      // furigana
      if (toks[i].f) {
        ctx.font = FONT_JP_RT
        ctx.fillStyle = rtCol
        ctx.textAlign = 'center'
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(toks[i].f, x + w / 2, y - jpFontSize - 6)
      }
      // base kanji/kana
      ctx.font = FONT_JP
      ctx.fillStyle = col
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(toks[i].s, x + w / 2, y)
      x += w + 20
    }
    y += jpLineH
  }

  // Romaji row
  const rParts = (lineData.romaji || '').trim().split(/\s+/).filter(Boolean)
  y += 12
  if (rParts.length) {
    ctx.font = FONT_ROMAJI
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
    const gap = 16
    const rWidths = rParts.map(p => ctx.measureText(p).width)
    const totW = rWidths.reduce((s, w) => s + w, 0) + gap * Math.max(0, rParts.length - 1)
    let rx = contentX + (contentW - totW) / 2
    for (let i = 0; i < rParts.length; i++) {
      let col = '#6B7280'
      if (rParts.length === toks.length) {
        const state = (aw >= toks.length || i < aw) ? 'past' : (i === aw ? 'active' : 'future')
        col = state === 'active' ? COL_ACTIVE : state === 'past' ? '#6B7280' : '#C0C6D0'
      }
      ctx.fillStyle = col
      ctx.fillText(rParts[i], rx, y)
      rx += rWidths[i] + gap
    }
    y += 50
  }

  // Bangla
  if (lineData.bangla) {
    ctx.font = FONT_BANGLA
    ctx.fillStyle = COL_PAST
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(lineData.bangla, WIDTH / 2, y + 52)
    y += 78
  }

  // Vocab pills
  const vocab = parseVocab(lineData.vocab)
  if (vocab.length) {
    ctx.textBaseline = 'alphabetic'
    ctx.font = FONT_VOCAB_JP
    const gap = 18
    const pillH = 68
    const items = vocab.map(v => {
      ctx.font = FONT_VOCAB_JP
      const jpW = ctx.measureText(v.jp).width
      ctx.font = FONT_VOCAB_BN
      const bnW = ctx.measureText(v.bn).width
      return { jp: v.jp, bn: v.bn, jpW, bnW, w: jpW + bnW + 20 + 40 }
    })
    // wrap
    const rows: typeof items[] = []
    {
      let row: typeof items = []
      let rowW = 0
      for (const it of items) {
        const iw = it.w + gap
        if (rowW + iw > contentW && row.length) { rows.push(row); row = []; rowW = 0 }
        row.push(it); rowW += iw
      }
      if (row.length) rows.push(row)
    }
    let py = y + 30
    for (const row of rows) {
      const rowW = row.reduce((s, it) => s + it.w + gap, 0) - gap
      let px = contentX + (contentW - rowW) / 2
      for (const it of row) {
        // pill bg
        ctx.fillStyle = 'rgba(230,57,70,.07)'
        roundRect(ctx, px, py, it.w, pillH, pillH / 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(230,57,70,.16)'
        ctx.lineWidth = 2
        roundRect(ctx, px, py, it.w, pillH, pillH / 2)
        ctx.stroke()
        // jp
        ctx.font = FONT_VOCAB_JP
        ctx.fillStyle = COL_ACTIVE
        ctx.textAlign = 'left'
        ctx.fillText(it.jp, px + 20, py + pillH / 2 + 12)
        // bn
        ctx.font = FONT_VOCAB_BN
        ctx.fillStyle = COL_FG_2
        ctx.fillText(it.bn, px + 20 + it.jpW + 20, py + pillH / 2 + 10)
        px += it.w + gap
      }
      py += pillH + 14
    }
  }
}

// ---------- MP4 (WebCodecs) ----------

async function pickVideoCodec(w: number, h: number, fps: number): Promise<string> {
  const candidates = ['avc1.640034', 'avc1.640033', 'avc1.4d0034', 'avc1.42e034', 'avc1.42001f']
  const VE: any = (globalThis as any).VideoEncoder
  for (const codec of candidates) {
    try {
      const sup = await VE.isConfigSupported({ codec, width: w, height: h, framerate: fps, bitrate: 8_000_000 })
      if (sup?.supported) return codec
    } catch { /* try next */ }
  }
  return 'avc1.42001f'
}

export async function exportSubtitleReelMp4(opts: ExportOpts): Promise<Blob> {
  const { source, lines, level, onProgress, signal } = opts
  const timeline = buildTimeline(lines)
  await ensureFonts()

  let videoEl: HTMLVideoElement | null = null
  let audio: AudioBuffer

  try {
    if (source.kind === 'video') {
      videoEl = await loadVideoElement(source.url)
      const videoDurSec = videoEl.duration || 0
      const durationSec = Math.max(videoDurSec, timeline.total / 1000)
      audio = await decodeAudioFromUrl(source.url, 48000).catch(async () => await makeSilentBuffer(durationSec))
      return await encodeMp4(videoEl, timeline, lines, level, durationSec, audio, source.transform, onProgress, signal)
    } else {
      const durationSec = Math.max(1, timeline.total / 1000)
      audio = await makeSilentBuffer(durationSec)
      return await encodeMp4(null, timeline, lines, level, durationSec, audio, undefined, onProgress, signal)
    }
  } finally {
    if (videoEl) detachVideo(videoEl)
  }
}

async function encodeMp4(
  videoEl: HTMLVideoElement | null,
  timeline: Timeline,
  lines: Line[],
  level: string,
  durationSec: number,
  audio: AudioBuffer,
  transform: VideoTransform | undefined,
  onProgress?: (r: number, note?: string) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const sampleRate = audio.sampleRate
  const channels = Math.min(2, audio.numberOfChannels || 1)

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    fastStart: 'in-memory',
    video: { codec: 'avc', width: WIDTH, height: HEIGHT },
    audio: { codec: 'aac', numberOfChannels: channels, sampleRate },
  })

  const VE: any = (globalThis as any).VideoEncoder
  const AE: any = (globalThis as any).AudioEncoder
  const VideoFrameC: any = (globalThis as any).VideoFrame
  const AudioDataC: any = (globalThis as any).AudioData

  const codec = await pickVideoCodec(WIDTH, HEIGHT, FPS)
  const videoEncoder = new VE({
    output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
    error: (e: any) => { throw e },
  })
  videoEncoder.configure({ codec, width: WIDTH, height: HEIGHT, framerate: FPS, bitrate: 8_000_000 })

  const audioEncoder = new AE({
    output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
    error: (e: any) => { throw e },
  })
  audioEncoder.configure({ codec: 'mp4a.40.2', sampleRate, numberOfChannels: channels, bitrate: 128_000 })

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')!

  const totalFrames = Math.max(1, Math.ceil(durationSec * FPS))
  const frameDur = Math.round(1e6 / FPS)

  if (videoEl) {
    // ensure decodable state
    try { await videoEl.play() } catch { /* muted, may fail */ }
    videoEl.pause()
    videoEl.currentTime = 0
    await seekVideo(videoEl, 0)
  }

  for (let i = 0; i < totalFrames; i++) {
    if (signal?.aborted) { throw new DOMException('Aborted', 'AbortError') }
    const tSec = i / FPS
    const tMs = tSec * 1000

    if (videoEl) {
      await seekVideo(videoEl, Math.min(tSec, videoEl.duration || tSec))
    }

    drawVideoBg(ctx, videoEl, transform)
    drawTopChrome(ctx, level)
    drawSubtitleZone(ctx, tMs, timeline, lines, level)

    const frame = new VideoFrameC(canvas, { timestamp: Math.round(i * 1e6 / FPS), duration: frameDur })
    videoEncoder.encode(frame, { keyFrame: i % (FPS * 2) === 0 })
    frame.close()

    if (videoEncoder.encodeQueueSize > FPS) await new Promise(r => setTimeout(r, 0))
    if (i % 6 === 0) onProgress?.((i / totalFrames) * 0.85, `Encoding video ${Math.round((i / totalFrames) * 100)}%`)
  }

  // audio
  const chunkFrames = 4800
  const totalAudioFrames = audio.length
  const ch0 = audio.getChannelData(0)
  const ch1 = channels > 1 && audio.numberOfChannels > 1 ? audio.getChannelData(1) : null
  for (let off = 0; off < totalAudioFrames; off += chunkFrames) {
    const n = Math.min(chunkFrames, totalAudioFrames - off)
    const planar = new Float32Array(n * channels)
    planar.set(ch0.subarray(off, off + n), 0)
    if (ch1) planar.set(ch1.subarray(off, off + n), n)
    const ad = new AudioDataC({
      format: 'f32-planar',
      sampleRate,
      numberOfFrames: n,
      numberOfChannels: channels,
      timestamp: Math.round((off / sampleRate) * 1e6),
      duration: Math.round((n / sampleRate) * 1e6),
      data: planar,
    })
    audioEncoder.encode(ad)
    ad.close()
  }
  onProgress?.(0.92, 'Finishing audio…')

  await videoEncoder.flush()
  await audioEncoder.flush()
  muxer.finalize()
  onProgress?.(1, 'Done')

  const { buffer } = muxer.target as ArrayBufferTarget
  return new Blob([buffer], { type: 'video/mp4' })
}

// ---------- WebM (MediaRecorder) fallback ----------

function pickWebmMime(): string {
  const cands = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  for (const c of cands) {
    if ((window as any).MediaRecorder?.isTypeSupported?.(c)) return c
  }
  return 'video/webm'
}

export async function exportSubtitleReelWebM(opts: ExportOpts): Promise<Blob> {
  const { source, lines, level, onProgress, signal } = opts
  const timeline = buildTimeline(lines)
  await ensureFonts()

  let videoEl: HTMLVideoElement | null = null
  try {
    let durationSec: number
    if (source.kind === 'video') {
      videoEl = await loadVideoElement(source.url)
      durationSec = Math.max(videoEl.duration || 0, timeline.total / 1000)
    } else {
      durationSec = Math.max(1, timeline.total / 1000)
    }

    const canvas = document.createElement('canvas')
    canvas.width = WIDTH
    canvas.height = HEIGHT
    const ctx = canvas.getContext('2d')!

    const canvasStream = (canvas as HTMLCanvasElement).captureStream(FPS)
    let audioTracks: MediaStreamTrack[] = []
    if (videoEl) {
      try {
        const vs: MediaStream | undefined = (videoEl as any).captureStream?.() || (videoEl as any).mozCaptureStream?.()
        if (vs) audioTracks = vs.getAudioTracks()
      } catch { /* no audio track */ }
    }
    const combined = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks])
    const rec = new MediaRecorder(combined, { mimeType: pickWebmMime(), videoBitsPerSecond: 6_000_000 })
    const chunks: BlobPart[] = []
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data) }

    const done = new Promise<Blob>((resolve, reject) => {
      rec.onstop = () => resolve(new Blob(chunks, { type: pickWebmMime() }))
      rec.onerror = e => reject((e as any).error || new Error('MediaRecorder error'))
    })

    if (videoEl) {
      videoEl.currentTime = 0
      videoEl.muted = false
      try { await videoEl.play() } catch { /* autoplay may fail; user gesture required */ }
    }

    rec.start(200)
    const startedAt = performance.now()
    let stopped = false
    const stop = () => { if (!stopped) { stopped = true; try { rec.stop() } catch { /* noop */ } if (videoEl) videoEl.pause() } }

    const loop = () => {
      if (stopped) return
      if (signal?.aborted) { stop(); return }
      const elapsedMs = performance.now() - startedAt
      const tMs = videoEl ? videoEl.currentTime * 1000 : elapsedMs
      drawVideoBg(ctx, videoEl, source.kind === 'video' ? source.transform : undefined)
      drawTopChrome(ctx, level)
      drawSubtitleZone(ctx, tMs, timeline, lines, level)
      const ratio = Math.min(1, elapsedMs / (durationSec * 1000))
      onProgress?.(ratio * 0.98, `Recording ${Math.round(ratio * 100)}%`)
      if (elapsedMs >= durationSec * 1000) { stop(); return }
      if (videoEl && videoEl.ended) { stop(); return }
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)

    const blob = await done
    onProgress?.(1, 'Done')
    return blob
  } finally {
    if (videoEl) detachVideo(videoEl)
  }
}

// ---------- helpers exposed for UI to test remote URL usability ----------

export async function fetchAsBlobUrl(url: string): Promise<{ blobUrl: string; label: string } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return { blobUrl: URL.createObjectURL(blob), label: url.split('/').pop() || 'Video' }
  } catch {
    return null
  }
}

// unused re-exports for tree-shaking clarity
export { buildTimeline, parseJP, parseVocab }
