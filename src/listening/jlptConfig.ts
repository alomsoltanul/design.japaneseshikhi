/**
 * JLPT listening exam audio standards.
 *
 * `speed` picks a deliberate exam pace. `pauseLengthScale` widens 、/。
 * pauses so clause breaks read as intentional beats without introducing
 * word-level choppiness (that job belongs to `synthesizeJlpt`).
 *
 * Reference speeds (character rates → speedScale):
 *   N5: ~120–150 chars/min  → 0.78
 *   N4: ~150–190 chars/min  → 0.85
 *   N3: ~200–260 chars/min  → 0.95
 *   N2: ~240–300 chars/min  → 1.02
 *   N1: ~280–350 chars/min  → 1.05
 */

export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

export interface JlptAudioProfile {
  level: JlptLevel
  speed: number
  pitch: number
  intonation: number
  volume: number
  prePhonemeLength: number
  postPhonemeLength: number
  /** Multiplier applied to every surviving `pause_mora` (comma/period). */
  pauseLengthScale: number
  pauseBetweenLines: number
  pauseBeforeQuestion: number
  pauseAfterNarrator: number
}

export const JLPT_PROFILES: Record<JlptLevel, JlptAudioProfile> = {
  N5: {
    level: 'N5',
    speed: 0.78,
    pitch: 0.0,
    intonation: 1.10,
    volume: 1.0,
    prePhonemeLength: 0.04,
    postPhonemeLength: 0.04,
    pauseLengthScale: 1.55,
    pauseBetweenLines: 700,
    pauseBeforeQuestion: 5500,
    pauseAfterNarrator: 900,
  },
  N4: {
    level: 'N4',
    speed: 0.82,
    pitch: 0.0,
    intonation: 1.05,
    volume: 1.0,
    prePhonemeLength: 0.03,
    postPhonemeLength: 0.03,
    pauseLengthScale: 1.50,
    pauseBetweenLines: 550,
    pauseBeforeQuestion: 4500,
    pauseAfterNarrator: 700,
  },
  N3: {
    level: 'N3',
    speed: 0.95,
    pitch: 0.0,
    intonation: 1.0,
    volume: 1.0,
    prePhonemeLength: 0.02,
    postPhonemeLength: 0.02,
    pauseLengthScale: 1.20,
    pauseBetweenLines: 450,
    pauseBeforeQuestion: 3500,
    pauseAfterNarrator: 550,
  },
  N2: {
    level: 'N2',
    speed: 1.02,
    pitch: 0.0,
    intonation: 0.97,
    volume: 1.0,
    prePhonemeLength: 0.015,
    postPhonemeLength: 0.015,
    pauseLengthScale: 1.05,
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
    pauseLengthScale: 1.0,
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
