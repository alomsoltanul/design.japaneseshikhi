import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guard, bad } from '../_lib/http'
import { generateSocialPack } from '../_lib/social'
import { putJson, socialKey } from '../_lib/store'
import type { ListeningQuestion } from '../_lib/schema'

// Module 3 — Social Content Pack Generator.
// POST a single question object (Module 1 schema). Optionally include
// { level, test_number, mondai_number } to cache the pack for reuse.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, ['POST'])) return

  const body = (typeof req.body === 'string' ? safeParse(req.body) : req.body) ?? {}
  // Accept either the bare question or { question, level, ... }
  const question: ListeningQuestion = (body.question ?? body) as ListeningQuestion

  if (!question || !question.question_text || !Array.isArray(question.options)) {
    return bad(res, 'POST body must be a question object with question_text and options')
  }

  try {
    const pack = await generateSocialPack(question)

    const level = body.level ? String(body.level).toUpperCase() : null
    const test = Number(body.test_number)
    const mondai = Number(body.mondai_number)
    if (level && Number.isInteger(test) && Number.isInteger(mondai)) {
      await putJson(socialKey(level, test, mondai, question.question_number), pack).catch(() => {})
    }

    res.status(200).json(pack)
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
