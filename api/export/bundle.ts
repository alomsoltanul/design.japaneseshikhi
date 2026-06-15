import type { VercelRequest, VercelResponse } from '@vercel/node'
import JSZip from 'jszip'
import { guard, bad, q, qNum } from '../_lib/http'
import { resolveQuestion, resolvePack, NotFound } from '../_lib/resolve'
import { slidePng } from '../_lib/carouselImage'
import { getAudio } from '../_lib/store'
import { buildScene } from '../_lib/obs'

// Module 6 — Export Bundle.
// GET /api/export/bundle?level=N5&test=3&mondai=1&question=2 -> ZIP with everything.
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

    // slide-1.png .. slide-5.png
    for (const slide of pack.carousel_slides) {
      zip.file(`slide-${slide.slide}.png`, await slidePng(slide, { level, total }))
    }

    // caption.txt (instagram caption + hashtags)
    zip.file('caption.txt', `${pack.instagram_caption}\n\n${pack.hashtags.join(' ')}\n`)
    // facebook-post.txt
    zip.file('facebook-post.txt', `${pack.facebook_post}\n`)
    // reel-script.json
    zip.file('reel-script.json', JSON.stringify(pack.reel_script, null, 2))

    // audio file from Supabase Storage (best-effort)
    const audio = await getAudio(level, r.question.audio_file)
    if (audio) {
      zip.file(r.question.audio_file, audio)
    } else {
      zip.file('audio-MISSING.txt', `Audio not found at mock-audio/listening/${level}/${r.question.audio_file}. Upload it to Supabase Storage.`)
    }

    // single-question OBS scene snippet
    const scene = buildScene({ level, test, mondai, question, baseUrl: process.env.STUDIO_BASE_URL }, 'question')
    zip.file(`obs-scene-q${question}.json`, JSON.stringify(scene, null, 2))

    const buf = await zip.generateAsync({ type: 'nodebuffer' })
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${level.toLowerCase()}_t${test}_m${mondai}_q${question}_bundle.zip"`)
    res.status(200).send(buf)
  } catch (e) {
    bad(res, (e as Error).message, e instanceof NotFound ? 404 : 500)
  }
}
