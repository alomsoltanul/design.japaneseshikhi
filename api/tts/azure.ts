import type { VercelRequest, VercelResponse } from '@vercel/node'
// NB: .js suffix required — package "type": "module" + Vercel Node runtime
// resolves ESM specifiers strictly. Existing routes miss this suffix and
// crash with ERR_MODULE_NOT_FOUND (pre-existing bug outside this change).
import { guard, bad } from '../_lib/http.js'

const MAX_TEXT_CHARS = 3000
const MAX_SSML_CHARS = 8000
const DEFAULT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'

const escXml = (s: string) =>
  s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

function buildSsml(opts: {
  text: string
  voice: string
  rate?: string
  pitch?: string
  styleDegree?: number
  style?: string
}): string {
  const rate = opts.rate ?? '+0%'
  const pitch = opts.pitch ?? '+0%'
  const body = escXml(opts.text)
  const inner = opts.style
    ? `<mstts:express-as style="${escXml(opts.style)}" styledegree="${opts.styleDegree ?? 1}">${body}</mstts:express-as>`
    : body
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="ja-JP"><voice name="${opts.voice}"><prosody rate="${rate}" pitch="${pitch}">${inner}</prosody></voice></speak>`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, ['POST'])) return

  const key = process.env.AZURE_SPEECH_KEY
  const region = process.env.AZURE_SPEECH_REGION || 'eastus'
  if (!key) return bad(res, 'AZURE_SPEECH_KEY not configured', 500)

  const body = (typeof req.body === 'string' ? safeParse(req.body) : req.body) ?? {}
  const rawSsml = typeof body.ssml === 'string' ? body.ssml.trim() : ''
  const text = typeof body.text === 'string' ? body.text : ''
  const voice = typeof body.voice === 'string' ? body.voice : 'ja-JP-NanamiNeural'
  const format = typeof body.format === 'string' ? body.format : DEFAULT_FORMAT

  let ssml: string
  if (rawSsml) {
    if (rawSsml.length > MAX_SSML_CHARS) return bad(res, `ssml exceeds ${MAX_SSML_CHARS} chars`)
    ssml = rawSsml
  } else {
    if (!text.trim()) return bad(res, 'text or ssml required')
    if (text.length > MAX_TEXT_CHARS) return bad(res, `text exceeds ${MAX_TEXT_CHARS} chars`)
    ssml = buildSsml({
      text,
      voice,
      rate: typeof body.rate === 'string' ? body.rate : undefined,
      pitch: typeof body.pitch === 'string' ? body.pitch : undefined,
      style: typeof body.style === 'string' ? body.style : undefined,
      styleDegree: typeof body.styleDegree === 'number' ? body.styleDegree : undefined,
    })
  }

  const upstream = await fetch(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': format,
        'User-Agent': 'japaneseshikhi-design',
      },
      body: ssml,
    },
  )

  if (!upstream.ok) {
    const detail = (await upstream.text()).slice(0, 400)
    return bad(res, `azure ${upstream.status}: ${detail}`, 502)
  }

  const audio = Buffer.from(await upstream.arrayBuffer())
  res.setHeader('Content-Type', format.includes('mp3') ? 'audio/mpeg' : 'application/octet-stream')
  res.setHeader('Cache-Control', 'private, max-age=0, no-store')
  res.status(200).send(audio)
}

function safeParse(s: string): Record<string, unknown> | null {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
