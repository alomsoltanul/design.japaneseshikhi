import { useCallback, useEffect, useMemo, useState } from 'react'
import { LEVELS, panelsOf, hasPanels, type LevelFile, type LevelQuestion } from './levels'
import { getMergedLevel, addPasted, clearPasted, getPasted, countQuestions } from './content'
import { ExportStage, type ExportJob } from './ExportStage'
import { ReelButton } from './ReelButton'
import { loadVoiceSettings, saveVoiceSettings, DEFAULT_VOICE, applyJlptPreset, type VoiceSettings } from './reel/voiceSettings'
import { listVoices } from './reel/voices'
import { reelEnvBlocked } from '@/listening/voicevox'
import { loadImageMap, addUpload, clearUploads, uploadedNames, resolveImage } from './imageStore'

const BRAND = '#E63946'
const CARD = 'rgba(255,255,255,0.045)'
const LINE = 'rgba(255,255,255,0.10)'

interface Speaker { name: string; styles: { id: number; name: string }[] }

export function ContentFactory() {
  const [level, setLevel] = useState('N5')
  const [file, setFile] = useState<LevelFile | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [testNo, setTestNo] = useState(1)
  const [mondaiNo, setMondaiNo] = useState(1)
  const [job, setJob] = useState<ExportJob | null>(null)
  const [busyQ, setBusyQ] = useState<number | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [panel, setPanel] = useState<'none' | 'upload' | 'paste' | 'voice'>('none')

  const [pasteText, setPasteText] = useState('')
  const [pasteMsg, setPasteMsg] = useState<string | null>(null)
  const pastedCount = useMemo(() => countQuestions(getPasted(level)), [level, reloadKey])

  // uploaded images (IndexedDB)
  const [imgReady, setImgReady] = useState(false)
  const [imgVersion, setImgVersion] = useState(0)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)
  useEffect(() => { loadImageMap().then(() => setImgReady(true)) }, [])
  const uploaded = useMemo(() => uploadedNames(), [imgVersion, imgReady])

  const [voice, setVoice] = useState<VoiceSettings>(DEFAULT_VOICE)
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const reelsLocalOnly = useMemo(() => reelEnvBlocked(), [])

  useEffect(() => { setVoice(loadVoiceSettings()) }, [])
  useEffect(() => {
    if (panel === 'voice' && speakers.length === 0) listVoices().then(setSpeakers).catch(() => {})
  }, [panel, speakers.length])

  const updateVoice = (patch: Partial<VoiceSettings>) =>
    setVoice(v => { const next = { ...v, ...patch }; saveVoiceSettings(next); return next })

  useEffect(() => {
    let cancelled = false
    setLoading(true); setErr(null); setFile(null)
    getMergedLevel(level)
      .then(f => {
        if (cancelled) return
        setFile(f)
        // Keep the current selection if it still exists (e.g. after a paste),
        // otherwise fall back to the first test/mondai.
        const t = f.tests.find(x => x.test_number === testNo) ?? f.tests[0]
        setTestNo(t?.test_number ?? 1)
        const p = t?.problems.find(x => x.mondai_number === mondaiNo) ?? t?.problems[0]
        setMondaiNo(p?.mondai_number ?? 1)
      })
      .catch(e => !cancelled && setErr((e as Error).message))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, reloadKey])

  const test = useMemo(() => file?.tests.find(t => t.test_number === testNo) ?? file?.tests[0], [file, testNo])
  const problem = useMemo(() => test?.problems.find(p => p.mondai_number === mondaiNo) ?? test?.problems[0], [test, mondaiNo])
  const questions = problem?.questions ?? []

  const onPaste = useCallback(() => {
    setPasteMsg(null)
    try {
      const f = addPasted(level, pasteText)
      setPasteText('')
      // Jump to the pasted content so it's immediately visible.
      const t = f.tests[0]
      if (t) { setTestNo(t.test_number); setMondaiNo(t.problems[0]?.mondai_number ?? 1) }
      setReloadKey(k => k + 1)
      setPanel('none')
      setPasteMsg(`✓ Added. Showing ${t?.test_number === 99 ? '“Pasted”' : `Test ${t?.test_number}`}. ${countQuestions(f)} pasted question(s).`)
    } catch (e) { setPasteMsg(`✗ ${(e as Error).message}`) }
  }, [level, pasteText])

  const onClearPasted = useCallback(() => { clearPasted(level); setReloadKey(k => k + 1); setPasteMsg('Cleared pasted content.') }, [level])

  const onUploadJson = useCallback(async (f: File) => {
    setPasteMsg(null)
    try {
      const text = await f.text()
      const merged = addPasted(level, text)
      const t = merged.tests[0]
      if (t) { setTestNo(t.test_number); setMondaiNo(t.problems[0]?.mondai_number ?? 1) }
      setReloadKey(k => k + 1)
      setPasteMsg(`✓ Loaded ${f.name}. ${countQuestions(merged)} question(s) added.`)
    } catch (e) { setPasteMsg(`✗ ${(e as Error).message}`) }
  }, [level])

  const onUploadImages = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (!arr.length) return
    for (const f of arr) await addUpload(f)
    setImgVersion(v => v + 1)
    setUploadMsg(`✓ ${arr.length} image(s) added (${uploadedNames().length} total).`)
  }, [])

  const onClearUploads = useCallback(async () => {
    await clearUploads()
    setImgVersion(v => v + 1)
    setUploadMsg('Cleared all uploaded images.')
  }, [])

  // image filenames referenced by the current level, and which are missing from uploads + repo
  const referenced = useMemo(() => {
    const names = new Set<string>()
    for (const t of file?.tests ?? [])
      for (const p of t.problems)
        for (const qn of p.questions) {
          if (qn.image_file) names.add(qn.image_file)
          for (const o of qn.options) if (o.image) names.add(o.image)
        }
    return [...names]
  }, [file])
  const notUploaded = useMemo(() => referenced.filter(n => !uploaded.includes(n)), [referenced, uploaded])

  const startExport = useCallback((qn: number) => {
    const question = problem?.questions.find(x => x.question_number === qn)
    if (!question || !test || !problem) return
    setBusyQ(qn); setErr(null)
    setJob({ question, level, test: test.test_number, mondai: problem.mondai_number })
  }, [problem, test, level])

  const studioUrl = (qn: number) =>
    `/listening/studio?level=${level}&test=${test?.test_number ?? 1}&mondai=${problem?.mondai_number ?? 1}&question=${qn}&scene=question`

  const sel: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: `1px solid ${LINE}`, color: '#fff', borderRadius: 9, padding: '8px 12px', fontSize: 14 }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 24px 48px', color: '#fff' }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, rgba(230,57,70,0.16), rgba(230,57,70,0.02))`, border: `1px solid ${LINE}`, borderRadius: 18, padding: '22px 24px', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.01em' }}>JLPT Listening Studio</span>
          <span style={{ background: '#10b981', fontSize: 11, fontWeight: 800, padding: '4px 11px', borderRadius: 999 }}>Offline · Free</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Toggle active={panel === 'upload'} onClick={() => setPanel(panel === 'upload' ? 'none' : 'upload')}>📤 Upload</Toggle>
            <Toggle active={panel === 'paste'} onClick={() => setPanel(panel === 'paste' ? 'none' : 'paste')}>📋 Paste JSON</Toggle>
            <Toggle active={panel === 'voice'} onClick={() => setPanel(panel === 'voice' ? 'none' : 'voice')}>🎙 Voice</Toggle>
          </div>
        </div>
        <div style={{ fontSize: 13, opacity: 0.65, marginTop: 8 }}>
          <b>Upload</b> your Claude JSON + images → questions and images appear → build a voiced MP4 reel (saved to your PC). No database; images stay in your browser.
        </div>
        {reelsLocalOnly && (
          <div style={{ marginTop: 12, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 10, padding: '9px 13px', fontSize: 12.5 }}>
            ⚠ <b>Reels are local-only.</b> This live site can’t reach your VOICEVOX. Slides & Studio work here; for MP4 reels run <code>npm run dev</code> and open <code>http://localhost:5173/listening</code>.
          </div>
        )}
      </div>

      {/* Level pills + selectors */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: 5 }}>
          {LEVELS.map(l => (
            <button key={l} onClick={() => { setLevel(l); setVoice(applyJlptPreset(l)) }} style={{ background: level === l ? BRAND : 'transparent', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 15px', fontWeight: 800, cursor: 'pointer', fontSize: 14 }}>{l}</button>
          ))}
        </div>
        <select value={testNo} onChange={e => setTestNo(Number(e.target.value))} style={sel} disabled={!file}>
          {file?.tests.map(t => <option key={t.test_number} value={t.test_number}>{t.test_number === 99 ? '📋 Pasted' : `Test ${t.test_number}`}</option>)}
        </select>
        <select value={mondaiNo} onChange={e => setMondaiNo(Number(e.target.value))} style={sel} disabled={!test}>
          {test?.problems.map(p => <option key={p.mondai_number} value={p.mondai_number}>もんだい{p.mondai_number} · {p.problem_title_en}</option>)}
        </select>
        {loading && <span style={{ fontSize: 13, opacity: 0.6 }}>Loading…</span>}
        <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.55 }}>{questions.length} question{questions.length === 1 ? '' : 's'}</span>
      </div>

      {/* Upload panel */}
      {panel === 'upload' && (
        <Panel title={`Upload content → ${level}`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
            <div style={{ minWidth: 240 }}>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>1. Claude JSON file</div>
              <label style={{ display: 'inline-block', background: BRAND, color: '#fff', borderRadius: 9, padding: '9px 18px', fontWeight: 800, cursor: 'pointer' }}>
                Choose .json
                <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onUploadJson(f); e.currentTarget.value = '' }} />
              </label>
            </div>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>2. Images (drag in, or choose — names must match the JSON)</div>
              <label
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) onUploadImages(e.dataTransfer.files) }}
                style={{ display: 'block', border: `2px dashed ${LINE}`, borderRadius: 10, padding: '18px', textAlign: 'center', cursor: 'pointer', fontSize: 13, opacity: 0.85 }}
              >
                Drag & drop images here, or click to choose
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { if (e.target.files) onUploadImages(e.target.files); e.currentTarget.value = '' }} />
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, opacity: 0.7 }}>{uploaded.length} image(s) uploaded</span>
            {uploaded.length > 0 && <button onClick={onClearUploads} style={{ ...sel, cursor: 'pointer' }}>Clear images</button>}
            {uploadMsg && <span style={{ fontSize: 12.5, color: uploadMsg.startsWith('✗') ? BRAND : '#10b981' }}>{uploadMsg}</span>}
          </div>
          {notUploaded.length > 0 && (
            <div style={{ fontSize: 12, marginTop: 10, color: '#f59e0b' }}>
              Referenced by JSON but not uploaded ({notUploaded.length}): {notUploaded.join(', ')}
              <span style={{ opacity: 0.6 }}> — upload these, or place them in public/jsonfileImages/.</span>
            </div>
          )}
          {uploaded.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {uploaded.map(n => <span key={n} style={{ fontSize: 11, background: 'rgba(16,185,129,0.14)', color: '#34d399', padding: '3px 9px', borderRadius: 999 }}>{n}</span>)}
            </div>
          )}
        </Panel>
      )}

      {/* Paste panel */}
      {panel === 'paste' && (
        <Panel title={`Paste JSON → ${level}`}>
          <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
            placeholder="Paste a question, an array of questions, a problem, a test, or a full level file…"
            style={{ ...sel, width: '100%', minHeight: 110, fontFamily: 'monospace', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <button onClick={onPaste} disabled={!pasteText.trim()} style={{ background: BRAND, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 20px', fontWeight: 800, cursor: pasteText.trim() ? 'pointer' : 'not-allowed', opacity: pasteText.trim() ? 1 : 0.5 }}>Add to {level}</button>
            {pastedCount > 0 && <button onClick={onClearPasted} style={{ ...sel, cursor: 'pointer' }}>Clear pasted ({pastedCount})</button>}
            {pasteMsg && <span style={{ fontSize: 12.5, color: pasteMsg.startsWith('✗') ? BRAND : '#10b981' }}>{pasteMsg}</span>}
          </div>
        </Panel>
      )}

      {/* Voice panel */}
      {panel === 'voice' && (
        <Panel title="Voice settings (saved automatically)">
          {/* Full VOICEVOX slider set — same order as the VOICEVOX app:
              話速 / 音高 / 抑揚 / 音量 / 間の長さ / 開始無音 / 終了無音 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
            <Slider label={`Speed (話速) ${voice.speed.toFixed(2)}×`} min={0.5} max={1.6} step={0.01} value={voice.speed} onChange={v => updateVoice({ speed: v })} />
            <Slider label={`Pitch (音高) ${voice.pitch >= 0 ? '+' : ''}${voice.pitch.toFixed(2)}`} min={-0.15} max={0.15} step={0.01} value={voice.pitch} onChange={v => updateVoice({ pitch: v })} />
            <Slider label={`Intonation (抑揚) ${voice.intonation.toFixed(2)}`} min={0} max={1.6} step={0.05} value={voice.intonation} onChange={v => updateVoice({ intonation: v })} />
            <Slider label={`Volume (音量) ${voice.volume.toFixed(2)}`} min={0.6} max={2} step={0.05} value={voice.volume} onChange={v => updateVoice({ volume: v })} />
            <Slider label={`Pause length (間の長さ) ${voice.pauseScale.toFixed(2)}×`} min={0.5} max={2} step={0.05} value={voice.pauseScale} onChange={v => updateVoice({ pauseScale: v })} />
            <Slider label={`Start silence (開始無音) ${voice.prePadding.toFixed(2)}s`} min={0} max={0.6} step={0.01} value={voice.prePadding} onChange={v => updateVoice({ prePadding: v })} />
            <Slider label={`End silence (終了無音) ${voice.postPadding.toFixed(2)}s`} min={0} max={0.8} step={0.01} value={voice.postPadding} onChange={v => updateVoice({ postPadding: v })} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 12 }}>
            <Slider label={`Gap between lines ${voice.gapSeconds.toFixed(2)}s`} min={0} max={1.2} step={0.05} value={voice.gapSeconds} onChange={v => updateVoice({ gapSeconds: v })} />
            <Slider label={`Think time ${voice.thinkSeconds}s`} min={2} max={10} step={1} value={voice.thinkSeconds} onChange={v => updateVoice({ thinkSeconds: v })} />
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 10 }}>
            Pause length stretches 、/。 pauses inside a line. Picking a JLPT level above resets these to exam pacing
            (N5 0.88× → N3 1.00× → N1 1.05×); tune freely after.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 14 }}>
            {(['narrator', 'female', 'male'] as const).map(role => (
              <label key={role} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, textTransform: 'capitalize' }}>{role} voice
                <select value={voice[role] ?? ''} onChange={e => updateVoice({ [role]: e.target.value ? Number(e.target.value) : null } as Partial<VoiceSettings>)} style={sel}>
                  <option value="">Auto</option>
                  {speakers.flatMap(s => s.styles.map(st => <option key={`${s.name}-${st.id}`} value={st.id}>{s.name} · {st.name}</option>))}
                </select>
              </label>
            ))}
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 10 }}>
            {speakers.length ? `${speakers.length} VOICEVOX voices loaded.` : 'Open VOICEVOX (local) to load voices. "Auto" picks sensible defaults.'}
          </div>
        </Panel>
      )}

      {err && <div style={{ background: 'rgba(230,57,70,0.13)', border: '1px solid rgba(230,57,70,0.4)', borderRadius: 10, padding: '11px 15px', fontSize: 13, marginBottom: 14 }}>{err}</div>}
      {!loading && !err && questions.length === 0 && <div style={{ fontSize: 13, opacity: 0.6, padding: '20px 0' }}>No questions here. Paste JSON or add to the level file.</div>}

      {/* Question cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {questions.map(qq => {
          const correct = qq.options.find(o => o.id === qq.correct_option_id)
          return (
            <div key={qq.question_number} style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 16, padding: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
              <Thumb q={qq} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 900, color: BRAND, fontSize: 13 }}>Q{qq.question_number}</span>
                  <span style={{ fontSize: 16.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{qq.question_text}</span>
                </div>
                {qq.question_text_en && <div style={{ fontSize: 12.5, opacity: 0.5, marginTop: 2 }}>{qq.question_text_en}</div>}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, background: 'rgba(16,185,129,0.14)', color: '#34d399', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>✓ {correct?.text}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a href={studioUrl(qq.question_number)} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#fff', textDecoration: 'none', border: `1px solid ${LINE}`, borderRadius: 9, padding: '8px 14px' }}>Studio ↗</a>
                  <button onClick={() => startExport(qq.question_number)} disabled={busyQ != null} style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: `1px solid ${LINE}`, borderRadius: 9, padding: '8px 14px', fontWeight: 700, cursor: busyQ != null ? 'progress' : 'pointer', whiteSpace: 'nowrap', opacity: busyQ != null && busyQ !== qq.question_number ? 0.5 : 1 }}>
                    {busyQ === qq.question_number ? 'Exporting…' : '🖼 Slides ZIP'}
                  </button>
                </div>
                <ReelButton question={qq} level={level} test={test?.test_number ?? 1} mondai={problem?.mondai_number ?? 1} settings={voice} />
              </div>
            </div>
          )
        })}
      </div>

      <ExportStage job={job} onDone={e => { if (e) setErr(`Export failed: ${e}`); setBusyQ(null); setJob(null) }} />
    </div>
  )
}

function Thumb({ q }: { q: LevelQuestion }) {
  const [failed, setFailed] = useState(false)
  const size = 84
  const singleUrl = resolveImage(q.image_file)
  // reset the error flag when the resolved URL changes (e.g. after an upload)
  useEffect(() => setFailed(false), [singleUrl])
  // 2x2 per-option image grid
  if (hasPanels(q)) {
    return (
      <div style={{ width: size, height: size, borderRadius: 12, background: '#fff', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, padding: 2, flex: 'none' }}>
        {panelsOf(q).map(p => (
          <div key={p.id} style={{ background: '#fff', border: p.correct ? '2px solid #e63946' : '1px solid #eee', borderRadius: 5, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {p.url ? <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ color: '#333', fontSize: 11, fontWeight: 800 }}>{p.id}</span>}
          </div>
        ))}
      </div>
    )
  }
  if (singleUrl && !failed) {
    return <img src={singleUrl} onError={() => setFailed(true)} alt="" style={{ width: size, height: size, objectFit: 'cover', borderRadius: 12, background: 'rgba(255,255,255,0.06)', flex: 'none' }} />
  }
  return (
    <div style={{ width: size, height: size, borderRadius: 12, background: 'rgba(255,255,255,0.05)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, padding: 8, flex: 'none' }}>
      {q.options.slice(0, 4).map(o => (
        <div key={o.id} style={{ background: o.id === q.correct_option_id ? 'rgba(230,57,70,0.5)' : 'rgba(255,255,255,0.10)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{o.id}</div>
      ))}
    </div>
  )
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ background: active ? BRAND : 'rgba(255,255,255,0.06)', color: '#fff', border: `1px solid ${active ? BRAND : LINE}`, borderRadius: 9, padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{children}</button>
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, opacity: 0.75, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}

function Slider({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, minWidth: 155 }}>
      {label}
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ accentColor: BRAND }} />
    </label>
  )
}

export default ContentFactory
