#!/usr/bin/env node
/**
 * Build the merged 9:16 reel from a Clip Finder manifest.
 *
 *   npm run reel -- reels/<word>-manifest.json [--lang en,bn,vi,ne] [--out <dir>]
 *
 * One reel per language, each carrying exactly one translation row — an English
 * reel has no Bangla on it, a Bangla reel has no English. Clips are downloaded
 * and probed once and shared across every language; only the overlay frames and
 * the final encode differ, so four languages cost far less than four runs.
 *
 * Each clip becomes a full 1080x1920 frame: the mint keyword card at the top,
 * the clip itself playing in the pane below it, and that line's subtitle —
 * English, Japanese with furigana, romaji, Bangla — burned in underneath, with
 * the searched word picked out in red. The header and subtitle come from
 * scripts/reel-frame.mjs as a PNG with a transparent pane, so ffmpeg composites
 * video and text in one pass.
 *
 * Every clip is re-encoded to identical specs BEFORE concatenation — 1080x1920,
 * 30 fps, setsar=1, AAC 48 kHz stereo, loudnorm I=-16:TP=-1.5:LRA=11. This is
 * not optional: mismatched frame rate or sample rate is the single most common
 * cause of audio drifting out of sync partway through a compilation. Because
 * every part then shares a format, the concat itself is a stream copy.
 *
 * Subtitle timings are rewritten from the durations ffprobe reports on the
 * finished parts, not from the API's segment lengths, so `start`/`end` match the
 * merged video exactly rather than approximately.
 */
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import path from 'node:path'
import { findChrome, renderFrame, FRAME, LAYOUT, PANE_Y, LANGS, LANG_NAMES } from './reel-frame.mjs'

const CARD_BG = '0xC8E6C9'
const FRAME_BG = '0x070A0F'

function run(cmd, args, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' })
    let out = '', err = ''
    if (capture) {
      p.stdout.on('data', d => { out += d })
      p.stderr.on('data', d => { err += d })
    }
    p.on('error', reject)
    p.on('close', code => code === 0
      ? resolve(out.trim())
      : reject(new Error(`${cmd} exited ${code}${err ? `\n${err.slice(-1500)}` : ''}`)))
  })
}

const ffmpeg = (args) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args])

async function probeDuration(file) {
  const out = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ], { capture: true })
  const n = Number(out)
  if (!Number.isFinite(n)) throw new Error(`Could not read duration of ${file}`)
  return n
}

async function hasAudio(file) {
  const out = await run('ffprobe', [
    '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index',
    '-of', 'csv=p=0', file,
  ], { capture: true })
  return out.length > 0
}

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
}

/**
 * Frames come from headless Chrome. Pillow is the fallback, but it has no
 * HarfBuzz on this machine, so Bengali clusters break — hence the warning.
 */
function makeFrameRenderer() {
  const chrome = findChrome()
  if (chrome) return { how: 'chrome', render: (spec, out) => renderFrame(spec, out, chrome) }
  console.warn('  ! Chrome not found — falling back to Pillow for the frames.')
  console.warn('    Pillow here reports raqm:False, so Bangla will not shape correctly.')
  return {
    how: 'pillow',
    render: (spec, out) => run('python3', [
      path.join(import.meta.dirname, 'reel-frame.py'),
      JSON.stringify({ ...spec, out }),
    ], { capture: true }),
  }
}

/** Shared encoder settings — every part must match for the concat to stream-copy. */
const ENCODE = [
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '192k',
  '-video_track_timescale', '30000', '-movflags', '+faststart',
]

/**
 * Nadeshiko's `videoUrl` is not motion footage — measured across ANIME, JDRAMA
 * and YOUTUBE, every clip is the segment's screenshot muxed with its audio
 * (0.00% inter-frame change, ~160 kbps for 720p). The build spec's claim that
 * videoUrl is "the motion clip" is wrong.
 *
 * So the pane gets a slow zoom instead of sitting on a dead frame. Direction
 * alternates per clip so a run of them doesn't read as one long push-in.
 * `--motion none` turns it off.
 */
function paneFilter(motion, index) {
  const base = `scale=${FRAME.w * 2}:${LAYOUT.pane * 2}:force_original_aspect_ratio=increase,`
    + `crop=${FRAME.w * 2}:${LAYOUT.pane * 2},fps=30`
  if (motion !== 'kenburns') {
    return `[1:v]scale=${FRAME.w}:${LAYOUT.pane}:force_original_aspect_ratio=increase,`
      + `crop=${FRAME.w}:${LAYOUT.pane},fps=30,setsar=1[pane]`
  }
  const z = index % 2 === 0
    ? `min(1+0.0012*in,1.16)`
    : `max(1.16-0.0012*in,1.0)`
  return `[1:v]${base},`
    + `zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:`
    + `s=${FRAME.w}x${LAYOUT.pane}:fps=30,setsar=1[pane]`
}

/** Clip scaled into the pane, overlay PNG on top, silence filled in if needed. */
function compositeArgs(clip, overlayPng, out, { silent, motion, index }) {
  const args = [
    '-f', 'lavfi', '-i', `color=c=${FRAME_BG}:s=${FRAME.w}x${FRAME.h}:r=30`,
    '-i', clip,
    '-i', overlayPng,
  ]
  if (silent) args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000')

  const filter = [
    paneFilter(motion, index),
    `[0:v][pane]overlay=0:${PANE_Y}[bg]`,
    `[bg][2:v]overlay=0:0,format=yuv420p[vo]`,
  ].join(';')

  args.push(
    '-filter_complex', filter,
    '-map', '[vo]',
    '-map', silent ? '3:a' : '1:a',
    '-af', silent ? 'anull' : 'loudnorm=I=-16:TP=-1.5:LRA=11',
    ...ENCODE, '-shortest', out,
  )
  return args
}

async function main() {
  const argv = process.argv.slice(2)
  const positional = []
  let outArg = 'reels'
  let keepTemp = false
  let motion = 'kenburns'
  let langArg = ''
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') outArg = argv[++i] ?? outArg
    else if (argv[i] === '--motion') motion = argv[++i] ?? motion
    else if (argv[i] === '--lang') langArg = argv[++i] ?? ''
    else if (argv[i] === '--keep-temp') keepTemp = true
    else positional.push(argv[i])
  }
  const manifestPath = positional[0]
  if (!manifestPath) {
    console.error('Usage: npm run reel -- <manifest.json> [--lang en,bn,vi,ne] [--out <dir>] [--motion kenburns|none] [--keep-temp]')
    process.exit(1)
  }
  if (!['kenburns', 'none'].includes(motion)) {
    console.error(`--motion must be kenburns or none, got "${motion}"`)
    process.exit(1)
  }
  const outDir = path.resolve(outArg)

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const clips = manifest.clips || []
  if (!clips.length) throw new Error('Manifest has no clips.')

  const byLang = manifest.subtitlesByLang || {}
  const requested = (langArg ? langArg.split(',') : (manifest.langs || Object.keys(byLang) || ['en']))
    .map(l => l.trim().toLowerCase())
    .filter(Boolean)
  const langs = requested.filter(l => LANGS.includes(l))
  const unknown = requested.filter(l => !LANGS.includes(l))
  if (unknown.length) console.warn(`  ! ignoring unknown language(s): ${unknown.join(', ')}`)
  if (!langs.length) throw new Error(`No renderable language. Pick from: ${LANGS.join(', ')}`)

  const slug = (manifest.word || 'reel').replace(/[^\p{L}\p{N}_-]/gu, '') || 'reel'
  const work = path.join(outDir, `${slug}-work`)
  await mkdir(work, { recursive: true })

  const frames = makeFrameRenderer()
  const header = {
    word: manifest.word || '',
    reading: manifest.reading || '',
    romaji: manifest.romaji || '',
    meaningEn: manifest.meaningEn || '',
  }

  console.log(`\n${manifest.word || 'reel'} — ${clips.length} clips · ${langs.length} language${langs.length === 1 ? '' : 's'} (${langs.map(l => LANG_NAMES[l]).join(', ')}) · frames via ${frames.how} · pane motion: ${motion}`)

  // ── intro card: identical for every language, so render and encode once ───
  const cardSec = manifest.titleCardSec ?? 2
  const cardPng = path.join(work, 'card.png')
  const cardMp4 = path.join(work, 'card.mp4')
  let drew = true
  try {
    await frames.render({ ...header, mode: 'card' }, cardPng)
  } catch (e) {
    drew = false
    console.warn(`  ! title card text skipped (${e.message.split('\n')[0]})`)
  }
  await ffmpeg([
    ...(drew ? ['-loop', '1', '-t', String(cardSec), '-i', cardPng]
             : ['-f', 'lavfi', '-t', String(cardSec), '-i', `color=c=${CARD_BG}:s=${FRAME.w}x${FRAME.h}:r=30`]),
    '-f', 'lavfi', '-t', String(cardSec), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-vf', `scale=${FRAME.w}:${FRAME.h},fps=30,setsar=1,format=yuv420p`,
    ...ENCODE, '-shortest', cardMp4,
  ])
  const cardActual = await probeDuration(cardMp4)
  console.log(`  card    ${cardActual.toFixed(2)}s`)

  // ── clips: downloaded and probed once, reused by every language ───────────
  const sources = []
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]
    const raw = path.join(work, `raw-${String(i + 1).padStart(3, '0')}.mp4`)
    process.stdout.write(`  fetch ${String(i + 1).padStart(2)}/${clips.length}  ${clip.source || ''}${clip.episode ? ` ep ${clip.episode}` : ''} … `)
    await download(clip.videoUrl, raw)
    const silent = !(await hasAudio(raw))
    sources.push({ raw, silent })
    console.log(`ok${silent ? ' (silent source)' : ''}`)
  }

  // ── one reel per language ────────────────────────────────────────────────
  const round2 = n => Math.round(n * 100) / 100
  const results = []

  for (const lang of langs) {
    const srcLines = byLang[lang]?.lines || []
    const langDir = path.join(work, lang)
    await mkdir(langDir, { recursive: true })
    process.stdout.write(`  ${LANG_NAMES[lang]} … `)

    const parts = [cardMp4]
    const durations = []
    for (let i = 0; i < clips.length; i++) {
      const n = String(i + 1).padStart(3, '0')
      const png = path.join(langDir, `frame-${n}.png`)
      const part = path.join(langDir, `part-${n}.mp4`)
      const src = srcLines[i] || {}
      await frames.render({
        ...header,
        mode: 'overlay',
        lang,
        // `bangla` is the field name the Subtitle Studio's importer reads; for a
        // Vietnamese reel it holds the Vietnamese line.
        line: { ...src, translation: src.bangla || '' },
      }, png)
      await ffmpeg(compositeArgs(sources[i].raw, png, part, { silent: sources[i].silent, motion, index: i }))
      durations.push(await probeDuration(part))
      parts.push(part)
    }

    const listFile = path.join(langDir, 'concat.txt')
    await writeFile(listFile, parts.map(p => `file '${path.resolve(p).replace(/'/g, "'\\''")}'`).join('\n') + '\n')

    const videoOut = path.join(outDir, `${slug}-reel-${lang}.mp4`)
    await ffmpeg(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-movflags', '+faststart', videoOut])
    const mergedDur = await probeDuration(videoOut)

    // Retimed against the durations ffprobe reports on the finished parts.
    const bounds = [round2(cardActual)]
    let acc = cardActual
    for (const d of durations) { acc += d; bounds.push(round2(acc)) }
    const lines = durations.map((_, i) => {
      const src = srcLines[i] || {}
      return {
        id: i + 1,
        start: bounds[i],
        end: bounds[i + 1],
        japanese_furigana: src.japanese_furigana || '',
        romaji: src.romaji || '',
        vocab: src.vocab || '',
        bangla: src.bangla || '',
      }
    })
    const subsOut = path.join(outDir, `${slug}-subtitles-${lang}.json`)
    await writeFile(subsOut, JSON.stringify({ level: manifest.level || 'N5', lines }, null, 2) + '\n')

    const lastEnd = lines.length ? lines[lines.length - 1].end : bounds[0]
    results.push({
      lang,
      name: LANG_NAMES[lang],
      video: videoOut,
      subtitles: subsOut,
      durationSec: mergedDur,
      drift: Math.abs(mergedDur - lastEnd),
      gaps: lines.slice(1).filter((l, i) => l.start !== lines[i].end).length,
      blanks: lines.filter(l => !String(l.bangla).trim()).length,
    })
    console.log(`${mergedDur.toFixed(2)}s`)
  }

  if (!keepTemp) await rm(work, { recursive: true, force: true })

  // ── report ────────────────────────────────────────────────────────────────
  console.log('')
  for (const r of results) {
    console.log(`  ${r.name.padEnd(11)} ${r.video}`)
    console.log(`  ${''.padEnd(11)} ${r.subtitles}`)
    console.log(`  ${''.padEnd(11)} ${r.durationSec.toFixed(2)}s · gaps ${r.gaps} · drift ${r.drift.toFixed(3)}s ${r.drift <= 0.1 ? 'OK' : 'OVER 0.1s'}${r.blanks ? ` · WARNING ${r.blanks} empty line(s)` : ''}`)
  }
  const first = results[0]
  if (first && (first.durationSec < 30 || first.durationSec > 40)) {
    console.log(`  note: ${first.durationSec.toFixed(1)}s is outside the 30-40s target band.`)
  }
  console.log('')

  if (results.some(r => r.drift > 0.1 || r.gaps > 0)) process.exitCode = 1
}

main().catch(e => { console.error(`\n${e.message}\n`); process.exit(1) })
