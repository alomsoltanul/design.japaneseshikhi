// Deterministic gapless audio mixer for the reel pipeline.
// Renders all voice segments + scene SFX into one AudioBuffer at exact offsets
// via OfflineAudioContext, then runs a soft-clip limiter on the master bus to
// prevent voice peaks at volumeScale ≥ 1.3 from clipping.

export interface AudioSeg {
  start: number
  audio?: AudioBuffer
  /** Trigger the answer-reveal sparkle chime at `start`. */
  chime?: boolean
  /** Trigger a scene-transition whoosh at `start`. */
  whoosh?: boolean
  /** Trigger a countdown tick beep at `start`. 'final' = longer, brighter. */
  tick?: 'normal' | 'final'
}

const FADE_S = 0.008 // 8 ms fade-in / fade-out kills boundary clicks

// ── synthesized SFX ───────────────────────────────────────
function chime(ctx: BaseAudioContext, dest: AudioNode, at: number) {
  for (const [i, freq] of [659.25, 987.77].entries()) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const t = at + i * 0.12
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
    osc.connect(gain).connect(dest)
    osc.start(t)
    osc.stop(t + 0.4)
  }
}

/** Short noise sweep — used as a scene-transition whoosh. */
function whoosh(ctx: BaseAudioContext, dest: AudioNode, at: number) {
  const dur = 0.32
  const sr = ctx.sampleRate
  const n = Math.ceil(dur * sr)
  const buf = ctx.createBuffer(1, n, sr)
  const data = buf.getChannelData(0)
  for (let i = 0; i < n; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.6
  }
  const src = ctx.createBufferSource()
  src.buffer = buf

  // band-pass that sweeps from low → high so the noise reads as a "swoosh"
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 0.9
  filter.frequency.setValueAtTime(420, at)
  filter.frequency.exponentialRampToValueAtTime(2400, at + dur)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(0.18, at + 0.04)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)

  src.connect(filter).connect(gain).connect(dest)
  src.start(at)
  src.stop(at + dur + 0.02)
}

/** Countdown tick. 'final' is brighter + longer to mark the "go" beat. */
function tick(ctx: BaseAudioContext, dest: AudioNode, at: number, kind: 'normal' | 'final') {
  const freq = kind === 'final' ? 1320 : 880
  const dur = kind === 'final' ? 0.18 : 0.06
  const peak = kind === 'final' ? 0.28 : 0.14

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(gain).connect(dest)
  osc.start(at)
  osc.stop(at + dur + 0.02)
}

// ── master limiter (soft clip via tanh) ───────────────────
/** Apply tanh-style soft clip to keep peaks below ~0.97 without harsh clipping. */
function softLimit(buf: AudioBuffer): AudioBuffer {
  const drive = 1.08
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const data = buf.getChannelData(ch)
    for (let i = 0; i < data.length; i++) {
      // tanh(x * drive) saturates smoothly; scale back so 1.0 in → ~0.78 out
      data[i] = Math.tanh(data[i] * drive) * 0.92
    }
  }
  return buf
}

export async function mixTimeline(segs: AudioSeg[], total: number, sampleRate = 48000): Promise<AudioBuffer> {
  const length = Math.max(1, Math.ceil((total + 0.3) * sampleRate))
  const octx = new OfflineAudioContext({ numberOfChannels: 1, length, sampleRate })

  // Master bus — gives us one place to apply the limiter via post-render math.
  const master = octx.createGain()
  master.gain.value = 1.0
  master.connect(octx.destination)

  for (const s of segs) {
    if (s.audio) {
      const src = octx.createBufferSource()
      src.buffer = s.audio
      const gain = octx.createGain()
      const t = Math.max(0, s.start)
      const dur = s.audio.duration
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(1, t + FADE_S)
      gain.gain.setValueAtTime(1, t + dur - FADE_S)
      gain.gain.linearRampToValueAtTime(0, t + dur)
      src.connect(gain).connect(master)
      src.start(t)
    }
    if (s.chime) chime(octx, master, s.start)
    if (s.whoosh) whoosh(octx, master, s.start)
    if (s.tick) tick(octx, master, s.start, s.tick)
  }

  const rendered = await octx.startRendering()
  return softLimit(rendered)
}
