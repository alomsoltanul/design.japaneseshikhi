export interface KanjiCompound {
  word: string
  kana: string
  en: string
  bn: string
  exampleJp: string
  exampleBn: string
}

export interface KanjiEntry {
  id: string
  kanji: string
  onYomi: string
  kunYomi: string
  meaningEn: string
  meaningBn: string
  jlpt: string
  compounds: KanjiCompound[]
}

const COMPOUND_KEYS: (keyof KanjiCompound)[] = ['word', 'kana', 'en', 'bn', 'exampleJp', 'exampleBn']
const ENTRY_KEYS: (keyof KanjiEntry)[] = ['kanji', 'onYomi', 'kunYomi', 'meaningEn', 'meaningBn', 'jlpt']

function slugify(kanji: string, en: string): string {
  const base = en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'kanji'
  return `${base}-${kanji.codePointAt(0)?.toString(36) ?? 'x'}`
}

/** Parse pasted JSON — accepts a single entry, an array, or `{ kanji: [...] }`. */
export function parseKanjiEntries(text: string): KanjiEntry[] {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON — check for missing commas or quotes.')
  }
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { kanji?: unknown[] }).kanji)
      ? (raw as { kanji: unknown[] }).kanji
      : [raw]

  return list.map((item, idx) => {
    const e = item as Record<string, unknown>
    if (!e || typeof e !== 'object') throw new Error(`Entry ${idx + 1}: not an object.`)
    for (const k of ENTRY_KEYS) {
      if (typeof e[k] !== 'string' || !(e[k] as string).trim()) {
        throw new Error(`Entry ${idx + 1}: missing field "${k}".`)
      }
    }
    if (!Array.isArray(e.compounds) || e.compounds.length !== 8) {
      throw new Error(`Entry ${idx + 1} (${e.kanji}): "compounds" must be an array of exactly 8 words.`)
    }
    const compounds = (e.compounds as Record<string, unknown>[]).map((c, ci) => {
      for (const k of COMPOUND_KEYS) {
        if (typeof c[k] !== 'string' || !(c[k] as string).trim()) {
          throw new Error(`Entry ${idx + 1} (${e.kanji}), compound ${ci + 1}: missing field "${k}".`)
        }
      }
      return {
        word: c.word, kana: c.kana, en: c.en, bn: c.bn,
        exampleJp: c.exampleJp, exampleBn: c.exampleBn,
      } as KanjiCompound
    })
    return {
      id: typeof e.id === 'string' && e.id.trim() ? e.id : slugify(e.kanji as string, e.meaningEn as string),
      kanji: e.kanji as string,
      onYomi: e.onYomi as string,
      kunYomi: e.kunYomi as string,
      meaningEn: e.meaningEn as string,
      meaningBn: e.meaningBn as string,
      jlpt: e.jlpt as string,
      compounds,
    }
  })
}

export const SAMPLE_ENTRY_JSON = `{
  "kanji": "食",
  "onYomi": "ショク・ジキ",
  "kunYomi": "た（べる）・く（う）",
  "meaningEn": "eat · food",
  "meaningBn": "খাওয়া · খাদ্য",
  "jlpt": "N5",
  "compounds": [
    { "word": "朝食", "kana": "ちょうしょく", "en": "breakfast", "bn": "সকালের নাশতা", "exampleJp": "毎朝、朝食を食べます。", "exampleBn": "আমি প্রতিদিন সকালে নাশতা খাই।" }
  ]
}`

export const CLAUDE_PROMPT_TEMPLATE = `Generate a Kanji Mind Map JSON entry for the kanji 「◯◯」 for Bangla-medium JLPT learners.

Rules:
- Exactly 8 compounds, common JLPT-level words that contain the kanji.
- Every compound needs: word (kanji), kana (hiragana reading), en (short English meaning), bn (Bangla meaning), exampleJp (one short natural example sentence), exampleBn (Bangla translation of the example).
- Top-level fields: kanji, onYomi (katakana, ・-separated), kunYomi (hiragana with okurigana in （）), meaningEn ("meaning · meaning"), meaningBn (Bangla, · separated), jlpt ("N5"–"N1").
- Output only the JSON object, no commentary.

Format example:
${SAMPLE_ENTRY_JSON}`
