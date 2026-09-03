/**
 * Japanese text processing for Clip Finder.
 *
 * Everything here derives from Nadeshiko's per-token morphology. No MeCab,
 * SudachiPy or kuromoji — the API already did the tokenising.
 *
 * Verified against api.nadeshiko.co/v1/search on 2026-09-02. Two things the
 * build spec got wrong, both confirmed against live responses:
 *
 *   1. `pt` is abbreviated, not spelled out. The real vocabulary is
 *      noun/verb/adj/adv/prt/aux/pron/exp/conj/pref/suf/det/intj — there is no
 *      "particle", "auxiliary" or "punctuation". Symbol tokens carry no `pt`
 *      field at all, only `kind: "symbol"`.
 *   2. Copula (です/だ) is `pt: "aux"` like every other auxiliary, so the
 *      "copula stands alone" rule cannot be expressed on `pt`. It is only
 *      separable via `posLabel: "Copula"`.
 *
 * Tokens also carry a precomputed `f` furigana array that the spec did not
 * mention. Across 921 sampled tokens every kanji-bearing token had one, so it
 * is the primary source; the suffix/prefix-stripping algorithm survives as a
 * fallback for tokens that arrive without it.
 */

export type FuriganaSegment = { t: string; r?: string }

export type NadeshikoToken = {
  s: string
  d?: string
  r?: string
  b?: number
  e?: number
  p?: string
  posLabel?: string
  pt?: string
  kind?: string
  f?: FuriganaSegment[]
}

/** Coarse part of speech, normalised away from Nadeshiko's abbreviations. */
export type Pos =
  | 'noun' | 'verb' | 'adj' | 'adv' | 'particle' | 'aux' | 'copula'
  | 'pronoun' | 'prefix' | 'suffix' | 'conjunction' | 'interjection'
  | 'expression' | 'determiner' | 'symbol' | 'other'

const PT_MAP: Record<string, Pos> = {
  noun: 'noun', verb: 'verb', adj: 'adj', adv: 'adv',
  prt: 'particle', aux: 'aux', pron: 'pronoun', pref: 'prefix',
  suf: 'suffix', conj: 'conjunction', intj: 'interjection',
  exp: 'expression', det: 'determiner',
}

/** Invisible marks Nadeshiko leaves in subtitle text (LTR/RTL marks, BOM, ZWSP). */
const INVISIBLE = /[​-‏‪-‮⁠﻿]/g

export function stripInvisible(s: string): string {
  return (s || '').replace(INVISIBLE, '')
}

/**
 * Normalise a token's part of speech.
 * `.toLowerCase()` is applied regardless, per the spec's instruction, but the
 * mapping is what actually does the work — the raw values are abbreviations.
 */
export function posOf(tok: NadeshikoToken): Pos {
  if (tok.kind === 'symbol') return 'symbol'
  const label = (tok.posLabel || '').toLowerCase()
  if (label === 'copula') return 'copula'
  if (label === 'symbol') return 'symbol'
  const pt = (tok.pt || '').toLowerCase()
  return PT_MAP[pt] || 'other'
}

/** A token that contributes nothing to furigana, romaji or vocab. */
export function isSkippable(tok: NadeshikoToken): boolean {
  if (posOf(tok) === 'symbol') return true
  return stripInvisible(tok.s).trim().length === 0
}

// ── kana ────────────────────────────────────────────────────────────────────

const isKanjiChar = (c: string) => /[㐀-䶿一-鿿豈-﫿々〆〇]/.test(c)

export const hasKanji = (s: string) => Array.from(s || '').some(isKanjiChar)

/** ァ..ヶ shift down one block into hiragana. ー, ・ and everything else pass through. */
export function katakanaToHiragana(s: string): string {
  return Array.from(s || '').map(ch => {
    const code = ch.codePointAt(0) as number
    return code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : ch
  }).join('')
}

export function hiraganaToKatakana(s: string): string {
  return Array.from(s || '').map(ch => {
    const code = ch.codePointAt(0) as number
    return code >= 0x3041 && code <= 0x3096 ? String.fromCodePoint(code + 0x60) : ch
  }).join('')
}

// ── furigana ────────────────────────────────────────────────────────────────

/**
 * Fallback annotation for tokens without an `f` array: strip the kana the
 * surface and the reading share on both ends, then wrap the kanji core.
 *
 *   食べ + タベ   → 食(た)べ
 *   親父 + オヤジ → 親父(おやじ)
 *   お茶 + オチャ → お茶(ちゃ)
 *   分かる + ワカル → 分(わ)かる
 */
export function furiganaByStripping(surface: string, reading: string): string {
  const s = stripInvisible(surface)
  const r = katakanaToHiragana(stripInvisible(reading))
  if (!s || !r || !hasKanji(s) || s === r) return s

  const sc = Array.from(s)
  const rc = Array.from(r)

  // longest shared non-kanji suffix
  let suf = 0
  while (
    suf < sc.length - 1 && suf < rc.length - 1 &&
    sc[sc.length - 1 - suf] === rc[rc.length - 1 - suf] &&
    !isKanjiChar(sc[sc.length - 1 - suf])
  ) suf++

  // longest shared non-kanji prefix
  let pre = 0
  while (
    pre < sc.length - suf - 1 && pre < rc.length - suf - 1 &&
    sc[pre] === rc[pre] && !isKanjiChar(sc[pre])
  ) pre++

  const prefix = sc.slice(0, pre).join('')
  const core = sc.slice(pre, sc.length - suf).join('')
  const suffix = suf ? sc.slice(sc.length - suf).join('') : ''
  const coreReading = rc.slice(pre, rc.length - suf).join('')

  if (!core || !coreReading || !hasKanji(core)) return s
  return `${prefix}${core}(${coreReading})${suffix}`
}

/** Inline `漢字(かんじ)` markup for one token. */
export function furiganaForToken(tok: NadeshikoToken): string {
  const surface = stripInvisible(tok.s)
  if (!surface) return ''
  if (Array.isArray(tok.f) && tok.f.length) {
    return tok.f.map(seg => {
      const t = stripInvisible(seg.t)
      if (!seg.r) return t
      const reading = katakanaToHiragana(stripInvisible(seg.r))
      return reading && reading !== t ? `${t}(${reading})` : t
    }).join('')
  }
  return furiganaByStripping(surface, tok.r || '')
}

/** Inline-ruby line for the Subtitle Studio's `jp` field. */
export function furiganaLine(tokens: NadeshikoToken[]): string {
  return (tokens || [])
    .map(tok => {
      const surface = stripInvisible(tok.s)
      if (!surface) return ''
      if (posOf(tok) === 'symbol') return surface
      return furiganaForToken(tok)
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── romaji ──────────────────────────────────────────────────────────────────

const ROMAJI_DIGRAPHS: Record<string, string> = {
  キャ: 'kya', キュ: 'kyu', キョ: 'kyo', シャ: 'sha', シュ: 'shu', ショ: 'sho',
  チャ: 'cha', チュ: 'chu', チョ: 'cho', ニャ: 'nya', ニュ: 'nyu', ニョ: 'nyo',
  ヒャ: 'hya', ヒュ: 'hyu', ヒョ: 'hyo', ミャ: 'mya', ミュ: 'myu', ミョ: 'myo',
  リャ: 'rya', リュ: 'ryu', リョ: 'ryo', ギャ: 'gya', ギュ: 'gyu', ギョ: 'gyo',
  ジャ: 'ja', ジュ: 'ju', ジョ: 'jo', ヂャ: 'ja', ヂュ: 'ju', ヂョ: 'jo',
  ビャ: 'bya', ビュ: 'byu', ビョ: 'byo', ピャ: 'pya', ピュ: 'pyu', ピョ: 'pyo',
  ファ: 'fa', フィ: 'fi', フェ: 'fe', フォ: 'fo', ヴァ: 'va', ヴィ: 'vi',
  ヴェ: 've', ヴォ: 'vo', ウィ: 'wi', ウェ: 'we', ウォ: 'wo', ティ: 'ti',
  ディ: 'di', トゥ: 'tu', ドゥ: 'du', シェ: 'she', ジェ: 'je', チェ: 'che',
}

const ROMAJI_SINGLES: Record<string, string> = {
  ア: 'a', イ: 'i', ウ: 'u', エ: 'e', オ: 'o',
  カ: 'ka', キ: 'ki', ク: 'ku', ケ: 'ke', コ: 'ko',
  サ: 'sa', シ: 'shi', ス: 'su', セ: 'se', ソ: 'so',
  タ: 'ta', チ: 'chi', ツ: 'tsu', テ: 'te', ト: 'to',
  ナ: 'na', ニ: 'ni', ヌ: 'nu', ネ: 'ne', ノ: 'no',
  ハ: 'ha', ヒ: 'hi', フ: 'fu', ヘ: 'he', ホ: 'ho',
  マ: 'ma', ミ: 'mi', ム: 'mu', メ: 'me', モ: 'mo',
  ヤ: 'ya', ユ: 'yu', ヨ: 'yo',
  ラ: 'ra', リ: 'ri', ル: 'ru', レ: 're', ロ: 'ro',
  ワ: 'wa', ヲ: 'o', ン: 'n',
  ガ: 'ga', ギ: 'gi', グ: 'gu', ゲ: 'ge', ゴ: 'go',
  ザ: 'za', ジ: 'ji', ズ: 'zu', ゼ: 'ze', ゾ: 'zo',
  ダ: 'da', ヂ: 'ji', ヅ: 'zu', デ: 'de', ド: 'do',
  バ: 'ba', ビ: 'bi', ブ: 'bu', ベ: 'be', ボ: 'bo',
  パ: 'pa', ピ: 'pi', プ: 'pu', ペ: 'pe', ポ: 'po',
  ヴ: 'vu',
  ァ: 'a', ィ: 'i', ゥ: 'u', ェ: 'e', ォ: 'o',
  ャ: 'ya', ュ: 'yu', ョ: 'yo', ヮ: 'wa',
}

/** Katakana (or hiragana) reading → lowercase Hepburn, no macrons. */
export function kanaToRomaji(kana: string): string {
  const src = hiraganaToKatakana(stripInvisible(kana))
  const chars = Array.from(src)
  let out = ''
  let pendingSokuon = false

  for (let i = 0; i < chars.length; i++) {
    const two = chars[i] + (chars[i + 1] || '')
    let unit = ''
    let consumed = 1

    if (ROMAJI_DIGRAPHS[two]) {
      unit = ROMAJI_DIGRAPHS[two]
      consumed = 2
    } else if (chars[i] === 'ッ') {
      pendingSokuon = true
      continue
    } else if (chars[i] === 'ー') {
      const last = out.slice(-1)
      if (/[aiueo]/.test(last)) out += last
      continue
    } else if (ROMAJI_SINGLES[chars[i]]) {
      unit = ROMAJI_SINGLES[chars[i]]
    } else {
      // punctuation and anything unmapped: drop it, romaji is a reading aid
      pendingSokuon = false
      continue
    }

    if (pendingSokuon) {
      // っち → tchi; otherwise double the leading consonant
      unit = unit.startsWith('ch') ? 't' + unit : (/^[a-z]/.test(unit) ? unit[0] + unit : unit)
      pendingSokuon = false
    }
    // ン before a vowel or y needs a separator so んあ ≠ な
    if (out.endsWith('n') && /^[aiueoy]/.test(unit) && chars[i - consumed] === 'ン') out += "'"

    out += unit
    i += consumed - 1
  }
  return out
}

/** Particles read literally are pronounced differently. Only applies to `prt`. */
const PARTICLE_SOUNDS: Record<string, string> = { は: 'wa', へ: 'e', を: 'o' }

/**
 * Auxiliaries and suffixes attach to the word before them; the copula does not.
 * `posOf` splits copula out of `aux` using posLabel, which is the only field
 * that distinguishes them.
 */
function attachesToPrevious(tok: NadeshikoToken): boolean {
  const pos = posOf(tok)
  return pos === 'aux' || pos === 'suffix'
}

/**
 * Word-spaced lowercase romaji built from token readings.
 *   言っ + た           → itta
 *   食べ + られ + ない  → taberarenai
 *   そこ に 行け ば     → soko ni ike ba
 *   私 は 学生 です     → watashi wa gakusei desu
 *   親父 へ 手紙 を     → oyaji e tegami o
 */
export function romajiLine(tokens: NadeshikoToken[]): string {
  const groups: { kana: string; fixed?: string }[] = []

  for (const tok of tokens || []) {
    if (isSkippable(tok)) continue
    const surface = stripInvisible(tok.s)
    const reading = stripInvisible(tok.r || surface)

    if (posOf(tok) === 'particle' && PARTICLE_SOUNDS[surface]) {
      groups.push({ kana: '', fixed: PARTICLE_SOUNDS[surface] })
      continue
    }
    if (attachesToPrevious(tok) && groups.length) {
      const prev = groups[groups.length - 1]
      if (prev.fixed != null) groups.push({ kana: reading })
      else prev.kana += reading
      continue
    }
    groups.push({ kana: reading })
  }

  return groups
    .map(g => (g.fixed != null ? g.fixed : kanaToRomaji(g.kana)))
    .filter(Boolean)
    .join(' ')
    .trim()
}

// ── vocab ───────────────────────────────────────────────────────────────────

export type VocabCandidate = { word: string; reading: string; pos: Pos }

const VOCAB_POS: Pos[] = ['noun', 'verb', 'adj', 'adv']

/**
 * Notable vocabulary only: content words, deduped by dictionary form, the
 * searched word first, capped at 4. Meanings are filled in later by Claude —
 * this returns the candidates, not the readings-as-meanings the Python
 * prototype emitted.
 */
export function extractVocab(tokens: NadeshikoToken[], searchWord = '', limit = 4): VocabCandidate[] {
  const seen = new Set<string>()
  const out: VocabCandidate[] = []

  for (const tok of tokens || []) {
    if (isSkippable(tok)) continue
    const pos = posOf(tok)
    if (!VOCAB_POS.includes(pos)) continue
    const word = stripInvisible(tok.d || tok.s).trim()
    if (!word || word.length < 2 && !hasKanji(word)) continue
    if (seen.has(word)) continue
    seen.add(word)
    out.push({ word, reading: katakanaToHiragana(stripInvisible(tok.r || '')), pos })
  }

  const target = stripInvisible(searchWord).trim()
  if (target) {
    out.sort((a, b) => {
      const av = a.word === target ? 0 : a.word.includes(target) ? 1 : 2
      const bv = b.word === target ? 0 : b.word.includes(target) ? 1 : 2
      return av - bv
    })
  }
  return out.slice(0, limit)
}

/** `word=meaning, word=meaning` — the Subtitle Studio's vocab field format. */
export function formatVocab(pairs: { word: string; meaning: string }[]): string {
  return pairs
    .filter(p => p.word && p.meaning)
    .map(p => `${p.word}=${p.meaning}`)
    .join(', ')
}

/** Plain sentence with the invisible marks and stray spacing removed. */
export function plainJapanese(tokens: NadeshikoToken[]): string {
  return (tokens || []).map(t => stripInvisible(t.s)).join('').replace(/\s+/g, ' ').trim()
}
