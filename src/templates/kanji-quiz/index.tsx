import { PosterShell } from '@/components/PosterShell'
import { DomainPill, LogoPill } from '@/components/BrandPills'
import { Field, StringInput, LevelSelect } from '@/components/Controls'
import type { Accent, Format, FxState, ControlProps } from '@/types'

export interface KanjiQuizData {
  level?: string
  kanji?: string
  question?: string
  opt1?: string
  opt2?: string
  opt3?: string
  opt4?: string
  correctIndex?: string
  kanjiSize?: number
}

export const kanjiQuizDefaults: KanjiQuizData = {
  level: 'N5',
  kanji: '山',
  question: 'এই কানজির অর্থ কী?',
  opt1: 'Mountain',
  opt2: 'River',
  opt3: 'Forest',
  opt4: 'Cloud',
  correctIndex: '0',
  kanjiSize: 200,
}

export function KanjiQuizPoster({ data, accent, fx, fmt }: {
  data: KanjiQuizData; accent: Accent; fx: FxState; fmt: Format
}) {
  const dk = accent.dark, txt = dk ? '#fff' : '#1D3557'
  const muted = dk ? 'rgba(255,255,255,0.45)' : 'rgba(29,53,87,0.45)'
  const cardBg = dk ? 'rgba(255,255,255,0.05)' : 'rgba(29,53,87,0.05)'
  const cardBdr = dk ? 'rgba(255,255,255,0.10)' : 'rgba(29,53,87,0.10)'
  const options = [data.opt1, data.opt2, data.opt3, data.opt4].filter(Boolean)
  const correct = parseInt(data.correctIndex || '0')

  return (
    <PosterShell accent={accent} fx={fx} fmt={fmt}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <LogoPill dark={dk} />
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(244,162,97,0.9)', whiteSpace: 'nowrap' }}>{data.level} · Kanji Quiz</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24, alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: data.kanjiSize || 200, fontWeight: 700, color: txt, lineHeight: 1, textAlign: 'center' }}>{data.kanji}</div>
          {data.question && (
            <div style={{ fontFamily: 'Noto Sans Bengali,Inter,sans-serif', fontSize: 22, color: muted, fontWeight: 600, marginTop: 12 }}>
              {data.question}
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, width: '100%' }}>
          {options.map((opt, i) => {
            const isCorrect = i === correct
            return (
              <div key={i} style={{
                background: isCorrect ? `${accent.p}20` : cardBg,
                border: `2px solid ${isCorrect ? accent.p : cardBdr}`,
                borderRadius: 14, padding: '16px 24px', display: 'flex', gap: 14, alignItems: 'center'
              }}>
                <span style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: isCorrect ? accent.p : cardBg,
                  border: `1px solid ${isCorrect ? accent.p : cardBdr}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 700, color: isCorrect ? '#fff' : muted, flexShrink: 0
                }}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span style={{ fontSize: 24, fontWeight: 600, color: isCorrect ? txt : muted, whiteSpace: 'nowrap' }}>{opt}</span>
                {isCorrect && <span style={{ marginLeft: 'auto', color: '#2A9D8F', fontSize: 22, flexShrink: 0 }}>✓</span>}
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><DomainPill accent={accent} /></div>
    </PosterShell>
  )
}

export function KanjiQuizCtrl({ data, onChange }: ControlProps) {
  const SI = (k: keyof KanjiQuizData) => <StringInput data={data} field={k} onChange={onChange} />
  return <>
    <LevelSelect data={data} onChange={onChange} />
    <div className="field-row">
      <Field label="Kanji">{SI('kanji')}</Field>
      <Field label="Kanji Size">{SI('kanjiSize')}</Field>
    </div>
    <Field label="Question">{SI('question')}</Field>
    <div className="sec-label">Options</div>
    <div className="field-row">
      <Field label="A">{SI('opt1')}</Field>
      <Field label="B">{SI('opt2')}</Field>
    </div>
    <div className="field-row">
      <Field label="C">{SI('opt3')}</Field>
      <Field label="D">{SI('opt4')}</Field>
    </div>
    <Field label="Correct Answer">
      <select value={data.correctIndex || '0'} onChange={e => onChange({ ...data, correctIndex: e.target.value })}>
        {['0', '1', '2', '3'].map(n => <option key={n} value={n}>{String.fromCharCode(65 + parseInt(n))}</option>)}
      </select>
    </Field>
  </>
}
