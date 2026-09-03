import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guard, bad } from '../_lib/http'
import { writeBangla, type BanglaLineInput } from '../_lib/nadeshiko'

/** POST /api/clips/bangla — one Claude call for the whole batch of lines. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, ['POST'])) return
  try {
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as
      { word?: string; lines?: BanglaLineInput[] }
    res.status(200).json(await writeBangla(body?.word ?? '', body?.lines ?? []))
  } catch (e) {
    const err = e as Error & { status?: number }
    bad(res, err.message, err.status ?? 500)
  }
}
