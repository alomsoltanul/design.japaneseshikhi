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
