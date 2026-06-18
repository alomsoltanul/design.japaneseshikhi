/**
 * JLPT listening exam audio standards.
 *
 * Reference speeds (character rates):
 *   N5: ~120–160 chars/min  → speedScale ~0.85–0.92
 *   N4: ~160–200 chars/min  → speedScale ~0.92–0.98
 *   N3: ~200–260 chars/min  → speedScale ~0.98–1.02
 *   N2: ~240–300 chars/min  → speedScale ~1.00–1.05
 *   N1: ~280–350 chars/min  → speedScale ~1.02–1.08
 *
 * Pause guidelines (JLPT official practice materials):
 *   N5: longer breathing room, very deliberate gaps
 *   N4: slightly reduced but still generous
 *   N3: natural conversational pacing
 *   N2: tight, near-native gaps
 *   N1: native speed, minimal gaps
 */

export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

export interface JlptAudioProfile {
  level: JlptLevel
  /** VOICEVOX speedScale */
  speed: number
  /** VOICEVOX pitchScale (0 = natural for the speaker) */
  pitch: number
  /** VOICEVOX intonationScale */
  intonation: number
  /** VOICEVOX volumeScale */
  volume: number
  /** VOICEVOX pre-phoneme breathing length (seconds) */
  prePhonemeLength: number
  /** VOICEVOX post-phoneme breathing length (seconds) */
  postPhonemeLength: number
  /** Pause between normal conversation lines (ms) */
  pauseBetweenLines: number
  /** Pause before the final question prompt (ms) */
  pauseBeforeQuestion: number
  /** Extra pause after narrator/instruction lines (ms) */
  pauseAfterNarrator: number
}

export const JLPT_PROFILES: Record<JlptLevel, JlptAudioProfile> = {
  N5: {
    level: 'N5',
    speed: 0.88,
    pitch: 0.0,
    intonation: 1.1,
    volume: 1.0,
    prePhonemeLength: 0.04,
    postPhonemeLength: 0.04,
    pauseBetweenLines: 700,
    pauseBeforeQuestion: 5500,
    pauseAfterNarrator: 900,
  },
  N4: {
    level: 'N4',
    speed: 0.94,
    pitch: 0.0,
    intonation: 1.05,
    volume: 1.0,
    prePhonemeLength: 0.03,
    postPhonemeLength: 0.03,
    pauseBetweenLines: 550,
    pauseBeforeQuestion: 4500,
    pauseAfterNarrator: 700,
  },
  N3: {
    level: 'N3',
    speed: 1.0,
    pitch: 0.0,
    intonation: 1.0,
    volume: 1.0,
    prePhonemeLength: 0.02,
    postPhonemeLength: 0.02,
    pauseBetweenLines: 450,
    pauseBeforeQuestion: 3500,
    pauseAfterNarrator: 550,
  },
  N2: {
    level: 'N2',
    speed: 1.03,
    pitch: 0.0,
    intonation: 0.97,
    volume: 1.0,
    prePhonemeLength: 0.015,
    postPhonemeLength: 0.015,
    pauseBetweenLines: 350,
    pauseBeforeQuestion: 3000,
    pauseAfterNarrator: 400,
  },
  N1: {
    level: 'N1',
    speed: 1.05,
    pitch: 0.0,
    intonation: 1.0,
    volume: 1.0,
    prePhonemeLength: 0.01,
    postPhonemeLength: 0.01,
    pauseBetweenLines: 250,
    pauseBeforeQuestion: 2500,
    pauseAfterNarrator: 300,
  },
}

export function getJlptProfile(level: string): JlptAudioProfile {
  return JLPT_PROFILES[level as JlptLevel] ?? JLPT_PROFILES.N4
}

/** Compute pause for a line based on its role in the script. */
export function computePauseForLine(
  lineIndex: number,
  lines: { speaker: string }[],
  profile: JlptAudioProfile
): number {
  const isNarrator = lines[lineIndex]?.speaker === '九州そら'
  const lastNarratorIdx = lines
    .map((l, i) => (l.speaker === '九州そら' ? i : -1))
    .filter(i => i >= 0)
    .pop()
  const isLastNarrator = lastNarratorIdx === lineIndex

  if (isLastNarrator) return profile.pauseBeforeQuestion
  if (isNarrator) return profile.pauseAfterNarrator
  return profile.pauseBetweenLines
}
