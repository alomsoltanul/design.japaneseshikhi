/**
 * Subtitle translation for the Clip Finder's per-language reels.
 *
 * English is never translated — Nadeshiko ships human-written English subs with
 * every segment, so the English reel uses the source text directly.
 *
 * Two providers:
 *   free    MyMemory. No key, no account. 5,000 chars/day anonymous (50,000 with
 *           an email in the `de` parameter, which we deliberately do not send).
 *           Measured on real anime lines it gets roughly 7 of 9 right and fails
 *           on slang — review the output before publishing.
 *   claude  One batched call, far better on colloquial lines, costs about two
 *           cents a reel on Haiku.
 */

export type LangCode = 'bn' | 'vi' | 'ne'

export const TRANSLATABLE: LangCode[] = ['bn', 'vi', 'ne']

export const LANG_NAMES: Record<string, string> = {
  en: 'English', bn: 'Bangla', vi: 'Vietnamese', ne: 'Nepali',
}

export type TranslateLine = { id: string; jp: string; english: string; vocab?: string[] }
export type TranslatedLine = { id: string; text: string; vocab: { word: string; meaning: string }[] }
export type TranslateResult = {
  provider: 'free' | 'claude'
  meaningEn: string
  byLang: Record<string, TranslatedLine[]>
  warnings: string[]
}

// ── free: MyMemory ──────────────────────────────────────────────────────────

const MYMEMORY = 'https://api.mymemory.translated.net/get'

async function myMemory(text: string, target: LangCode): Promise<string> {
  const url = `${MYMEMORY}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(`en|${target}`)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`)
  const data = await res.json() as {
    responseData?: { translatedText?: string }
    responseStatus?: number | string
    quotaFinished?: boolean
  }
  if (data.quotaFinished) throw new Error('MyMemory daily character quota is used up. Try again tomorrow, or switch the provider to Claude.')
  const out = data.responseData?.translatedText ?? ''
  // MyMemory signals problems in the payload rather than the status code.
  if (!out || /^(PLEASE SELECT|INVALID|NO QUERY|MYMEMORY WARNING)/i.test(out)) {
    throw new Error(`MyMemory rejected a segment: ${out.slice(0, 120)}`)
  }
  return out.trim()
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function translateFree(lines: TranslateLine[], langs: LangCode[]): Promise<TranslateResult> {
  const byLang: Record<string, TranslatedLine[]> = {}
  const warnings: string[] = []
  // Repeated English lines are common across a reel and every lookup spends
  // quota, so memoise per language.
  const cache = new Map<string, string>()

  const one = async (text: string, lang: LangCode) => {
    const key = `${lang}:${text}`
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    const out = await myMemory(text, lang)
    cache.set(key, out)
    await sleep(120)
    return out
  }

  for (const lang of langs) {
    const rows: TranslatedLine[] = []
    for (const l of lines) {
      let text = ''
      try {
        text = l.english ? await one(l.english, lang) : ''
      } catch (e) {
        warnings.push(`${LANG_NAMES[lang]}: ${(e as Error).message}`)
      }
      // Vocab entries are Japanese dictionary forms, which MyMemory's en|xx
      // pair cannot read, so vocab meanings come from the Claude provider only.
      rows.push({ id: l.id, text, vocab: [] })
    }
    byLang[lang] = rows
  }

  if (Object.values(byLang).every(rows => rows.every(r => !r.text))) {
    throw Object.assign(new Error('MyMemory returned nothing for any line.'), { status: 502 })
  }
  warnings.push('Free provider: sentence translations only, no vocab meanings. Machine output — read it before publishing.')
  return { provider: 'free', meaningEn: '', byLang, warnings }
}

// ── claude ──────────────────────────────────────────────────────────────────

const SYSTEM = (langs: LangCode[]) => `You translate Japanese subtitle lines for a Japanese-language teaching reel.

You are given each line's Japanese text and its English subtitle. Produce a translation into each of these languages: ${langs.map(l => LANG_NAMES[l]).join(', ')}.

Rules:
- "meaningEn" is a short English gloss of the reel's headword — two or three words, lowercase, no article. It goes on the title card.
- Each translation is ONE natural, idiomatic sentence in that language carrying the meaning of the Japanese line. Never a word-for-word gloss, never a transliteration, never romanised.
- "vocab" gives the MEANING of each supplied Japanese word in that language — never its Japanese reading, never romaji, never English.
- Keep the same "id" you were given, one object per input line, in the same order.
- Reply with a JSON object only. No preamble, no explanation, no markdown fences.

Shape: {"meaningEn":"dad, old man","langs":{"bn":[{"id":"...","text":"...","vocab":[{"word":"親父","meaning":"বাবা"}]}]}}`

async function translateClaude(word: string, lines: TranslateLine[], langs: LangCode[]): Promise<TranslateResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw Object.assign(new Error('ANTHROPIC_API_KEY is not set — switch the provider to Free, or add the key to .env.local.'), { status: 500 })
  }
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const payload = lines.map(l => ({
    id: l.id, japanese: l.jp, english: l.english || '', vocab: (l.vocab || []).slice(0, 4),
  }))

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4000,
    system: SYSTEM(langs),
    messages: [{
      role: 'user',
      content: `The reel teaches the word ${word || '(unspecified)'}.\n\n${JSON.stringify(payload, null, 2)}`,
    }],
  })

  // Filter by block type — never index content[0].
  const raw = msg.content
    .filter(b => b.type === 'text')
    .map(b => (b as { text: string }).text)
    .join('\n')
    .trim()

  return { ...parseClaudeReply(raw, lines, langs), provider: 'claude', warnings: [] }
}

/** Strip fences defensively even though the prompt forbids them, then parse. */
export function parseClaudeReply(raw: string, lines: TranslateLine[], langs: LangCode[]): { meaningEn: string; byLang: Record<string, TranslatedLine[]> } {
  let s = raw.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) s = fence[1].trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start >= 0 && end > start) s = s.slice(start, end + 1)

  const obj = JSON.parse(s) as Record<string, unknown>
  const langBlocks = (obj.langs && typeof obj.langs === 'object' ? obj.langs : {}) as Record<string, unknown>
  const meaningEn = typeof obj.meaningEn === 'string' ? obj.meaningEn.trim() : ''

  const byLang: Record<string, TranslatedLine[]> = {}
  for (const lang of langs) {
    const rows = Array.isArray(langBlocks[lang]) ? langBlocks[lang] as Record<string, unknown>[] : []
    const byId = new Map<string, Record<string, unknown>>()
    rows.forEach((r, i) => {
      const id = typeof r?.id === 'string' && r.id ? r.id : (lines[i]?.id ?? String(i))
      byId.set(id, r)
    })
    byLang[lang] = lines.map(l => {
      const r = byId.get(l.id)
      const vocab = Array.isArray(r?.vocab) ? r!.vocab as Record<string, unknown>[] : []
      return {
        id: l.id,
        text: typeof r?.text === 'string' ? r.text.trim() : '',
        vocab: vocab
          .map(v => ({ word: String(v?.word ?? '').trim(), meaning: String(v?.meaning ?? '').trim() }))
          .filter(v => v.word && v.meaning),
      }
    })
  }
  return { meaningEn, byLang }
}

// ── entry point ─────────────────────────────────────────────────────────────

export async function translateLines(opts: {
  provider?: 'free' | 'claude'
  word?: string
  langs?: string[]
  lines?: TranslateLine[]
}): Promise<TranslateResult> {
  const lines = opts.lines ?? []
  if (!lines.length) return { provider: opts.provider ?? 'free', meaningEn: '', byLang: {}, warnings: [] }

  // English needs no translator; drop it before anything else runs.
  const langs = (opts.langs ?? [])
    .map(l => String(l).toLowerCase())
    .filter((l): l is LangCode => (TRANSLATABLE as string[]).includes(l))
  if (!langs.length) return { provider: opts.provider ?? 'free', meaningEn: '', byLang: {}, warnings: [] }

  return opts.provider === 'claude'
    ? translateClaude(opts.word ?? '', lines, langs)
    : translateFree(lines, langs)
}
