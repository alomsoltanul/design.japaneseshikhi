/**
 * VOICEVOX Engine API client
 * Proxied through /api/voicevox in dev mode via vite.config.ts
 */

const BASE_URL = import.meta.env.DEV ? '/api/voicevox' : 'http://127.0.0.1:50021'

/** True when we're on localhost dev (where the VOICEVOX proxy is reachable). */
export function isLocalHost(): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
}

/**
 * On a deployed HTTPS site the browser blocks calls to the user's local
 * VOICEVOX (mixed content / private network), and our server can't reach it
 * either. Reels are therefore local-only.
 */
export function reelEnvBlocked(): boolean {
  return location.protocol === 'https:' && !isLocalHost()
}

export interface VvSpeaker {
  name: string
  speaker_uuid: string
  styles: { id: number; name: string }[]
  version: string
}

export interface VvAudioQuery {
  accent_phrases: unknown[]
  speedScale: number
  pitchScale: number
  intonationScale: number
  volumeScale: number
  prePhonemeLength: number
  postPhonemeLength: number
  outputSamplingRate: number
  outputStereo: boolean
  kana: string
}

let speakersCache: VvSpeaker[] | null = null

export async function getSpeakers(): Promise<VvSpeaker[]> {
  if (speakersCache) return speakersCache
  const res = await fetch(`${BASE_URL}/speakers`, { mode: 'cors' })
  if (!res.ok) throw new Error(`VOICEVOX speakers error: ${res.status}`)
  speakersCache = await res.json()
  return speakersCache!
}

export async function audioQuery(text: string, speakerId: number): Promise<VvAudioQuery> {
  const params = new URLSearchParams({ text, speaker: String(speakerId) })
  const res = await fetch(`${BASE_URL}/audio_query?${params.toString()}`, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`VOICEVOX query error: ${res.status}`)
  return res.json()
}

export async function synthesize(query: VvAudioQuery, speakerId: number): Promise<ArrayBuffer> {
  const params = new URLSearchParams({ speaker: String(speakerId) })
  const res = await fetch(`${BASE_URL}/synthesis?${params.toString()}`, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  })
  if (!res.ok) throw new Error(`VOICEVOX synthesis error: ${res.status}`)
  return res.arrayBuffer()
}

export async function synthesizeText(
  text: string,
  speakerId: number,
  opts?: { speed?: number; pitch?: number; intonation?: number; volume?: number }
): Promise<ArrayBuffer> {
  const query = await audioQuery(text, speakerId)
  if (opts?.speed != null) query.speedScale = opts.speed
  if (opts?.pitch != null) query.pitchScale = opts.pitch
  if (opts?.intonation != null) query.intonationScale = opts.intonation
  if (opts?.volume != null) query.volumeScale = opts.volume
  return synthesize(query, speakerId)
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/version`, { mode: 'cors', signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}
