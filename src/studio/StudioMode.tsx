import { useCallback, useEffect, useState } from 'react'
import './studio.css'
import { findQuestion, panelsOf, hasPanels, type LevelQuestion } from './levels'
import { getMergedLevel } from './content'
import { loadImageMap, resolveImage } from './imageStore'

/* ════════════════════════════════════════════════════════════
   Studio Mode (chromeless 9:16 recording surface) — offline.
   /listening/studio?level=N5&test=1&mondai=1&question=2&scene=question
   Reads from public/jsonfileLevels/{level}.json. No API, no audio.
   Screen-record this page (or OBS) for a reel.
   Scenes: question → think → answer → feedback → outro
   Extras: &countdown=N  &autoplay=true&autoadvance=N
   ════════════════════════════════════════════════════════════ */

const SCENES = ['question', 'think', 'answer', 'feedback', 'outro'] as const
type Scene = (typeof SCENES)[number]

function readParams() {
  const p = new URLSearchParams(window.location.search)
  const scene = (SCENES as readonly string[]).includes(p.get('scene') || '')
    ? (p.get('scene') as Scene)
    : 'question'
  return {
    level: (p.get('level') || 'N5').toUpperCase(),
    test: Number(p.get('test') || 1),
    mondai: Number(p.get('mondai') || 1),
    question: Number(p.get('question') || 1),
    scene,
    countdown: Number(p.get('countdown') || 5),
    autoplay: p.get('autoplay') === 'true',
    autoadvance: Number(p.get('autoadvance') || 6),
  }
}

/** Short pleasant chime via WebAudio (no asset needed). */
function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const now = ctx.currentTime
    for (const [i, freq] of [659.25, 987.77].entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = now + i * 0.12
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.4)
    }
  } catch {
    /* autoplay restrictions — ignore */
  }
}

export function StudioMode() {
  const [params, setParams] = useState(readParams)
  const [data, setData] = useState<LevelQuestion | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const sceneIdx = SCENES.indexOf(params.scene)

  // Load uploaded images + the question (images first so the grid resolves).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await loadImageMap()
      try {
        const f = await getMergedLevel(params.level)
        if (cancelled) return
        const q = findQuestion(f, params.test, params.mondai, params.question)
        if (!q) throw new Error(`Q${params.question} not found in ${params.level} test ${params.test} mondai ${params.mondai}`)
        setData(q)
        setErr(null)
      } catch (e) {
        if (!cancelled) setErr((e as Error).message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [params.level, params.test, params.mondai, params.question])

  // Best-effort scene report for OBS auto-switching (no-op offline).
  useEffect(() => {
    fetch('/api/studio/scene-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scene: params.scene,
        level: params.level,
        test: params.test,
        mondai: params.mondai,
        question: params.question,
      }),
    }).catch(() => {})
  }, [params.scene, params.level, params.test, params.mondai, params.question])

  const goto = useCallback((next: Scene) => {
    const url = new URL(window.location.href)
    url.searchParams.set('scene', next)
    window.history.pushState({}, '', url)
    setParams(readParams())
  }, [])

  const step = useCallback(
    (dir: 1 | -1) => {
      const i = Math.min(Math.max(sceneIdx + dir, 0), SCENES.length - 1)
      goto(SCENES[i])
    },
    [sceneIdx, goto],
  )

  // Keyboard manual control during recording.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step])

  // Hands-off auto-advance.
  useEffect(() => {
    if (!params.autoplay) return
    if (params.scene === 'outro') return
    const ms = (params.scene === 'think' ? params.countdown : params.autoadvance) * 1000
    const t = setTimeout(() => step(1), ms)
    return () => clearTimeout(t)
  }, [params.autoplay, params.scene, params.autoadvance, params.countdown, step])

  return (
    <div className="studio-root">
      <div className="studio-stage">
        <div className="studio-progress">
          <div className="studio-progress-fill" style={{ width: `${((sceneIdx + 1) / SCENES.length) * 100}%` }} />
        </div>

        {err && <div className="studio-err">{err} — check public/jsonfileLevels/{params.level.toLowerCase()}.json</div>}

        {params.scene === 'question' && <QuestionScene data={data} level={params.level} />}
        {params.scene === 'think' && <ThinkScene seconds={params.countdown} />}
        {params.scene === 'answer' && <AnswerScene data={data} />}
        {params.scene === 'feedback' && <FeedbackScene data={data} />}
        {params.scene === 'outro' && <OutroScene />}
      </div>
    </div>
  )
}

function LevelBadge({ level }: { level: string }) {
  return <div className="studio-badge">JLPT {level}</div>
}

function PanelGrid({ q, reveal }: { q: LevelQuestion; reveal?: boolean }) {
  return (
    <div className="studio-panels">
      {panelsOf(q).map(p => (
        <div key={p.id} className={`studio-panel${reveal && p.correct ? ' correct' : ''}`}>
          {p.url ? <img src={p.url} alt="" /> : <span className="studio-panel-text">{p.text}</span>}
          <span className="studio-panel-num">{p.id}</span>
          {reveal && p.correct && <span className="studio-panel-check">✓</span>}
        </div>
      ))}
    </div>
  )
}

function QuestionScene({ data, level }: { data: LevelQuestion | null; level: string }) {
  const [imgFailed, setImgFailed] = useState(false)
  const showImage = data?.image_file && !imgFailed
  return (
    <div className="studio-scene">
      <LevelBadge level={level} />
      <div className="studio-question">{data?.question_text ?? '…'}</div>
      {data && hasPanels(data) ? (
        <PanelGrid q={data} />
      ) : showImage ? (
        <img className="studio-image" src={resolveImage(data!.image_file) ?? ''} alt="" onError={() => setImgFailed(true)} />
      ) : (
        <div className="studio-options">
          {data?.options.map(o => (
            <div key={o.id} className="studio-option">
              <span className="studio-option-num">{o.id}</span>
              {o.text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ThinkScene({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    setLeft(seconds)
    const id = setInterval(() => setLeft(v => (v > 0 ? v - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [seconds])
  return (
    <div className="studio-scene studio-think">
      <div className="studio-think-label">かんがえて！ / Think about it!</div>
      <div className="studio-countdown">{left}</div>
    </div>
  )
}

function AnswerScene({ data }: { data: LevelQuestion | null }) {
  useEffect(() => {
    playChime()
  }, [])
  return (
    <div className="studio-scene">
      <div className="studio-think-label">こたえ / Answer</div>
      {data && hasPanels(data) ? (
        <PanelGrid q={data} reveal />
      ) : (
        <div className="studio-options">
          {data?.options.map(o => {
            const correct = o.id === data.correct_option_id
            return (
              <div key={o.id} className={`studio-option${correct ? ' correct' : ''}`}>
                <span className="studio-option-num">{o.id}</span>
                {o.text}
                {correct && <span className="studio-check">✓</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FeedbackScene({ data }: { data: LevelQuestion | null }) {
  return (
    <div className="studio-scene studio-feedback">
      <div className="studio-think-label">ポイント / Key point</div>
      <div className="studio-fb-advice">{data?.feedback.advice}</div>
      <div className="studio-fb-hint">💡 {data?.feedback.hint}</div>
    </div>
  )
}

function OutroScene() {
  return (
    <div className="studio-scene studio-outro">
      <div className="studio-outro-card">
        <div className="studio-outro-logo">日本語シキ</div>
        <div className="studio-outro-text">Follow</div>
        <div className="studio-outro-handle">@japaneseshikhi</div>
        <div className="studio-outro-sub">for daily JLPT practice</div>
      </div>
    </div>
  )
}

export default StudioMode
