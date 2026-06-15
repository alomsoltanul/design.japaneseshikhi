import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guard, bad } from '../_lib/http'
import { generateJson } from '../_lib/anthropic'
import { listeningSystemPrompt, listeningUserPrompt } from '../_lib/prompts'
import { validateListeningTest, audioName, type JlptLevel, type ListeningTest } from '../_lib/schema'
import { saveTest } from '../_lib/store'

const LEVELS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

// Module 1 — Listening JSON Generator.
// POST { level, test_number, mondai_number, question_count, topic_seed }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, ['POST'])) return

  const body = (typeof req.body === 'string' ? safeParse(req.body) : req.body) ?? {}
  const level = String(body.level || '').toUpperCase() as JlptLevel
  const test_number = Number(body.test_number)
  const mondai_number = Number(body.mondai_number)
  const question_count = Number(body.question_count)
  const topic_seed = body.topic_seed ? String(body.topic_seed) : undefined

  if (!LEVELS.includes(level)) return bad(res, 'level must be one of N5..N1')
  if (!Number.isInteger(test_number) || test_number < 1) return bad(res, 'test_number must be a positive integer')
  if (![1, 2, 3, 4].includes(mondai_number)) return bad(res, 'mondai_number must be 1-4')
  if (!Number.isInteger(question_count) || question_count < 1 || question_count > 12)
    return bad(res, 'question_count must be 1-12')

  try {
    let test: ListeningTest | null = null
    let lastErrors: string[] = []

    // Generate, validate, retry once if the model violates a hard rule.
    for (let attempt = 0; attempt < 2 && !test; attempt++) {
      const draft = await generateJson<ListeningTest>({
        system: listeningSystemPrompt(level, mondai_number),
        user: listeningUserPrompt({ level, test_number, mondai_number, question_count, topic_seed }),
        maxTokens: 8192,
        temperature: attempt === 0 ? 0.7 : 0.4,
      })
      normalize(draft, level, test_number, mondai_number)
      const result = validateListeningTest(draft)
      if (result.ok) test = draft
      else lastErrors = result.errors
    }

    if (!test) return bad(res, `Generation failed validation: ${lastErrors.join('; ')}`, 502)

    // Persist so Studio / social-pack / carousel / bundle can read the same content.
    await saveTest(level, test_number, mondai_number, test).catch(() => {})

    res.status(200).json(test)
  } catch (e) {
    bad(res, (e as Error).message, 500)
  }
}

function safeParse(s: string): Record<string, unknown> | null {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

/** Force the structural fields we control so they always match the request. */
function normalize(t: ListeningTest, level: JlptLevel, test: number, mondai: number) {
  if (!t || typeof t !== 'object') return
  t.level = level
  t.test_number = test
  t.section = 'listening'
  const problems = Array.isArray(t.problems) ? t.problems : []
  const total = problems.reduce((n, p) => n + (p.questions?.length ?? 0), 0)
  t.total_questions = total
  for (const p of problems) {
    p.problem_number = mondai
    p.question_count = p.questions?.length ?? 0
    for (const [i, qq] of (p.questions ?? []).entries()) {
      qq.question_number = i + 1
      qq.audio_file = audioName(level, test, mondai, i + 1)
      if (p.has_image && !qq.image_file) qq.image_file = `${level.toLowerCase()}_t${test}_m${mondai}_q${i + 1}.png`
    }
  }
}
