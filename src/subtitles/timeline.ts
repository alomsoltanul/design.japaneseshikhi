export type Token = { s: string; f: string }
export type Line = {
  jp: string
  romaji: string
  bangla: string
  vocab: string
  times: (number | undefined)[]
  startMs?: number
  endMs?: number
}
export type TimelineLine = { start: number; end: number; wordStarts: number[]; toks: Token[] }
export type Timeline = { lines: TimelineLine[]; total: number }

export const HOLD = 700

const isKanji = (c: string) => /[一-龯々㐀-䶿]/.test(c)

export function parseJP(str: string): Token[] {
  str = str || ''
  const tokens: Token[] = []
  let buf = ''
  const flush = () => { if (buf) { tokens.push({ s: buf, f: '' }); buf = '' } }
  for (let i = 0; i < str.length; i++) {
    const c = str[i]
    if (c === '(' || c === '（') {
      let j = i + 1
      let rd = ''
      while (j < str.length && str[j] !== ')' && str[j] !== '）') { rd += str[j]; j++ }
      let k = buf.length
      while (k > 0 && isKanji(buf[k - 1])) k--
      let base = buf.slice(k)
      const prefix = buf.slice(0, k)
      if (!base) base = buf
      if (base !== buf && prefix) tokens.push({ s: prefix, f: '' })
      buf = ''
      if (base) tokens.push({ s: base, f: rd.trim() })
      i = j
    } else {
      buf += c
    }
  }
  flush()
  return tokens.filter(t => t.s.length > 0)
}

export function parseVocab(str: string): { jp: string; bn: string }[] {
  return (str || '').split(/[,、]/).map(p => {
    const m = p.split('=')
    if (m.length < 2) return null
    const jp = m[0].trim()
    const bn = m.slice(1).join('=').trim()
    return (jp && bn) ? { jp, bn } : null
  }).filter((x): x is { jp: string; bn: string } => x !== null)
}

export const defDur = (tk: Token) => tk.f ? 660 : Math.max(280, tk.s.length * 150)

export function buildTimeline(lines: Line[]): Timeline {
  const out: TimelineLine[] = []
  let clock = 0
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    const toks = parseJP(line.jp)
    const times = line.times || []
    const synced = toks.some((_, ti) => typeof times[ti] === 'number')
    const wordStarts: number[] = []
    let lineStart: number, lineEnd: number
    const hasStartOverride = typeof line.startMs === 'number' && line.startMs >= 0
    const hasEndOverride = typeof line.endMs === 'number' && line.endMs >= 0

    if (synced) {
      const abs: (number | null)[] = toks.map((_, ti) => typeof times[ti] === 'number' ? (times[ti] as number) : null)
      for (let ti = 0; ti < abs.length; ti++) {
        if (abs[ti] == null) {
          let nj = ti + 1
          while (nj < abs.length && abs[nj] == null) nj++
          const prev = ti > 0 ? wordStarts[ti - 1] : clock
          if (nj < abs.length) {
            const gap = ((abs[nj] as number) - prev) / (nj - ti + 1)
            abs[ti] = prev + gap
          } else {
            abs[ti] = prev + defDur(toks[ti])
          }
        }
        wordStarts[ti] = abs[ti] as number
      }
      lineStart = wordStarts.length ? wordStarts[0] : clock
      lineEnd = (wordStarts.length ? wordStarts[wordStarts.length - 1] : clock) + defDur(toks[toks.length - 1] || { s: '', f: '' })
    } else {
      lineStart = hasStartOverride ? (line.startMs as number) : clock
      let t = lineStart
      for (let ti = 0; ti < toks.length; ti++) {
        wordStarts[ti] = t
        t += defDur(toks[ti])
      }
      lineEnd = toks.length ? t : lineStart + 600
    }

    // Apply overrides
    if (hasStartOverride) {
      const targetStart = Math.max(0, line.startMs as number)
      const shift = targetStart - lineStart
      lineStart = targetStart
      lineEnd += shift
      for (let ti = 0; ti < wordStarts.length; ti++) wordStarts[ti] += shift
    }
    if (hasEndOverride) {
      const targetEnd = Math.max(lineStart + 100, line.endMs as number)
      if (wordStarts.length > 1) {
        const oldSpan = Math.max(1, wordStarts[wordStarts.length - 1] - wordStarts[0])
        const newSpan = Math.max(1, targetEnd - lineStart - defDur(toks[toks.length - 1] || { s: '', f: '' }))
        const scale = newSpan / oldSpan
        const base = wordStarts[0]
        for (let ti = 0; ti < wordStarts.length; ti++) {
          wordStarts[ti] = base + (wordStarts[ti] - base) * scale
        }
      }
      lineEnd = targetEnd
    }

    if (!hasStartOverride && lineStart < clock) {
      const shift = clock - lineStart
      lineStart += shift
      lineEnd += shift
      for (let ti = 0; ti < wordStarts.length; ti++) wordStarts[ti] += shift
    }
    clock = lineEnd + HOLD
    out.push({ start: lineStart, end: lineEnd, wordStarts, toks })
  }
  const total = out.length ? out[out.length - 1].end : 1000
  return { lines: out, total }
}

export function parseTimeInput(s: string): number | null {
  const str = s.trim()
  if (!str) return null
  // mm:ss(.mmm) or ss(.mmm)
  const colon = str.match(/^(\d+):(\d+(?:\.\d+)?)$/)
  if (colon) {
    const m = parseInt(colon[1], 10)
    const sec = parseFloat(colon[2])
    if (!isFinite(m) || !isFinite(sec)) return null
    return Math.round((m * 60 + sec) * 1000)
  }
  const num = parseFloat(str)
  if (!isFinite(num) || num < 0) return null
  return Math.round(num * 1000)
}

export function fmtTimeInput(ms: number): string {
  if (!isFinite(ms) || ms < 0) return ''
  const totalSec = ms / 1000
  const m = Math.floor(totalSec / 60)
  const sec = totalSec - m * 60
  return `${m}:${sec.toFixed(1).padStart(4, '0')}`
}

export function activeIndices(timeline: Timeline, phMs: number): { li: number; aw: number } {
  let li = 0
  for (let i = 0; i < timeline.lines.length; i++) if (timeline.lines[i].start <= phMs) li = i
  const L = timeline.lines[li]
  let aw = -1
  if (L) {
    for (let i = 0; i < L.wordStarts.length; i++) if (L.wordStarts[i] <= phMs) aw = i
    if (phMs < L.start) aw = -1
  }
  return { li, aw }
}
