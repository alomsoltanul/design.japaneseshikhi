// Deterministic reel pipeline: VOICEVOX voice → gapless offline audio mix →
// WebCodecs MP4 (or WebM fallback). No ffmpeg.wasm, no realtime audio drift.
import { imageUrl, type LevelQuestion } from '../levels'
import { renderFrame, getCanvasSize, type SceneKind, type SceneMeta, type Aspect } from './render'
import { ensureVoiceEngine, resolveVoices, synthBuffer, type VoiceId } from './voices'
import { mixTimeline, type AudioSeg } from './mixAudio'
import { encodeReelMp4, webcodecsSupported } from './encodeMp4'
import type { VoiceSettings } from './voiceSettings'

const FPS = 30

export interface ReelProgress {
  stage: 'voice' | 'encode'
  ratio: number
  note?: string
}

export interface ReelResult {
  video: Blob
  mime: string
  ext: 'mp4' | 'webm'
  durationSec: number
}

export interface BuildReelOptions {
  /** Output aspect ratio. Default 'reel' (1080×1920 / 9:16). */
  aspect?: Aspect
  /** Disable scene-transition whooshes (still keeps intro/outro SFX). */
  noTransitionSfx?: boolean
  /** Disable per-second countdown ticks during the think scene. */
  noCountdownTicks?: boolean
}

interface Seg {
  scene: SceneKind
  dur: number
  start: number
  audio?: AudioBuffer
  chime?: boolean
  meta?: SceneMeta
}

export async function buildReel(
  q: LevelQuestion,
  level: string,
  settings: VoiceSettings,
  onProgress: (p: ReelProgress) => void,
  options: BuildReelOptions = {},
): Promise<ReelResult> {
  const aspect: Aspect = options.aspect ?? 'reel'
  const { width: CW, height: CH } = getCanvasSize(aspect)
  await ensureVoiceEngine(settings.provider)
  const decodeCtx = new AudioContext({ sampleRate: 48000 })
  const voices = await resolveVoices(settings)

  // Branded SFX bookends: woosh on intro, chime-out on the very end. Decoded
  // up front on decodeCtx (48k) so they land in the gapless offline mix.
  const [wooshSfx, endSfx] = await Promise.all([
    loadAudio(decodeCtx, `${import.meta.env.BASE_URL}sounds/woosh.mp3`).catch(() => null),
    loadAudio(decodeCtx, `${import.meta.env.BASE_URL}sounds/end.mp3`).catch(() => null),
  ])

  const correct = q.options.find(o => o.id === q.correct_option_id)
  const tr = q.transcript
  const lines: { text: string; voice: VoiceId; scene: SceneKind; chime?: boolean; tail?: number; meta?: SceneMeta }[] = []
  lines.push({ text: [tr?.pre_question, q.question_text].filter(Boolean).join('、'), voice: voices.narrator, scene: 'question', meta: { speaker: 'narrator', jpText: q.question_text } })
  // Track speaker turns so two women/men talking get different voices.
  // We toggle between primary/alternate voices on every consecutive same-gender line
  // so alternating dialogues (A-B-A-B) always get distinct speakers.
  let lastSpeaker: string | null = null
  let useAltFemale = false
  let useAltMale = false
  for (const d of tr?.dialogue ?? []) {
    let v: VoiceId
    if (d.speaker === 'narrator') {
      v = voices.narrator
    } else if (d.speaker === 'male') {
      useAltMale = lastSpeaker === 'male' ? !useAltMale : false
      v = useAltMale ? voices.male2 : voices.male
    } else {
      useAltFemale = lastSpeaker === 'female' ? !useAltFemale : false
      v = useAltFemale ? voices.female2 : voices.female
    }
    lastSpeaker = d.speaker
    lines.push({ text: d.text, voice: v, scene: 'listen', meta: { speaker: d.speaker, jpText: d.text } })
  }
  lines.push({ text: `せいかいは、${correct?.text ?? ''}、です。`, voice: voices.narrator, scene: 'answer', chime: true, tail: 0.8, meta: { speaker: 'narrator', jpText: correct?.text ?? '' } })
  lines.push({ text: [q.feedback.advice, q.feedback.hint].filter(Boolean).join('。'), voice: voices.narrator, scene: 'feedback', tail: 0.5, meta: { speaker: 'narrator', jpText: q.feedback.advice } })

  const segs: Seg[] = []
  for (let i = 0; i < lines.length; i++) {
    onProgress({ stage: 'voice', ratio: i / lines.length, note: `Synthesizing voice ${i + 1}/${lines.length}` })
    const ln = lines[i]
    const audio = ln.text ? await synthBuffer(decodeCtx, ln.text, ln.voice, settings) : undefined
    const dur = (audio?.duration ?? 1) + settings.gapSeconds + (ln.tail ?? 0)
    if (ln.scene === 'answer') segs.push({ scene: 'think', dur: settings.thinkSeconds, start: 0 })
    segs.push({ scene: ln.scene, dur, start: 0, audio, chime: ln.chime, meta: ln.meta })
  }
  segs.push({ scene: 'outro', dur: 3.6, start: 0 })

  let acc = 0
  for (const s of segs) { s.start = acc; acc += s.dur }
  const total = acc
  await decodeCtx.close()

  // gapless audio
  const audioSegs: AudioSeg[] = segs.map(s => ({ start: s.start, audio: s.audio, chime: s.chime }))
  // SFX bookends: woosh at t=0, end sound aligned to finish with the video.
  if (wooshSfx) audioSegs.push({ start: 0, audio: wooshSfx })
  if (endSfx) audioSegs.push({ start: Math.max(0, total - endSfx.duration), audio: endSfx })

  // Scene-transition whooshes (synthesized at mix time) at each scene boundary
  // EXCEPT the very first scene (the intro woosh covers it).
  if (!options.noTransitionSfx) {
    for (let i = 1; i < segs.length; i++) {
      // Skip transitions into 'outro' — the final end.mp3 chime carries it.
      if (segs[i].scene === 'outro') continue
      audioSegs.push({ start: segs[i].start, whoosh: true })
    }
  }
  // Countdown ticks during the think scene: 1Hz beeps for each remaining second.
  if (!options.noCountdownTicks) {
    const think = segs.find(s => s.scene === 'think')
    if (think) {
      const n = Math.floor(think.dur)
      for (let i = 0; i < n; i++) {
        // Final tick (last second) is a longer "go!" beep.
        audioSegs.push({ start: think.start + i, tick: i === n - 1 ? 'final' : 'normal' })
      }
    }
  }

  const mixed = await mixTimeline(audioSegs, total, 48000)

  // preload images (resolved from the local store / repo; won't taint the canvas)
  const singleUrl = imageUrl(q.image_file)
  const single = singleUrl ? await loadImage(singleUrl).catch(() => null) : null
  const panelImgs = await Promise.all(
    q.options.map(o => {
      const u = imageUrl(o.image)
      return u ? loadImage(u).catch(() => null) : Promise.resolve(null)
    }),
  )
  const media = { single, panels: panelImgs.some(Boolean) ? panelImgs : undefined }

  // frame drawer
  const draw = (ctx: CanvasRenderingContext2D, t: number) => {
    let cur = segs[0]
    for (const s of segs) if (t >= s.start) cur = s
    renderFrame(ctx, cur.scene, q, level, t - cur.start, cur.dur, media, cur.meta, t, aspect)
  }

  if (webcodecsSupported()) {
    const mp4 = await encodeReelMp4({
      width: CW, height: CH, fps: FPS, durationSec: total, draw, audio: mixed,
      onProgress: (r, note) => onProgress({ stage: 'encode', ratio: r, note }),
    })
    return { video: mp4, mime: 'video/mp4', ext: 'mp4', durationSec: total }
  }

  // Fallback: realtime WebM (browser without WebCodecs)
  const webm = await recordWebm(draw, mixed, total, CW, CH, (r, note) => onProgress({ stage: 'encode', ratio: r, note }))
  return { video: webm, mime: 'video/webm', ext: 'webm', durationSec: total }
}

async function loadAudio(ctx: BaseAudioContext, url: string): Promise<AudioBuffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`audio not found: ${url}`)
  const buf = await res.arrayBuffer()
  return ctx.decodeAudioData(buf)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error(`image not found: ${src}`))
    im.src = src
  })
}

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
      if (t >= total) { try { rec.stop() } catch { /* ignore */ } actx.close(); return }
      draw(ctx, Math.max(0, t))
      onProgress(t / total, `Recording ${Math.round(t)}s`)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}
