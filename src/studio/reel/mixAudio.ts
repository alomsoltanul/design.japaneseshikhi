// Deterministic gapless audio: render all voice segments into one AudioBuffer
// at exact offsets via OfflineAudioContext. No realtime drift/overlap → fixes
// "voices heard intermittently".

export interface AudioSeg {
  start: number
  audio?: AudioBuffer
  chime?: boolean
}

const FADE_S = 0.008 // 8 ms fade-in / fade-out kills boundary clicks

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

export async function mixTimeline(segs: AudioSeg[], total: number, sampleRate = 48000): Promise<AudioBuffer> {
  const length = Math.max(1, Math.ceil((total + 0.3) * sampleRate))
  const octx = new OfflineAudioContext({ numberOfChannels: 1, length, sampleRate })
  for (const s of segs) {
    if (s.audio) {
      const src = octx.createBufferSource()
      src.buffer = s.audio
      const gain = octx.createGain()
      const t = Math.max(0, s.start)
      const dur = s.audio.duration
      // micro fade-in / fade-out to prevent pops at segment boundaries
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(1, t + FADE_S)
      gain.gain.setValueAtTime(1, t + dur - FADE_S)
      gain.gain.linearRampToValueAtTime(0, t + dur)
      src.connect(gain).connect(octx.destination)
      src.start(t)
    }
    if (s.chime) chime(octx, octx.destination, s.start)
  }
  return octx.startRendering()
}
