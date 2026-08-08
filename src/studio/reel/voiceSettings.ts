// Persisted voice controls — fixes inconsistent speaker speed/volume and lets
// the user tune narration. Stored in localStorage (Supabase-swappable later).

import type { TtsProvider } from '@/listening/types'

export interface VoiceSettings {
  /** TTS backend. 'azure' = cloud (works on prod HTTPS). 'voicevox' = localhost only. */
  provider: TtsProvider
  speed: number // VOICEVOX speedScale 話速 (0.5–2)
  pitch: number // VOICEVOX pitchScale 音高 (-0.15–0.15)
  volume: number // volumeScale 音量 (0.5–2)
  intonation: number // intonationScale 抑揚 (0–2)
  pauseScale: number // pauseLengthScale 間の長さ — multiplier on 、/。 pauses inside a line
  prePadding: number // prePhonemeLength 開始無音 seconds (leading silence)
  postPadding: number // postPhonemeLength 終了無音 seconds (trailing silence)
  gapSeconds: number // extra silence inserted between lines
  thinkSeconds: number // countdown length
  // VOICEVOX role → style id (null = auto-resolve)
  narrator: number | null
  female: number | null
  male: number | null
  // Azure role → voice name (null = auto-resolve). Ignored when provider='voicevox'.
  azureNarrator: string | null
  azureFemale: string | null
  azureMale: string | null
}

/** Detect a sensible default provider — VOICEVOX only reachable on localhost. */
function defaultProvider(): TtsProvider {
  if (typeof window === 'undefined') return 'azure'
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
  return isLocal ? 'voicevox' : 'azure'
}

export const DEFAULT_VOICE: VoiceSettings = {
  provider: defaultProvider(),
  speed: 1.0,
  pitch: 0.0,
  pauseScale: 1.0,
  volume: 1.3,
  intonation: 1.0,
  prePadding: 0.1,
  postPadding: 0.25,
  gapSeconds: 0.35,
  thinkSeconds: 5,
  narrator: null,
  female: null,
  male: null,
  azureNarrator: null,
  azureFemale: null,
  azureMale: null,
}

/** JLPT-graded presets tuned to match official exam pacing.
 *  N5 = slowest/clearest, N1 = native speed, tight gaps.
 *  Partial — provider + azure voice slots inherit from DEFAULT_VOICE. */
export const JLPT_VOICE_PRESETS: Record<string, Partial<VoiceSettings>> = {
  N5: {
    speed: 0.88,
    pitch: 0.0,
    pauseScale: 1.5,
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
    pitch: 0.0,
    pauseScale: 1.35,
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
    pitch: 0.0,
    pauseScale: 1.2,
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
    pitch: 0.0,
    pauseScale: 1.05,
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
    pitch: 0.0,
    pauseScale: 1.0,
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
  const preset = JLPT_VOICE_PRESETS[level] ?? {}
  const next: VoiceSettings = { ...DEFAULT_VOICE, ...preset }
  saveVoiceSettings(next)
  return next
}
