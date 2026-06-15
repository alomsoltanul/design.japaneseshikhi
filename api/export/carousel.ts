import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guard, bad, q, qNum } from '../_lib/http'
import { resolveQuestion, resolvePack, NotFound } from '../_lib/resolve'
import { slidePng } from '../_lib/carouselImage'

// Module 4 — Carousel Image Export (single slide).
// GET /api/export/carousel?level=N5&test=3&mondai=1&question=2&slide=1 -> PNG 1080x1350
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, ['GET'])) return

  const level = q(req.query.level).toUpperCase()
  const test = qNum(req.query.test, NaN)
  const mondai = qNum(req.query.mondai, NaN)
  const question = qNum(req.query.question, NaN)
  const slideNo = qNum(req.query.slide, 1)

  if (!level || [test, mondai, question].some(Number.isNaN)) return bad(res, 'level, test, mondai, question are required')
  if (slideNo < 1 || slideNo > 5) return bad(res, 'slide must be 1-5')

  try {
    const r = await resolveQuestion(level, test, mondai, question)
    const pack = await resolvePack(r)
    const slide = pack.carousel_slides.find(s => s.slide === slideNo)
    if (!slide) return bad(res, `slide ${slideNo} not found`, 404)

    const png = await slidePng(slide, { level, total: pack.carousel_slides.length })
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.status(200).send(png)
  } catch (e) {
    bad(res, (e as Error).message, e instanceof NotFound ? 404 : 500)
  }
}
