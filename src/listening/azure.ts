/**
 * Azure Speech (Neural TTS) client. Server-side key stays in Vercel env
 * (AZURE_SPEECH_KEY / AZURE_SPEECH_REGION); the browser only talks to
 * /api/tts/azure. Works on prod HTTPS unlike VOICEVOX which needs a
 * localhost engine.
 */

export interface AzureVoice {
  /** Azure voice name e.g. "ja-JP-NanamiNeural" — passed to the API. */
  name: string
  /** Display label. */
  label: string
  gender: 'female' | 'male'
  emoji: string
  /** Optional express-as style tags supported by this voice. */
  styles?: string[]
}

export const AZURE_VOICES: AzureVoice[] = [
  { name: 'ja-JP-NanamiNeural',  label: 'Nanami',  gender: 'female', emoji: '🌸', styles: ['general', 'chat', 'customerservice'] },
  { name: 'ja-JP-AoiNeural',     label: 'Aoi',     gender: 'female', emoji: '🌊' },
  { name: 'ja-JP-ShioriNeural',  label: 'Shiori',  gender: 'female', emoji: '🍃' },
  { name: 'ja-JP-MayuNeural',    label: 'Mayu',    gender: 'female', emoji: '🌷' },
  { name: 'ja-JP-KeitaNeural',   label: 'Keita',   gender: 'male',   emoji: '🗻' },
  { name: 'ja-JP-DaichiNeural',  label: 'Daichi',  gender: 'male',   emoji: '🌲' },
  { name: 'ja-JP-NaokiNeural',   label: 'Naoki',   gender: 'male',   emoji: '⛩️' },
  { name: 'ja-JP-MasaruNeural',  label: 'Masaru',  gender: 'male',   emoji: '🍶' },
]

export const DEFAULT_AZURE_VOICE = 'ja-JP-NanamiNeural'

export function getAzureVoice(name: string): AzureVoice | undefined {
  return AZURE_VOICES.find(v => v.name === name)
}

/**
 * Given a gender preference, return an Azure voice — used when swapping
 * providers so the picked line keeps a similar-gender voice.
 */
export function pickAzureByGender(gender: 'female' | 'male' | 'other'): AzureVoice {
  const g = gender === 'other' ? 'female' : gender
  return AZURE_VOICES.find(v => v.gender === g) ?? AZURE_VOICES[0]
}

export interface AzureSynthOpts {
  /** VOICEVOX-style multiplier (1.0 = neutral); mapped to Azure prosody rate. */
  speed?: number
  /** VOICEVOX-style pitch offset in semitone-ish units; mapped to Azure pitch %. */
  pitch?: number
  /** Optional express-as style. */
  style?: string
  styleDegree?: number
}

function toRatePct(speed: number | undefined): string {
  const s = typeof speed === 'number' ? speed : 1.0
  const pct = Math.round((s - 1) * 100)
  const clamped = Math.max(-50, Math.min(50, pct))
  return `${clamped >= 0 ? '+' : ''}${clamped}%`
}

function toPitchPct(pitch: number | undefined): string {
  const p = typeof pitch === 'number' ? pitch : 0
  const pct = Math.round(p * 20)
  const clamped = Math.max(-50, Math.min(50, pct))
  return `${clamped >= 0 ? '+' : ''}${clamped}%`
}

/**
 * Hit the serverless /api/tts/azure route → MP3 ArrayBuffer.
 * Throws on non-2xx so the caller can flip line status to 'error'.
 */
export async function synthesizeAzure(
  text: string,
  voice: string,
  opts: AzureSynthOpts = {},
): Promise<ArrayBuffer> {
  const clean = text.trim()
  if (!clean) throw new Error('synthesizeAzure: empty text')

  const res = await fetch('/api/tts/azure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: clean,
      voice: voice || DEFAULT_AZURE_VOICE,
      rate: toRatePct(opts.speed),
      pitch: toPitchPct(opts.pitch),
      ...(opts.style ? { style: opts.style, styleDegree: opts.styleDegree ?? 1 } : null),
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`azure tts ${res.status}: ${detail.slice(0, 200)}`)
  }
  return res.arrayBuffer()
}

/** Cheap probe — the api route responds even without a key on OPTIONS. */
export async function checkAzureHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/tts/azure', {
      method: 'OPTIONS',
      signal: AbortSignal.timeout(2500),
    })
    return res.ok || res.status === 204
  } catch {
    return false
  }
}
