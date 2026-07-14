// Kanji Studio — pick a kanji, play the mind map, paste new kanji JSON,
// export the reveal animation as video (Reel 9:16 / FB 4:5 / YouTube 16:9).
import { useCallback, useEffect, useRef, useState } from 'react'
import { KanjiMindMap } from './KanjiMindMap'
import { addPasted, loadLibrary, removeCustom, type KanjiLibrary } from './kanjiStore'
import { CLAUDE_PROMPT_TEMPLATE, type KanjiEntry } from './types'
import { buildKanjiVideo, KANJI_ASPECTS, type KanjiAspect, type KanjiVideoProgress } from './renderKanjiVideo'

const PREFS_KEY = 'js-kanji-studio-prefs-v1'

interface Prefs {
  aspect: KanjiAspect
  secondsPerWord: number
  sfxVolume: number
  kanjiId?: string
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) return { aspect: 'reel', secondsPerWord: 2, sfxVolume: 0.7, ...JSON.parse(raw) }
  } catch { /* defaults */ }
  return { aspect: 'reel', secondsPerWord: 2, sfxVolume: 0.7 }
}

export function KanjiStudio() {
  const [lib, setLib] = useState<KanjiLibrary | null>(null)
  const [loadError, setLoadError] = useState('')
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteMsg, setPasteMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [building, setBuilding] = useState(false)
  const [prog, setProg] = useState<KanjiVideoProgress | null>(null)
  const [result, setResult] = useState<{ url: string; ext: string; durationSec: number; aspect: KanjiAspect } | null>(null)
  const [buildError, setBuildError] = useState('')
  const resultUrlRef = useRef<string | null>(null)

  const refresh = useCallback(() => {
    loadLibrary()
      .then(setLib)
      .catch(e => setLoadError(e instanceof Error ? e.message : String(e)))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  }, [prefs])

  useEffect(() => () => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
  }, [])

  const entries = lib?.entries ?? []
  const entry: KanjiEntry | undefined =
    entries.find(e => e.id === prefs.kanjiId) ?? entries[0]

  const onPaste = () => {
    setPasteMsg(null)
    try {
      const added = addPasted(pasteText)
      setPasteText('')
      setPasteMsg({ ok: true, text: `Added ${added.map(e => e.kanji).join('、')} ✓` })
      refresh()
      if (added.length) setPrefs(p => ({ ...p, kanjiId: added[added.length - 1].id }))
    } catch (e) {
      setPasteMsg({ ok: false, text: e instanceof Error ? e.message : String(e) })
    }
  }

  const onExport = async () => {
    if (!entry || building) return
    setBuilding(true)
    setBuildError('')
    setResult(null)
    if (resultUrlRef.current) { URL.revokeObjectURL(resultUrlRef.current); resultUrlRef.current = null }
    try {
      const r = await buildKanjiVideo(entry, {
        aspect: prefs.aspect,
        secondsPerWord: prefs.secondsPerWord,
        sfxVolume: prefs.sfxVolume,
      }, setProg)
      const url = URL.createObjectURL(r.video)
      resultUrlRef.current = url
      setResult({ url, ext: r.ext, durationSec: r.durationSec, aspect: prefs.aspect })
    } catch (e) {
      setBuildError(e instanceof Error ? e.message : String(e))
    } finally {
      setBuilding(false)
      setProg(null)
    }
  }

  const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }
  const panel: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 16 }

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg-body)' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 24px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>🧠 Kanji Mind Map</h1>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>One kanji, eight words — animated map, quiz, and social video export.</span>
        </div>

        {loadError && <div style={{ color: 'var(--accent-red)', marginBottom: 14 }}>{loadError}</div>}

        {/* kanji picker */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          {entries.map(e => {
            const active = entry?.id === e.id
            const custom = lib?.customIds.has(e.id)
            return (
              <div key={e.id} style={{ position: 'relative' }}>
                <button
                  onClick={() => setPrefs(p => ({ ...p, kanjiId: e.id }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 12, cursor: 'pointer',
                    border: `1px solid ${active ? 'var(--accent-red)' : 'var(--border-color)'}`,
                    background: active ? 'rgba(230,57,70,0.12)' : 'var(--bg-card)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 22, fontWeight: 700 }}>{e.kanji}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.jlpt}{custom ? ' · pasted' : ''}</span>
                </button>
                {custom && (
                  <button
                    title="Remove pasted kanji"
                    onClick={() => { removeCustom(e.id); refresh(); if (prefs.kanjiId === e.id) setPrefs(p => ({ ...p, kanjiId: undefined })) }}
                    style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'var(--accent-red)', color: '#fff', fontSize: 10, cursor: 'pointer', lineHeight: '18px', padding: 0 }}
                  >✕</button>
                )}
              </div>
            )
          })}
          <button
            onClick={() => setPasteOpen(o => !o)}
            style={{ padding: '8px 14px', borderRadius: 12, cursor: 'pointer', border: '1px dashed var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}
          >
            ＋ Paste kanji JSON
          </button>
        </div>

        {/* paste panel */}
        {pasteOpen && (
          <div style={{ ...panel, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <div style={label}>Paste kanji entry JSON (single object, array, or {'{ "kanji": [...] }'})</div>
              <button
                onClick={() => { navigator.clipboard.writeText(CLAUDE_PROMPT_TEMPLATE).then(() => setPasteMsg({ ok: true, text: 'Claude prompt copied — replace 「◯◯」 with your kanji.' })) }}
                style={{ padding: '6px 12px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}
              >📋 Copy Claude prompt</button>
            </div>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder='{"kanji":"山","onYomi":"サン","kunYomi":"やま","meaningEn":"mountain","meaningBn":"পাহাড়","jlpt":"N5","compounds":[ …8 items… ]}'
              style={{ width: '100%', minHeight: 130, resize: 'vertical', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 10, color: 'var(--text-primary)', padding: 12, fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5 }}
            />
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 10 }}>
              <button onClick={onPaste} disabled={!pasteText.trim()} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'var(--accent-red)', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: pasteText.trim() ? 1 : 0.5 }}>
                Add to library
              </button>
              {pasteMsg && <span style={{ fontSize: 13, color: pasteMsg.ok ? 'var(--accent-teal)' : 'var(--accent-red)' }}>{pasteMsg.text}</span>}
            </div>
          </div>
        )}

        {/* export controls */}
        <div style={{ ...panel, display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <div style={{ ...label, marginBottom: 6 }}>Video format</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {KANJI_ASPECTS.map(a => (
                <button
                  key={a.id}
                  onClick={() => setPrefs(p => ({ ...p, aspect: a.id }))}
                  title={a.size}
                  style={{
                    padding: '8px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
                    border: `1px solid ${prefs.aspect === a.id ? 'var(--accent-teal)' : 'var(--border-color)'}`,
                    background: prefs.aspect === a.id ? 'rgba(42,157,143,0.14)' : 'var(--bg-input)',
                    color: prefs.aspect === a.id ? 'var(--accent-teal)' : 'var(--text-secondary)',
                  }}
                >{a.label}<span style={{ opacity: 0.6, marginLeft: 6, fontWeight: 400 }}>{a.size}</span></button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ ...label, marginBottom: 6 }}>Seconds per word · {prefs.secondsPerWord}s</div>
            <input type="range" min={1} max={8} step={0.5} value={prefs.secondsPerWord}
              onChange={e => setPrefs(p => ({ ...p, secondsPerWord: Number(e.target.value) }))} style={{ width: 160 }} />
          </div>
          <div>
            <div style={{ ...label, marginBottom: 6 }}>SFX volume · {Math.round(prefs.sfxVolume * 100)}%</div>
            <input type="range" min={0} max={1} step={0.1} value={prefs.sfxVolume}
              onChange={e => setPrefs(p => ({ ...p, sfxVolume: Number(e.target.value) }))} style={{ width: 140 }} />
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {building && prog && (
              <div style={{ minWidth: 180 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{prog.note ?? prog.stage}</div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round(prog.ratio * 100)}%`, background: 'var(--accent-teal)', transition: 'width 200ms ease' }} />
                </div>
              </div>
            )}
            <button
              onClick={onExport}
              disabled={building || !entry}
              style={{ padding: '11px 22px', borderRadius: 12, border: 'none', background: 'var(--accent-red)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: building ? 'wait' : 'pointer', opacity: building ? 0.6 : 1 }}
            >
              {building ? 'Rendering…' : '🎬 Export video'}
            </button>
          </div>
          {buildError && <div style={{ width: '100%', color: 'var(--accent-red)', fontSize: 13 }}>{buildError}</div>}
          {result && entry && (
            <div style={{ width: '100%', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
              <video src={result.url} controls style={{ maxHeight: 260, borderRadius: 10, background: '#000' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {entry.kanji} mind map · {KANJI_ASPECTS.find(a => a.id === result.aspect)?.size} · {result.durationSec.toFixed(1)}s · .{result.ext}
                </div>
                <a
                  href={result.url}
                  download={`kanji-mindmap-${entry.id}-${result.aspect}.${result.ext}`}
                  style={{ alignSelf: 'flex-start', padding: '9px 18px', borderRadius: 10, background: 'var(--accent-teal)', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}
                >⬇ Download</a>
              </div>
            </div>
          )}
        </div>

        {/* the mind map */}
        {entry && (
          <KanjiMindMap entry={entry} secondsPerWord={prefs.secondsPerWord} sfxVolume={prefs.sfxVolume} />
        )}
      </div>
    </div>
  )
}
