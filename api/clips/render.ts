import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guard, bad } from '../_lib/http'

/**
 * POST /api/clips/render — local-only.
 *
 * The render shells out to ffmpeg and headless Chrome (see scripts/merge-reel.mjs
 * and scripts/reel-frame.mjs), neither of which exists in a serverless runtime.
 * The working implementation lives in the Vite dev middleware in vite.config.ts;
 * this exists so the deployed panel fails with an explanation rather than a 404.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, ['POST'])) return
  bad(res, 'Reel rendering runs locally only — it needs ffmpeg and Chrome. Run the studio with `npm run dev` and export from there.', 501)
}
