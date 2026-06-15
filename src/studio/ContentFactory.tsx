import { useCallback, useEffect, useMemo, useState } from 'react'
import { LEVELS, type LevelFile } from './levels'
import { getMergedLevel, addPasted, clearPasted, getPasted, countQuestions } from './content'
import { ExportStage, type ExportJob } from './ExportStage'
import { ReelButton } from './ReelButton'
import { loadVoiceSettings, saveVoiceSettings, DEFAULT_VOICE, type VoiceSettings } from './reel/voiceSettings'
import { listVoices } from './reel/voices'

const BRAND = '#E63946'

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

  // paste
  const [pasteText, setPasteText] = useState('')
  const [pasteMsg, setPasteMsg] = useState<string | null>(null)
  const pastedCount = useMemo(() => countQuestions(getPasted(level)), [level, reloadKey])

  // voice
  const [voice, setVoice] = useState<VoiceSettings>(DEFAULT_VOICE)
  const [showVoice, setShowVoice] = useState(false)
  const [speakers, setSpeakers] = useState<Speaker[]>([])

  useEffect(() => { setVoice(loadVoiceSettings()) }, [])
  useEffect(() => {
    if (showVoice && speakers.length === 0) listVoices().then(setSpeakers).catch(() => {})
  }, [showVoice, speakers.length])

  const updateVoice = (patch: Partial<VoiceSettings>) => {
    setVoice(v => { const next = { ...v, ...patch }; saveVoiceSettings(next); return next })
  }

  // load merged level
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr(null)
    setFile(null)
    getMergedLevel(level)
      .then(f => {
        if (cancelled) return
        setFile(f)
        setTestNo(f.tests[0]?.test_number ?? 1)
        setMondaiNo(f.tests[0]?.problems[0]?.mondai_number ?? 1)
      })
      .catch(e => !cancelled && setErr((e as Error).message))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [level, reloadKey])

  const test = useMemo(() => file?.tests.find(t => t.test_number === testNo) ?? file?.tests[0], [file, testNo])
  const problem = useMemo(() => test?.problems.find(p => p.mondai_number === mondaiNo) ?? test?.problems[0], [test, mondaiNo])
  const questions = problem?.questions ?? []

  const onPaste = useCallback(() => {
    setPasteMsg(null)
    try {
      const f = addPasted(level, pasteText)
      setPasteText('')
      setReloadKey(k => k + 1)
      setPasteMsg(`Added. ${countQuestions(f)} pasted question(s) now available for ${level}.`)
    } catch (e) {
      setPasteMsg(`✗ ${(e as Error).message}`)
    }
  }, [level, pasteText])

  const onClearPasted = useCallback(() => {
    clearPasted(level)
    setReloadKey(k => k + 1)
    setPasteMsg('Cleared pasted content for this level.')
  }, [level])

  const startExport = useCallback((q: number) => {
    const question = problem?.questions.find(x => x.question_number === q)
    if (!question || !test || !problem) return
    setBusyQ(q)
    setErr(null)
    setJob({ question, level, test: test.test_number, mondai: problem.mondai_number })
  }, [problem, test, level])

  const studioUrl = (q: number) =>
    `/listening/studio?level=${level}&test=${test?.test_number ?? 1}&mondai=${problem?.mondai_number ?? 1}&question=${q}&scene=question`

  const input: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: 14 }
  const sub = (t: string) => <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, margin: '4px 0 8px' }}>{t}</div>

  return (
    <div style={{ padding: 24, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 18, fontWeight: 800 }}>Content Factory</span>
        <span style={{ background: '#10b981', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>Offline · Free</span>
        <button onClick={() => setShowVoice(s => !s)} style={{ ...input, marginLeft: 'auto', cursor: 'pointer' }}>🎙 Voice settings {showVoice ? '▲' : '▼'}</button>
      </div>

      {/* Voice settings */}
      {showVoice && (
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 16, margin: '12px 0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
            <Slider label={`Speed ${voice.speed.toFixed(2)}×`} min={0.5} max={1.6} step={0.05} value={voice.speed} onChange={v => updateVoice({ speed: v })} />
            <Slider label={`Volume ${voice.volume.toFixed(2)}`} min={0.6} max={2} step={0.05} value={voice.volume} onChange={v => updateVoice({ volume: v })} />
            <Slider label={`Intonation ${voice.intonation.toFixed(2)}`} min={0} max={1.6} step={0.05} value={voice.intonation} onChange={v => updateVoice({ intonation: v })} />
            <Slider label={`Gap ${voice.gapSeconds.toFixed(2)}s`} min={0} max={1.2} step={0.05} value={voice.gapSeconds} onChange={v => updateVoice({ gapSeconds: v })} />
            <Slider label={`Think ${voice.thinkSeconds}s`} min={2} max={10} step={1} value={voice.thinkSeconds} onChange={v => updateVoice({ thinkSeconds: v })} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 14 }}>
            {(['narrator', 'female', 'male'] as const).map(role => (
              <label key={role} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, textTransform: 'capitalize' }}>
                {role} voice
                <select
                  value={voice[role] ?? ''}
                  onChange={e => updateVoice({ [role]: e.target.value ? Number(e.target.value) : null } as Partial<VoiceSettings>)}
                  style={input}
                >
                  <option value="">Auto</option>
                  {speakers.flatMap(s => s.styles.map(st => (
                    <option key={`${s.name}-${st.id}`} value={st.id}>{s.name} · {st.name}</option>
                  )))}
                </select>
              </label>
            ))}
          </div>
          <div style={{ fontSize: 11, opacity: 0.55, marginTop: 10 }}>
            {speakers.length ? `${speakers.length} VOICEVOX voices loaded.` : 'Open VOICEVOX to load the voice list. "Auto" picks sensible defaults.'} Settings are saved automatically.
          </div>
        </div>
      )}

      {/* Paste JSON */}
      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 16, margin: '8px 0 16px' }}>
        {sub(`Paste JSON → ${level} (generate without editing files)`)}
        <textarea
          value={pasteText}
          onChange={e => setPasteText(e.target.value)}
          placeholder='Paste a question, an array of questions, a problem, a test, or a full level file…'
          style={{ ...input, width: '100%', minHeight: 90, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
          <button onClick={onPaste} disabled={!pasteText.trim()} style={{ background: BRAND, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 800, cursor: pasteText.trim() ? 'pointer' : 'not-allowed', opacity: pasteText.trim() ? 1 : 0.5 }}>
            Add to {level}
          </button>
          {pastedCount > 0 && (
            <button onClick={onClearPasted} style={{ ...input, cursor: 'pointer' }}>Clear pasted ({pastedCount})</button>
          )}
          {pasteMsg && <span style={{ fontSize: 12, color: pasteMsg.startsWith('✗') ? BRAND : '#10b981' }}>{pasteMsg}</span>}
        </div>
      </div>

      {/* Selectors */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>Level
          <select value={level} onChange={e => setLevel(e.target.value)} style={input}>{LEVELS.map(l => <option key={l} value={l}>{l}</option>)}</select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>Test
          <select value={testNo} onChange={e => setTestNo(Number(e.target.value))} style={input} disabled={!file}>
            {file?.tests.map(t => <option key={t.test_number} value={t.test_number}>{t.test_number === 99 ? 'Pasted' : `Test ${t.test_number}`}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>Mondai
          <select value={mondaiNo} onChange={e => setMondaiNo(Number(e.target.value))} style={input} disabled={!test}>
            {test?.problems.map(p => <option key={p.mondai_number} value={p.mondai_number}>{p.mondai_number} · {p.problem_title_en}</option>)}
          </select>
        </label>
        {loading && <span style={{ fontSize: 13, opacity: 0.7 }}>Loading…</span>}
      </div>

      {err && <div style={{ background: 'rgba(230,57,70,0.15)', border: '1px solid rgba(230,57,70,0.4)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>{err}</div>}
      {!loading && !err && questions.length === 0 && <div style={{ fontSize: 13, opacity: 0.6 }}>No questions here yet. Paste JSON above or add to the level file.</div>}

      {questions.map(q => {
        const correct = q.options.find(o => o.id === q.correct_option_id)
        return (
          <div key={q.question_number} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 16px', marginBottom: 8 }}>
            <span style={{ fontWeight: 800, color: BRAND, width: 28 }}>Q{q.question_number}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.question_text}</div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>✓ {correct?.text}</div>
            </div>
            <a href={studioUrl(q.question_number)} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#fff', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '8px 14px' }}>Open Studio ↗</a>
            <button onClick={() => startExport(q.question_number)} disabled={busyQ != null} style={{ background: BRAND, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: busyQ != null ? 'progress' : 'pointer', whiteSpace: 'nowrap', opacity: busyQ != null && busyQ !== q.question_number ? 0.5 : 1 }}>
              {busyQ === q.question_number ? 'Exporting…' : 'Export Slides (ZIP)'}
            </button>
            <ReelButton question={q} level={level} test={test?.test_number ?? 1} mondai={problem?.mondai_number ?? 1} settings={voice} />
          </div>
        )
      })}

      <ExportStage job={job} onDone={e => { if (e) setErr(`Export failed: ${e}`); setBusyQ(null); setJob(null) }} />
    </div>
  )
}

function Slider({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, minWidth: 150 }}>
      {label}
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ accentColor: BRAND }} />
    </label>
  )
}

export default ContentFactory
