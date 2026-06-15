// Listening test JSON schema — shared types + validator.
// Matches the content-factory pipeline schema (NOT the internal ListeningStudio Track model).

export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
export type Speaker = 'male' | 'female' | 'narrator'

export interface ListeningOption {
  id: number
  text: string
}

export interface ListeningFeedback {
  reason: string
  advice: string
  hint: string
  trap: string
}

export interface DialogueLine {
  speaker: Speaker
  text: string
}

export interface ListeningTranscript {
  pre_question: string
  dialogue: DialogueLine[]
  post_question: string
}

export interface ListeningQuestion {
  question_number: number
  question_text: string
  question_text_en: string
  audio_file: string
  image_file?: string
  image_prompt?: string
  options: ListeningOption[]
  correct_option_id: number
  feedback: ListeningFeedback
  transcript: ListeningTranscript
}

export interface ListeningProblem {
  problem_number: number
  problem_title: string
  problem_title_en: string
  instructions: string
  instructions_en: string
  has_image: boolean
  image_type?: string
  question_count: number
  questions: ListeningQuestion[]
}

export interface ListeningTest {
  level: JlptLevel
  test_number: number
  section: 'listening'
  total_questions: number
  problems: ListeningProblem[]
}

/** Audio filename convention: {level_lower}_t{test}_m{mondai}_q{question}.wav */
export function audioName(level: string, test: number, mondai: number, q: number): string {
  return `${level.toLowerCase()}_t${test}_m${mondai}_q${q}.wav`
}

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

/** Validate a generated listening test against the schema + quality rules. */
export function validateListeningTest(data: unknown): ValidationResult {
  const errors: string[] = []
  const t = data as ListeningTest

  if (!t || typeof t !== 'object') return { ok: false, errors: ['root is not an object'] }
  if (!t.level) errors.push('missing level')
  if (typeof t.test_number !== 'number') errors.push('missing/invalid test_number')
  if (t.section !== 'listening') errors.push('section must be "listening"')
  if (!Array.isArray(t.problems) || t.problems.length === 0) {
    errors.push('problems must be a non-empty array')
    return { ok: false, errors }
  }

  for (const p of t.problems) {
    if (!Array.isArray(p.questions)) {
      errors.push(`problem ${p.problem_number}: questions not an array`)
      continue
    }
    if (p.question_count !== p.questions.length) {
      errors.push(`problem ${p.problem_number}: question_count ${p.question_count} != questions.length ${p.questions.length}`)
    }
    for (const q of p.questions) {
      const qid = `p${p.problem_number} q${q.question_number}`
      if (![1, 2, 3, 4].includes(q.correct_option_id)) {
        errors.push(`${qid}: correct_option_id must be 1-4`)
      }
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        errors.push(`${qid}: must have exactly 4 options`)
      }
      const fb = q.feedback
      for (const k of ['reason', 'advice', 'hint', 'trap'] as const) {
        if (!fb || !fb[k] || !String(fb[k]).trim()) errors.push(`${qid}: feedback.${k} missing/empty`)
      }
      if (!q.transcript || !Array.isArray(q.transcript.dialogue)) {
        errors.push(`${qid}: transcript.dialogue missing`)
      }
    }
  }

  return { ok: errors.length === 0, errors }
}

/** Pull a single question out of a stored test by mondai + question number. */
export function findQuestion(
  test: ListeningTest,
  mondaiNumber: number,
  questionNumber: number,
): ListeningQuestion | null {
  const problem = test.problems.find(p => p.problem_number === mondaiNumber) ?? test.problems[0]
  if (!problem) return null
  return problem.questions.find(q => q.question_number === questionNumber) ?? null
}
