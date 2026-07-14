// Kanji Mind Map SFX — synthesized Web Audio, no audio files.
// Primitives take a BaseAudioContext so the same sounds play live (AudioContext)
// and render into the video mix (OfflineAudioContext).

export const POP_SCALE = [523, 587, 659, 784, 880, 988, 1046, 1174]

export function tone(
  ctx: BaseAudioContext, dest: AudioNode, at: number,
  f1: number, f2: number, dur: number, gain: number,
  type: OscillatorType = 'sine',
) {
  const t = Math.max(0, at)
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(f1, t)
  o.frequency.exponentialRampToValueAtTime(f2, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(dest)
  o.start(t)
  o.stop(t + dur + 0.05)
}

/** Bandpass-filtered noise whoosh: 420→1500 Hz, Q 1.2, 0.35 s. */
export function whoosh(ctx: BaseAudioContext, dest: AudioNode, at: number, vol: number) {
  const t = Math.max(0, at)
  const dur = 0.35
  const len = Math.floor(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buf
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = 1.2
  f.frequency.setValueAtTime(420, t)
  f.frequency.exponentialRampToValueAtTime(1500, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.18 * vol, t + 0.06)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(dest)
  src.start(t)
  src.stop(t + dur)
}

/** Pentatonic-ish pop for node i. */
export function pop(ctx: BaseAudioContext, dest: AudioNode, at: number, i: number, vol: number) {
  const f = POP_SCALE[i % 8]
  tone(ctx, dest, at, f * 0.75, f, 0.16, 0.30 * vol, 'triangle')
}

export function chime(ctx: BaseAudioContext, dest: AudioNode, at: number, vol: number) {
  tone(ctx, dest, at, 659, 659, 0.3, 0.25 * vol, 'sine')
  tone(ctx, dest, at + 0.14, 880, 880, 0.45, 0.25 * vol, 'sine')
}

export function kanjiReveal(ctx: BaseAudioContext, dest: AudioNode, at: number, vol: number) {
  tone(ctx, dest, at, 200, 130, 0.3, 0.4 * vol, 'sine')
}

export function pillPops(ctx: BaseAudioContext, dest: AudioNode, at: number, vol: number) {
  pop(ctx, dest, at, 2, vol)
  pop(ctx, dest, at + 0.1, 4, vol)
}

export function nodeReveal(ctx: BaseAudioContext, dest: AudioNode, at: number, i: number, vol: number) {
  whoosh(ctx, dest, at, vol)
  pop(ctx, dest, at + 0.24, i, vol)
}

// ── live playback wrapper ─────────────────────────────────
export class KanjiSfx {
  private ac: AudioContext | null = null
  volume = 0.7

  ensure() {
    if (!this.ac) {
      try { this.ac = new AudioContext() } catch { this.ac = null }
    }
    if (this.ac?.state === 'suspended') void this.ac.resume()
  }

  private go(fn: (ctx: BaseAudioContext, dest: AudioNode) => void) {
    if (!this.ac) return
    fn(this.ac, this.ac.destination)
  }

  private now() { return this.ac?.currentTime ?? 0 }

  stepSound(n: number) {
    if (n === 1) this.go((c, d) => kanjiReveal(c, d, this.now(), this.volume))
    else if (n === 2) this.go((c, d) => pillPops(c, d, this.now(), this.volume))
    else this.go((c, d) => nodeReveal(c, d, this.now(), n - 3, this.volume))
  }

  pop(i: number) { this.go((c, d) => pop(c, d, this.now(), i, this.volume)) }
  buzz() { this.go((c, d) => tone(c, d, this.now(), 160, 110, 0.25, 0.25 * this.volume, 'square')) }
  chime() { this.go((c, d) => chime(c, d, this.now(), this.volume)) }
  learned() { this.go((c, d) => tone(c, d, this.now(), 784, 1046, 0.22, 0.3 * this.volume, 'triangle')) }
  correct(i: number) {
    this.go((c, d) => {
      pop(c, d, this.now(), i, this.volume)
      tone(c, d, this.now() + 0.1, 1046, 1318, 0.2, 0.25 * this.volume, 'sine')
    })
  }
}
