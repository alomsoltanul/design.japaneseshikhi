import { useEffect, useRef } from 'react'
import { toPng } from 'html-to-image'
import JSZip from 'jszip'
import { SlideCard } from './SlideCard'
import { buildSocialPack } from './slides'
import type { LevelQuestion } from './levels'

export interface ExportJob {
  question: LevelQuestion
  level: string
  test: number
  mondai: number
}

/* Renders the 5 slides offscreen, captures each to PNG in-browser, and bundles
   slides + caption.txt + reel-script.json into a ZIP. Fully offline. */
export function ExportStage({ job, onDone }: { job: ExportJob | null; onDone: (err?: string) => void }) {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (!job) return
    let cancelled = false
    const pack = buildSocialPack(job.question, job.level)

    async function run() {
      try {
        await document.fonts.ready
        await new Promise(r => setTimeout(r, 250)) // let layout settle

        // System (local) fonts render Japanese fine; skip web-font embedding so
        // html-to-image doesn't choke on the app's cross-origin Google Fonts CSS.
        const opts = { width: 1080, height: 1350, pixelRatio: 1, cacheBust: true, skipFonts: true }
        const zip = new JSZip()
        for (let i = 0; i < pack.carousel_slides.length; i++) {
          const node = cardRefs.current[i]
          if (!node) throw new Error('slide not ready')
          await toPng(node, opts) // warm-up pass
          const dataUrl = await toPng(node, opts)
          zip.file(`slide-${i + 1}.png`, dataUrl.split(',')[1], { base64: true })
        }

        zip.file('caption.txt', `${pack.caption}\n\n${pack.hashtags.join(' ')}\n`)
        zip.file('reel-script.json', JSON.stringify(pack.reel_script, null, 2))

        const blob = await zip.generateAsync({ type: 'blob' })
        if (cancelled) return
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${job.level.toLowerCase()}_t${job.test}_m${job.mondai}_q${job.question.question_number}_slides.zip`
        a.click()
        URL.revokeObjectURL(a.href)
        onDone()
      } catch (e) {
        if (!cancelled) onDone((e as Error).message)
      }
    }
    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job])

  if (!job) return null
  const pack = buildSocialPack(job.question, job.level)

  // Offscreen render surface — positioned far off-canvas, not display:none
  // (html-to-image needs a laid-out node).
  return (
    <div style={{ position: 'fixed', left: -20000, top: 0, pointerEvents: 'none', opacity: 0 }} aria-hidden>
      {pack.carousel_slides.map((s, i) => (
        <div key={s.slide} ref={el => { cardRefs.current[i] = el }}>
          <SlideCard slide={s} level={job.level} total={pack.carousel_slides.length} />
        </div>
      ))}
    </div>
  )
}

export default ExportStage
