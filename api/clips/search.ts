import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guard, bad } from '../_lib/http'
import { nadeshikoSearch, type SearchInput } from '../_lib/nadeshiko'

/** POST /api/clips/search — proxies Nadeshiko so NADESHIKO_API_KEY stays server-side. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, ['POST'])) return
  try {
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as SearchInput
    res.status(200).json(await nadeshikoSearch(body || ({} as SearchInput)))
  } catch (e) {
    const err = e as Error & { status?: number }
    bad(res, err.message, err.status ?? 500)
  }
}
