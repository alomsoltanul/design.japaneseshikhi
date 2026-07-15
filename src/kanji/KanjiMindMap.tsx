// Kanji Mind Map — interactive learning stage (1080×1350 portrait, scaled to fit).
// Ported from the design handoff prototype (Kanji Mind Map Final.dc.html).
import { useCallback, useEffect, useRef, useState } from 'react'
import type { KanjiEntry } from './types'
import { KanjiSfx } from './sfx'
import { loadLearned, saveLearned } from './kanjiStore'
import { KANJI_THEMES, type KanjiTheme } from './themes'

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
export const HUB = { x: 540, y: 700 }
export const PTS: [number, number][] = [
  [693, 303], [910, 535], [910, 865], [693, 1097],
  [387, 1097], [170, 865], [170, 535], [387, 303],
]

export function toBn(n: number | string): string {
  return String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[+d])
}

const FBN_UI = "600 14px 'Noto Sans Bengali', 'Inter', sans-serif"

interface Props {
  entry: KanjiEntry
  secondsPerWord?: number
  sfxVolume?: number
  theme?: KanjiTheme
}

type Phase = 'explore' | 'quiz'
interface Feedback { i: number; ok: boolean }

export function KanjiMindMap({ entry, secondsPerWord = 3, sfxVolume = 0.7, theme = KANJI_THEMES.light }: Props) {
  const T = theme
  const [step, setStep] = useState(0)
  const [mode, setMode] = useState<'step' | 'auto'>('step')
  const [playing, setPlaying] = useState(false)
  const [recording, setRecording] = useState(false)
  const [scale, setScale] = useState(0.5)
  const [pulse, setPulse] = useState(-1)
  const [selected, setSelected] = useState(-1)
  const [learned, setLearned] = useState<number[]>([])
  const [phase, setPhase] = useState<Phase>('explore')
  const [quizOrder, setQuizOrder] = useState<number[]>([])
  const [quizIdx, setQuizIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [fb, setFb] = useState<Feedback | null>(null)

  const wrapRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | null>(null)
  const sfxRef = useRef<KanjiSfx | null>(null)
  if (!sfxRef.current) sfxRef.current = new KanjiSfx()
  sfxRef.current.volume = sfxVolume

  const stepRef = useRef(step); stepRef.current = step
  const playingRef = useRef(playing); playingRef.current = playing
  const recordingRef = useRef(recording); recordingRef.current = recording
  const paceRef = useRef(secondsPerWord); paceRef.current = secondsPerWord

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }, [])

  const advance = useCallback(() => {
    if (stepRef.current >= 10) return
    const n = stepRef.current + 1
    sfxRef.current!.stepSound(n)
    setStep(n)
    stepRef.current = n
    if (playingRef.current) {
      if (n < 10) {
        timerRef.current = window.setTimeout(advance, paceRef.current * 1000)
      } else {
        sfxRef.current!.chime()
        playingRef.current = false
        setPlaying(false)
      }
    }
  }, [])

  const startAuto = useCallback(() => {
    stopTimer()
    sfxRef.current!.ensure()
    setStep(0); stepRef.current = 0
    setPlaying(true); playingRef.current = true
    setSelected(-1)
    setPhase('explore')
    timerRef.current = window.setTimeout(advance, 900)
  }, [advance, stopTimer])

  // reset when the kanji changes
  useEffect(() => {
    stopTimer()
    setStep(0); stepRef.current = 0
    setPlaying(false); playingRef.current = false
    setSelected(-1); setPulse(-1); setFb(null)
    setPhase('explore'); setQuizOrder([]); setQuizIdx(0); setScore(0)
    setLearned(loadLearned(entry.id))
  }, [entry.id, stopTimer])

  // scale to fit
  useEffect(() => {
    const update = () => {
      if (recordingRef.current) {
        setScale(Math.max(Math.min((window.innerWidth - 16) / 1080, (window.innerHeight - 16) / 1350), 0.15))
        return
      }
      const w = wrapRef.current?.clientWidth ?? window.innerWidth
      const s = Math.min((w - 8) / 1080, (window.innerHeight - 250) / 1350, 1)
      setScale(Math.max(s, 0.15))
    }
    update()
    window.addEventListener('resize', update)
    const ro = wrapRef.current ? new ResizeObserver(update) : null
    if (wrapRef.current && ro) ro.observe(wrapRef.current)
    return () => { window.removeEventListener('resize', update); ro?.disconnect() }
  }, [recording])

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (recordingRef.current) {
          stopTimer()
          playingRef.current = false
          setRecording(false); setPlaying(false)
        } else {
          setSelected(-1)
        }
      } else if ((e.key === 'ArrowRight' || e.key === ' ') && !recordingRef.current) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return
        e.preventDefault()
        sfxRef.current!.ensure()
        advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, stopTimer])

  useEffect(() => () => stopTimer(), [stopTimer])

  const inQuiz = phase === 'quiz'
  const quizDone = inQuiz && quizOrder.length > 0 && quizIdx >= quizOrder.length
  const data = entry.compounds.slice(0, 8)

  const answer = (i: number) => {
    if (fb) return
    const target = quizOrder[quizIdx]
    if (i === target) {
      sfxRef.current!.correct(i)
      setFb({ i, ok: true })
      setScore(s => s + 1)
      window.setTimeout(() => {
        setFb(null)
        setQuizIdx(q => {
          const next = q + 1
          if (next >= quizOrder.length) sfxRef.current!.chime()
          return next
        })
      }, 750)
    } else {
      sfxRef.current!.buzz()
      setFb({ i, ok: false })
      window.setTimeout(() => setFb(null), 550)
    }
  }

  const nodeClick = (i: number) => {
    sfxRef.current!.ensure()
    if (inQuiz) { answer(i); return }
    sfxRef.current!.pop(i)
    setPulse(i); setSelected(i)
    window.setTimeout(() => setPulse(-1), 380)
  }

  const toggleLearned = () => {
    if (selected < 0) return
    setLearned(prev => {
      const at = prev.indexOf(selected)
      let next: number[]
      if (at >= 0) next = prev.filter(x => x !== selected)
      else { next = [...prev, selected]; sfxRef.current!.learned() }
      saveLearned(entry.id, next)
      return next
    })
  }

  const startQuiz = () => {
    sfxRef.current!.ensure()
    const order = [0, 1, 2, 3, 4, 5, 6, 7].sort(() => Math.random() - 0.5).slice(0, 5)
    setPhase('quiz'); setQuizOrder(order); setQuizIdx(0); setScore(0)
    setSelected(-1); setFb(null)
    setStep(10); stepRef.current = 10
  }

  const stepMode = mode === 'step'
  const sel = selected >= 0 ? data[selected] : null
  const selLearned = selected >= 0 && learned.includes(selected)
  const quizTarget = inQuiz && !quizDone && quizOrder.length > 0 ? data[quizOrder[quizIdx]] : null

  const seg = (active: boolean): React.CSSProperties => ({
    font: "600 13px 'Noto Sans Bengali', 'Inter', sans-serif",
    padding: '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
    background: active ? '#1D3557' : 'transparent', color: active ? '#fff' : '#374151',
    transition: 'background 180ms ease, color 180ms ease',
  })

  const cardShadow = T.glassy ? 'none' : '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)'
  const nodeShadow = T.glassy ? 'none' : '0 1px 2px 0 rgba(0,0,0,0.05)'
  const glassBlur = T.glassy ? 'blur(8px)' : undefined

  const stage = (
    <div style={{ position: 'absolute', inset: 0, background: T.stage, overflow: 'hidden' }}>
      <svg width="1080" height="1350" viewBox="0 0 1080 1350" style={{ position: 'absolute', inset: 0 }}>
        {data.map((_, i) => {
          const [x, y] = PTS[i]
          const vis = step >= i + 3
          return (
            <path key={i} d={`M${HUB.x} ${HUB.y} L${x} ${y}`} fill="none" stroke={T.connector} strokeWidth={1.5}
              style={{ strokeDasharray: 900, strokeDashoffset: vis ? 0 : 900, transition: 'stroke-dashoffset 600ms ease' }} />
          )
        })}
      </svg>

      {/* header */}
      <div style={{ position: 'absolute', top: 48, left: 64, right: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ font: "600 13px 'Inter', sans-serif", letterSpacing: '0.14em', textTransform: 'uppercase', color: T.sub }}>Kanji mind map</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ background: T.tealPill.bg, color: T.tealPill.text, border: `1px solid ${T.tealPill.border}`, fontFamily: "'Noto Sans Bengali', 'Inter', sans-serif", fontSize: 14, fontWeight: 700, padding: '6px 16px', borderRadius: 9999 }}>
            ⚡ {toBn(learned.length)}/{toBn(8)} শেখা হয়েছে
          </div>
          <div style={{ background: T.redPill.bg, color: T.redPill.text, border: `1px solid ${T.redPill.border}`, font: "700 14px 'Inter', sans-serif", padding: '6px 16px', borderRadius: 9999 }}>
            JLPT {entry.jlpt}
          </div>
        </div>
      </div>

      {/* hub */}
      <div style={{
        position: 'absolute', left: HUB.x, top: HUB.y, width: 330,
        transform: `translate(-50%,-50%) scale(${step >= 1 ? 1 : 0.6})`, opacity: step >= 1 ? 1 : 0,
        transition: `opacity 550ms ease, transform 550ms ${EASE}`,
      }}>
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 24, boxShadow: cardShadow, backdropFilter: glassBlur, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '30px 24px 26px' }}>
          <div style={{ font: "700 148px/1 'Noto Sans JP', sans-serif", color: T.heading }}>{entry.kanji}</div>
          <div style={{ font: "600 21px 'Inter', sans-serif", color: T.enStrong }}>{entry.meaningEn}</div>
          <div style={{ fontFamily: "'Noto Sans Bengali', sans-serif", fontSize: 18, color: T.bn }}>{entry.meaningBn}</div>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, alignItems: 'center',
            opacity: step >= 2 ? 1 : 0, transform: step >= 2 ? 'translateY(0)' : 'translateY(10px)',
            transition: `opacity 450ms ease, transform 450ms ${EASE}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.onPill.bg, border: `1px solid ${T.onPill.border}`, borderRadius: 9999, padding: '6px 16px' }}>
              <span style={{ font: "700 11px 'Inter', sans-serif", letterSpacing: '0.1em', color: T.onPill.text }}>音 ON</span>
              <span style={{ font: "500 17px 'Noto Sans JP', sans-serif", color: T.onPill.text }}>{entry.onYomi}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.kunPill.bg, border: `1px solid ${T.kunPill.border}`, borderRadius: 9999, padding: '6px 16px' }}>
              <span style={{ font: "700 11px 'Inter', sans-serif", letterSpacing: '0.1em', color: T.kunPill.text }}>訓 KUN</span>
              <span style={{ font: "500 17px 'Noto Sans JP', sans-serif", color: T.kunPill.text }}>{entry.kunYomi}</span>
            </div>
          </div>
        </div>
      </div>

      {/* spoke nodes */}
      {data.map((d, i) => {
        const [x, y] = PTS[i]
        const vis = step >= i + 3
        const pulsed = pulse === i
        const isLearned = learned.includes(i)
        let glow = 'none'
        if (fb && fb.i === i) glow = fb.ok ? '0 0 0 4px rgba(42,157,143,0.55)' : '0 0 0 4px rgba(230,57,70,0.55)'
        else if (selected === i && !inQuiz) glow = '0 0 0 3px rgba(230,57,70,0.25)'
        return (
          <div key={i} onClick={() => nodeClick(i)} style={{
            position: 'absolute', left: x, top: y, width: 208, borderRadius: 16, boxShadow: glow,
            transform: `translate(-50%,-50%) scale(${pulsed ? 1.09 : vis ? 1 : 0.7})`,
            opacity: vis ? 1 : 0, cursor: 'pointer',
            transition: `opacity 450ms ease ${vis ? '150ms' : '0ms'}, transform 450ms ${EASE} ${vis && !pulsed ? '150ms' : '0ms'}, box-shadow 200ms ease`,
          }}>
            <div className="kmm-node-card" style={{ position: 'relative', background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, boxShadow: nodeShadow, backdropFilter: glassBlur, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '16px 12px 14px', transition: 'box-shadow 250ms ease, transform 250ms ease' }}>
              <div style={{
                position: 'absolute', top: -9, right: -9, width: 24, height: 24, borderRadius: '50%',
                background: '#2A9D8F', color: '#fff', font: "700 13px/24px 'Inter', sans-serif", textAlign: 'center',
                opacity: isLearned ? 1 : 0, transform: isLearned ? 'scale(1)' : 'scale(0.4)',
                transition: `opacity 250ms ease, transform 300ms ${EASE}`,
              }}>✓</div>
              <div style={{ font: "700 30px/1.2 'Noto Sans JP', sans-serif", color: T.heading }}>{d.word}</div>
              <div style={{ font: "500 15px 'Noto Sans JP', sans-serif", color: T.kana }}>{d.kana}</div>
              <div style={{ font: "600 14px 'Inter', sans-serif", color: T.en, marginTop: 4 }}>{d.en}</div>
              <div style={{ fontFamily: "'Noto Sans Bengali', sans-serif", fontSize: 14, color: T.bn }}>{d.bn}</div>
            </div>
          </div>
        )
      })}

      {/* footer */}
      <div style={{ position: 'absolute', bottom: 44, left: 64, right: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <img src={T.logo} alt="Japanese Shikhi" style={{ height: 26 }} />
        <div style={{ fontFamily: "'Noto Sans Bengali', sans-serif", fontSize: 14, color: T.sub }}>প্রতিদিন একটি কাঞ্জি 🎌</div>
      </div>

      {/* detail popover */}
      {sel && !inQuiz && !recording && (
        <div style={{ position: 'absolute', left: 540, bottom: 104, transform: 'translateX(-50%)', width: 760, background: T.glassy ? 'rgba(20,18,42,0.88)' : T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 20, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', backdropFilter: glassBlur, padding: '22px 26px', display: 'flex', gap: 24, alignItems: 'center', zIndex: 5 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 150 }}>
            <div style={{ font: "700 58px/1.1 'Noto Sans JP', sans-serif", color: T.heading }}>{sel.word}</div>
            <div style={{ font: "500 17px 'Noto Sans JP', sans-serif", color: T.kana }}>{sel.kana}</div>
            <div style={{ font: "600 14px 'Inter', sans-serif", color: T.en }}>{sel.en}</div>
            <div style={{ fontFamily: "'Noto Sans Bengali', sans-serif", fontSize: 14, color: T.bn }}>{sel.bn}</div>
          </div>
          <div style={{ width: 1, alignSelf: 'stretch', background: T.connector }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <div style={{ font: "600 11px 'Inter', sans-serif", letterSpacing: '0.12em', textTransform: 'uppercase', color: T.sub }}>Example</div>
            <div style={{ font: "500 22px/1.5 'Noto Sans JP', sans-serif", color: T.enStrong }}>{sel.exampleJp}</div>
            <div style={{ fontFamily: "'Noto Sans Bengali', sans-serif", fontSize: 15, color: T.bn }}>{sel.exampleBn}</div>
            <button onClick={toggleLearned} style={{
              alignSelf: 'flex-start', marginTop: 6, font: FBN_UI,
              background: selLearned ? '#2A9D8F' : 'rgba(42,157,143,0.1)', color: selLearned ? '#fff' : '#2A9D8F',
              border: '1px solid rgba(42,157,143,0.35)', borderRadius: 10, padding: '8px 16px', cursor: 'pointer',
              transition: 'background 200ms ease, color 200ms ease',
            }}>
              {selLearned ? '✓ শেখা হয়েছে' : 'শিখেছি বলে চিহ্নিত করুন'}
            </button>
          </div>
          <button onClick={() => setSelected(-1)} style={{ position: 'absolute', top: 12, right: 14, background: 'transparent', border: 'none', font: "600 16px 'Inter', sans-serif", color: T.sub, cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* quiz panel */}
      {inQuiz && !quizDone && (
        <div style={{ position: 'absolute', left: 540, bottom: 104, transform: 'translateX(-50%)', width: 700, background: '#1D3557', borderRadius: 20, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', padding: '20px 26px', display: 'flex', alignItems: 'center', gap: 20, zIndex: 5, fontFamily: "'Noto Sans Bengali', 'Inter', sans-serif" }}>
          <div style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, fontWeight: 700, padding: '6px 12px', borderRadius: 9999, whiteSpace: 'nowrap' }}>
            কুইজ {toBn(Math.min(quizIdx + 1, 5))}/{toBn(5)}
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#fff', flex: 1 }}>
            কোন শব্দের অর্থ “{quizTarget?.bn}”? — ম্যাপে ট্যাপ করুন
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F4A261', whiteSpace: 'nowrap' }}>স্কোর {toBn(score)}/{toBn(5)}</div>
        </div>
      )}
      {quizDone && (
        <div style={{ position: 'absolute', left: 540, bottom: 104, transform: 'translateX(-50%)', width: 700, background: '#1D3557', borderRadius: 20, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 18, zIndex: 5, fontFamily: "'Noto Sans Bengali', 'Inter', sans-serif" }}>
          <div style={{ fontSize: 21, fontWeight: 700, color: '#fff', flex: 1 }}>
            🎉 কুইজ শেষ! স্কোর {toBn(score)}/{toBn(5)} · ⚡ +{toBn(score * 10)} XP
          </div>
          <button onClick={startQuiz} style={{ font: FBN_UI, background: '#E63946', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px', cursor: 'pointer' }}>↻ আবার কুইজ</button>
          <button onClick={() => { setPhase('explore'); setFb(null) }} style={{ font: FBN_UI, background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px', cursor: 'pointer' }}>শেষ</button>
        </div>
      )}
    </div>
  )

  return (
    <div ref={wrapRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <style>{`.kmm-node-card:hover { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1) !important; transform: translateY(-2px); }`}</style>
      <div style={recording
        ? { position: 'fixed', inset: 0, zIndex: 1000, background: T.glassy || T.id === 'slate' ? '#06070d' : '#EEF0F4', display: 'flex', alignItems: 'center', justifyContent: 'center' }
        : { width: 1080 * scale, height: 1350 * scale, position: 'relative' }}>
        <div style={{
          position: recording ? 'relative' : 'absolute', left: 0, top: 0, width: 1080, height: 1350,
          transform: `scale(${scale})`, transformOrigin: recording ? 'center center' : 'top left',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', flexShrink: 0,
        }}>
          {stage}
        </div>
      </div>

      {/* control bar */}
      {!recording && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center', background: '#FFFFFF', border: '1px solid #F3F4F6', borderRadius: 16, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)', padding: '10px 14px', marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#F3F4F6', borderRadius: 12, padding: 4 }}>
            <button style={seg(stepMode)} onClick={() => { stopTimer(); playingRef.current = false; setMode('step'); setPlaying(false) }}>ধাপে ধাপে</button>
            <button style={seg(!stepMode)} onClick={() => setMode('auto')}>অটো</button>
          </div>
          <button
            onClick={() => {
              sfxRef.current!.ensure()
              if (stepMode) advance()
              else if (playingRef.current) { stopTimer(); playingRef.current = false; setPlaying(false) }
              else startAuto()
            }}
            style={{ font: FBN_UI, background: '#E63946', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', cursor: 'pointer' }}
          >
            {stepMode ? (step >= 10 ? 'শেষ ✓' : 'পরের শব্দ →') : (playing ? '⏸ থামান' : '▶ চালান')}
          </button>
          {step >= 10 && !inQuiz && (
            <button onClick={startQuiz} style={{ font: FBN_UI, background: '#1D3557', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 18px', cursor: 'pointer' }}>🎯 কুইজ</button>
          )}
          <button
            onClick={() => {
              stopTimer(); sfxRef.current!.ensure()
              setPhase('explore'); setSelected(-1); setFb(null)
              if (mode === 'auto') startAuto()
              else { setStep(0); stepRef.current = 0; playingRef.current = false; setPlaying(false) }
            }}
            style={{ font: "600 13px 'Noto Sans Bengali', 'Inter', sans-serif", background: 'transparent', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 12, padding: '9px 14px', cursor: 'pointer' }}
          >↻ আবার</button>
          <button
            onClick={() => {
              sfxRef.current!.ensure()
              setSelected(-1); setPhase('explore'); setFb(null)
              setRecording(true); recordingRef.current = true
              window.setTimeout(startAuto, 50)
            }}
            style={{ font: "600 13px 'Noto Sans Bengali', 'Inter', sans-serif", background: 'transparent', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 12, padding: '9px 14px', cursor: 'pointer' }}
          >🎥 রেকর্ডিং মোড</button>
          <div style={{ font: "600 13px 'Inter', sans-serif", color: '#6B7280', minWidth: 52, textAlign: 'center' }}>{toBn(step)} / {toBn(10)}</div>
        </div>
      )}
      {recording && (
        <div style={{ position: 'fixed', bottom: 8, left: 0, right: 0, textAlign: 'center', fontSize: 12, color: '#9CA3AF', zIndex: 1001, fontFamily: "'Noto Sans Bengali', sans-serif" }}>
          Esc — রেকর্ডিং মোড বন্ধ করুন
        </div>
      )}
    </div>
  )
}
