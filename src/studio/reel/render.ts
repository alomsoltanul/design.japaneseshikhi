// Canvas renderer for the animated 1080x1920 reel. System fonts → Japanese OK.
import type { LevelQuestion } from '../levels'

export const W = 1080
export const H = 1920
const BRAND = '#E63946'
const JP = "'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP','Yu Gothic',sans-serif"

export type SceneKind = 'question' | 'listen' | 'think' | 'answer' | 'feedback' | 'outro'

function bg(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#0d0f1a')
  g.addColorStop(0.55, '#15131f')
  g.addColorStop(1, '#1a1024')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // top progress accent
  ctx.fillStyle = BRAND
  ctx.fillRect(0, 0, W, 12)
}

function badge(ctx: CanvasRenderingContext2D, level: string) {
  ctx.save()
  ctx.font = `800 44px ${JP}`
  const label = `JLPT ${level}`
  const w = ctx.measureText(label).width + 72
  const x = (W - w) / 2
  const y = 120
  roundRect(ctx, x, y, w, 84, 42)
  ctx.fillStyle = BRAND
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, W / 2, y + 44)
  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Wrap + center text. Returns the y after the block. */
function wrapCenter(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  topY: number,
  maxW: number,
  lineH: number,
): number {
  const lines: string[] = []
  for (const raw of text.split('\n')) {
    let line = ''
    for (const ch of raw) {
      if (ctx.measureText(line + ch).width > maxW && line) {
        lines.push(line)
        line = ch
      } else {
        line += ch
      }
    }
    lines.push(line)
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  let y = topY
  for (const l of lines) {
    ctx.fillText(l, cx, y)
    y += lineH
  }
  return y
}

function optionRows(ctx: CanvasRenderingContext2D, q: LevelQuestion, topY: number, highlightCorrect: boolean, pop: number) {
  const rowH = 150
  const gap = 26
  const x = 90
  const w = W - 180
  ctx.font = `700 56px ${JP}`
  q.options.forEach((o, i) => {
    const y = topY + i * (rowH + gap)
    const correct = highlightCorrect && o.id === q.correct_option_id
    roundRect(ctx, x, y, w, rowH, 28)
    ctx.fillStyle = correct ? 'rgba(230,57,70,0.20)' : 'rgba(255,255,255,0.07)'
    ctx.fill()
    if (correct) {
      ctx.lineWidth = 5
      ctx.strokeStyle = BRAND
      ctx.stroke()
    }
    // number circle
    const cy = y + rowH / 2
    ctx.beginPath()
    ctx.arc(x + 78, cy, 44, 0, Math.PI * 2)
    ctx.fillStyle = correct ? BRAND : 'rgba(255,255,255,0.14)'
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `800 44px ${JP}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(o.id), x + 78, cy)
    // text
    ctx.font = `700 56px ${JP}`
    ctx.textAlign = 'left'
    ctx.fillStyle = '#fff'
    ctx.fillText(o.text, x + 150, cy)
    // checkmark pop
    if (correct) {
      ctx.save()
      ctx.translate(x + w - 90, cy)
      ctx.scale(pop, pop)
      ctx.fillStyle = BRAND
      ctx.font = `900 90px ${JP}`
      ctx.textAlign = 'center'
      ctx.fillText('✓', 0, 6)
      ctx.restore()
    }
  })
}

function label(ctx: CanvasRenderingContext2D, text: string, y: number) {
  ctx.font = `800 58px ${JP}`
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, W / 2, y)
}

/** Draw one frame. tLocal = seconds into the scene, dur = scene length. */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  scene: SceneKind,
  q: LevelQuestion,
  level: string,
  tLocal: number,
  dur: number,
) {
  bg(ctx)
  ctx.fillStyle = '#fff'

  if (scene === 'question') {
    badge(ctx, level)
    ctx.fillStyle = '#fff'
    ctx.font = `800 70px ${JP}`
    const afterQ = wrapCenter(ctx, q.question_text, W / 2, 360, W - 160, 92)
    optionRows(ctx, q, Math.max(afterQ + 40, 760), false, 0)
    return
  }

  if (scene === 'listen') {
    badge(ctx, level)
    ctx.font = `900 220px ${JP}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🎧', W / 2, H / 2 - 120)
    const dots = '.'.repeat(1 + (Math.floor(tLocal * 2) % 3))
    label(ctx, `きいて ください${dots}`, H / 2 + 120)
    ctx.font = `600 44px ${JP}`
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.fillText('Listen carefully', W / 2, H / 2 + 200)
    return
  }

  if (scene === 'think') {
    label(ctx, 'かんがえて！ / Think!', 520)
    const remain = Math.max(0, Math.ceil(dur - tLocal))
    ctx.font = `900 460px ${JP}`
    ctx.fillStyle = BRAND
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(230,57,70,0.5)'
    ctx.shadowBlur = 80
    ctx.fillText(String(remain || 1), W / 2, H / 2 + 40)
    ctx.shadowBlur = 0
    return
  }

  if (scene === 'answer') {
    badge(ctx, level)
    label(ctx, 'こたえ / Answer', 320)
    const pop = Math.min(1, tLocal / 0.4)
    optionRows(ctx, q, 470, true, pop < 0.05 ? 0 : pop)
    return
  }

  if (scene === 'feedback') {
    badge(ctx, level)
    label(ctx, 'ポイント / Key point', 360)
    ctx.font = `800 64px ${JP}`
    ctx.fillStyle = '#fff'
    const after = wrapCenter(ctx, q.feedback.advice, W / 2, 620, W - 160, 86)
    ctx.font = `600 52px ${JP}`
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    wrapCenter(ctx, `💡 ${q.feedback.hint}`, W / 2, after + 90, W - 160, 70)
    return
  }

  // outro
  const cardW = W - 200
  const cardH = 720
  const cx = 100
  const cy = (H - cardH) / 2
  roundRect(ctx, cx, cy, cardW, cardH, 48)
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  ctx.fill()
  ctx.lineWidth = 5
  ctx.strokeStyle = BRAND
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = BRAND
  ctx.font = `900 80px ${JP}`
  ctx.fillText('日本語シキ', W / 2, cy + 200)
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = `600 52px ${JP}`
  ctx.fillText('Follow', W / 2, cy + 320)
  ctx.fillStyle = '#fff'
  ctx.font = `900 76px ${JP}`
  ctx.fillText('@japaneseshikhi', W / 2, cy + 430)
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.font = `600 46px ${JP}`
  ctx.fillText('for daily JLPT practice', W / 2, cy + 540)
}
