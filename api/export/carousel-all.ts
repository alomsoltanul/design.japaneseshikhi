import type { VercelRequest, VercelResponse } from '@vercel/node'
import JSZip from 'jszip'
import { guard, bad, q, qNum } from '../_lib/http'
import { resolveQuestion, resolvePack, NotFound } from '../_lib/resolve'
import { slidePng } from '../_lib/carouselImage'

// Module 4 — Carousel Image Export (all 5 slides, zipped).
// GET /api/export/carousel-all?level=N5&test=3&mondai=1&question=2 -> ZIP of slide-1..5.png
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, ['GET'])) return

  const level = q(req.query.level).toUpperCase()
  const test = qNum(req.query.test, NaN)
  const mondai = qNum(req.query.mondai, NaN)
  const question = qNum(req.query.question, NaN)

  if (!level || [test, mondai, question].some(Number.isNaN)) return bad(res, 'level, test, mondai, question are required')

  try {
    const r = await resolveQuestion(level, test, mondai, question)
    const pack = await resolvePack(r)
    const zip = new JSZip()
    const total = pack.carousel_slides.length

    for (const slide of pack.carousel_slides) {
      const png = await slidePng(slide, { level, total })
      zip.file(`slide-${slide.slide}.png`, png)
    }

    const buf = await zip.generateAsync({ type: 'nodebuffer' })
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${level.toLowerCase()}_t${test}_m${mondai}_q${question}_carousel.zip"`)
    res.status(200).send(buf)
  } catch (e) {
    bad(res, (e as Error).message, e instanceof NotFound ? 404 : 500)
  }
}
