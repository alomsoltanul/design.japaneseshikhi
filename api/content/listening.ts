import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guard, bad, q, qNum } from '../_lib/http'
import { loadTest, audioPublicUrl } from '../_lib/store'
import { findQuestion } from '../_lib/schema'

// GET /api/content/listening?level=N5&test=3&mondai=1[&question=2]
// Returns the stored ListeningTest, or a single question when ?question= is given.
// Audio public URLs are attached for the Studio play button.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, ['GET'])) return

  const level = q(req.query.level).toUpperCase()
  const test = qNum(req.query.test, NaN)
  const mondai = qNum(req.query.mondai, NaN)
  const questionNum = req.query.question != null ? qNum(req.query.question, NaN) : null

  if (!level || Number.isNaN(test) || Number.isNaN(mondai))
    return bad(res, 'level, test and mondai query params are required')

  const data = await loadTest(level, test, mondai)
  if (!data) return bad(res, `No generated content for ${level} t${test} m${mondai}. Run /api/generate/listening first.`, 404)

  if (questionNum != null && !Number.isNaN(questionNum)) {
    const question = findQuestion(data, mondai, questionNum)
    if (!question) return bad(res, `question ${questionNum} not found`, 404)
    return res.status(200).json({
      level: data.level,
      test_number: data.test_number,
      mondai_number: mondai,
      question,
      audio_url: audioPublicUrl(level, question.audio_file),
    })
  }

  res.status(200).json(data)
}
