import { useCallback, useEffect, useMemo, useState } from 'react'
import './clips.css'
import { parseJP } from '@/subtitles/timeline'
import { kanaToRomaji } from './japanese'
import {
  searchClips, mapSegments, translateBatch, applyTranslations, buildSubtitleDoc,
  buildManifest, readingForWord, autoPick, renderReel,
  TITLE_CARD_SEC, LANGS, LANG_NAMES,
  type Clip, type ClipCategory, type Quota, type RawResponse, type RenderResult, type LangCode,
} from './nadeshiko'

/** Subtitle Studio reads this on mount and prefills its JSON Import box. */
export const HANDOFF_KEY = 'js-clip-finder-handoff'

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
const CATEGORIES: ClipCategory[] = ['ANIME', 'JDRAMA', 'YOUTUBE']
const TARGET_MIN = 30
const TARGET_MAX = 40

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
  const [word, setWord] = useState('親父')
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
  const [quota, setQuota] = useState<Quota | null>(null)
  const [reading, setReading] = useState('')
  const [meaningEn, setMeaningEn] = useState('')

  const [stage, setStage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notices, setNotices] = useState<string[]>([])
  const [rendered, setRendered] = useState<RenderResult | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [toast, setToast] = useState('')

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }, [])

  // Keep the review tab on a language that is actually selected.
  useEffect(() => {
    if (!langs.includes(activeLang)) setActiveLang(langs[0] ?? 'en')
  }, [langs, activeLang])

  const kept = useMemo(() => clips.filter(c => c.keep), [clips])
  const clipSecs = useMemo(() => kept.reduce((a, c) => a + c.durationSec, 0), [kept])
  const totalSecs = clipSecs + TITLE_CARD_SEC
  const inBand = totalSecs >= TARGET_MIN && totalSecs <= TARGET_MAX

  /** Kept clips with nothing to show in a selected language's row. */
  const missing = useMemo(() => {
    const out: { lang: LangCode; count: number }[] = []
    for (const l of langs) {
      const n = kept.filter(c => !(c.translations[l] || '').trim()).length
      if (n) out.push({ lang: l, count: n })
    }
    return out
  }, [kept, langs])

  // ── steps ─────────────────────────────────────────────────────────────────
  const doSearch = useCallback(async (): Promise<Clip[]> => {
    const w = word.trim()
    setStage('Searching Nadeshiko…')
    const { clips: found, quota: q } = await searchClips({
      word: w, exactMatch, categories, minSec, maxSec, take,
      // A fresh seed every run, so the same word gives a different reel.
      seed: Math.floor(Math.random() * 100000),
    })
    setQuota(q)
    if (!found.length) {
      throw new Error(`No clips for ${w}. Try “broader search”, another category, or a wider length range — formal words return very little spoken media.`)
    }
    const picked = autoPick(found)
    setClips(picked)
    const r = readingForWord(picked, w)
    if (r) setReading(r)
    return picked
  }, [word, exactMatch, categories, minSec, maxSec, take])

  /** English needs no translator; a failure here must never block the render. */
  const doTranslate = useCallback(async (source: Clip[]): Promise<{ clips: Clip[]; meaning: string }> => {
    const targets = langs.filter(l => l !== 'en')
    const keepers = source.filter(c => c.keep)
    if (!targets.length || !keepers.length) return { clips: source, meaning: meaningEn }

    setStage(`Translating into ${targets.map(l => LANG_NAMES[l]).join(', ')}…`)
    try {
      const result = await translateBatch({ provider, word: word.trim(), langs: targets, clips: keepers })
      const next = applyTranslations(source, result)
      setClips(next)
      if (result.warnings?.length) setNotices(n => [...n, ...result.warnings])
      const meaning = result.meaningEn || meaningEn
      if (result.meaningEn) setMeaningEn(result.meaningEn)
      return { clips: next, meaning }
    } catch (e) {
      setNotices(n => [...n, `Translation skipped: ${(e as Error).message}`])
      return { clips: source, meaning: meaningEn }
    }
  }, [langs, provider, word, meaningEn])

  const doRender = useCallback(async (source: Clip[], meaning: string) => {
    setStage(`Rendering ${langs.length} reel${langs.length === 1 ? '' : 's'} — clips download once, then one encode per language…`)
    const manifest = buildManifest({
      word: word.trim(), reading, meaningEn: meaning, level, clips: source, langs,
    })
    setRendered(await renderReel(manifest))
  }, [word, reading, level, langs])

  const guardRun = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true); setError(null); setNotices([]); setRendered(null)
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false); setStage('')
    }
  }, [])

  const makeReels = useCallback(() => guardRun(async () => {
    const found = await doSearch()
    const { clips: translated, meaning } = await doTranslate(found)
    await doRender(translated, meaning)
    showToast(`${langs.length} reel${langs.length === 1 ? '' : 's'} saved`)
  }), [guardRun, doSearch, doTranslate, doRender, langs, showToast])

  const findOnly = useCallback(() => guardRun(async () => {
    const found = await doSearch()
    showToast(`${found.filter(c => c.keep).length} clips picked from ${found.length}`)
  }), [guardRun, doSearch, showToast])

  const exportOnly = useCallback(() => guardRun(async () => {
    const { clips: translated, meaning } = await doTranslate(clips)
    await doRender(translated, meaning)
    showToast(`${langs.length} reel${langs.length === 1 ? '' : 's'} saved`)
  }), [guardRun, doTranslate, doRender, clips, langs, showToast])

  // ── manual helpers ────────────────────────────────────────────────────────
  const loadPasted = useCallback(() => {
    setError(null)
    try {
      const raw = JSON.parse(pasteText) as RawResponse
      const found = mapSegments(raw, word.trim())
      if (!found.length) { setError('That response contained no segments with a video URL.'); return }
      const picked = autoPick(found)
      setClips(picked)
      const r = readingForWord(picked, word.trim())
      if (r) setReading(r)
      showToast(`Loaded ${found.length} clips from pasted response`)
    } catch (e) {
      setError(`Could not parse that: ${(e as Error).message}`)
    }
  }, [pasteText, word, showToast])

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

  return (
    <div className="clips-root">
      <div className="clips-bar">
        <span className="clips-step">Step 0</span>
        <span className="clips-title">Find clips</span>

        <div className="clips-field">
          <span className="clips-label">Japanese word</span>
          <input className="clips-input jp" style={{ width: 150 }} value={word}
                 onChange={e => setWord(e.target.value)}
                 onKeyDown={e => { if (e.key === 'Enter' && !busy) makeReels() }} />
        </div>

        <div className="clips-field">
          <span className="clips-label">Level</span>
          <select className="clips-select" value={level} onChange={e => setLevel(e.target.value)}>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="clips-field">
          <span className="clips-label">Subtitle language — one reel each</span>
          <div style={{ display: 'flex', gap: 5 }}>
            {LANGS.map(l => (
              <button key={l} type="button"
                      className={`clips-chip${langs.includes(l) ? ' on' : ''}`}
                      title={l === 'en' ? 'Human-written subs from the source — never machine translated' : `Translated into ${LANG_NAMES[l]}`}
                      onClick={() => toggleLang(l)}>{LANG_NAMES[l]}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end' }}>
          <button className="clips-btn" onClick={makeReels} disabled={busy || !word.trim() || !langs.length} style={{ padding: '9px 20px' }}>
            {busy ? 'Working…' : `🎬 Make ${langs.length} reel${langs.length === 1 ? '' : 's'}`}
          </button>
          <button className="clips-btn ghost" onClick={findOnly} disabled={busy || !word.trim()}>Find clips only</button>
          <button className="clips-btn ghost" onClick={() => setShowAdvanced(a => !a)} disabled={busy}>
            {showAdvanced ? 'Hide options' : 'Options'}
          </button>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--js-fg-4)', fontWeight: 600, textAlign: 'right' }}>
          {quota && quota.monthlyUsed != null
            ? <>Quota {quota.monthlyUsed}/{quota.monthlyLimit} this month</>
            : <>Each reel carries one language only</>}
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
          {busy && <div className="clips-ok">⏳ {stage}</div>}
          {error && <div className="clips-warn">{error}</div>}
          {notices.map((n, i) => <div key={i} className="clips-warn">{n}</div>)}

          {rendered && (
            <div className="clips-panel" style={{ borderColor: 'var(--js-success)' }}>
              <h3>{rendered.reels.length} reel{rendered.reels.length === 1 ? '' : 's'} saved</h3>
              {rendered.reels.map(r => (
                <div key={r.lang} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid var(--js-border-subtle)' }}>
                  <span className="clips-chip on" style={{ cursor: 'default' }}>{r.name}</span>
                  <span className="clips-note" style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, flex: 1, minWidth: 240 }}>{r.video}</span>
                  <a className="clips-btn" href={r.downloadUrl} download style={{ textDecoration: 'none' }}>⬇ Download</a>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <button className="clips-btn ghost" onClick={copyJson}>Copy {LANG_NAMES[activeLang]} subtitles</button>
                {onOpenStudio && <button className="clips-btn ghost" onClick={sendToStudio}>Open in Subtitle Studio</button>}
              </div>
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
              <h3>The reel</h3>
              <div className="clips-total">
                <b style={{ color: inBand ? 'var(--js-success)' : 'var(--js-primary)' }}>{totalSecs.toFixed(1)}s</b>
                <span className="clips-note">
                  {kept.length} of {clips.length} clips kept + {TITLE_CARD_SEC}s title card · target {TARGET_MIN}–{TARGET_MAX}s
                  · × {langs.length} language{langs.length === 1 ? '' : 's'}
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
                <button className="clips-btn" onClick={exportOnly} disabled={busy || !kept.length || !langs.length}>
                  Export this selection
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
                  {activeLang === 'en'
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

                      <input className={activeLang === 'en' || activeLang === 'vi' ? '' : 'bn'}
                             value={c.translations[activeLang] || ''}
                             placeholder={`${LANG_NAMES[activeLang]} line`}
                             onChange={e => setField(c, 'translations', e.target.value)} />
                      <input className={activeLang === 'en' || activeLang === 'vi' ? '' : 'bn'}
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

          {clips.length === 0 && !error && !busy && (
            <div className="clips-panel">
              <h3>Paste a Japanese word, tick the languages, press once</h3>
              <p className="clips-note">
                One press searches Nadeshiko with a fresh random seed, keeps eight or nine clips that land in the
                30–40s band, translates, and renders <b>one reel per language</b> — each carrying that language
                and nothing else. Clips download once and are shared across every language, so four reels cost
                far less than four runs.
              </p>
              <p className="clips-note" style={{ marginTop: 8 }}>
                English is never machine translated: Nadeshiko ships human-written English subs with every clip.
                The free translator (MyMemory) needs no key and allows about four reels a day;
                Claude costs roughly two cents a reel and reads far better on slang.
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
