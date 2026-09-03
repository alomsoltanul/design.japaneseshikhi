import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guard, bad } from '../_lib/http'
import { nadeshikoSearch, type SearchInput } from '../_lib/nadeshiko'
import { translateLines } from '../_lib/translate'

/**
 * POST /api/clips/{search,translate,render}
 *
 * One dynamic route rather than a file per action, deliberately: the Hobby plan
 * caps a deployment at 12 Serverless Functions, and this project already ships
 * nine. Four separate clip routes plus the middleware pushed it to fourteen and
 * the deployment was rejected outright. Collapsing them keeps the same URLs —
 * no client change — for one function instead of four.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, ['POST'])) return

  const action = Array.isArray(req.query.action) ? req.query.action[0] : req.query.action
  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) ?? {}

  try {
    switch (action) {
      case 'search':
        return res.status(200).json(await nadeshikoSearch(body as SearchInput))

      case 'translate':
        return res.status(200).json(await translateLines(body))

      case 'render':
        // The render shells out to ffmpeg and headless Chrome (scripts/merge-reel.mjs
        // and scripts/reel-frame.mjs), neither of which exists in a serverless
        // runtime. The working implementation is the Vite dev middleware in
        // vite.config.ts; this exists so the deployed panel fails with an
        // explanation rather than a 404.
        return bad(res, 'Reel rendering runs locally only — it needs ffmpeg and Chrome. Run the studio with `npm run dev` and export from there.', 501)

      default:
        return bad(res, `Unknown clips action "${action ?? ''}". Use search, translate or render.`, 404)
    }
  } catch (e) {
    const err = e as Error & { status?: number }
    bad(res, err.message, err.status ?? 500)
  }
}
