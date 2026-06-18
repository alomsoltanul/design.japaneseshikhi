// Persisted voice controls — fixes inconsistent speaker speed/volume and lets
// the user tune narration. Stored in localStorage (Supabase-swappable later).

export interface VoiceSettings {
  speed: number // VOICEVOX speedScale (0.5–2)
  volume: number // volumeScale (0.5–2)
  intonation: number // intonationScale (0–2)
  prePadding: number // prePhonemeLength seconds (leading silence)
  postPadding: number // postPhonemeLength seconds (trailing silence)
  gapSeconds: number // extra silence inserted between lines
  thinkSeconds: number // countdown length
  // explicit speaker style ids per role (null = auto-resolve from VOICEVOX list)
  narrator: number | null
  female: number | null
  male: number | null
}

export const DEFAULT_VOICE: VoiceSettings = {
  speed: 1.0,
  volume: 1.3,
  intonation: 1.0,
  prePadding: 0.1,
  postPadding: 0.25,
  gapSeconds: 0.35,
  thinkSeconds: 5,
  narrator: null,
  female: null,
  male: null,
}

/** JLPT-graded presets tuned to match official exam pacing.
 *  N5 = slowest/clearest, N1 = native speed, tight gaps. */
export const JLPT_VOICE_PRESETS: Record<string, VoiceSettings> = {
  N5: {
    speed: 0.88,
    volume: 1.3,
    intonation: 1.1,
    prePadding: 0.12,
    postPadding: 0.30,
    gapSeconds: 0.55,
    thinkSeconds: 8,
    narrator: null,
    female: null,
    male: null,
  },
  N4: {
    speed: 0.94,
    volume: 1.3,
    intonation: 1.05,
    prePadding: 0.08,
    postPadding: 0.25,
    gapSeconds: 0.40,
    thinkSeconds: 6,
    narrator: null,
    female: null,
    male: null,
  },
  N3: {
    speed: 1.0,
    volume: 1.3,
    intonation: 1.0,
    prePadding: 0.06,
    postPadding: 0.20,
    gapSeconds: 0.30,
    thinkSeconds: 5,
    narrator: null,
    female: null,
    male: null,
  },
  N2: {
    speed: 1.03,
    volume: 1.25,
    intonation: 0.97,
    prePadding: 0.04,
    postPadding: 0.15,
    gapSeconds: 0.20,
    thinkSeconds: 4,
    narrator: null,
    female: null,
    male: null,
  },
  N1: {
    speed: 1.05,
    volume: 1.2,
    intonation: 1.0,
    prePadding: 0.03,
    postPadding: 0.10,
    gapSeconds: 0.12,
    thinkSeconds: 3,
    narrator: null,
    female: null,
    male: null,
  },
}

const KEY = 'js-reel-voice-v1'

export function loadVoiceSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT_VOICE, ...JSON.parse(raw) } : { ...DEFAULT_VOICE }
  } catch {
    return { ...DEFAULT_VOICE }
  }
}

export function saveVoiceSettings(v: VoiceSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

/** Apply a JLPT preset and persist it. Returns the new settings. */
export function applyJlptPreset(level: string): VoiceSettings {
  const preset = JLPT_VOICE_PRESETS[level] ?? DEFAULT_VOICE
  const next = { ...preset }
  saveVoiceSettings(next)
  return next
}
