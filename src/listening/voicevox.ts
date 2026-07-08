/**
 * VOICEVOX Engine API client — JLPT audio calibration layer.
 *
 * ── Why deep payload mutation is required ────────────────────────────────
 * Top-level scalars (`speedScale`, `pitchScale`, `intonationScale`,
 * `volumeScale`, `prePhonemeLength`, `postPhonemeLength`) do not touch the
 * per-phrase silence tokens VOICEVOX inserts inside `accent_phrases[i]
 * .pause_mora`. Those tokens are what produce the "yo-ya-ku-shi-ta [gap]
 * he-ya [gap] wa" stutter-step: every stray space or bunsetsu boundary
 * spawns a fresh `pause_mora` with its own vowel_length, and slowing
 * `speedScale` only amplifies each silence.
 *
 * `synthesizeJlpt()` executes the full mutation protocol:
 *
 *   1. `normalizeJp(text)`  — strip whitespace, markdown, hidden chars;
 *                              unify punctuation to 、 / 。 / ！ / ？ so
 *                              particles stay welded to their host word.
 *   2. POST /audio_query    — receive AudioQuery JSON.
 *   3. Global scaler align  — apply speedScale + pauseLengthScale +
 *                              phoneme padding from the JLPT profile.
 *   4. Accent-phrase loop   — zero `vowel_length` / `consonant_length` on
 *                              every non-punctuation `pause_mora` so
 *                              neighboring chunks fuse into one breath
 *                              group. Real 、/。 pauses survive and are
 *                              stretched by pauseLengthScale.
 *   5. POST /synthesis      — mutated payload → WAV bytes.
 *
 * Proxied through /api/voicevox in dev mode via vite.config.ts.
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

/** Single mora inside an accent phrase. VOICEVOX Engine schema. */
export interface VvMora {
  text: string
  consonant?: string | null
  consonant_length?: number | null
  vowel: string
  vowel_length: number
  pitch: number
}

/** One accent phrase. `pause_mora` marks a punctuation-driven breath. */
export interface VvAccentPhrase {
  moras: VvMora[]
  accent: number
  pause_mora?: VvMora | null
  is_interrogative?: boolean
}

export interface VvAudioQuery {
  accent_phrases: VvAccentPhrase[]
  speedScale: number
  pitchScale: number
  intonationScale: number
  volumeScale: number
  prePhonemeLength: number
  postPhonemeLength: number
  /** Engine ≥ 0.15 — global scaler for every surviving `pause_mora` duration. */
  pauseLengthScale?: number
  /** Engine ≥ 0.15 — absolute pause override (unused; we scale instead). */
  pauseLength?: number | null
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

/**
 * Normalize a Japanese line so VOICEVOX generates one cohesive
 * accent-phrase graph instead of scattering micro-phrases.
 *
 * - Strips ASCII spaces, tabs, newlines, full-width spaces, zero-width
 *   joiners, BOM, and other invisible artifacts that MeCab treats as
 *   phrase separators.
 * - Removes common markdown scraps (`*`, `_`, `~`, backticks, list bullets)
 *   that occasionally survive AI-generated content pipelines.
 * - Unifies half-width `,` `.` `!` `?` to their Japanese equivalents so the
 *   pauses we DO keep are the ones the JLPT format expects.
 * - Collapses duplicate punctuation runs so `、、` never doubles up.
 *
 * Particle-preservation guarantee: because we strip ALL whitespace, a
 * source line like "おとこ の ひと が" collapses to "おとこのひとが",
 * letting VOICEVOX group the accent phrase as one native chunk.
 */
export function normalizeJp(input: string): string {
  return input
    // invisible chars: ASCII whitespace, full-width space, ZWJ/ZWNJ, BOM
    .replace(/[\s　​-‍﻿]+/g, '')
    // markdown artifacts that leak from AI pipelines
    .replace(/[*_~`]/g, '')
    .replace(/^[-•·]+/gm, '')
    // half-width punctuation → JLPT-native punctuation
    .replace(/,/g, '、')
    .replace(/\./g, '。')
    .replace(/!/g, '！')
    .replace(/\?/g, '？')
    // collapse duplicate punctuation runs
    .replace(/、{2,}/g, '、')
    .replace(/。{2,}/g, '。')
    .replace(/！{2,}/g, '！')
    .replace(/？{2,}/g, '？')
    .trim()
}

/**
 * Punctuation-derived `pause_mora` heuristic.
 *
 * VOICEVOX marks punctuation pauses with a longer combined duration
 * (>= ~0.14s). Bunsetsu-junction pauses inside a breath group land well
 * below that. We keep the punctuation ones and flatten the rest.
 *
 * This is intentionally duration-based rather than text-index-based: it
 * survives MeCab reordering and works uniformly across every speaker.
 */
function isPunctuationPause(pm: VvMora | null | undefined): boolean {
  if (!pm) return false
  const dur = (pm.consonant_length ?? 0) + (pm.vowel_length ?? 0)
  return dur >= 0.14
}

export interface JlptSynthOpts {
  /** VOICEVOX speedScale — 0.80–0.85 for N4/N5 exam clarity. */
  speed: number
  pitch?: number
  intonation?: number
  volume?: number
  /** Pre / post-utterance silence in seconds. Keep small (0.02–0.05). */
  prePhonemeLength: number
  postPhonemeLength: number
  /** Multiplier for surviving pause_mora durations — 1.4–1.6 amplifies 、/。 beats. */
  pauseLengthScale: number
}

/**
 * JLPT-calibrated synthesis. Executes the full mutation protocol described
 * at the top of this file.
 *
 * Fallback behavior:
 *   - Empty / whitespace-only input → throws before any network call.
 *   - Missing or empty `accent_phrases` array → skips mutation loop, runs
 *     /synthesis with the unmodified query so the caller still gets audio
 *     instead of a crash.
 *   - Malformed `pause_mora` (missing fields) → silently ignored.
 */
export async function synthesizeJlpt(
  text: string,
  speakerId: number,
  opts: JlptSynthOpts,
): Promise<ArrayBuffer> {
  const clean = normalizeJp(text)
  if (!clean) {
    throw new Error('synthesizeJlpt: input text is empty after normalization')
  }

  const query = await audioQuery(clean, speakerId)

  // ── Step 3: Global scaler alignment ──────────────────────────────────
  // Do NOT touch pitchScale unless the caller asked — every speaker has
  // its own natural baseline and shifting it de-natures the voice.
  query.speedScale = opts.speed
  if (opts.pitch != null) query.pitchScale = opts.pitch
  if (opts.intonation != null) query.intonationScale = opts.intonation
  if (opts.volume != null) query.volumeScale = opts.volume
  query.prePhonemeLength = opts.prePhonemeLength
  query.postPhonemeLength = opts.postPhonemeLength
  query.pauseLengthScale = opts.pauseLengthScale

  // ── Step 4: Accent-phrase boundary correction ────────────────────────
  // For every phrase whose pause_mora is a bunsetsu junction (not tied to
  // 、/。/？/！), zero the durations in place. We keep the mora object so
  // the payload shape is preserved for engines that validate structure.
  // The final phrase never carries a trailing pause, so we can walk the
  // full array without a special-case skip.
  const phrases = query.accent_phrases
  if (Array.isArray(phrases) && phrases.length > 0) {
    for (const phrase of phrases) {
      const pm = phrase?.pause_mora
      if (!pm) continue
      if (isPunctuationPause(pm)) continue
      // Programmatic zero-out — welds neighboring grammatical chunks
      // ("onna no hito to otoko no hito ga") into a single breath group.
      pm.vowel_length = 0.0
      if (pm.consonant_length != null) pm.consonant_length = 0.0
    }
  }

  return synthesize(query, speakerId)
}

/**
 * Back-compat convenience wrapper for non-JLPT flows (e.g. reels). Applies
 * top-level scalars only, no accent-phrase mutation.
 */
export async function synthesizeText(
  text: string,
  speakerId: number,
  opts?: {
    speed?: number
    pitch?: number
    intonation?: number
    volume?: number
    prePhonemeLength?: number
    postPhonemeLength?: number
    pauseLengthScale?: number
  },
): Promise<ArrayBuffer> {
  const query = await audioQuery(text, speakerId)
  if (opts?.speed != null) query.speedScale = opts.speed
  if (opts?.pitch != null) query.pitchScale = opts.pitch
  if (opts?.intonation != null) query.intonationScale = opts.intonation
  if (opts?.volume != null) query.volumeScale = opts.volume
  if (opts?.prePhonemeLength != null) query.prePhonemeLength = opts.prePhonemeLength
  if (opts?.postPhonemeLength != null) query.postPhonemeLength = opts.postPhonemeLength
  if (opts?.pauseLengthScale != null) query.pauseLengthScale = opts.pauseLengthScale
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
