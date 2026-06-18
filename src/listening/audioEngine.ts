/**
 * Web Audio API playback engine for the Listening Studio.
 * Handles single-line preview, sequential track playback, and WAV export.
 *
 * Timing is fully driven by AudioContext.currentTime so that pause/resume
 * and UI highlighting stay perfectly in sync — no wall-clock drift.
 */

export interface ScheduleItem {
  buffer: AudioBuffer
  speed: number
  pitch: number
  pauseAfter: number
  /** Called (via rAF polling against audio time) when this item starts playing */
  onStart?: () => void
}

export class AudioEngine {
  ctx: AudioContext | null = null
  private gain: GainNode | null = null
  private sources: AudioBufferSourceNode[] = []
  private isPlaying = false
  private onEndedCb: (() => void) | null = null

  /* schedule tracking */
  private scheduleStart = 0          // ctx.currentTime when schedule() was called
  private scheduledCbs: { when: number; cb: () => void; fired: boolean }[] = []
  private rafId = 0

  private ensureCtx() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.gain = this.ctx.createGain()
      this.gain.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
    return this.ctx!
  }

  async decode(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = this.ensureCtx()
    return ctx.decodeAudioData(arrayBuffer.slice(0))
  }

  /** Playback position in seconds. AudioContext.currentTime naturally pauses
   *  when the context is suspended, so no extra bookkeeping is needed. */
  get playbackTime(): number {
    if (!this.ctx) return 0
    return Math.max(0, this.ctx.currentTime - this.scheduleStart)
  }

  get playing() {
    return this.isPlaying
  }

  get currentTime(): number {
    return this.ctx?.currentTime ?? 0
  }

  setOnEnded(cb: (() => void) | null) {
    this.onEndedCb = cb
  }

  setVolume(v: number): void {
    if (this.gain) this.gain.gain.value = v
  }

  private playBuffer(buf: AudioBuffer, speed = 1.0, pitch = 0.0, when = 0): void {
    const ctx = this.ensureCtx()
    const source = ctx.createBufferSource()
    source.buffer = buf
    source.playbackRate.value = speed
    source.detune.value = pitch * 100
    const gain = ctx.createGain()
    gain.gain.value = 1.0
    source.connect(gain)
    gain.connect(this.gain!)
    source.start(when)
    this.sources.push(source)

    source.onended = () => {
      this.sources = this.sources.filter(s => s !== source)
      if (this.sources.length === 0 && this.isPlaying) {
        this.isPlaying = false
        this.onEndedCb?.()
      }
    }
  }

  /** Play a single line immediately */
  async play(buf: AudioBuffer, speed = 1.0, pitch = 0.0): Promise<void> {
    this.stop()
    this.isPlaying = true
    const ctx = this.ensureCtx()
    this.scheduleStart = ctx.currentTime
    this.playBuffer(buf, speed, pitch, ctx.currentTime)
  }

  /** Schedule sequential playback of multiple buffers with pauses (in seconds) */
  schedule(items: ScheduleItem[]): void {
    this.stop()
    this.isPlaying = true
    const ctx = this.ensureCtx()
    this.scheduleStart = ctx.currentTime
    this.scheduledCbs = []
    let t = ctx.currentTime

    items.forEach(item => {
      const when = Math.max(t, ctx.currentTime)
      const dur = item.buffer.duration / item.speed
      this.playBuffer(item.buffer, item.speed, item.pitch, when)

      if (item.onStart) {
        this.scheduledCbs.push({ when, cb: item.onStart, fired: false })
      }

      t = when + dur + item.pauseAfter
    })

    this._poll()
  }

  /** rAF loop that fires onStart callbacks exactly when AudioContext reaches them */
  private _poll() {
    const tick = () => {
      if (!this.isPlaying || !this.ctx) return
      const now = this.ctx.currentTime
      for (const sc of this.scheduledCbs) {
        if (!sc.fired && now >= sc.when) {
          sc.fired = true
          sc.cb()
        }
      }
      if (this.sources.length > 0) {
        this.rafId = requestAnimationFrame(tick)
      }
    }
    this.rafId = requestAnimationFrame(tick)
  }

  pause(): void {
    this.ctx?.suspend()
    cancelAnimationFrame(this.rafId)
  }

  resume(): void {
    this.ctx?.resume()
    this._poll()
  }

  stop(): void {
    this.sources.forEach(s => {
      try { s.stop() } catch {}
    })
    this.sources = []
    cancelAnimationFrame(this.rafId)
    this.rafId = 0
    this.isPlaying = false
    this.scheduledCbs = []
  }

  /** Export multiple buffers into a single WAV file */
  async exportWav(items: { buffer: AudioBuffer; speed: number; pitch: number; pauseAfter: number }[]): Promise<Blob> {
    const ctx = this.ensureCtx()
    const sampleRate = ctx.sampleRate
    const channels = 1

    // Compute total length
    let totalSamples = 0
    for (const item of items) {
      const srcSamples = item.buffer.length
      totalSamples += Math.floor(srcSamples / item.speed)
      totalSamples += Math.floor(item.pauseAfter * sampleRate)
    }

    const offline = new OfflineAudioContext(channels, totalSamples, sampleRate)
    let t = 0
    for (const item of items) {
      const src = offline.createBufferSource()
      src.buffer = item.buffer
      src.playbackRate.value = item.speed
      src.detune.value = item.pitch * 100
      const gain = offline.createGain()
      gain.gain.value = 1.0
      src.connect(gain)
      gain.connect(offline.destination)
      src.start(t)
      const dur = item.buffer.duration / item.speed
      t += dur + item.pauseAfter
    }

    const rendered = await offline.startRendering()
    return audioBufferToWav(rendered)
  }
}

/** Convert AudioBuffer to WAV Blob */
function audioBufferToWav(buf: AudioBuffer): Blob {
  const numOfChan = buf.numberOfChannels
  const length = buf.length * numOfChan * 2 + 44
  const buffer = new ArrayBuffer(length)
  const view = new DataView(buffer)
  const channels: Float32Array[] = []
  let i: number
  let sample: number
  let offset = 0
  let pos = 0

  // write WAVE header
  setUint32(0x46464952) // "RIFF"
  setUint32(length - 8) // file length - 8
  setUint32(0x45564157) // "WAVE"
  setUint32(0x20746d66) // "fmt " chunk
  setUint32(16) // length = 16
  setUint16(1) // PCM (uncompressed)
  setUint16(numOfChan)
  setUint32(buf.sampleRate)
  setUint32(buf.sampleRate * 2 * numOfChan) // avg. bytes/sec
  setUint16(numOfChan * 2) // block-align
  setUint16(16) // 16-bit (hardcoded in this example)
  setUint32(0x61746164) // "data" - chunk
  setUint32(length - pos - 4) // chunk length

  // write interleaved data
  for (i = 0; i < buf.numberOfChannels; i++) channels.push(buf.getChannelData(i))

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]))
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(pos, sample, true)
      pos += 2
    }
    offset++
  }

  return new Blob([buffer], { type: 'audio/wav' })

  function setUint16(data: number) {
    view.setUint16(pos, data, true)
    pos += 2
  }
  function setUint32(data: number) {
    view.setUint32(pos, data, true)
    pos += 4
  }
}
