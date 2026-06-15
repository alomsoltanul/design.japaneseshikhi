// Offline level data: read hand-authored JSON from /public/jsonfileLevels/{level}.json.
// No API, no key, no cost. Edit the JSON + refresh the browser.

export interface Option { id: number; text: string }
export interface Feedback { reason: string; advice: string; hint: string; trap: string }
export interface DialogueLine { speaker: 'male' | 'female' | 'narrator'; text: string }
export interface Transcript { pre_question: string; dialogue: DialogueLine[]; post_question: string }
export interface SocialOverride { caption?: string; hashtags?: string[] }

export interface LevelQuestion {
  question_number: number
  question_text: string
  question_text_en: string
  image_file?: string
  image_prompt?: string
  audio_file?: string
  options: Option[]
  correct_option_id: number
  feedback: Feedback
  transcript?: Transcript
  social?: SocialOverride
}

export interface LevelProblem {
  mondai_number: number
  problem_title: string
  problem_title_en: string
  questions: LevelQuestion[]
}

export interface LevelTest {
  test_number: number
  problems: LevelProblem[]
}

export interface LevelFile {
  level: string
  tests: LevelTest[]
}

export const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
export type Level = (typeof LEVELS)[number]

const cache = new Map<string, Promise<LevelFile>>()

/** Fetch (and cache) the JSON file for a level. */
export function loadLevel(level: string): Promise<LevelFile> {
  const key = level.toUpperCase()
  if (!cache.has(key)) {
    const p = fetch(`/jsonfileLevels/${key.toLowerCase()}.json`, { cache: 'no-store' })
      .then(r => {
        if (!r.ok) throw new Error(`No file public/jsonfileLevels/${key.toLowerCase()}.json (HTTP ${r.status})`)
        return r.json() as Promise<LevelFile>
      })
      .catch(e => {
        cache.delete(key) // allow retry after the user fixes the file
        throw e
      })
    cache.set(key, p)
  }
  return cache.get(key)!
}

export function findTest(file: LevelFile, test: number): LevelTest | undefined {
  return file.tests.find(t => t.test_number === test) ?? file.tests[0]
}

export function findProblem(file: LevelFile, test: number, mondai: number): LevelProblem | undefined {
  const t = findTest(file, test)
  return t?.problems.find(p => p.mondai_number === mondai) ?? t?.problems[0]
}

export function findQuestion(
  file: LevelFile,
  test: number,
  mondai: number,
  question: number,
): LevelQuestion | undefined {
  const p = findProblem(file, test, mondai)
  return p?.questions.find(q => q.question_number === question)
}
