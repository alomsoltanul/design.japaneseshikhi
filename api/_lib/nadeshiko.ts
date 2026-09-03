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
