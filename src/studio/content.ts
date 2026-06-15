// Content sources, merged. Today: static files + pasted (localStorage).
// Tomorrow: add a Supabase source implementing the same `getLevel` shape and
// push it into SOURCES — nothing else changes.
import type { LevelFile, LevelTest, LevelProblem, LevelQuestion } from './levels'

const PASTE_PREFIX = 'js-pasted-'

async function fetchFileLevel(level: string): Promise<LevelFile | null> {
  try {
    const r = await fetch(`/jsonfileLevels/${level.toLowerCase()}.json`, { cache: 'no-store' })
    if (!r.ok) return null
    return (await r.json()) as LevelFile
  } catch {
    return null
  }
}

// ── pasted store (localStorage) ──
export function getPasted(level: string): LevelFile | null {
  try {
    const raw = localStorage.getItem(PASTE_PREFIX + level.toUpperCase())
    return raw ? (JSON.parse(raw) as LevelFile) : null
  } catch {
    return null
  }
}

export function setPasted(level: string, file: LevelFile) {
  localStorage.setItem(PASTE_PREFIX + level.toUpperCase(), JSON.stringify(file))
}

export function clearPasted(level: string) {
  localStorage.removeItem(PASTE_PREFIX + level.toUpperCase())
}

/** Accept many shapes (full file / test / problem / question[] / question) → LevelFile. */
export function normalizePasted(level: string, raw: unknown): LevelFile {
  const lvl = level.toUpperCase()
  const r = raw as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const wrapProblem = (problem: LevelProblem, testNo = 99): LevelFile => ({
    level: lvl,
    tests: [{ test_number: testNo, problems: [problem] }],
  })
  const asProblem = (questions: LevelQuestion[], mondai = 1): LevelProblem => ({
    mondai_number: mondai,
    problem_title: 'もんだい',
    problem_title_en: 'Pasted',
    questions,
  })

  if (r && Array.isArray(r.tests)) return { level: lvl, tests: r.tests as LevelTest[] }
  if (r && Array.isArray(r.problems)) return { level: lvl, tests: [{ test_number: r.test_number ?? 99, problems: r.problems }] }
  if (r && Array.isArray(r.questions)) return wrapProblem(asProblem(r.questions, r.mondai_number ?? 1), r.test_number ?? 99)
  if (Array.isArray(r)) return wrapProblem(asProblem(r as LevelQuestion[]))
  if (r && r.question_text && Array.isArray(r.options)) return wrapProblem(asProblem([r as LevelQuestion]))
  throw new Error('Unrecognized JSON. Paste a question, an array of questions, a problem, a test, or a full level file.')
}

// ── merge ──
function mergeLevels(a: LevelFile | null, b: LevelFile | null, level: string): LevelFile {
  const out: LevelFile = { level: level.toUpperCase(), tests: [] }
  const testMap = new Map<number, LevelTest>()
  for (const file of [a, b]) {
    if (!file) continue
    for (const t of file.tests ?? []) {
      let dst = testMap.get(t.test_number)
      if (!dst) {
        dst = { test_number: t.test_number, problems: [] }
        testMap.set(t.test_number, dst)
      }
      const probMap = new Map(dst.problems.map(p => [p.mondai_number, p]))
      for (const p of t.problems ?? []) probMap.set(p.mondai_number, p) // later source (pasted) wins
      dst.problems = [...probMap.values()].sort((x, y) => x.mondai_number - y.mondai_number)
    }
  }
  out.tests = [...testMap.values()].sort((x, y) => x.test_number - y.test_number)
  return out
}

/** Parse + add pasted JSON to a level's local store (accumulates). Returns the new pasted file. */
export function addPasted(level: string, rawText: string): LevelFile {
  const parsed = JSON.parse(rawText)
  const incoming = normalizePasted(level, parsed)
  const existing = getPasted(level)
  const merged = existing ? mergeLevels(existing, incoming, level) : incoming
  setPasted(level, merged)
  return merged
}

export function countQuestions(file: LevelFile | null): number {
  if (!file) return 0
  return file.tests.reduce((n, t) => n + t.problems.reduce((m, p) => m + p.questions.length, 0), 0)
}

/** The merged content for a level (file + pasted). */
export async function getMergedLevel(level: string): Promise<LevelFile> {
  const [file, pasted] = [await fetchFileLevel(level), getPasted(level)]
  const merged = mergeLevels(file, pasted, level)
  if (merged.tests.length === 0 && !file && !pasted) {
    throw new Error(`No content for ${level}. Add public/jsonfileLevels/${level.toLowerCase()}.json or paste JSON.`)
  }
  return merged
}
