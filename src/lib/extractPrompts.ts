export interface PromptEntry {
  level: string
  testNumber: number
  problemNumber: number
  problemTitle: string
  questionNumber: number
  questionText: string
  prompt: string
  filename: string | null
}

export interface PromptGroup {
  problemNumber: number
  title: string
  items: PromptEntry[]
}

export interface ExtractedPrompts {
  groups: PromptGroup[]
  allPrompts: string[]
  promptCount: number
  problemCount: number
}

interface ListeningTest {
  level?: string
  test_number?: number
  problems?: Problem[]
}

interface Problem {
  problem_number?: number
  problem_title?: string
  problem_title_en?: string
  questions?: Question[]
}

interface Question {
  question_number?: number
  question_text?: string
  question_text_en?: string
  image_prompt?: string
  audio_file?: string
}

export function extractPrompts(jsonText: string): ExtractedPrompts {
  let parsed: ListeningTest
  try {
    parsed = JSON.parse(jsonText) as ListeningTest
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown parse error'
    throw new Error(`Invalid JSON: ${msg}`)
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid JSON: Root must be an object.')
  }

  if (!Array.isArray(parsed.problems)) {
    throw new Error('No "problems" array found in this JSON.')
  }

  const level = String(parsed.level ?? 'N5')
  const testNumber = Number(parsed.test_number ?? 0)

  const groups: PromptGroup[] = []
  const allPrompts: string[] = []

  for (const problem of parsed.problems) {
    const problemNumber = Number(problem.problem_number ?? 0)
    const problemTitle =
      problem.problem_title ||
      problem.problem_title_en ||
      (problemNumber ? `Problem ${problemNumber}` : 'Problem')

    const questions = Array.isArray(problem.questions) ? problem.questions : []

    const items: PromptEntry[] = []

    for (const question of questions) {
      const prompt = typeof question.image_prompt === 'string' ? question.image_prompt.trim() : ''
      if (!prompt) continue

      const questionNumber = Number(question.question_number ?? 0)
      const questionText =
        question.question_text ||
        question.question_text_en ||
        (questionNumber ? `Question ${questionNumber}` : '')

      const audioFile = question.audio_file
      const filename = audioFile
        ? audioFile.replace(/\.(wav|mp3)$/i, '') + '_img.png'
        : null

      items.push({
        level,
        testNumber,
        problemNumber,
        problemTitle,
        questionNumber,
        questionText,
        prompt,
        filename,
      })

      allPrompts.push(prompt)
    }

    if (items.length) {
      groups.push({
        problemNumber,
        title: problemTitle,
        items,
      })
    }
  }

  return {
    groups,
    allPrompts,
    promptCount: allPrompts.length,
    problemCount: groups.length,
  }
}
