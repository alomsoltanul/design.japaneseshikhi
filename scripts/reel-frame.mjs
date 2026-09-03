/**
 * Renders the reel's 1080x1920 frames — the intro card and the per-clip overlay
 * carrying the keyword header and the burned-in subtitle.
 *
 * Rendered in headless Chrome rather than in ffmpeg or Pillow, for two reasons
 * that are both hard blockers rather than preferences:
 *
 *   1. This ffmpeg is built without libfreetype and without libass, so there is
 *      no `drawtext` and no `subtitles` filter — no text can be drawn in the
 *      filter graph at all.
 *   2. This Pillow reports `raqm: False`, meaning no HarfBuzz shaping. Bengali
 *      is a complex script: without shaping, কর + ো renders as a dotted-circle
 *      placeholder instead of করো. Japanese survives it; Bangla does not.
 *
 * Chrome shapes Bengali correctly and lays out `<ruby>` natively, so furigana
 * sits over its own kanji cluster with no width measuring at all.
 *
 * The overlay is a PNG with a transparent band where the clip plays, so ffmpeg
 * composites the video underneath in a single pass.
 */
import { spawn } from 'node:child_process'
import { writeFile, mkdtemp, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

export const FRAME = { w: 1080, h: 1920 }
/** One reel per language; each carries exactly one translation row. */
export const LANGS = ['en', 'bn', 'vi', 'ne']
export const LANG_NAMES = { en: 'English', bn: 'Bangla', vi: 'Vietnamese', ne: 'Nepali' }
/** Top block, video pane, bottom block — must sum to FRAME.h exactly. */
export const LAYOUT = { top: 470, pane: 608, bottom: 842 }
export const PANE_Y = LAYOUT.top

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
]

export function findChrome() {
  return CHROME_CANDIDATES.find(p => existsSync(p)) || null
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
))

const isKanji = (c) => /[一-鿿㐀-䶿々〆〇]/.test(c)

/** `漢字(かんじ)` markup → tokens, matching src/subtitles/timeline.ts's parser. */
function parseJP(str) {
  const out = []
  let buf = ''
  for (let i = 0; i < (str || '').length; i++) {
    const c = str[i]
    if (c === '(' || c === '（') {
      let j = i + 1, rd = ''
      while (j < str.length && str[j] !== ')' && str[j] !== '）') rd += str[j++]
      let k = buf.length
      while (k > 0 && isKanji(buf[k - 1])) k--
      let base = buf.slice(k)
      const prefix = buf.slice(0, k)
      if (!base) base = buf
      if (base !== buf && prefix) out.push({ s: prefix, f: '' })
      buf = ''
      if (base) out.push({ s: base, f: rd.trim() })
      i = j
    } else buf += c
  }
  if (buf) out.push({ s: buf, f: '' })
  return out.filter(t => t.s.length > 0)
}

/** Ruby markup, with the searched word picked out. */
function japaneseHtml(markup, keyword) {
  return parseJP(markup).map(t => {
    const hit = keyword && (t.s.includes(keyword) || (keyword.includes(t.s) && t.s.length > 1))
    const cls = hit ? ' class="key"' : ''
    const body = t.f
      ? `<ruby${cls}>${esc(t.s)}<rt>${esc(t.f)}</rt></ruby>`
      : `<span${cls}>${esc(t.s)}</span>`
    return body
  }).join('')
}

function romajiHtml(romaji, keyRomaji) {
  return (romaji || '').split(/\s+/).filter(Boolean)
    .map(p => (p === keyRomaji ? `<span class="key">${esc(p)}</span>` : esc(p)))
    .join(' ')
}

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${FRAME.w}px;height:${FRAME.h}px;background:transparent}
body{
  font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;
  display:flex;flex-direction:column;
}
.jp{font-family:'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif}
.serif{font-family:'Times New Roman',Georgia,serif}
.key{color:#E63946}

/* One translation row per reel, in that language's own script. */
.t-en,.t-vi{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif}
.t-bn{font-family:'Kohinoor Bangla','Bangla MN','Noto Sans Bengali',sans-serif}
.t-ne{font-family:'Kohinoor Devanagari','Devanagari Sangam MN','Noto Sans Devanagari',sans-serif}

.top{height:${LAYOUT.top}px;background:#070A0F;padding:52px 40px 0}
.pane{height:${LAYOUT.pane}px;background:transparent}
.bottom{
  height:${LAYOUT.bottom}px;background:#070A0F;
  padding:56px 56px 0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:26px;text-align:center;
}

.card{
  background:#C8E6C9;border-radius:30px;height:100%;
  display:flex;align-items:center;gap:28px;padding:26px 40px;
}
.brand{width:190px;flex:none;text-align:center;color:#1D3557}
.badge{
  width:78px;height:78px;margin:0 auto 12px;border-radius:18px;background:#fff;
  display:flex;align-items:center;justify-content:center;
  font-size:40px;font-weight:700;color:#E63946;
}
.brand p{font-size:21px;font-weight:700;line-height:1.3}
.stack{flex:1;text-align:center}
.stack .romaji{font-size:78px;line-height:1.05;color:#1D3557}
.stack .rule{height:1px;background:rgba(29,53,87,.32);margin:12px auto;width:78%}
.stack .meaning{font-size:35px;color:#374151}
.stack .kana{font-size:37px;color:#5B6B7A;margin-top:4px}
.stack .word{font-size:var(--word-size);font-weight:700;color:#E63946;line-height:1.15;margin-top:6px}

.line{font-size:var(--jp-size);font-weight:700;color:#F4F7FA;line-height:1.6;max-width:1000px}
.line rt{font-size:.34em;font-weight:500;color:#96A0AE;line-height:1}
.line .key rt{color:#E63946}
.ro{font-size:33px;color:#96A0AE;letter-spacing:.01em;max-width:960px}
.tr{font-size:var(--tr-size);font-weight:600;color:#F4F7FA;line-height:1.5;max-width:980px}

/* Intro card: the same card, given the whole frame. */
.solo{height:${FRAME.h}px;background:#C8E6C9;display:flex;align-items:center;padding:0 60px}
.solo .card{height:auto;padding:70px 56px;box-shadow:0 30px 70px rgba(15,23,41,.10)}
.solo .brand{width:250px}
.solo .badge{width:104px;height:104px;font-size:54px}
.solo .brand p{font-size:27px}
.solo .stack .romaji{font-size:112px}
.solo .stack .meaning{font-size:46px}
.solo .stack .kana{font-size:50px}
.solo .stack .word{font-size:calc(var(--word-size) * 1.5)}
`

function cardHtml(spec) {
  const word = String(spec.word || '')
  const size = word.length <= 2 ? 104 : word.length <= 4 ? 84 : 64
  return `<div class="card" style="--word-size:${size}px">
  <div class="brand">
    <div class="badge jp">文</div>
    <p>Learn Japanese<br>with anime</p>
  </div>
  <div class="stack">
    <div class="romaji serif">${esc(spec.romaji)}</div>
    <div class="rule"></div>
    <div class="meaning serif">${esc(spec.meaningEn)}</div>
    <div class="rule"></div>
    <div class="kana jp">${esc(spec.reading)}</div>
    <div class="word jp">${esc(word)}</div>
  </div>
</div>`
}

function page(body) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`
}

export function buildHtml(spec) {
  if (spec.mode === 'card') {
    return page(`<div class="solo">${cardHtml(spec)}</div>`)
  }
  const line = spec.line || {}
  const lang = LANGS.includes(spec.lang) ? spec.lang : 'en'
  const jp = String(line.japanese_furigana || '')
  // Long lines shrink rather than wrapping into a second ruby row.
  const plain = parseJP(jp).reduce((n, t) => n + t.s.length, 0)
  const jpSize = plain <= 16 ? 66 : plain <= 22 ? 58 : plain <= 28 ? 50 : 44
  // Bengali and Devanagari carry more vertical detail than Latin at the same
  // point size, and both wrap sooner, so they get their own scale.
  const translation = String(line.translation || '')
  const trBase = lang === 'bn' || lang === 'ne' ? 46 : 42
  const trSize = translation.length <= 46 ? trBase : translation.length <= 80 ? trBase - 6 : trBase - 11
  return page(`
<div class="top">${cardHtml(spec)}</div>
<div class="pane"></div>
<div class="bottom" style="--jp-size:${jpSize}px;--tr-size:${trSize}px">
  ${jp ? `<div class="line jp">${japaneseHtml(jp, spec.word)}</div>` : ''}
  ${line.romaji ? `<div class="ro">${romajiHtml(line.romaji, spec.romaji)}</div>` : ''}
  ${translation ? `<div class="tr t-${lang}">${esc(translation)}</div>` : ''}
</div>`)
}

/** Screenshot one frame. `mode: 'overlay'` keeps the video pane transparent. */
export async function renderFrame(spec, outPng, chrome) {
  const dir = await mkdtemp(path.join(tmpdir(), 'reel-frame-'))
  const html = path.join(dir, 'frame.html')
  await writeFile(html, buildHtml(spec), 'utf8')
  const args = [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-sandbox',
    // A dedicated profile: without it Chrome tries to talk to an already-running
    // instance and the screenshot never returns.
    `--user-data-dir=${path.join(dir, 'profile')}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--disable-sync', '--disable-default-apps',
    '--force-device-scale-factor=1',
    '--virtual-time-budget=4000',
    `--window-size=${FRAME.w},${FRAME.h}`,
    `--screenshot=${outPng}`,
  ]
  if (spec.mode === 'overlay') args.push('--default-background-color=00000000')
  args.push(`file://${html}`)

  try {
    await new Promise((resolve, reject) => {
      const proc = spawn(chrome, args, { stdio: 'ignore' })
      let settled = false
      const finish = (err) => {
        if (settled) return
        settled = true
        clearInterval(poll)
        try { proc.kill('SIGKILL') } catch { /* already gone */ }
        err ? reject(err) : resolve()
      }
      // Chrome writes the screenshot but does not always exit afterwards, so
      // wait for the file to appear and settle rather than for the process.
      let lastSize = -1
      let waited = 0
      const poll = setInterval(async () => {
        waited += 200
        try {
          const { size } = await stat(outPng)
          if (size > 0 && size === lastSize) return finish()
          lastSize = size
        } catch { /* not written yet */ }
        if (waited > 30000) finish(new Error('Chrome timed out rendering a frame'))
      }, 200)
      proc.on('error', finish)
      proc.on('close', code => {
        if (settled) return
        if (code !== 0 && lastSize <= 0) finish(new Error(`Chrome exited ${code}`))
      })
    })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
  return outPng
}
