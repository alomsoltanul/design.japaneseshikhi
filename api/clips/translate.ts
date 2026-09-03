import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guard, bad } from '../_lib/http'
import { translateLines } from '../_lib/translate'

/** POST /api/clips/translate — free (MyMemory) or Claude, one batch for every line. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, ['POST'])) return
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    res.status(200).json(await translateLines(body || {}))
  } catch (e) {
    const err = e as Error & { status?: number }
    bad(res, err.message, err.status ?? 500)
  }
}
