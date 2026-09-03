/**
 * Nadeshiko search + Bangla translation, kept free of @vercel/node types so the
 * same functions back both the deployed serverless routes and the Vite dev
 * middleware. Neither API key is ever sent to the browser.
 *
 * Verified against api.nadeshiko.co on 2026-09-02: the live rate limit header
 * reads `ratelimit-policy: 300;w=60`, not the 150/min the build spec quoted.
 * Monthly quota is 5,000 and one search is one request no matter how many
 * segments come back, so there is deliberately no caching layer here.
 */

const NADESHIKO_BASE = 'https://api.nadeshiko.co/v1'

export type NadeshikoCategory = 'ANIME' | 'JDRAMA' | 'YOUTUBE'

export type SearchInput = {
  word: string
  exactMatch?: boolean
  categories?: NadeshikoCategory[]
  minSec?: number
  maxSec?: number
  take?: number
  seed?: number
  minChars?: number
  maxChars?: number
}

export type Quota = {
  monthlyLimit: number | null
  monthlyUsed: number | null
  monthlyReset: string | null
  rateLimit: string | null
}

const CATEGORIES: NadeshikoCategory[] = ['ANIME', 'JDRAMA', 'YOUTUBE']

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function buildSearchBody(input: SearchInput) {
  const categories = (input.categories || ['ANIME'])
    .map(c => String(c).toUpperCase() as NadeshikoCategory)
    .filter(c => CATEGORIES.includes(c))

  const minSec = Number.isFinite(input.minSec) ? (input.minSec as number) : 1.8
  const maxSec = Number.isFinite(input.maxSec) ? (input.maxSec as number) : 5

  return {
    query: { search: input.word, exactMatch: input.exactMatch !== false },
    // `take` caps at 50 server-side; clamp so a bad client value is a smaller
    // result set rather than a 400.
    take: clamp(Math.round(input.take ?? 20), 1, 50),
    sort: { mode: 'RANDOM', seed: Math.round(input.seed ?? Date.now() % 100000) },
    filters: {
      category: categories.length ? categories : ['ANIME'],
      contentRating: ['SAFE'],
      status: ['ACTIVE'],
      // Duration is filtered server-side. Never re-filter this client-side —
      // that would download clips only to throw them away.
      segmentDurationMs: {
        min: Math.round(clamp(minSec, 0.5, 30) * 1000),
        max: Math.round(clamp(maxSec, 0.5, 30) * 1000),
      },
      segmentLengthChars: {
        min: Math.round(input.minChars ?? 6),
        max: Math.round(input.maxChars ?? 40),
      },
    },
    include: ['media'],
  }
}

function readQuota(res: Response): Quota {
  const num = (h: string) => {
    const v = res.headers.get(h)
    const n = v == null ? NaN : Number(v)
    return Number.isFinite(n) ? n : null
  }
  return {
    monthlyLimit: num('x-monthly-quota-limit'),
    monthlyUsed: num('x-monthly-quota-used'),
    monthlyReset: res.headers.get('x-monthly-quota-reset'),
    rateLimit: res.headers.get('ratelimit'),
  }
}

export async function nadeshikoSearch(input: SearchInput) {
  const key = process.env.NADESHIKO_API_KEY
  if (!key) throw Object.assign(new Error('NADESHIKO_API_KEY is not set'), { status: 500 })
  if (!input.word || !String(input.word).trim()) {
    throw Object.assign(new Error('A search word is required.'), { status: 400 })
  }

  const res = await fetch(`${NADESHIKO_BASE}/search`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildSearchBody(input)),
  })

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 500)
    throw Object.assign(new Error(`Nadeshiko search failed (${res.status}): ${detail}`), {
      status: res.status === 429 ? 429 : 502,
    })
  }

  const data = await res.json() as { segments?: unknown[]; includes?: unknown; pagination?: unknown }
  return {
    segments: data.segments ?? [],
    includes: data.includes ?? {},
    pagination: data.pagination ?? null,
    quota: readQuota(res),
  }
}

// ── Bangla ──────────────────────────────────────────────────────────────────

export type BanglaLineInput = { id: string; jp: string; english?: string; vocab?: string[] }
export type BanglaLineOutput = { id: string; bangla: string; vocab: { word: string; meaning: string }[] }
export type BanglaBatch = { meaningEn: string; results: BanglaLineOutput[] }

const BANGLA_SYSTEM = `You translate Japanese subtitle lines into Bangla for a Japanese-language teaching reel.

Rules:
- "meaningEn" is a short English gloss of the reel's headword — two or three words, lowercase, no article. It goes on the title card.
- "bangla" is ONE natural, idiomatic Bangla sentence carrying the meaning of the Japanese line. Never a word-for-word gloss, never a transliteration.
- "vocab" gives the Bangla MEANING of each supplied word — never its Japanese reading, never romaji, never English.
- Keep the same "id" you were given, and return one object per input line in the same order.
- Reply with a JSON object only. No preamble, no explanation, no markdown fences.

Shape: {"meaningEn":"dad, old man","lines":[{"id":"...","bangla":"...","vocab":[{"word":"親父","meaning":"বাবা"}]}]}`

/**
 * One Anthropic call for the whole batch — never one per line.
 * Callers treat a throw as "leave the fields blank and let the user type them";
 * translation failure must never block an export.
 */
export async function writeBangla(word: string, lines: BanglaLineInput[]): Promise<BanglaBatch> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw Object.assign(new Error('ANTHROPIC_API_KEY is not set'), { status: 500 })
  }
  if (!Array.isArray(lines) || lines.length === 0) return { meaningEn: '', results: [] }

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const payload = lines.map(l => ({
    id: l.id,
    japanese: l.jp,
    english: l.english || '',
    vocab: (l.vocab || []).slice(0, 4),
  }))

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: BANGLA_SYSTEM,
    messages: [{
      role: 'user',
      content: `The reel teaches the word ${word || '(unspecified)'}.\n\n${JSON.stringify(payload, null, 2)}`,
    }],
  })

  // Filter by block type — never index content[0], which may be a thinking or
  // tool block rather than text.
  const raw = msg.content
    .filter(b => b.type === 'text')
    .map(b => (b as { text: string }).text)
    .join('\n')
    .trim()

  return parseBanglaReply(raw, lines)
}

/** Strip fences defensively even though the prompt forbids them, then parse. */
export function parseBanglaReply(raw: string, lines: BanglaLineInput[]): BanglaBatch {
  let s = raw.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) s = fence[1].trim()
  const start = s.search(/[[{]/)
  const end = Math.max(s.lastIndexOf(']'), s.lastIndexOf('}'))
  if (start >= 0 && end > start) s = s.slice(start, end + 1)

  const parsed = JSON.parse(s) as unknown
  // Accept a bare array too, in case the model drops the wrapper object.
  const obj = (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
    ? parsed as Record<string, unknown>
    : { lines: parsed }
  const rows = Array.isArray(obj.lines) ? obj.lines : []
  if (!rows.length) throw new Error('Model returned no lines.')
  const meaningEn = typeof obj.meaningEn === 'string' ? obj.meaningEn.trim() : ''

  const byId = new Map<string, Record<string, unknown>>()
  rows.forEach((row, i) => {
    if (!row || typeof row !== 'object') return
    const r = row as Record<string, unknown>
    const id = typeof r.id === 'string' && r.id ? r.id : (lines[i]?.id ?? String(i))
    byId.set(id, r)
  })

  return {
    meaningEn,
    results: lines.map(l => {
      const r = byId.get(l.id)
      const vocab = Array.isArray(r?.vocab) ? r!.vocab as Record<string, unknown>[] : []
      return {
        id: l.id,
        bangla: typeof r?.bangla === 'string' ? r.bangla.trim() : '',
        vocab: vocab
          .map(v => ({ word: String(v?.word ?? '').trim(), meaning: String(v?.meaning ?? '').trim() }))
          .filter(v => v.word && v.meaning),
      }
    }),
  }
}
