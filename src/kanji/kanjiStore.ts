import { parseKanjiEntries, type KanjiEntry } from './types'

const CUSTOM_KEY = 'js-kanji-mindmap-v1'
const LEARNED_KEY = 'js-kanji-learned-v1'

function loadCustom(): KanjiEntry[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.custom) ? parsed.custom : []
  } catch {
    return []
  }
}

function saveCustom(custom: KanjiEntry[]) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify({ custom }))
}

let builtInCache: KanjiEntry[] | null = null

export async function loadBuiltIn(): Promise<KanjiEntry[]> {
  if (builtInCache) return builtInCache
  const res = await fetch(`${import.meta.env.BASE_URL}kanji/kanji-mind-maps.json`)
  if (!res.ok) throw new Error('Could not load kanji-mind-maps.json')
  const data = await res.json()
  builtInCache = parseKanjiEntries(JSON.stringify(data.kanji))
  return builtInCache
}

export interface KanjiLibrary {
  entries: KanjiEntry[]
  customIds: Set<string>
}

export async function loadLibrary(): Promise<KanjiLibrary> {
  const builtIn = await loadBuiltIn()
  const custom = loadCustom()
  const seen = new Set(custom.map(e => e.id))
  return {
    entries: [...builtIn.filter(e => !seen.has(e.id)), ...custom],
    customIds: new Set(custom.map(e => e.id)),
  }
}

/** Parse pasted JSON and merge into localStorage. Returns the added entries. */
export function addPasted(text: string): KanjiEntry[] {
  const entries = parseKanjiEntries(text)
  const custom = loadCustom()
  for (const e of entries) {
    const at = custom.findIndex(c => c.id === e.id)
    if (at >= 0) custom[at] = e
    else custom.push(e)
  }
  saveCustom(custom)
  return entries
}

export function removeCustom(id: string) {
  saveCustom(loadCustom().filter(e => e.id !== id))
}

// ── learned words, per kanji id ───────────────────────────
export function loadLearned(kanjiId: string): number[] {
  try {
    const raw = localStorage.getItem(LEARNED_KEY)
    const map = raw ? JSON.parse(raw) : {}
    return Array.isArray(map[kanjiId]) ? map[kanjiId] : []
  } catch {
    return []
  }
}

export function saveLearned(kanjiId: string, learned: number[]) {
  try {
    const raw = localStorage.getItem(LEARNED_KEY)
    const map = raw ? JSON.parse(raw) : {}
    map[kanjiId] = learned
    localStorage.setItem(LEARNED_KEY, JSON.stringify(map))
  } catch {
    /* ignore quota errors */
  }
}
