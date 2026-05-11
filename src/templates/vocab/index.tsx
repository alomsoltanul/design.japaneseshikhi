import { PosterShell } from '@/components/PosterShell'
import { DomainPill, LogoPill } from '@/components/BrandPills'
import { Field, Slider, LevelSelect } from '@/components/Controls'
import { TAG_COLORS } from '@/types'
import type { Accent, Format, FxState, ControlProps } from '@/types'

export interface VocabWord {
  jp?: string
  romaji?: string
  bn?: string
  tag?: string
}

export interface VocabData {
  level?: string
  headline?: string
  sub?: string
  words?: VocabWord[]
  hlSize?: number
  jpSize?: number
}

export const vocabDefaults: VocabData = {
  level: 'N5', headline: 'আজকের Vocabulary', sub: '৬টি গুরুত্বপূর্ণ শব্দ — আজই শিখুন',
  words: [
    { jp: '食べる', romaji: 'Taberu', bn: "খাওয়া", tag: 'Verb' },
    { jp: '飲む', romaji: 'Nomu', bn: 'পান করা', tag: 'Verb' },
    { jp: '学校', romaji: 'Gakkō', bn: 'স্কুল', tag: 'Noun' },
    { jp: '先生', romaji: 'Sensei', bn: 'শিক্ষক', tag: 'Noun' },
    { jp: '大きい', romaji: 'Ōkii', bn: 'বড়', tag: 'Adj' },
    { jp: '速い', romaji: 'Hayai', bn: 'দ্রুত', tag: 'Adj' },
  ],
  hlSize: 52, jpSize: 36,
}

export function VocabPoster({ data, accent, fx, fmt }: {
  data: VocabData; accent: Accent; fx: FxState; fmt: Format
}) {
  const dk = accent.dark, txt = dk ? '#fff' : '#1D3557'
  const muted = dk ? 'rgba(255,255,255,0.45)' : 'rgba(29,53,87,0.45)'
  const words = data.words || []

  return (
    <PosterShell accent={accent} fx={fx} fmt={fmt}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <LogoPill dark={dk} />
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(244,162,97,0.9)', whiteSpace: 'nowrap' }}>{data.level} · Vocabulary</span>
      </div>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: data.hlSize || 52, fontWeight: 800, color: txt, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{data.headline}</div>
        {data.sub && <div style={{ fontSize: 21, fontFamily: 'Noto Sans Bengali,Inter,sans-serif', color: muted, fontWeight: 500, marginTop: 7, whiteSpace: 'nowrap' }}>{data.sub}</div>}
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        {words.slice(0, 6).map((w, i) => {
          const color = TAG_COLORS[w.tag || ''] || accent.p
          return (
            <div key={i} style={{
              background: dk ? 'rgba(255,255,255,0.05)' : 'rgba(29,53,87,0.05)',
              border: `1px solid ${color}33`, borderRadius: 16, padding: '20px 18px',
              display: 'flex', flexDirection: 'column', gap: 5
            }}>
              <div style={{ fontSize: data.jpSize || 36, fontWeight: 700, color: txt, lineHeight: 1 }}>{w.jp}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: muted }}>{w.romaji}</div>
              <div style={{ fontSize: 17, fontFamily: 'Noto Sans Bengali,Inter,sans-serif', color: txt, fontWeight: 600 }}>{w.bn}</div>
              <div style={{
                marginTop: 'auto', paddingTop: 8, alignSelf: 'flex-start',
                background: `${color}22`, border: `1px solid ${color}44`,
                borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700, color,
                whiteSpace: 'nowrap'
              }}>{w.tag}</div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}><DomainPill accent={accent} /></div>
    </PosterShell>
  )
}

export function VocabCtrl({ data, onChange }: ControlProps) {
  const updW = (i: number, field: keyof VocabWord, val: string) => {
    const words = [...(data.words || [])]
    words[i] = { ...words[i], [field]: val }
    onChange({ ...data, words })
  }
  return <>
    <LevelSelect data={data} onChange={onChange} />
    <Field label="Headline">
      <input value={data.headline || ''} onChange={e => onChange({ ...data, headline: e.target.value })} />
    </Field>
    <Field label="Sub-headline">
      <input value={data.sub || ''} onChange={e => onChange({ ...data, sub: e.target.value })} />
    </Field>
    <div className="sec-label">Words (6 slots)</div>
    {((data.words || []) as VocabWord[]).slice(0, 6).map((w, i) => (
      <div key={i} className="word-slot">
        <div className="word-slot-head">Word {i + 1}</div>
        <div className="field-row">
          <Field label="JP"><input value={w.jp || ''} onChange={e => updW(i, 'jp', e.target.value)} /></Field>
          <Field label="Romaji"><input value={w.romaji || ''} onChange={e => updW(i, 'romaji', e.target.value)} /></Field>
        </div>
        <div className="field-row">
          <Field label="Bengali"><input value={w.bn || ''} onChange={e => updW(i, 'bn', e.target.value)} /></Field>
          <Field label="Tag">
            <select value={w.tag || 'Noun'} onChange={e => updW(i, 'tag', e.target.value)}>
              {['Verb', 'Noun', 'Adj', 'Adv', 'Other'].map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
      </div>
    ))}
    <div className="sec-label">Font Sizes</div>
    <Slider label="Headline" data={data} field="hlSize" min={24} max={80} onChange={onChange} />
    <Slider label="JP Words" data={data} field="jpSize" min={18} max={64} onChange={onChange} />
  </>
}
