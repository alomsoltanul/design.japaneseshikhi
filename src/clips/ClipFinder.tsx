import { useCallback, useEffect, useMemo, useState } from 'react'
import './clips.css'
import { parseJP } from '@/subtitles/timeline'
import { kanaToRomaji } from './japanese'
import {
  searchClips, mapSegments, translateBatch, applyTranslations, buildSubtitleDoc,
  buildManifest, readingForWord, autoPick, renderReel,
  TITLE_CARD_SEC, LANGS, LANG_NAMES,
  type Clip, type ClipCategory, type Quota, type RawResponse, type RenderedReel, type LangCode,
} from './nadeshiko'

/** Subtitle Studio reads this on mount and prefills its JSON Import box. */
export const HANDOFF_KEY = 'js-clip-finder-handoff'

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
const CATEGORIES: ClipCategory[] = ['ANIME', 'JDRAMA', 'YOUTUBE']
const TARGET_MIN = 30
const TARGET_MAX = 40

type Stage = 'queued' | 'searching' | 'translating' | 'rendering' | 'done' | 'failed'

type BatchRow = {
  word: string
  stage: Stage
  detail?: string
  reels: RenderedReel[]
  clipCount?: number
  seconds?: number
}

const STAGE_LABEL: Record<Stage, string> = {
  queued: 'Queued',
  searching: 'Searching…',
  translating: 'Translating…',
  rendering: 'Rendering…',
  done: 'Done',
  failed: 'Failed',
}

/** Accepts commas, newlines, or Japanese full-width commas between words. */
function parseWords(raw: string): string[] {
  const seen = new Set<string>()
  return raw
    .split(/[,、\n]+/)
    .map(w => w.trim())
    .filter(w => w && !seen.has(w) && seen.add(w))
}

function Ruby({ text }: { text: string }) {
  return (
    <div className="clips-jp">
      {parseJP(text).map((t, i) => (
        t.f
          ? <ruby key={i}>{t.s}<rt>{t.f}</rt></ruby>
          : <span key={i}>{t.s}</span>
      ))}
    </div>
  )
}

export function ClipFinder({ onOpenStudio }: { onOpenStudio?: () => void }) {
  const [words, setWords] = useState('親父')
  const [level, setLevel] = useState<string>('N4')
  const [langs, setLangs] = useState<LangCode[]>(['en', 'bn'])
  const [provider, setProvider] = useState<'free' | 'claude'>('free')
  const [activeLang, setActiveLang] = useState<LangCode>('bn')

  const [exactMatch, setExactMatch] = useState(true)
  const [categories, setCategories] = useState<ClipCategory[]>(['ANIME'])
  const [minSec, setMinSec] = useState(3)
  const [maxSec, setMaxSec] = useState(4.6)
  const [take, setTake] = useState(50)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [clips, setClips] = useState<Clip[]>([])
  const [reviewWord, setReviewWord] = useState('')
  const [quota, setQuota] = useState<Quota | null>(null)
  const [reading, setReading] = useState('')
  const [meaningEn, setMeaningEn] = useState('')

  const [batch, setBatch] = useState<BatchRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notices, setNotices] = useState<string[]>([])
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [toast, setToast] = useState('')

  const wordList = useMemo(() => parseWords(words), [words])
  const totalVideos = wordList.length * langs.length

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }, [])

  // Keep the review tab on a language that is actually selected.
  useEffect(() => {
    if (!langs.includes(activeLang)) setActiveLang(langs[0] ?? 'en')
  }, [langs, activeLang])

  const kept = useMemo(() => clips.filter(c => c.keep), [clips])
  const clipSecs = useMemo(() => kept.reduce((a, c) => a + c.durationSec, 0), [kept])
  const totalSecs = clipSecs + TITLE_CARD_SEC
  const inBand = totalSecs >= TARGET_MIN && totalSecs <= TARGET_MAX

  const missing = useMemo(() => {
    const out: { lang: LangCode; count: number }[] = []
    for (const l of langs) {
      const n = kept.filter(c => !(c.translations[l] || '').trim()).length
      if (n) out.push({ lang: l, count: n })
    }
    return out
  }, [kept, langs])

  // ── one word, end to end ──────────────────────────────────────────────────
  const searchFor = useCallback(async (word: string): Promise<Clip[]> => {
    const { clips: found, quota: q } = await searchClips({
      word, exactMatch, categories, minSec, maxSec, take,
      // A fresh seed every run, so the same word gives a different reel.
      seed: Math.floor(Math.random() * 100000),
    })
    setQuota(q)
    if (!found.length) {
      throw new Error('no clips — try “broader search”, another category, or a wider length range')
    }
    return autoPick(found)
  }, [exactMatch, categories, minSec, maxSec, take])

  /**
   * English and Spanish come from Nadeshiko's own subtitles, so only the
   * remaining languages reach a translator. A failure here never blocks the
   * render; the affected lines simply stay blank and are flagged.
   */
  const translateFor = useCallback(async (word: string, source: Clip[]) => {
    const targets = langs.filter(l => l !== 'en' && l !== 'es')
    const keepers = source.filter(c => c.keep)
    if (!targets.length || !keepers.length) return { clips: source, meaning: '' }
    try {
      const result = await translateBatch({ provider, word, langs: targets, clips: keepers })
      if (result.warnings?.length) {
        setNotices(n => Array.from(new Set([...n, ...result.warnings])))
      }
      return { clips: applyTranslations(source, result), meaning: result.meaningEn || '' }
    } catch (e) {
      setNotices(n => Array.from(new Set([...n, `Translation skipped: ${(e as Error).message}`])))
      return { clips: source, meaning: '' }
    }
  }, [langs, provider])

  const renderFor = useCallback(async (word: string, source: Clip[], meaning: string) => {
    const manifest = buildManifest({
      word, reading: readingForWord(source, word), meaningEn: meaning, level, clips: source, langs,
    })
    return renderReel(manifest)
  }, [level, langs])

  // ── the batch ─────────────────────────────────────────────────────────────
  const patchRow = useCallback((i: number, next: Partial<BatchRow>) => {
    setBatch(rows => rows.map((r, j) => (j === i ? { ...r, ...next } : r)))
  }, [])

  const runBatch = useCallback(async () => {
    const list = wordList
    if (!list.length || !langs.length) return

    setBusy(true); setError(null); setNotices([])
    setBatch(list.map(w => ({ word: w, stage: 'queued' as Stage, reels: [] })))

    let made = 0
    for (let i = 0; i < list.length; i++) {
      const word = list[i]
      try {
        patchRow(i, { stage: 'searching' })
        const picked = await searchFor(word)

        // Show the newest word's clips so the grid stays reviewable as it runs.
        setClips(picked)
        setReviewWord(word)
        setReading(readingForWord(picked, word))

        patchRow(i, {
          stage: 'translating',
          clipCount: picked.filter(c => c.keep).length,
          seconds: picked.filter(c => c.keep).reduce((a, c) => a + c.durationSec, 0) + TITLE_CARD_SEC,
        })
        const { clips: translated, meaning } = await translateFor(word, picked)
        setClips(translated)
        if (meaning) setMeaningEn(meaning)

        patchRow(i, { stage: 'rendering' })
        const result = await renderFor(word, translated, meaning)
        patchRow(i, { stage: 'done', reels: result.reels })
        made += result.reels.length
      } catch (e) {
        patchRow(i, { stage: 'failed', detail: (e as Error).message })
      }
    }

    setBusy(false)
    showToast(made ? `${made} video${made === 1 ? '' : 's'} saved` : 'Nothing was produced — see the queue')
  }, [wordList, langs, patchRow, searchFor, translateFor, renderFor, showToast])

  /** Search only, for reviewing a single word before committing to a batch. */
  const findOnly = useCallback(async () => {
    const word = wordList[0]
    if (!word) return
    setBusy(true); setError(null); setNotices([]); setBatch([])
    try {
      const picked = await searchFor(word)
      setClips(picked)
      setReviewWord(word)
      setReading(readingForWord(picked, word))
      showToast(`${picked.filter(c => c.keep).length} clips picked from ${picked.length}`)
    } catch (e) {
      setError(`${word}: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }, [wordList, searchFor, showToast])

  /** Render exactly what is on screen, after any hand edits. */
  const exportCurrent = useCallback(async () => {
    if (!reviewWord || !kept.length) return
    setBusy(true); setError(null)
    setBatch([{ word: reviewWord, stage: 'rendering', reels: [], clipCount: kept.length, seconds: totalSecs }])
    try {
      const result = await renderFor(reviewWord, clips, meaningEn)
      setBatch([{ word: reviewWord, stage: 'done', reels: result.reels, clipCount: kept.length, seconds: totalSecs }])
      showToast(`${result.reels.length} video${result.reels.length === 1 ? '' : 's'} saved`)
    } catch (e) {
      setBatch([{ word: reviewWord, stage: 'failed', detail: (e as Error).message, reels: [] }])
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }, [reviewWord, kept.length, totalSecs, clips, meaningEn, renderFor, showToast])

  // ── manual helpers ────────────────────────────────────────────────────────
  const loadPasted = useCallback(() => {
    setError(null)
    const word = wordList[0] ?? ''
    try {
      const raw = JSON.parse(pasteText) as RawResponse
      const found = mapSegments(raw, word)
      if (!found.length) { setError('That response contained no segments with a video URL.'); return }
      const picked = autoPick(found)
      setClips(picked)
      setReviewWord(word)
      setReading(readingForWord(picked, word))
      showToast(`Loaded ${found.length} clips from pasted response`)
    } catch (e) {
      setError(`Could not parse that: ${(e as Error).message}`)
    }
  }, [pasteText, wordList, showToast])

  const patch = useCallback((id: string, next: Partial<Clip>) => {
    setClips(cs => cs.map(c => (c.id === id ? { ...c, ...next } : c)))
  }, [])

  const setField = useCallback((c: Clip, key: 'translations' | 'vocabs', value: string) => {
    patch(c.id, { [key]: { ...c[key], [activeLang]: value } } as Partial<Clip>)
  }, [patch, activeLang])

  const subtitleJson = useCallback(
    () => JSON.stringify(buildSubtitleDoc(clips, level, activeLang), null, 2),
    [clips, level, activeLang],
  )

  const copyJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(subtitleJson())
      showToast(`Copied the ${LANG_NAMES[activeLang]} subtitles`)
    } catch { showToast('Copy failed') }
  }, [subtitleJson, activeLang, showToast])

  const sendToStudio = useCallback(() => {
    try { localStorage.setItem(HANDOFF_KEY, subtitleJson()) } catch { /* private mode */ }
    onOpenStudio?.()
  }, [subtitleJson, onOpenStudio])

  const toggleLang = (l: LangCode) =>
    setLangs(ls => (ls.includes(l) ? ls.filter(x => x !== l) : [...LANGS].filter(x => x === l || ls.includes(x))))
  const toggleCategory = (c: ClipCategory) =>
    setCategories(cs => (cs.includes(c) ? cs.filter(x => x !== c) : [...cs, c]))

  const doneCount = batch.filter(r => r.stage === 'done').length
  const allReels = batch.flatMap(r => r.reels)

  return (
    <div className="clips-root">
      <div className="clips-bar">
        <span className="clips-step">Step 0</span>
        <span className="clips-title">Find clips</span>

        <div className="clips-field" style={{ flex: 1, minWidth: 220 }}>
          <span className="clips-label">
            Japanese words — one reel per word, per language
          </span>
          <input className="clips-input jp" value={words}
                 onChange={e => setWords(e.target.value)}
                 placeholder="親父, 時間, 食べる"
                 onKeyDown={e => { if (e.key === 'Enter' && !busy) void runBatch() }} />
        </div>

        <div className="clips-field">
          <span className="clips-label">Level</span>
          <select className="clips-select" value={level} onChange={e => setLevel(e.target.value)}>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="clips-field">
          <span className="clips-label">Subtitle language</span>
          <div style={{ display: 'flex', gap: 5 }}>
            {LANGS.map(l => (
              <button key={l} type="button"
                      className={`clips-chip${langs.includes(l) ? ' on' : ''}`}
                      title={l === 'en' || l === 'es'
                        ? 'Human-written subs from the source — never machine translated'
                        : `Translated into ${LANG_NAMES[l]}`}
                      onClick={() => toggleLang(l)}>{LANG_NAMES[l]}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end' }}>
          <button className="clips-btn" onClick={() => void runBatch()}
                  disabled={busy || !wordList.length || !langs.length} style={{ padding: '9px 20px' }}>
            {busy ? 'Working…' : `🎬 Make ${totalVideos} video${totalVideos === 1 ? '' : 's'}`}
          </button>
          <button className="clips-btn ghost" onClick={() => void findOnly()} disabled={busy || !wordList.length}>
            Preview first word
          </button>
          <button className="clips-btn ghost" onClick={() => setShowAdvanced(a => !a)} disabled={busy}>
            {showAdvanced ? 'Hide options' : 'Options'}
          </button>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--js-fg-4)', fontWeight: 600, textAlign: 'right' }}>
          {quota && quota.monthlyUsed != null
            ? <>Quota {quota.monthlyUsed}/{quota.monthlyLimit} this month</>
            : <>{wordList.length} word{wordList.length === 1 ? '' : 's'} × {langs.length} language{langs.length === 1 ? '' : 's'}</>}
        </div>
      </div>

      {showAdvanced && (
        <div className="clips-bar" style={{ borderTop: 0, background: 'var(--js-surface-alt)' }}>
          <div className="clips-field">
            <span className="clips-label">Translator</span>
            <div style={{ display: 'flex', gap: 5 }}>
              <button type="button" className={`clips-chip${provider === 'free' ? ' on' : ''}`}
                      title="MyMemory — no key, 5,000 chars/day, machine quality" onClick={() => setProvider('free')}>Free</button>
              <button type="button" className={`clips-chip${provider === 'claude' ? ' on' : ''}`}
                      title="Claude Haiku — needs ANTHROPIC_API_KEY, about 2¢ per reel" onClick={() => setProvider('claude')}>Claude</button>
            </div>
          </div>
          <div className="clips-field">
            <span className="clips-label">Category</span>
            <div style={{ display: 'flex', gap: 5 }}>
              {CATEGORIES.map(c => (
                <button key={c} type="button"
                        className={`clips-chip${categories.includes(c) ? ' on' : ''}`}
                        onClick={() => toggleCategory(c)}>{c}</button>
              ))}
            </div>
          </div>
          <div className="clips-field">
            <span className="clips-label">Clip seconds</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input className="clips-input" style={{ width: 58 }} type="number" step="0.1" min="0.5" max="30"
                     value={minSec} onChange={e => setMinSec(Number(e.target.value))} />
              <span style={{ color: 'var(--js-fg-4)' }}>–</span>
              <input className="clips-input" style={{ width: 58 }} type="number" step="0.1" min="0.5" max="30"
                     value={maxSec} onChange={e => setMaxSec(Number(e.target.value))} />
            </div>
          </div>
          <div className="clips-field">
            <span className="clips-label">Candidates</span>
            <input className="clips-input" style={{ width: 62 }} type="number" min="1" max="50"
                   value={take} onChange={e => setTake(Number(e.target.value))} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--js-fg-2)', alignSelf: 'flex-end', paddingBottom: 6 }}>
            <input type="checkbox" checked={!exactMatch} onChange={e => setExactMatch(!e.target.checked)} />
            Broader search
          </label>
          <button className="clips-btn ghost" style={{ alignSelf: 'flex-end' }}
                  onClick={() => setPasteOpen(o => !o)}>Paste a response</button>
        </div>
      )}

      <div className="clips-scroll">
        <div className="clips-body">
          {error && <div className="clips-warn">{error}</div>}
          {notices.map((n, i) => <div key={i} className="clips-warn">{n}</div>)}

          {batch.length > 0 && (
            <div className="clips-panel" style={{ borderColor: doneCount === batch.length ? 'var(--js-success)' : 'var(--js-border)' }}>
              <h3>
                Queue — {doneCount}/{batch.length} word{batch.length === 1 ? '' : 's'}
                {allReels.length > 0 && ` · ${allReels.length} video${allReels.length === 1 ? '' : 's'} saved`}
              </h3>
              {batch.map((row, i) => (
                <div key={`${row.word}-${i}`} style={{ padding: '10px 0', borderBottom: '1px solid var(--js-border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span className="clips-input jp" style={{ border: 0, padding: 0, fontSize: 17, minWidth: 90 }}>{row.word}</span>
                    <span className={row.stage === 'failed' ? 'clips-warn' : 'clips-note'}
                          style={{ padding: row.stage === 'failed' ? '3px 9px' : 0, fontWeight: 700, fontSize: 12 }}>
                      {STAGE_LABEL[row.stage]}
                    </span>
                    {row.clipCount != null && (
                      <span className="clips-note">{row.clipCount} clips · {row.seconds?.toFixed(1)}s</span>
                    )}
                    {row.detail && <span className="clips-note" style={{ color: 'var(--js-primary)' }}>{row.detail}</span>}
                  </div>
                  {row.reels.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {row.reels.map(r => (
                        <a key={r.lang} className="clips-btn ghost" href={r.downloadUrl} download
                           style={{ textDecoration: 'none', fontSize: 12, padding: '5px 11px' }}>
                          ⬇ {r.name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <p className="clips-note" style={{ marginTop: 10 }}>
                Everything is written to <code>reels/</code> as well, named by word and language.
              </p>
            </div>
          )}

          {pasteOpen && (
            <div className="clips-panel">
              <h3>Paste a response instead</h3>
              <p className="clips-note">
                No network path? Run the search with curl and paste the raw <code>/v1/search</code> body here —
                the panel maps it through the same code as a live request.
              </p>
              <textarea className="clips-paste" value={pasteText} spellCheck={false}
                        placeholder='{"segments":[…],"includes":{"media":{…}}}'
                        onChange={e => setPasteText(e.target.value)} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="clips-btn ghost" onClick={loadPasted} disabled={!pasteText.trim()}>Load pasted response</button>
                <button className="clips-btn ghost" onClick={() => { setPasteOpen(false); setPasteText('') }}>Hide</button>
              </div>
            </div>
          )}

          {clips.length > 0 && (
            <div className="clips-panel">
              <h3>Reviewing {reviewWord}</h3>
              <div className="clips-total">
                <b style={{ color: inBand ? 'var(--js-success)' : 'var(--js-primary)' }}>{totalSecs.toFixed(1)}s</b>
                <span className="clips-note">
                  {kept.length} of {clips.length} clips kept + {TITLE_CARD_SEC}s title card · target {TARGET_MIN}–{TARGET_MAX}s
                </span>
              </div>
              <div className="clips-meter">
                <u style={{ left: `${(TARGET_MIN / 50) * 100}%`, width: `${((TARGET_MAX - TARGET_MIN) / 50) * 100}%` }} />
                <i style={{ width: `${Math.min(100, (totalSecs / 50) * 100)}%` }} />
              </div>

              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 14 }}>
                <div className="clips-field">
                  <span className="clips-label">Kana reading</span>
                  <input className="clips-input jp" style={{ width: 130 }} value={reading}
                         onChange={e => setReading(e.target.value)} placeholder="おやじ" />
                </div>
                <div className="clips-field">
                  <span className="clips-label">Romaji (card)</span>
                  <input className="clips-input" style={{ width: 130 }} value={kanaToRomaji(reading)} readOnly />
                </div>
                <div className="clips-field" style={{ flex: 1, minWidth: 200 }}>
                  <span className="clips-label">English meaning (card)</span>
                  <input className="clips-input" value={meaningEn} onChange={e => setMeaningEn(e.target.value)}
                         placeholder="short English gloss" />
                </div>
              </div>

              {missing.map(m => (
                <div key={m.lang} className="clips-warn" style={{ marginTop: 12 }}>
                  {m.count} kept clip{m.count === 1 ? '' : 's'} {m.count === 1 ? 'has' : 'have'} no {LANG_NAMES[m.lang]} line.
                </div>
              ))}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <button className="clips-btn" onClick={() => void exportCurrent()} disabled={busy || !kept.length || !langs.length}>
                  Render this word ({langs.length})
                </button>
                <button className="clips-btn ghost" onClick={copyJson} disabled={!kept.length}>
                  Copy {LANG_NAMES[activeLang]} for JSON Import
                </button>
                {onOpenStudio && (
                  <button className="clips-btn ghost" onClick={sendToStudio} disabled={!kept.length}>Open in Subtitle Studio</button>
                )}
              </div>
            </div>
          )}

          {clips.length > 0 && (
            <>
              <div className="clips-panel" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="clips-label">Reviewing</span>
                {langs.map(l => (
                  <button key={l} type="button" className={`clips-chip${activeLang === l ? ' on' : ''}`}
                          onClick={() => setActiveLang(l)}>{LANG_NAMES[l]}</button>
                ))}
                <span className="clips-note" style={{ marginLeft: 'auto' }}>
                  {activeLang === 'en' || activeLang === 'es'
                    ? 'Human-written subs from the source.'
                    : provider === 'free'
                      ? 'Machine output — read every line before publishing.'
                      : 'Written by Claude — still worth a read.'}
                </span>
              </div>

              <div className="clips-grid">
                {clips.map(c => (
                  <div key={c.id} className={`clips-card${c.keep ? '' : ' off'}`}>
                    <video src={c.videoUrl} poster={c.imageUrl} preload="none" controls playsInline />
                    <div className="clips-card-body">
                      <div className="clips-meta">
                        <span>{c.source}{c.episode ? ` · ep ${c.episode}` : ''}</span>
                        <span>{c.durationSec.toFixed(2)}s</span>
                      </div>
                      <Ruby text={c.furigana} />
                      <div className="clips-romaji">{c.romaji}</div>

                      <input className={activeLang === 'bn' || activeLang === 'ne' ? 'bn' : ''}
                             value={c.translations[activeLang] || ''}
                             placeholder={`${LANG_NAMES[activeLang]} line`}
                             onChange={e => setField(c, 'translations', e.target.value)} />
                      <input className={activeLang === 'bn' || activeLang === 'ne' ? 'bn' : ''}
                             value={c.vocabs[activeLang] || ''}
                             placeholder="親父=…, 行く=…"
                             onChange={e => setField(c, 'vocabs', e.target.value)} />
                      {c.vocabCandidates.length > 0 && (
                        <div className="clips-cands">
                          {c.vocabCandidates.map(v => {
                            const cur = c.vocabs[activeLang] || ''
                            return (
                              <button key={v.word} type="button" className="clips-cand"
                                      title={`Add ${v.word} to the ${LANG_NAMES[activeLang]} vocab field`}
                                      onClick={() => setField(c, 'vocabs', cur.trim() ? `${cur.replace(/,\s*$/, '')}, ${v.word}=` : `${v.word}=`)}>
                                {v.word}{v.reading ? ` · ${v.reading}` : ''}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      <button className={`clips-btn${c.keep ? '' : ' ghost'}`}
                              onClick={() => patch(c.id, { keep: !c.keep })}>
                        {c.keep ? 'Keep' : 'Rejected'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {clips.length === 0 && batch.length === 0 && !error && !busy && (
            <div className="clips-panel">
              <h3>Type a few words, tick the languages, press once</h3>
              <p className="clips-note">
                Separate words with commas — <span className="clips-input jp" style={{ border: 0, padding: 0 }}>親父, 時間, 食べる</span>.
                Each word gets its own search with a fresh random seed, eight or nine clips in the 30–40s band,
                and <b>one reel per language</b>, each carrying that language and nothing else.
              </p>
              <p className="clips-note" style={{ marginTop: 8 }}>
                English and Spanish are never machine translated — Nadeshiko ships human-written subtitles for
                both. Only বাংলা, Tiếng Việt and नेपाली go to a translator.
              </p>
              <p className="clips-note" style={{ marginTop: 8 }}>
                Rendering runs on this machine — it needs ffmpeg and Chrome, so it only works under
                <code> npm run dev</code>, not on the deployed site.
              </p>
            </div>
          )}
        </div>
      </div>

      {toast && <div className="clips-toast">{toast}</div>}
    </div>
  )
}
