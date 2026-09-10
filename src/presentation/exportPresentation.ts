import { toPng } from 'html-to-image'
import JSZip from 'jszip'
import type { PresentationDeck } from './types'

export async function exportSlidePng(node: HTMLElement, filename = 'slide.png'): Promise<void> {
  await document.fonts.ready
  // Ensure images are loaded
  const imgs = Array.from(node.querySelectorAll('img'))
  await Promise.all(
    imgs.map(im => (im.complete ? null : new Promise(res => { im.onload = im.onerror = () => res(null) })))
  )
  await new Promise(r => setTimeout(r, 150)) // layout settle

  // Save transform state
  const prevTransform = node.style.transform
  const prevTransformOrigin = node.style.transformOrigin

  try {
    node.style.transform = 'none'
    node.style.transformOrigin = 'top left'

    const opts = {
      width: 1920,
      height: 1080,
      pixelRatio: 1,
      cacheBust: true,
      skipFonts: true,
    }

    // Warm-up pass
    await toPng(node, opts)
    const dataUrl = await toPng(node, opts)

    const a = document.createElement('a')
    a.href = dataUrl
    a.download = filename
    a.click()
  } finally {
    node.style.transform = prevTransform
    node.style.transformOrigin = prevTransformOrigin
  }
}

export async function captureSlideDataUrl(node: HTMLElement): Promise<string> {
  await document.fonts.ready
  const imgs = Array.from(node.querySelectorAll('img'))
  await Promise.all(
    imgs.map(im => (im.complete ? null : new Promise(res => { im.onload = im.onerror = () => res(null) })))
  )
  await new Promise(r => setTimeout(r, 100))

  const prevTransform = node.style.transform
  const prevTransformOrigin = node.style.transformOrigin

  try {
    node.style.transform = 'none'
    node.style.transformOrigin = 'top left'

    const opts = {
      width: 1920,
      height: 1080,
      pixelRatio: 1,
      cacheBust: true,
      skipFonts: true,
    }

    await toPng(node, opts)
    return await toPng(node, opts)
  } finally {
    node.style.transform = prevTransform
    node.style.transformOrigin = prevTransformOrigin
  }
}

export async function exportDeckZip(
  deck: PresentationDeck,
  renderSlideOffscreen: (slideIndex: number) => Promise<HTMLElement>,
  onProgress?: (progressText: string) => void
): Promise<void> {
  const zip = new JSZip()
  const total = deck.slides.length

  for (let i = 0; i < total; i++) {
    onProgress?.(`Rendering slide ${i + 1} of ${total}...`)
    const node = await renderSlideOffscreen(i)
    const dataUrl = await captureSlideDataUrl(node)
    const base64 = dataUrl.split(',')[1]
    const slideNumber = String(i + 1).padStart(2, '0')
    zip.file(`slide-${slideNumber}.png`, base64, { base64: true })
  }

  onProgress?.('Generating presentation package...')

  // Include the full JSON workflow
  zip.file('presentation-workflow.json', JSON.stringify(deck, null, 2))

  // Include speaker notes as a guide for video recording
  const notesText = deck.slides
    .map((s, idx) => {
      return `=== SLIDE ${idx + 1}: ${s.keyword || ''} ${s.title || ''} (${s.type}) ===\n${s.speakerNotes || '(No notes provided)'}\n`
    })
    .join('\n\n')

  zip.file('speaker-notes-guide.txt', `PRESENTATION GUIDE: ${deck.title}\n\n${notesText}\n`)

  const blob = await zip.generateAsync({ type: 'blob' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${deck.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-slides.zip`
  a.click()
  URL.revokeObjectURL(a.href)
}
