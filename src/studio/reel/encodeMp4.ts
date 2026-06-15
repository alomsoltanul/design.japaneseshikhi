// Deterministic MP4 via WebCodecs + mp4-muxer. Hardware-accelerated, no wasm,
// no realtime recording. Draws each frame and muxes H.264 + AAC into a real MP4.
import { Muxer, ArrayBufferTarget } from 'mp4-muxer'

/* eslint-disable @typescript-eslint/no-explicit-any */

export function webcodecsSupported(): boolean {
  return (
    typeof (globalThis as any).VideoEncoder === 'function' &&
    typeof (globalThis as any).AudioEncoder === 'function' &&
    typeof (globalThis as any).VideoFrame === 'function' &&
    typeof (globalThis as any).AudioData === 'function'
  )
}

export interface EncodeOpts {
  width: number
  height: number
  fps: number
  durationSec: number
  draw: (ctx: CanvasRenderingContext2D, t: number) => void
  audio: AudioBuffer
  onProgress?: (ratio: number, note?: string) => void
}

async function pickVideoCodec(width: number, height: number, fps: number): Promise<string> {
  const candidates = ['avc1.640034', 'avc1.640033', 'avc1.4d0034', 'avc1.42e034', 'avc1.42001f']
  const VE: any = (globalThis as any).VideoEncoder
  for (const codec of candidates) {
    try {
      const sup = await VE.isConfigSupported({ codec, width, height, framerate: fps, bitrate: 8_000_000 })
      if (sup?.supported) return codec
    } catch {
      /* try next */
    }
  }
  return 'avc1.42001f'
}

export async function encodeReelMp4(opts: EncodeOpts): Promise<Blob> {
  const { width, height, fps, durationSec, draw, audio, onProgress } = opts
  const sampleRate = audio.sampleRate
  const channels = Math.min(2, audio.numberOfChannels)

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    fastStart: 'in-memory',
    video: { codec: 'avc', width, height },
    audio: { codec: 'aac', numberOfChannels: channels, sampleRate },
  })

  const VE: any = (globalThis as any).VideoEncoder
  const AE: any = (globalThis as any).AudioEncoder
  const VideoFrameC: any = (globalThis as any).VideoFrame
  const AudioDataC: any = (globalThis as any).AudioData

  const codec = await pickVideoCodec(width, height, fps)
  const videoEncoder = new VE({
    output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
    error: (e: any) => { throw e },
  })
  videoEncoder.configure({ codec, width, height, framerate: fps, bitrate: 8_000_000 })

  const audioEncoder = new AE({
    output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
    error: (e: any) => { throw e },
  })
  audioEncoder.configure({ codec: 'mp4a.40.2', sampleRate, numberOfChannels: channels, bitrate: 128_000 })

  // ── video frames ──
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const totalFrames = Math.ceil(durationSec * fps)
  const frameDur = Math.round(1e6 / fps)

  for (let i = 0; i < totalFrames; i++) {
    const t = i / fps
    draw(ctx, t)
    const frame = new VideoFrameC(canvas, { timestamp: Math.round(i * 1e6 / fps), duration: frameDur })
    videoEncoder.encode(frame, { keyFrame: i % (fps * 2) === 0 })
    frame.close()
    if (videoEncoder.encodeQueueSize > fps) await new Promise(r => setTimeout(r, 0))
    if (i % 6 === 0) onProgress?.((i / totalFrames) * 0.85, `Encoding video ${Math.round((i / totalFrames) * 100)}%`)
  }

  // ── audio (planar f32 chunks) ──
  const chunkFrames = 4800 // 0.1s
  const totalAudioFrames = audio.length
  const ch0 = audio.getChannelData(0)
  const ch1 = channels > 1 ? audio.getChannelData(1) : null
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
