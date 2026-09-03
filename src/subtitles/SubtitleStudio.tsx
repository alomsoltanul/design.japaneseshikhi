import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react'
import './subtitles.css'
import { parseJP, parseVocab, buildTimeline, parseTimeInput, fmtTimeInput, type Line } from './timeline'
import { exportSubtitleReelMp4, exportSubtitleReelWebM, webcodecsAvailable, type ExportSource } from './exportVideo'

type SourceKind = 'video' | 'youtube' | 'frame'
export type VideoFit = 'cover' | 'contain' | 'fill'
export type VideoTransform = { fit: VideoFit; zoom: number; offsetX: number; offsetY: number }
type Source = { kind: SourceKind; url: string; label: string; isFile?: boolean; transform?: VideoTransform }

const DEFAULT_TRANSFORM: VideoTransform = { fit: 'cover', zoom: 1, offsetX: 0, offsetY: 0 }
type Tab = 'video' | 'subtitles' | 'sync' | 'export'
type VideoTab = 'upload' | 'url' | 'frame'

const ACTIVE = '#E63946'
const PAST = '#1D3557'
const FUT = '#C0C6D0'
const RT_ACT = 'rgba(230,57,70,.72)'
const RT_DIM = '#9CA3AF'

function TimeInput({ ms, override, onChange, title }: { ms: number; override: boolean; onChange: (ms: number | null) => void; title: string }) {
  const [text, setText] = useState<string>(fmtTimeInput(ms))
  const [focused, setFocused] = useState(false)
  useEffect(() => { if (!focused) setText(fmtTimeInput(ms)) }, [ms, focused])
  const commit = () => {
    setFocused(false)
    const trimmed = text.trim()
    if (!trimmed) { onChange(null); return }
    const parsed = parseTimeInput(trimmed)
    if (parsed == null) { setText(fmtTimeInput(ms)); return }
    onChange(parsed)
  }
  return (
    <input
      type="text"
      title={title}
      value={text}
      onChange={e => setText(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      spellCheck={false}
      style={{
        width: 66, padding: '3px 6px', borderRadius: 6,
        border: '1px solid ' + (override ? 'var(--js-primary)' : 'var(--js-border)'),
        background: override ? 'rgba(230,57,70,.05)' : '#fff',
        color: override ? 'var(--js-primary)' : 'var(--js-fg-2)',
        fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
        fontFamily: 'ui-monospace, Menlo, monospace', outline: 'none', textAlign: 'center',
      }}
    />
  )
}

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

function srtTime(ms: number) {
  ms = Math.max(0, Math.round(ms))
  const h = Math.floor(ms / 3600000); ms -= h * 3600000
  const m = Math.floor(ms / 60000); ms -= m * 60000
  const s = Math.floor(ms / 1000); ms -= s * 1000
  const p = (n: number, l: number) => String(n).padStart(l, '0')
  return `${p(h, 2)}:${p(m, 2)}:${p(s, 2)},${p(ms, 3)}`
}

function ytId(u: string) {
  const m = u.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{6,})/)
  return m ? m[1] : ''
}

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
type Level = typeof LEVELS[number]

const INITIAL_LINES: Line[] = [
  { jp: '私(わたし)は学生(がくせい)です。', romaji: 'watashi wa gakusei desu', bangla: 'আমি একজন ছাত্র।', vocab: '私=আমি, 学生=ছাত্র', times: [] },
  { jp: '毎日(まいにち)日本語(にほんご)を勉強(べんきょう)します。', romaji: 'mainichi nihongo o benkyō shimasu', bangla: 'প্রতিদিন আমি জাপানি ভাষা শিখি।', vocab: '毎日=প্রতিদিন, 勉強=অধ্যয়ন', times: [] },
  { jp: '将来(しょうらい)日本(にほん)で働(はたら)きたいです。', romaji: 'shōrai nihon de hatarakitai desu', bangla: 'ভবিষ্যতে আমি জাপানে কাজ করতে চাই।', vocab: '将来=ভবিষ্যৎ, 働く=কাজ করা', times: [] },
]

export function SubtitleStudio() {
  const [tab, setTab] = useState<Tab>('subtitles')
  const [videoTab, setVideoTab] = useState<VideoTab>('upload')
  const [source, setSource] = useState<Source>({ kind: 'frame', url: '', label: 'Still frame' })
  const [urlInput, setUrlInput] = useState('')
  const [lines, setLines] = useState<Line[]>(INITIAL_LINES)
  const [selectedLine, setSelectedLine] = useState(0)
  const [syncCursor, setSyncCursor] = useState(0)
  const [toast, setToast] = useState('')
  const [level, setLevel] = useState<Level>('N5')
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')

  // Clip Finder writes the exported document here before switching view, so
  // step 0 hands off to step 2 without a trip through the clipboard.
  useEffect(() => {
    try {
      const handoff = localStorage.getItem('js-clip-finder-handoff')
      if (handoff) {
        setImportText(handoff)
        setImportOpen(true)
        localStorage.removeItem('js-clip-finder-handoff')
      }
    } catch { /* private mode */ }
  }, [])

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const scrubRef = useRef<HTMLDivElement | null>(null)
  const phRef = useRef(0)
  const playingRef = useRef(false)
  const videoDurRef = useRef(0)
  const lastRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [, setTick] = useState(0)
  const forceUpdate = useCallback(() => setTick(t => t + 1), [])

  const [exporting, setExporting] = useState<null | { note: string; ratio: number }>(null)
  const exportAbortRef = useRef<AbortController | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(''), 2000)
  }, [])

  const timeline = buildTimeline(lines)
  const totalDur = source.kind === 'video' && videoDurRef.current
    ? videoDurRef.current * 1000
    : timeline.total

  const flatTokens = () => {
    const f: { li: number; ti: number; s: string; f: string; t?: number }[] = []
    lines.forEach((l, li) => {
      parseJP(l.jp).forEach((tk, ti) => {
        f.push({ li, ti, s: tk.s, f: tk.f, t: (l.times || [])[ti] })
      })
    })
    return f
  }

  // rAF loop for playhead
  useEffect(() => {
    lastRef.current = performance.now()
    const loop = (now: number) => {
      const dt = now - lastRef.current
      lastRef.current = now
      const v = videoRef.current
      if (source.kind === 'video' && v) {
        phRef.current = v.currentTime * 1000
        const wasPlaying = playingRef.current
        playingRef.current = !v.paused
        if (playingRef.current || wasPlaying) forceUpdate()
      } else if (playingRef.current) {
        phRef.current += dt
        const tot = source.kind === 'video' && videoDurRef.current
          ? videoDurRef.current * 1000
          : buildTimeline(lines).total
        if (phRef.current > tot) phRef.current = 0
        forceUpdate()
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [source.kind, lines, forceUpdate])

  // hook video duration
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onMeta = () => { videoDurRef.current = v.duration || 0; forceUpdate() }
    v.addEventListener('loadedmetadata', onMeta)
    return () => v.removeEventListener('loadedmetadata', onMeta)
  }, [source.url, source.kind, forceUpdate])

  // space key for sync
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (tab !== 'sync') return
      if (e.code !== 'Space') return
      const t = (e.target as HTMLElement).tagName
      if (t === 'INPUT' || t === 'TEXTAREA') return
      e.preventDefault()
      tapWord()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, lines, syncCursor])

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
  }, [])

  // ---------- playback ----------
  const toggle = () => {
    const v = videoRef.current
    if (source.kind === 'video' && v) {
      if (v.paused) v.play().catch(() => {}); else v.pause()
    } else {
      playingRef.current = !playingRef.current
      lastRef.current = performance.now()
      forceUpdate()
    }
  }
  const seek = (ms: number) => {
    ms = Math.max(0, ms)
    const v = videoRef.current
    if (source.kind === 'video' && v) v.currentTime = ms / 1000
    phRef.current = ms
    forceUpdate()
  }
  const restart = () => seek(0)
  const onScrub = (e: React.MouseEvent) => {
    const el = scrubRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const pct = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    seek(pct * totalDur)
  }

  // ---------- video sources ----------
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    const url = URL.createObjectURL(f)
    videoDurRef.current = 0; phRef.current = 0; playingRef.current = false
    setSource({ kind: 'video', url, label: f.name, isFile: true, transform: { ...DEFAULT_TRANSFORM } })
    showToast('Video loaded')
  }
  const loadUrl = () => {
    const u = (urlInput || '').trim()
    if (!u) return
    videoDurRef.current = 0; phRef.current = 0; playingRef.current = false
    if (/youtu\.?be/.test(u)) {
      const id = ytId(u)
      setSource({ kind: 'youtube', url: `https://www.youtube.com/embed/${id}?autoplay=0&mute=1&controls=1&rel=0`, label: 'YouTube · ' + id })
    } else {
      setSource({ kind: 'video', url: u, label: u.split('/').pop() || 'Video URL', transform: { ...DEFAULT_TRANSFORM } })
    }
    showToast('Source loaded')
  }
  const useFrameSrc = () => { phRef.current = 0; playingRef.current = false; setSource({ kind: 'frame', url: '', label: 'Still frame' }) }
  const clearSource = () => { phRef.current = 0; playingRef.current = false; videoDurRef.current = 0; setSource({ kind: 'frame', url: '', label: 'Still frame' }) }
  const updateTransform = (patch: Partial<VideoTransform>) => {
    setSource(s => ({ ...s, transform: { ...(s.transform || DEFAULT_TRANSFORM), ...patch } }))
  }
  const resetTransform = () => setSource(s => ({ ...s, transform: { ...DEFAULT_TRANSFORM } }))

  // ---------- json import ----------
  /**
   * Reads the Clip Finder export shape:
   *   { level, lines: [{ id, start, end, japanese_furigana, romaji, vocab, bangla }] }
   * `start`/`end` are seconds and become per-line overrides, so imported
   * timings survive into Sync as a spot-check rather than a manual pass.
   */
  const applyJsonImport = useCallback(() => {
    let parsed: unknown
    try {
      parsed = JSON.parse(importText)
    } catch (e) {
      showToast('Invalid JSON: ' + (e as Error).message)
      return
    }
    const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>
    const rows = Array.isArray(obj.lines) ? obj.lines : Array.isArray(parsed) ? parsed : null
    if (!rows) { showToast('JSON needs a "lines" array'); return }

    const next: Line[] = (rows as Record<string, unknown>[]).map(r => {
      const line: Line = {
        jp: String(r.japanese_furigana ?? r.jp ?? ''),
        romaji: String(r.romaji ?? ''),
        bangla: String(r.bangla ?? ''),
        vocab: String(r.vocab ?? ''),
        times: [],
      }
      const start = Number(r.start)
      const end = Number(r.end)
      if (Number.isFinite(start) && start >= 0) line.startMs = Math.round(start * 1000)
      if (Number.isFinite(end) && end > 0) line.endMs = Math.round(end * 1000)
      return line
    }).filter(l => l.jp.trim())

    if (!next.length) { showToast('No usable lines in that JSON'); return }

    const lvl = String(obj.level ?? '')
    if ((LEVELS as readonly string[]).includes(lvl)) setLevel(lvl as Level)
    setLines(next)
    setSelectedLine(0)
    setSyncCursor(0)
    setImportOpen(false)
    const blanks = next.filter(l => !l.bangla.trim()).length
    showToast(blanks ? `Imported ${next.length} lines — ${blanks} without Bangla` : `Imported ${next.length} lines`)
  }, [importText, showToast])

  // ---------- lines ----------
  const updateLine = (i: number, key: keyof Line, val: string) => {
    setLines(ls => {
      const copy = ls.slice()
      copy[i] = { ...copy[i], [key]: val }
      return copy
    })
  }
  const setLineTime = (i: number, key: 'startMs' | 'endMs', ms: number | null) => {
    setLines(ls => {
      const copy = ls.slice()
      const next = { ...copy[i] }
      if (ms == null) delete next[key]
      else next[key] = ms
      copy[i] = next
      return copy
    })
  }
  const clearLineTimes = (i: number) => {
    setLines(ls => {
      const copy = ls.slice()
      const next = { ...copy[i] }
      delete next.startMs
      delete next.endMs
      copy[i] = next
      return copy
    })
  }
  const snapLineStartToPlayhead = (i: number) => {
    const ms = Math.round(phRef.current)
    setLineTime(i, 'startMs', ms)
  }
  const addLine = () => {
    setLines(ls => [...ls, { jp: '', romaji: '', bangla: '', vocab: '', times: [] }])
    setSelectedLine(lines.length)
  }
  const deleteLine = (i: number) => {
    setLines(ls => { const c = ls.slice(); c.splice(i, 1); return c })
    setSelectedLine(0); setSyncCursor(0)
  }
  const moveLine = (i: number, d: number) => {
    setLines(ls => {
      const j = i + d
      if (j < 0 || j >= ls.length) return ls
      const c = ls.slice()
      const t = c[i]; c[i] = c[j]; c[j] = t
      return c
    })
  }
  const selectLineFn = (i: number) => {
    const tl = buildTimeline(lines)
    setSelectedLine(i)
    if (tl.lines[i]) seek(tl.lines[i].start + 5)
  }

  // ---------- sync ----------
  const tapWord = () => {
    const flat = flatTokens()
    if (syncCursor >= flat.length) return
    const { li, ti } = flat[syncCursor]
    const ph = Math.round(phRef.current)
    setLines(ls => {
      const copy = ls.map(l => ({ ...l, times: (l.times || []).slice() }))
      copy[li].times[ti] = ph
      return copy
    })
    setSyncCursor(c => c + 1)
  }
  const undoSync = () => {
    if (syncCursor <= 0) return
    const c = syncCursor - 1
    const flat = flatTokens()
    const { li, ti } = flat[c]
    setLines(ls => {
      const copy = ls.map(l => ({ ...l, times: (l.times || []).slice() }))
      copy[li].times[ti] = undefined
      return copy
    })
    setSyncCursor(c)
  }
  const resetSync = () => {
    setLines(ls => ls.map(l => ({ ...l, times: [] })))
    setSyncCursor(0)
    showToast('Timings cleared')
  }

  // ---------- export ----------
  const reelJson = () => {
    const tl = buildTimeline(lines)
    return {
      product: 'Japanese Shikhi', format: '9:16', level,
      source: { kind: source.kind, ref: source.label },
      durationMs: Math.round(totalDur),
      lines: lines.map((l, i) => ({
        jp: l.jp, romaji: l.romaji, bangla: l.bangla,
        tokens: parseJP(l.jp),
        vocab: parseVocab(l.vocab),
        startMs: Math.round(tl.lines[i] ? tl.lines[i].start : 0),
        endMs: Math.round(tl.lines[i] ? tl.lines[i].end : 0),
        wordStartsMs: (tl.lines[i] ? tl.lines[i].wordStarts : []).map(x => Math.round(x)),
      })),
    }
  }
  const toSrt = () => {
    const tl = buildTimeline(lines)
    return lines.map((l, i) => {
      const L = tl.lines[i] || { start: 0, end: 0 }
      const plain = parseJP(l.jp).map(t => t.s).join('')
      return `${i + 1}\n${srtTime(L.start)} --> ${srtTime(L.end)}\n${plain}\n${l.bangla || ''}`.trim()
    }).join('\n\n') + '\n'
  }
  const download = (name: string, text: string, type: string) => {
    const blob = new Blob([text], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const downloadJson = () => { download('japanese-shikhi-reel.json', JSON.stringify(reelJson(), null, 2), 'application/json'); showToast('Reel JSON downloaded') }
  const downloadSrt = () => { download('japanese-shikhi-reel.srt', toSrt(), 'text/plain'); showToast('.srt downloaded') }
  const copyJson = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(reelJson(), null, 2)); showToast('JSON copied') }
    catch { showToast('Copy failed') }
  }

  const exportableSource = (): ExportSource | null => {
    if (source.kind === 'frame') return { kind: 'frame' }
    if (source.kind === 'video' && source.isFile) return { kind: 'video', url: source.url, isFile: true, transform: source.transform }
    return null
  }
  const canExportVideo = exportableSource() !== null

  const runVideoExport = async (format: 'mp4' | 'webm') => {
    const src = exportableSource()
    if (!src) return
    const controller = new AbortController()
    exportAbortRef.current = controller
    setExporting({ note: 'Preparing…', ratio: 0 })
    try {
      const onProgress = (ratio: number, note?: string) => setExporting({ ratio, note: note || '' })
      const opts = { source: src, lines, level, onProgress, signal: controller.signal }
      const blob = format === 'mp4' && webcodecsAvailable()
        ? await exportSubtitleReelMp4(opts)
        : await exportSubtitleReelWebM(opts)
      const name = format === 'mp4' && webcodecsAvailable() ? 'japanese-shikhi-reel.mp4' : 'japanese-shikhi-reel.webm'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = name
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      showToast(name + ' downloaded')
    } catch (e) {
      const err = e as Error
      if (err.name === 'AbortError') showToast('Export cancelled')
      else { console.error(err); showToast('Export failed: ' + err.message) }
    } finally {
      setExporting(null)
      exportAbortRef.current = null
    }
  }

  const cancelExport = () => { exportAbortRef.current?.abort() }

  // ---------- derive render values ----------
  const ph = phRef.current
  let li = 0
  for (let i = 0; i < timeline.lines.length; i++) if (timeline.lines[i].start <= ph) li = i
  const L = timeline.lines[li] || { toks: [], wordStarts: [], start: 0, end: 1 }
  let aw = -1
  for (let i = 0; i < L.wordStarts.length; i++) if (L.wordStarts[i] <= ph) aw = i
  if (ph < L.start) aw = -1
  const lineData = lines[li] || { romaji: '', bangla: '', vocab: '' } as Line

  const rubyOf = (col: string): CSSProperties => ({ display: 'inline-flex', flexDirection: 'column-reverse', alignItems: 'center', margin: '0 3px', lineHeight: 1.02, color: col, transition: 'color .16s ease' })
  const rtOf = (act: boolean): CSSProperties => ({ fontSize: '.42em', fontWeight: 500, marginBottom: '3px', color: act ? RT_ACT : RT_DIM, transition: 'color .16s ease', minHeight: '1em' })

  const tokens = L.toks.map((tk, i) => {
    const state = (aw >= L.toks.length || i < aw) ? 'past' : (i === aw ? 'active' : 'future')
    const col = state === 'active' ? ACTIVE : state === 'past' ? PAST : FUT
    return { s: tk.s, f: tk.f || ' ', rubyStyle: rubyOf(col), rtStyle: rtOf(state === 'active') }
  })

  const rParts = (lineData.romaji || '').trim().split(/\s+/).filter(Boolean)
  let romajiTokens: { t: string; style: CSSProperties }[]
  if (rParts.length && rParts.length === L.toks.length) {
    romajiTokens = rParts.map((t, i) => {
      const state = (aw >= L.toks.length || i < aw) ? 'past' : (i === aw ? 'active' : 'future')
      return { t, style: { fontSize: '14px', fontWeight: 500, color: state === 'active' ? ACTIVE : (state === 'past' ? '#6B7280' : '#C0C6D0'), transition: 'color .16s ease' } }
    })
  } else if (lineData.romaji) {
    romajiTokens = [{ t: lineData.romaji, style: { fontSize: '14px', fontWeight: 500, color: '#6B7280' } }]
  } else {
    romajiTokens = []
  }

  const tabDefs: { id: Tab; n: string; label: string }[] = [
    { id: 'video', n: '1', label: 'Video' },
    { id: 'subtitles', n: '2', label: 'Subtitles' },
    { id: 'sync', n: '3', label: 'Sync' },
    { id: 'export', n: '4', label: 'Export' },
  ]
  const tabStyle = (on: boolean): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 2, border: 'none', cursor: 'pointer', padding: '7px 13px', borderRadius: 9, fontSize: 13.5, fontWeight: 600, background: on ? 'var(--js-primary)' : 'transparent', color: on ? '#fff' : 'var(--js-fg-3)' })

  const vtabDefs: { id: VideoTab; label: string }[] = [
    { id: 'upload', label: 'Upload' },
    { id: 'url', label: 'URL' },
    { id: 'frame', label: 'Frame' },
  ]
  const vtabStyle = (on: boolean): CSSProperties => ({ border: 'none', cursor: 'pointer', padding: '7px 15px', borderRadius: 9, fontSize: 13, fontWeight: 600, background: on ? '#fff' : 'transparent', color: on ? 'var(--js-secondary)' : 'var(--js-fg-3)', boxShadow: on ? 'var(--js-shadow-sm)' : 'none' })

  const flat = flatTokens()
  const cursor = Math.min(syncCursor, flat.length)
  const syncQueue: { s: string; f: string; rubyStyle: CSSProperties; rtStyle: CSSProperties }[] = []
  for (let k = cursor; k < Math.min(flat.length, cursor + 4); k++) {
    const isCur = k === cursor
    syncQueue.push({
      s: flat[k].s, f: flat[k].f || ' ',
      rubyStyle: { display: 'inline-flex', flexDirection: 'column-reverse', alignItems: 'center', margin: '0 4px', lineHeight: 1.02, color: isCur ? ACTIVE : '#C0C6D0', fontSize: isCur ? 30 : 22, fontWeight: 700, transition: 'all .18s ease' },
      rtStyle: { fontSize: '.42em', fontWeight: 500, marginBottom: '3px', color: isCur ? RT_ACT : '#C0C6D0', minHeight: '1em' },
    })
  }
  const syncDone = cursor >= flat.length && flat.length > 0

  const useVideoEl = source.kind === 'video'
  const useYouTube = source.kind === 'youtube'
  const useFrame = source.kind === 'frame'
  const playing = playingRef.current
  const playedPct = (Math.min(1, ph / (totalDur || 1)) * 100).toFixed(1) + '%'
  const linePct = Math.min(100, Math.max(0, (ph - L.start) / Math.max(1, (L.end - L.start)) * 100)).toFixed(1) + '%'
  const lineLabel = lines.length ? ((li + 1) + ' / ' + lines.length) : '0 / 0'
  const wordCount = L.toks.length
  const wordPos = Math.max(0, Math.min(wordCount, aw + 1))
  const lineElapsedSec = Math.max(0, (ph - L.start) / 1000)
  const lineTotalSec = Math.max(0, (L.end - L.start) / 1000)
  const hasContent = lines.length > 0

  return (
    <div className="subs-root">
      {/* TAB STRIP (README-given branded header omitted — parent app has GlobalNav) */}
      <header style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 14, padding: '0 20px', height: 52, background: '#fff', borderBottom: '1px solid var(--js-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {tabDefs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={tabStyle(tab === t.id)}>
              <span style={{ opacity: .75, fontSize: 11 }}>{t.n}</span>&nbsp;{t.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--js-fg-3)', fontWeight: 600 }}>
          Level
          <select value={level} onChange={e => setLevel(e.target.value as Level)} style={{ border: '1px solid var(--js-border)', borderRadius: 8, padding: '5px 8px', background: '#fff', color: 'var(--js-secondary)', fontWeight: 700, fontSize: 12 }}>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
      </header>

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* LEFT: EDITOR */}
        <section className="subs-scroll" style={{ flex: '1 1 0', minWidth: 0, overflowY: 'auto', background: '#EEF0F4' }}>
          <div style={{ padding: '22px 24px 60px', maxWidth: 660, margin: '0 auto', width: '100%' }}>

            {tab === 'video' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--js-secondary)' }}>Add a video</h2>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--js-fg-3)', lineHeight: 1.5 }}>Upload a clip, paste a link, or use a still frame. The clip fills the top half of the 9:16 reel.</p>
                </div>

                <div style={{ display: 'flex', gap: 6, background: '#E4E7ED', padding: 4, borderRadius: 12, width: 'fit-content' }}>
                  {vtabDefs.map(v => (
                    <button key={v.id} onClick={() => setVideoTab(v.id)} style={vtabStyle(videoTab === v.id)}>{v.label}</button>
                  ))}
                </div>

                {videoTab === 'upload' && (
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center', minHeight: 150, borderRadius: 16, border: '2px dashed var(--js-border-strong)', background: '#fff', cursor: 'pointer', padding: 22 }}>
                    <input type="file" accept="video/*" onChange={onFile} style={{ display: 'none' }} />
                    <div style={{ fontSize: 30 }}>🎬</div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--js-secondary)' }}>Click to upload a video file</div>
                    <div style={{ fontSize: 12.5, color: 'var(--js-fg-3)' }}>mp4 · webm · mov — plays with real audio &amp; timeline</div>
                  </label>
                )}

                {videoTab === 'url' && (
                  <div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://… .mp4  or  a YouTube link" spellCheck={false} style={{ flex: 1, border: '1px solid var(--js-border)', borderRadius: 11, padding: '11px 14px', fontSize: 14, color: 'var(--js-fg-1)', background: '#fff', outline: 'none' }} />
                      <button onClick={loadUrl} style={{ background: 'var(--js-primary)', color: '#fff', border: 'none', borderRadius: 11, padding: '11px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Load</button>
                    </div>
                    <p style={{ margin: '8px 2px 0', fontSize: 12, color: 'var(--js-fg-4)', lineHeight: 1.5 }}>Direct video links play frame-accurately. YouTube links embed as a backdrop; word timing then runs on the studio clock.</p>
                  </div>
                )}

                {videoTab === 'frame' && (
                  <div>
                    <button onClick={useFrameSrc} style={{ background: 'var(--js-secondary)', color: '#fff', border: 'none', borderRadius: 11, padding: '11px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Use a still frame</button>
                    <p style={{ margin: '8px 2px 0', fontSize: 12, color: 'var(--js-fg-4)', lineHeight: 1.5 }}>Drop your own image onto the video area in the preview. Timing runs on the studio clock.</p>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: '1px solid var(--js-border)', borderRadius: 12, background: '#fff' }}>
                  <span style={{ fontSize: 12, color: 'var(--js-fg-3)' }}>Current source</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--js-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{source.label || 'None'}</span>
                  <button onClick={clearSource} style={{ background: 'transparent', border: '1px solid var(--js-border)', color: 'var(--js-fg-2)', borderRadius: 9, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                </div>

                {source.kind === 'video' && (() => {
                  const tf = source.transform || DEFAULT_TRANSFORM
                  const fitOpts: { id: VideoFit; label: string }[] = [
                    { id: 'cover', label: 'Cover (crop)' },
                    { id: 'contain', label: 'Contain (fit)' },
                    { id: 'fill', label: 'Fill (stretch)' },
                  ]
                  return (
                    <div style={{ padding: 14, border: '1px solid var(--js-border)', borderRadius: 12, background: '#fff', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--js-secondary)' }}>Frame · resize &amp; crop</div>
                        <div style={{ flex: 1 }} />
                        <button onClick={resetTransform} style={{ background: 'transparent', border: '1px solid var(--js-border)', color: 'var(--js-fg-2)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Reset</button>
                      </div>

                      <div style={{ display: 'flex', gap: 6, background: '#E4E7ED', padding: 3, borderRadius: 10, width: 'fit-content' }}>
                        {fitOpts.map(f => (
                          <button
                            key={f.id}
                            onClick={() => updateTransform({ fit: f.id })}
                            style={{ border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: tf.fit === f.id ? '#fff' : 'transparent', color: tf.fit === f.id ? 'var(--js-secondary)' : 'var(--js-fg-3)', boxShadow: tf.fit === f.id ? 'var(--js-shadow-sm)' : 'none' }}
                          >{f.label}</button>
                        ))}
                      </div>

                      <label style={{ display: 'grid', gridTemplateColumns: '80px 1fr 60px', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--js-fg-3)', letterSpacing: '.05em', textTransform: 'uppercase' }}>Zoom</span>
                        <input type="range" min={0.5} max={3} step={0.01} value={tf.zoom} onChange={e => updateTransform({ zoom: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                        <span style={{ fontSize: 12, color: 'var(--js-fg-2)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{tf.zoom.toFixed(2)}×</span>
                      </label>
                      <label style={{ display: 'grid', gridTemplateColumns: '80px 1fr 60px', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--js-fg-3)', letterSpacing: '.05em', textTransform: 'uppercase' }}>Offset X</span>
                        <input type="range" min={-0.5} max={0.5} step={0.005} value={tf.offsetX} onChange={e => updateTransform({ offsetX: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                        <span style={{ fontSize: 12, color: 'var(--js-fg-2)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{Math.round(tf.offsetX * 100)}%</span>
                      </label>
                      <label style={{ display: 'grid', gridTemplateColumns: '80px 1fr 60px', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--js-fg-3)', letterSpacing: '.05em', textTransform: 'uppercase' }}>Offset Y</span>
                        <input type="range" min={-0.5} max={0.5} step={0.005} value={tf.offsetY} onChange={e => updateTransform({ offsetY: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                        <span style={{ fontSize: 12, color: 'var(--js-fg-2)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{Math.round(tf.offsetY * 100)}%</span>
                      </label>

                      <p style={{ margin: 0, fontSize: 11.5, color: 'var(--js-fg-4)', lineHeight: 1.5 }}>Applied to both the live preview and the exported video. Cover keeps aspect, Contain letterboxes, Fill stretches. Zoom + offsets pan and crop within the frame.</p>
                    </div>
                  )
                })()}
              </div>
            )}

            {tab === 'subtitles' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--js-secondary)' }}>Subtitle lines</h2>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--js-fg-3)', lineHeight: 1.5 }}>
                    For furigana, wrap the reading in parentheses right after the kanji:{' '}
                    <span style={{ fontFamily: "'Noto Sans JP',sans-serif", background: 'rgba(230,57,70,.07)', color: 'var(--js-primary)', padding: '2px 7px', borderRadius: 6, fontWeight: 600 }}>漢字(かんじ)</span> → renders かんじ above 漢字.
                  </p>
                </div>

                <div style={{ border: '1px solid var(--js-border)', borderRadius: 12, background: '#fff' }}>
                  <button
                    type="button"
                    onClick={() => setImportOpen(o => !o)}
                    style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 14px', border: 0, background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--js-secondary)' }}
                  >
                    <span>📋 JSON Import — paste a Clip Finder export</span>
                    <span style={{ color: 'var(--js-fg-4)' }}>{importOpen ? '▲' : '▼'}</span>
                  </button>
                  {importOpen && (
                    <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <textarea
                        value={importText}
                        onChange={e => setImportText(e.target.value)}
                        spellCheck={false}
                        placeholder={'{\n  "level": "N5",\n  "lines": [\n    { "id": 1, "start": 2.0, "end": 5.43, "japanese_furigana": "\u89aa\u7236(\u304a\u3084\u3058)\u306f\u8a00(\u3044)\u3063\u305f\u3002", "romaji": "oyaji wa itta", "vocab": "\u89aa\u7236=\u09ac\u09be\u09ac\u09be", "bangla": "\u09ac\u09be\u09ac\u09be \u09ac\u09b2\u09c7\u099b\u09bf\u09b2\u0964" }\n  ]\n}'}
                        style={{ minHeight: 130, border: '1px solid var(--js-border)', borderRadius: 9, padding: 10, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, color: 'var(--js-fg-1)', background: '#fff', outline: 'none', resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={applyJsonImport} disabled={!importText.trim()}
                          style={{ border: 0, borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 700, background: importText.trim() ? 'var(--js-primary)' : 'var(--js-fg-4)', color: '#fff', cursor: importText.trim() ? 'pointer' : 'not-allowed' }}>
                          Replace lines
                        </button>
                        <button type="button" onClick={() => setImportText('')}
                          style={{ borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 700, background: '#fff', color: 'var(--js-secondary)', border: '1px solid var(--js-border)', cursor: 'pointer' }}>
                          Clear
                        </button>
                      </div>
                      <p style={{ margin: 0, fontSize: 11.5, color: 'var(--js-fg-4)', lineHeight: 1.5 }}>
                        Replaces every line. <code>start</code>/<code>end</code> are seconds and become per-line timing overrides.
                      </p>
                    </div>
                  )}
                </div>

                {lines.map((l, i) => {
                  const Lt = timeline.lines[i] || { start: 0, end: 0 }
                  const prev = parseJP(l.jp).map(tk => ({
                    s: tk.s, f: tk.f || ' ',
                    rubyStyle: { display: 'inline-flex', flexDirection: 'column-reverse', alignItems: 'center', margin: '0 2px', lineHeight: 1.02, color: '#1D3557' } as CSSProperties,
                    rtStyle: { fontSize: '.44em', fontWeight: 500, marginBottom: '2px', color: '#9CA3AF', minHeight: '1em' } as CSSProperties,
                  }))
                  const previewArr = prev.length ? prev : [{ s: '—', f: ' ', rubyStyle: { color: '#C0C6D0' } as CSSProperties, rtStyle: { fontSize: '.44em', minHeight: '1em' } as CSSProperties }]
                  const cardStyle: CSSProperties = {
                    border: '1px solid ' + (i === selectedLine ? 'var(--js-primary)' : 'var(--js-border)'),
                    borderRadius: 14, background: '#fff', padding: 14,
                    boxShadow: i === selectedLine ? '0 4px 12px rgba(230,57,70,.08)' : 'var(--js-shadow-sm)',
                  }
                  return (
                    <div key={i} style={cardStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <button onClick={() => selectLineFn(i)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 7, background: 'var(--js-secondary)', color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>{i + 1}</button>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <TimeInput
                            ms={Lt.start}
                            override={typeof l.startMs === 'number'}
                            onChange={ms => setLineTime(i, 'startMs', ms)}
                            title="Line start (mm:ss or seconds)"
                          />
                          <span style={{ fontSize: 11, color: 'var(--js-fg-4)' }}>–</span>
                          <TimeInput
                            ms={Lt.end}
                            override={typeof l.endMs === 'number'}
                            onChange={ms => setLineTime(i, 'endMs', ms)}
                            title="Line end (mm:ss or seconds)"
                          />
                          <button
                            onClick={() => snapLineStartToPlayhead(i)}
                            title="Set start to current playhead"
                            style={{ marginLeft: 2, padding: '3px 7px', borderRadius: 6, border: '1px solid var(--js-border)', background: '#fff', color: 'var(--js-fg-3)', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                          >⏱</button>
                          {(typeof l.startMs === 'number' || typeof l.endMs === 'number') && (
                            <button
                              onClick={() => clearLineTimes(i)}
                              title="Clear time overrides"
                              style={{ padding: '3px 7px', borderRadius: 6, border: '1px solid var(--js-border)', background: '#fff', color: 'var(--js-fg-3)', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                            >auto</button>
                          )}
                        </div>
                        <div style={{ flex: 1 }} />
                        <button onClick={() => moveLine(i, -1)} title="Move up" style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid var(--js-border)', background: '#fff', color: 'var(--js-fg-3)', cursor: 'pointer', fontSize: 12 }}>↑</button>
                        <button onClick={() => moveLine(i, 1)} title="Move down" style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid var(--js-border)', background: '#fff', color: 'var(--js-fg-3)', cursor: 'pointer', fontSize: 12 }}>↓</button>
                        <button onClick={() => deleteLine(i)} title="Delete" style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid rgba(230,57,70,.25)', background: '#fff', color: 'var(--js-primary)', cursor: 'pointer', fontSize: 13 }}>✕</button>
                      </div>

                      <label style={{ display: 'block', marginBottom: 9 }}>
                        <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--js-fg-3)', marginBottom: 4 }}>Japanese · furigana markup</span>
                        <textarea value={l.jp} onChange={e => updateLine(i, 'jp', e.target.value)} rows={1} spellCheck={false} placeholder="私(わたし)は学生(がくせい)です。" style={{ width: '100%', resize: 'vertical', border: '1px solid var(--js-border)', borderRadius: 9, padding: '9px 11px', fontSize: 15, fontFamily: "'Noto Sans JP',sans-serif", lineHeight: 1.4, color: 'var(--js-fg-1)', background: '#fff', outline: 'none', minHeight: 40 }} />
                      </label>

                      <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: '2px 4px', padding: '8px 11px', background: 'var(--js-surface-alt)', borderRadius: 9, marginBottom: 10, minHeight: 38, fontFamily: "'Noto Sans JP',sans-serif" }}>
                        {previewArr.map((pt, k) => (
                          <ruby key={k} style={pt.rubyStyle}>{pt.s}<rt style={pt.rtStyle}>{pt.f}</rt></ruby>
                        ))}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                        <label style={{ display: 'block' }}>
                          <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--js-fg-3)', marginBottom: 4 }}>Romaji</span>
                          <input type="text" value={l.romaji} onChange={e => updateLine(i, 'romaji', e.target.value)} spellCheck={false} placeholder="watashi wa gakusei desu" style={{ width: '100%', border: '1px solid var(--js-border)', borderRadius: 9, padding: '8px 11px', fontSize: 13, color: 'var(--js-fg-1)', background: '#fff', outline: 'none' }} />
                        </label>
                        <label style={{ display: 'block' }}>
                          <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--js-fg-3)', marginBottom: 4 }}>Vocab · word=meaning, …</span>
                          <input type="text" value={l.vocab} onChange={e => updateLine(i, 'vocab', e.target.value)} placeholder="学生=ছাত্র, 私=আমি" style={{ width: '100%', border: '1px solid var(--js-border)', borderRadius: 9, padding: '8px 11px', fontSize: 13, fontFamily: "'Noto Sans Bengali',sans-serif", color: 'var(--js-fg-1)', background: '#fff', outline: 'none' }} />
                        </label>
                      </div>
                      <label style={{ display: 'block', marginTop: 9 }}>
                        <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--js-fg-3)', marginBottom: 4 }}>Bangla translation</span>
                        <input type="text" value={l.bangla} onChange={e => updateLine(i, 'bangla', e.target.value)} placeholder="আমি একজন ছাত্র।" style={{ width: '100%', border: '1px solid var(--js-border)', borderRadius: 9, padding: '8px 11px', fontSize: 14, fontFamily: "'Noto Sans Bengali',sans-serif", color: 'var(--js-fg-1)', background: '#fff', outline: 'none' }} />
                      </label>
                    </div>
                  )
                })}

                <button onClick={addLine} style={{ alignSelf: 'flex-start', background: 'transparent', color: 'var(--js-primary)', border: '1px dashed var(--js-primary)', borderRadius: 11, padding: '10px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>+ Add subtitle line</button>
              </div>
            )}

            {tab === 'sync' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--js-secondary)' }}>Tap to sync</h2>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--js-fg-3)', lineHeight: 1.5 }}>Press play, then tap <b>Mark word</b> (or the <b>space bar</b>) exactly when each word is spoken. Timings drive the karaoke highlight.</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: '1px solid var(--js-border)', borderRadius: 12, background: '#fff' }}>
                  <button onClick={toggle} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 9999, border: 'none', background: 'var(--js-primary)', color: '#fff', fontSize: 14, cursor: 'pointer' }}>{playing ? '❚❚' : '▶'}</button>
                  <button onClick={restart} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 9999, border: '1px solid var(--js-border)', background: '#fff', color: 'var(--js-fg-2)', fontSize: 16, cursor: 'pointer' }}>↺</button>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 5, borderRadius: 9999, background: 'var(--js-border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: playedPct, background: 'var(--js-primary)' }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--js-fg-3)', fontVariantNumeric: 'tabular-nums' }}>{fmt(ph)} / {fmt(totalDur)}</span>
                </div>

                <div style={{ border: '1px solid var(--js-border)', borderRadius: 16, background: '#fff', padding: 20, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--js-fg-4)', marginBottom: 12 }}>
                    {syncDone ? 'All words synced ✓' : ('Word ' + (cursor + 1) + ' of ' + flat.length)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, minHeight: 64, marginBottom: 16, fontFamily: "'Noto Sans JP',sans-serif" }}>
                    {syncQueue.map((q, k) => (
                      <ruby key={k} style={q.rubyStyle}>{q.s}<rt style={q.rtStyle}>{q.f}</rt></ruby>
                    ))}
                  </div>
                  <button
                    onClick={tapWord}
                    className={playing && !syncDone ? 'subs-tap-live' : ''}
                    style={{ background: syncDone ? 'var(--js-success)' : 'var(--js-primary)', color: '#fff', border: 'none', borderRadius: 14, padding: '16px 34px', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
                  >Mark word ⌁</button>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 14 }}>
                    <button onClick={undoSync} style={{ background: 'transparent', border: '1px solid var(--js-border)', color: 'var(--js-fg-2)', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>↶ Undo last</button>
                    <button onClick={resetSync} style={{ background: 'transparent', border: '1px solid var(--js-border)', color: 'var(--js-fg-2)', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Reset timings</button>
                  </div>
                </div>
              </div>
            )}

            {tab === 'export' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--js-secondary)' }}>Export reel</h2>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--js-fg-3)', lineHeight: 1.5 }}>Download the finished video with karaoke subtitles burned in — or grab the raw reel JSON / .srt subtitle track.</p>
                </div>

                {/* Video export */}
                <div style={{ border: '1px solid var(--js-border)', borderRadius: 14, background: '#fff', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--js-secondary)' }}>Rendered video</div>
                    <div style={{ fontSize: 12, color: 'var(--js-fg-3)', marginTop: 2 }}>1080 × 1920 · 9:16 · burned-in furigana/romaji/Bangla + vocab pills.</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => runVideoExport('mp4')}
                      disabled={!canExportVideo || !!exporting}
                      style={{ background: canExportVideo ? 'var(--js-primary)' : '#E4E7ED', color: canExportVideo ? '#fff' : 'var(--js-fg-4)', border: 'none', borderRadius: 12, padding: '12px 20px', fontWeight: 700, fontSize: 14, cursor: canExportVideo && !exporting ? 'pointer' : 'not-allowed' }}
                    >⬇ Video ({webcodecsAvailable() ? '.mp4' : '.webm'})</button>
                    {webcodecsAvailable() && (
                      <button
                        onClick={() => runVideoExport('webm')}
                        disabled={!canExportVideo || !!exporting}
                        style={{ background: '#fff', color: 'var(--js-fg-2)', border: '1px solid var(--js-border)', borderRadius: 12, padding: '12px 18px', fontWeight: 600, fontSize: 14, cursor: canExportVideo && !exporting ? 'pointer' : 'not-allowed' }}
                      >Alt: .webm (realtime)</button>
                    )}
                    {exporting && (
                      <button onClick={cancelExport} style={{ background: 'transparent', color: 'var(--js-primary)', border: '1px solid var(--js-primary)', borderRadius: 12, padding: '12px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
                    )}
                  </div>

                  {exporting && (
                    <div>
                      <div style={{ height: 6, borderRadius: 9999, background: 'var(--js-border)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(exporting.ratio * 100).toFixed(1)}%`, background: 'var(--js-primary)', transition: 'width .2s ease' }} />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--js-fg-3)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{exporting.note || 'Working…'}</div>
                    </div>
                  )}

                  {source.kind === 'youtube' && (
                    <div style={{ padding: '10px 12px', background: 'rgba(230,57,70,.06)', border: '1px solid rgba(230,57,70,.16)', borderRadius: 10, fontSize: 12.5, color: 'var(--js-fg-2)', lineHeight: 1.5 }}>
                      YouTube embeds can't be exported as video — the iframe is opaque, and audio isn't accessible. Use the SRT export and burn subtitles into the source video externally (e.g. <code style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>ffmpeg -i in.mp4 -vf subtitles=reel.srt out.mp4</code>).
                    </div>
                  )}
                  {source.kind === 'video' && !source.isFile && (
                    <div style={{ padding: '10px 12px', background: 'var(--js-surface-alt)', border: '1px solid var(--js-border)', borderRadius: 10, fontSize: 12.5, color: 'var(--js-fg-2)', lineHeight: 1.5 }}>
                      Remote video URLs are only exportable if the host sends CORS headers. If export fails, download the video, upload it in the <b>Video</b> tab, then try again — or use the SRT export.
                    </div>
                  )}
                </div>

                {/* JSON + SRT */}
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--js-fg-3)', marginBottom: 6 }}>Data exports</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={downloadJson} style={{ background: 'var(--js-secondary)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>⬇ Reel JSON</button>
                    <button onClick={downloadSrt} style={{ background: 'var(--js-secondary)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>⬇ Subtitles .srt</button>
                    <button onClick={copyJson} style={{ background: '#fff', color: 'var(--js-fg-2)', border: '1px solid var(--js-border)', borderRadius: 12, padding: '12px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Copy JSON</button>
                  </div>
                </div>

                <div>
                  <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--js-fg-3)', marginBottom: 6 }}>JSON preview</span>
                  <textarea readOnly value={JSON.stringify(reelJson(), null, 2)} spellCheck={false} className="subs-scroll" style={{ width: '100%', height: 220, resize: 'vertical', border: '1px solid var(--js-border)', borderRadius: 12, padding: 14, fontSize: 12, lineHeight: 1.5, fontFamily: 'ui-monospace, Menlo, monospace', color: 'var(--js-fg-2)', background: '#fff', outline: 'none' }} />
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--js-fg-4)', lineHeight: 1.5 }}>Uploaded video files aren't embedded in the JSON — the reel references your source, so keep the clip alongside it.</p>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT: REEL PREVIEW */}
        <section style={{ flex: '0 0 452px', minWidth: 0, display: 'flex', flexDirection: 'column', background: 'linear-gradient(160deg,#11131d,#0c0e16)' }}>
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
            <span style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', fontWeight: 700, color: 'rgba(255,255,255,.5)' }}>Live preview · 9:16</span>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>Level</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 9999, background: 'var(--js-primary)', color: '#fff', fontSize: 11, fontWeight: 700 }}>{level}</span>
            </div>
          </div>

          <div className="subs-scroll" style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '22px 18px' }}>
            <div style={{ width: 388, height: 690, borderRadius: 26, overflow: 'hidden', background: '#0b0b14', boxShadow: '0 30px 60px -22px rgba(0,0,0,.6)', position: 'relative', flex: 'none' }}>

              {/* VIDEO ZONE */}
              <div style={{ position: 'relative', height: '50%', background: '#0b0b14', overflow: 'hidden' }}>
                {useVideoEl && (() => {
                  const tf = source.transform || DEFAULT_TRANSFORM
                  const objectFit: CSSProperties['objectFit'] = tf.fit === 'fill' ? 'fill' : tf.fit
                  return (
                    <video
                      ref={videoRef}
                      src={source.url}
                      playsInline
                      style={{
                        position: 'absolute', inset: 0, width: '100%', height: '100%',
                        objectFit, background: '#000',
                        transform: `translate(${tf.offsetX * 100}%, ${tf.offsetY * 100}%) scale(${tf.zoom})`,
                        transformOrigin: 'center center',
                      }}
                    />
                  )
                })()}
                {useYouTube && (
                  <iframe src={source.url} allow="autoplay; encrypted-media" frameBorder={0} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
                )}
                {useFrame && (
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#1D3557,#0b0b14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.45)', fontSize: 13, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase' }}>Still frame</div>
                )}

                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 96, background: 'linear-gradient(180deg, rgba(8,9,18,.55), transparent)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 130, background: 'linear-gradient(0deg, rgba(8,9,18,.8), transparent)', pointerEvents: 'none' }} />

                <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 11px', borderRadius: 9999, background: 'var(--js-primary)', color: '#fff', fontSize: 12, fontWeight: 700 }}>{level}</span>
                  <span className={`subs-eq ${playing ? '' : 'paused'}`} style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 13, opacity: .9 }}>
                    <span style={{ height: '100%', animationDelay: '0s' }} />
                    <span style={{ height: '100%', animationDelay: '.2s' }} />
                    <span style={{ height: '100%', animationDelay: '.45s' }} />
                    <span style={{ height: '100%', animationDelay: '.15s' }} />
                  </span>
                </div>
                <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.14)', backdropFilter: 'blur(6px)', padding: '4px 10px 4px 5px', borderRadius: 9999 }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, background: 'var(--js-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 12, fontFamily: "'Noto Sans JP',sans-serif" }}>あ</span>
                  <span style={{ fontWeight: 700, fontSize: 11.5, color: '#fff' }}>Japanese Shikhi</span>
                </div>

                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 14px 12px', display: 'flex', alignItems: 'center', gap: 9 }}>
                  <button onClick={toggle} style={{ width: 32, height: 32, borderRadius: 9999, border: 'none', background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(6px)', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{playing ? '❚❚' : '▶'}</button>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.9)', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{fmt(ph)}</span>
                  <div onClick={onScrub} ref={scrubRef} style={{ flex: 1, height: 5, borderRadius: 9999, background: 'rgba(255,255,255,.22)', overflow: 'hidden', cursor: 'pointer' }}>
                    <div style={{ height: '100%', width: playedPct, background: 'var(--js-primary)', borderRadius: 9999, pointerEvents: 'none' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.6)', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{fmt(totalDur)}</span>
                </div>
              </div>

              {/* SUBTITLE ZONE */}
              <div style={{ height: '50%', background: '#FFFFFF', display: 'flex', flexDirection: 'column', padding: '16px 20px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 9999, background: 'var(--js-primary)', color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: '.05em' }}>{level}</span>
                    <span style={{ fontFamily: "'Noto Sans JP',sans-serif", fontSize: 11, fontWeight: 700, color: 'var(--js-secondary)', whiteSpace: 'nowrap' }}>日本語</span>
                    <span style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--js-fg-4)', whiteSpace: 'nowrap' }}>Nihongo</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, fontWeight: 700, color: 'var(--js-fg-3)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    <span>Line {lineLabel}</span>
                    <span style={{ opacity: .5 }}>·</span>
                    <span>Word {wordPos}/{wordCount || 0}</span>
                    <span style={{ opacity: .5 }}>·</span>
                    <span>{lineElapsedSec.toFixed(1)}s / {lineTotalSec.toFixed(1)}s</span>
                  </div>
                </div>
                <div style={{ height: 4, borderRadius: 9999, background: 'var(--js-border-subtle)', overflow: 'hidden', margin: '8px 0 0' }}>
                  <div style={{ height: '100%', width: linePct, background: 'linear-gradient(90deg,var(--js-primary),var(--js-accent))', borderRadius: 9999, transition: 'width .12s linear' }} />
                </div>
                {wordCount > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    {L.toks.map((_, k) => {
                      const state = aw >= wordCount || k < aw ? 'past' : (k === aw ? 'active' : 'future')
                      return (
                        <span key={k} style={{
                          flex: 1, height: 3, borderRadius: 9999,
                          background: state === 'active' ? 'var(--js-primary)' : state === 'past' ? 'var(--js-secondary)' : 'var(--js-border-subtle)',
                          transition: 'background .18s ease',
                        }} />
                      )
                    })}
                  </div>
                )}

                {hasContent ? (
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', rowGap: 6, columnGap: 1, fontFamily: "'Noto Sans JP',sans-serif", fontWeight: 700, fontSize: 29, lineHeight: 1.18 }}>
                      {tokens.map((tk, k) => (
                        <ruby key={k} style={tk.rubyStyle}>{tk.s}<rt style={tk.rtStyle}>{tk.f}</rt></ruby>
                      ))}
                    </div>
                    <div style={{ display: romajiTokens.length ? 'flex' : 'none', flexWrap: 'wrap', columnGap: 6, rowGap: 2, marginTop: -2 }}>
                      {romajiTokens.map((r, k) => (
                        <span key={k} style={r.style}>{r.t}</span>
                      ))}
                    </div>
                    <div style={{ fontFamily: "'Noto Sans Bengali',sans-serif", fontWeight: 600, fontSize: 19, lineHeight: 1.5, color: 'var(--js-secondary)' }}>{lineData.bangla || ''}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                      {parseVocab(lineData.vocab).map((v, k) => (
                        <span key={k} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, padding: '5px 11px', borderRadius: 9999, background: 'rgba(230,57,70,.07)', border: '1px solid rgba(230,57,70,.16)' }}>
                          <span style={{ fontFamily: "'Noto Sans JP',sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--js-primary)' }}>{v.jp}</span>
                          <span style={{ fontFamily: "'Noto Sans Bengali',sans-serif", fontSize: 12, color: 'var(--js-fg-2)' }}>{v.bn}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--js-fg-4)', fontSize: 13, lineHeight: 1.6 }}>
                    Add subtitle lines in step 2<br />to see them here.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', background: 'var(--js-secondary)', color: '#fff', padding: '11px 20px', borderRadius: 12, fontSize: 13.5, fontWeight: 600, boxShadow: 'var(--js-shadow-lg)', zIndex: 50 }}>{toast}</div>
      )}
    </div>
  )
}
