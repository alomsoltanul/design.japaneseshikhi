/**
 * Client for the Clip Finder server routes, plus the mapping from a raw
 * Nadeshiko response to the shape the panel and the merge script use.
 *
 * `mapSegments` is deliberately separate from `searchClips` so the panel's
 * paste box — for a response body pasted straight from curl — goes through
 * exactly the same code path as a live request.
 */
import {
  furiganaLine, romajiLine, extractVocab, plainJapanese, stripInvisible,
  katakanaToHiragana, kanaToRomaji, formatVocab,
  type NadeshikoToken, type VocabCandidate,
} from './japanese'

export const TITLE_CARD_SEC = 2

/**
 * One reel per language, each carrying exactly one translation row. English is
 * never machine-translated — Nadeshiko ships human-written English subs.
 */
export const LANGS = ['en', 'bn', 'vi', 'ne'] as const
export type LangCode = typeof LANGS[number]
export const LANG_NAMES: Record<LangCode, string> = {
  en: 'English', bn: 'বাংলা', vi: 'Tiếng Việt', ne: 'नेपाली',
}
export const TRANSLATABLE: LangCode[] = ['bn', 'vi', 'ne']

export type ClipCategory = 'ANIME' | 'JDRAMA' | 'YOUTUBE'

export type SearchParams = {
  word: string
  exactMatch: boolean
  categories: ClipCategory[]
  minSec: number
  maxSec: number
  take: number
  seed?: number
}

export type Quota = {
  monthlyLimit: number | null
  monthlyUsed: number | null
  monthlyReset: string | null
  rateLimit: string | null
}

export type Clip = {
  id: string
  videoUrl: string
  imageUrl: string
  audioUrl: string
  durationSec: number
  tokens: NadeshikoToken[]
  jp: string
  furigana: string
  romaji: string
  english: string
  vocabCandidates: VocabCandidate[]
  source: string
  episode: number | null
  category: string
  /** editable in the panel; one entry per language, `en` from the source subs */
  keep: boolean
  translations: Record<string, string>
  vocabs: Record<string, string>
}

type RawSegment = {
  publicId?: string
  mediaPublicId?: string
  episode?: number | null
  startTimeMs?: number
  endTimeMs?: number
  urls?: { imageUrl?: string; audioUrl?: string; videoUrl?: string }
  textJa?: { content?: string; tokens?: NadeshikoToken[] }
  textEn?: { content?: string }
}

type RawMedia = { nameEn?: string; nameRomaji?: string; nameJa?: string; category?: string }

export type RawResponse = {
  segments?: RawSegment[]
  includes?: { media?: Record<string, RawMedia> }
  quota?: Quota
  error?: string
}

/** Map a raw Nadeshiko payload into panel clips. Used for live and pasted responses alike. */
export function mapSegments(raw: RawResponse, word: string): Clip[] {
  const media = raw.includes?.media || {}
  return (raw.segments || []).map((seg, i) => {
    const tokens = seg.textJa?.tokens || []
    const m = seg.mediaPublicId ? media[seg.mediaPublicId] : undefined
    const durationSec = Math.max(0, ((seg.endTimeMs ?? 0) - (seg.startTimeMs ?? 0)) / 1000)
    return {
      id: seg.publicId || `seg-${i}`,
      videoUrl: seg.urls?.videoUrl || '',
      imageUrl: seg.urls?.imageUrl || '',
      audioUrl: seg.urls?.audioUrl || '',
      durationSec,
      tokens,
      jp: plainJapanese(tokens) || stripInvisible(seg.textJa?.content || ''),
      furigana: furiganaLine(tokens),
      romaji: romajiLine(tokens),
      english: stripInvisible(seg.textEn?.content || ''),
      vocabCandidates: extractVocab(tokens, word),
      source: m?.nameEn || m?.nameRomaji || m?.nameJa || 'Unknown',
      episode: seg.episode ?? null,
      category: m?.category || '',
      keep: true,
      translations: { en: stripInvisible(seg.textEn?.content || '') },
      vocabs: {},
    }
  }).filter(c => c.videoUrl)
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let data: unknown = null
  try { data = text ? JSON.parse(text) : null } catch { /* fall through to raw text */ }
  if (!res.ok) {
    const msg = (data as { error?: string })?.error || text.slice(0, 300) || `Request failed (${res.status})`
    throw new Error(msg)
  }
  return data as T
}

export async function searchClips(params: SearchParams): Promise<{ clips: Clip[]; quota: Quota | null }> {
  const raw = await postJson<RawResponse>('/api/clips/search', params)
  return { clips: mapSegments(raw, params.word), quota: raw.quota ?? null }
}

/**
 * Keep the first clips that fit the target length, reject the rest.
 *
 * The API already returned them in RANDOM order for this search's seed, so
 * taking them in order gives a different reel every run without any shuffling
 * here. Eight or nine, not seven — seven only reaches 35s if every clip runs at
 * the top of the range.
 */
export function autoPick(clips: Clip[], opts: { minClips?: number; maxClips?: number; maxClipSecs?: number } = {}): Clip[] {
  const minClips = opts.minClips ?? 8
  const maxClips = opts.maxClips ?? 9
  const maxClipSecs = opts.maxClipSecs ?? 38

  const take = (cap: number) => {
    const chosen: string[] = []
    let total = 0
    for (const c of clips) {
      if (chosen.length >= maxClips) break
      if (total + c.durationSec > cap) continue
      chosen.push(c.id)
      total += c.durationSec
    }
    return chosen
  }

  // If the band is too tight to reach the minimum, let the reel run long rather
  // than shipping a five-clip reel.
  let chosen = take(maxClipSecs)
  if (chosen.length < minClips) chosen = take(maxClipSecs + 8)
  const keep = new Set(chosen)
  return clips.map(c => ({ ...c, keep: keep.has(c.id) }))
}

export type TranslateResult = {
  provider: 'free' | 'claude'
  meaningEn: string
  byLang: Record<string, { id: string; text: string; vocab: { word: string; meaning: string }[] }[]>
  warnings: string[]
}

/**
 * One request for the whole batch — never one per line.
 * `en` is dropped before the call: it already came from Nadeshiko.
 */
export async function translateBatch(opts: {
  provider: 'free' | 'claude'
  word: string
  langs: LangCode[]
  clips: Clip[]
}): Promise<TranslateResult> {
  const lines = opts.clips.map(c => ({
    id: c.id,
    jp: c.jp,
    english: c.translations.en || c.english,
    vocab: c.vocabCandidates.map(v => v.word),
  }))
  return postJson<TranslateResult>('/api/clips/translate', {
    provider: opts.provider,
    word: opts.word,
    langs: opts.langs.filter(l => l !== 'en'),
    lines,
  })
}

/** Fold a translate response back into the clips. */
export function applyTranslations(clips: Clip[], result: TranslateResult): Clip[] {
  const index = new Map<string, Record<string, { text: string; vocab: string }>>()
  for (const [lang, rows] of Object.entries(result.byLang || {})) {
    for (const r of rows) {
      const entry = index.get(r.id) || {}
      entry[lang] = { text: r.text || '', vocab: formatVocab(r.vocab || []) }
      index.set(r.id, entry)
    }
  }
  return clips.map(c => {
    const entry = index.get(c.id)
    if (!entry) return c
    const translations = { ...c.translations }
    const vocabs = { ...c.vocabs }
    for (const [lang, v] of Object.entries(entry)) {
      if (v.text) translations[lang] = v.text
      if (v.vocab) vocabs[lang] = v.vocab
    }
    return { ...c, translations, vocabs }
  })
}

export type RenderedReel = {
  lang: string
  name: string
  video: string
  subtitles: string
  downloadUrl: string
}

export type RenderResult = {
  reels: RenderedReel[]
  manifest: string
  log: string
}

/**
 * Hand the manifest to the local render route, which runs the ffmpeg pipeline
 * and writes the finished mp4 into reels/. Local only — see api/clips/render.ts.
 */
export async function renderReel(manifest: ReelManifest): Promise<RenderResult> {
  return postJson<RenderResult>('/api/clips/render', manifest)
}

// ── export ──────────────────────────────────────────────────────────────────

export type SubtitleLine = {
  id: number
  start: number
  end: number
  japanese_furigana: string
  romaji: string
  vocab: string
  bangla: string
}

export type SubtitleDoc = { level: string; lines: SubtitleLine[] }

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Cumulative timings across the merged video, offset by the title card.
 * Boundaries are rounded once and shared between adjacent lines, so every
 * `end` is byte-identical to the next `start` — no gaps, no overlaps.
 */
export function buildSubtitleDoc(clips: Clip[], level: string, lang: LangCode = 'en', cardSec = TITLE_CARD_SEC): SubtitleDoc {
  const kept = clips.filter(c => c.keep)
  const bounds: number[] = [round2(cardSec)]
  let acc = cardSec
  for (const c of kept) {
    acc += c.durationSec
    bounds.push(round2(acc))
  }
  return {
    level,
    lines: kept.map((c, i) => ({
      id: i + 1,
      start: bounds[i],
      end: bounds[i + 1],
      japanese_furigana: c.furigana,
      romaji: c.romaji,
      vocab: c.vocabs[lang] || '',
      // The Studio's importer reads `bangla`; for a Vietnamese reel this field
      // carries the Vietnamese line.
      bangla: c.translations[lang] || '',
    })),
  }
}

export type ReelManifest = {
  word: string
  reading: string
  romaji: string
  meaningEn: string
  level: string
  titleCardSec: number
  langs: LangCode[]
  clips: { id: string; videoUrl: string; durationSec: number; source: string; episode: number | null }[]
  /** One spec-shaped document per language; the renderer picks by `--lang`. */
  subtitlesByLang: Record<string, SubtitleDoc>
}

/** Everything scripts/merge-reel.mjs needs to build the video, in one file. */
export function buildManifest(opts: {
  word: string
  reading: string
  meaningEn: string
  level: string
  clips: Clip[]
  langs: LangCode[]
  cardSec?: number
}): ReelManifest {
  const cardSec = opts.cardSec ?? TITLE_CARD_SEC
  const kept = opts.clips.filter(c => c.keep)
  const langs = opts.langs.length ? opts.langs : (['en'] as LangCode[])
  return {
    word: opts.word,
    reading: opts.reading,
    romaji: kanaToRomaji(opts.reading),
    meaningEn: opts.meaningEn,
    level: opts.level,
    titleCardSec: cardSec,
    langs,
    clips: kept.map(c => ({
      id: c.id,
      videoUrl: c.videoUrl,
      durationSec: c.durationSec,
      source: c.source,
      episode: c.episode,
    })),
    subtitlesByLang: Object.fromEntries(
      langs.map(l => [l, buildSubtitleDoc(opts.clips, opts.level, l, cardSec)]),
    ),
  }
}

/** Kana reading of the searched word, taken from whichever token matches it. */
export function readingForWord(clips: Clip[], word: string): string {
  const target = stripInvisible(word).trim()
  if (!target) return ''
  for (const c of clips) {
    for (const tok of c.tokens) {
      if (stripInvisible(tok.s) === target || stripInvisible(tok.d || '') === target) {
        return katakanaToHiragana(stripInvisible(tok.r || ''))
      }
    }
  }
  return ''
}
