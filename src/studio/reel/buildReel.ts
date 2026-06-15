// Deterministic reel pipeline: VOICEVOX voice → gapless offline audio mix →
// WebCodecs MP4 (or WebM fallback). No ffmpeg.wasm, no realtime audio drift.
import type { LevelQuestion } from '../levels'
import { W, H, renderFrame, type SceneKind } from './render'
import { ensureVoicevox, resolveVoices, synthBuffer } from './voices'
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

interface Seg {
  scene: SceneKind
  dur: number
  start: number
  audio?: AudioBuffer
  chime?: boolean
}

export async function buildReel(
  q: LevelQuestion,
  level: string,
  settings: VoiceSettings,
  onProgress: (p: ReelProgress) => void,
): Promise<ReelResult> {
  await ensureVoicevox()
  const decodeCtx = new AudioContext({ sampleRate: 48000 })
  const voices = await resolveVoices(settings)

  const correct = q.options.find(o => o.id === q.correct_option_id)
  const tr = q.transcript
  const lines: { text: string; voice: number; scene: SceneKind; chime?: boolean; tail?: number }[] = []
  lines.push({ text: [tr?.pre_question, q.question_text].filter(Boolean).join('、'), voice: voices.narrator, scene: 'question' })
  for (const d of tr?.dialogue ?? []) {
    const v = d.speaker === 'male' ? voices.male : d.speaker === 'female' ? voices.female : voices.narrator
    lines.push({ text: d.text, voice: v, scene: 'listen' })
  }
  lines.push({ text: `せいかいは、${correct?.text ?? ''}、です。`, voice: voices.narrator, scene: 'answer', chime: true, tail: 0.8 })
  lines.push({ text: [q.feedback.advice, q.feedback.hint].filter(Boolean).join('。'), voice: voices.narrator, scene: 'feedback', tail: 0.5 })

  const segs: Seg[] = []
  for (let i = 0; i < lines.length; i++) {
    onProgress({ stage: 'voice', ratio: i / lines.length, note: `Synthesizing voice ${i + 1}/${lines.length}` })
    const ln = lines[i]
    const audio = ln.text ? await synthBuffer(decodeCtx, ln.text, ln.voice, settings) : undefined
    const dur = (audio?.duration ?? 1) + settings.gapSeconds + (ln.tail ?? 0)
    if (ln.scene === 'answer') segs.push({ scene: 'think', dur: settings.thinkSeconds, start: 0 })
    segs.push({ scene: ln.scene, dur, start: 0, audio, chime: ln.chime })
  }
  segs.push({ scene: 'outro', dur: 2.6, start: 0 })

  let acc = 0
  for (const s of segs) { s.start = acc; acc += s.dur }
  const total = acc
  await decodeCtx.close()

  // gapless audio
  const audioSegs: AudioSeg[] = segs.map(s => ({ start: s.start, audio: s.audio, chime: s.chime }))
  const mixed = await mixTimeline(audioSegs, total, 48000)

  // preload the question image (same-origin, won't taint the canvas)
  const img = q.image_file ? await loadImage(`/jsonfileImages/${q.image_file}`).catch(() => null) : null

  // frame drawer
  const draw = (ctx: CanvasRenderingContext2D, t: number) => {
    let cur = segs[0]
    for (const s of segs) if (t >= s.start) cur = s
    renderFrame(ctx, cur.scene, q, level, t - cur.start, cur.dur, img)
  }

  if (webcodecsSupported()) {
    const mp4 = await encodeReelMp4({
      width: W, height: H, fps: FPS, durationSec: total, draw, audio: mixed,
      onProgress: (r, note) => onProgress({ stage: 'encode', ratio: r, note }),
    })
    return { video: mp4, mime: 'video/mp4', ext: 'mp4', durationSec: total }
  }

  // Fallback: realtime WebM (browser without WebCodecs)
  const webm = await recordWebm(draw, mixed, total, (r, note) => onProgress({ stage: 'encode', ratio: r, note }))
  return { video: webm, mime: 'video/webm', ext: 'webm', durationSec: total }
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
  onProgress: (r: number, note?: string) => void,
): Promise<Blob> {
  const actx = new AudioContext()
  const dest = actx.createMediaStreamDestination()
  const src = actx.createBufferSource()
  src.buffer = mixed
  src.connect(dest)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
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
