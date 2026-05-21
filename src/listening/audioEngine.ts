/**
 * Web Audio API playback engine for the Listening Studio.
 * Handles single-line preview, sequential track playback, and WAV export.
 */

export class AudioEngine {
  ctx: AudioContext | null = null
  private gain: GainNode | null = null
  private sources: AudioBufferSourceNode[] = []
  private scheduled: number[] = []
  private startTime = 0
  private pausedAt = 0
  private isPlaying = false
  private onEndedCb: (() => void) | null = null

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

  playBuffer(buf: AudioBuffer, speed = 1.0, pitch = 0.0, when = 0): void {
    const ctx = this.ensureCtx()
    const source = ctx.createBufferSource()
    source.buffer = buf

    // Speed change via playbackRate
    source.playbackRate.value = speed

    // Pitch shift via detune (cents)
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
    this.ensureCtx()
    this.playBuffer(buf, speed, pitch, this.ctx!.currentTime)
  }

  /** Schedule sequential playback of multiple buffers with pauses (in seconds) */
  schedule(
    items: { buffer: AudioBuffer; speed: number; pitch: number; pauseAfter: number }[],
    onLineStart?: (index: number) => void
  ): void {
    this.stop()
    this.isPlaying = true
    const ctx = this.ensureCtx()
    let t = ctx.currentTime

    items.forEach((item, i) => {
      const source = ctx.createBufferSource()
      source.buffer = item.buffer
      source.playbackRate.value = item.speed
      source.detune.value = item.pitch * 100
      const gain = ctx.createGain()
      gain.gain.value = 1.0
      source.connect(gain)
      gain.connect(this.gain!)

      const when = Math.max(t, ctx.currentTime)
      const mark = window.setTimeout(() => onLineStart?.(i), Math.max(0, (when - ctx.currentTime) * 1000))
      this.scheduled.push(mark)

      source.start(when)
      t = when + item.buffer.duration / item.speed + item.pauseAfter
      this.sources.push(source)

      source.onended = () => {
        this.sources = this.sources.filter(s => s !== source)
        if (this.sources.length === 0 && this.isPlaying) {
          this.isPlaying = false
          this.onEndedCb?.()
        }
      }
    })
  }

  pause(): void {
    this.ctx?.suspend()
  }

  resume(): void {
    this.ctx?.resume()
  }

  stop(): void {
    this.sources.forEach(s => {
      try { s.stop() } catch {}
    })
    this.sources = []
    this.scheduled.forEach(id => clearTimeout(id))
    this.scheduled = []
    this.isPlaying = false
    this.pausedAt = 0
  }

  setVolume(v: number): void {
    if (this.gain) this.gain.gain.value = v
  }

  get currentTime(): number {
    return this.ctx?.currentTime ?? 0
  }

  setOnEnded(cb: (() => void) | null) {
    this.onEndedCb = cb
  }

  get playing() {
    return this.isPlaying
  }

  /** Export multiple buffers into a single WAV file */
  async exportWav(items: { buffer: AudioBuffer; speed: number; pauseAfter: number }[]): Promise<Blob> {
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
