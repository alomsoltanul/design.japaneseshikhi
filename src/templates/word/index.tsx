import { PosterShell } from '@/components/PosterShell'
import { DomainPill, LogoPill } from '@/components/BrandPills'
import { Field, StringInput, Slider, LevelSelect } from '@/components/Controls'
import type { Accent, Format, FxState, ControlProps } from '@/types'

export interface WordData {
  level?: string
  jp?: string
  romaji?: string
  bn?: string
  exJp?: string
  exBn?: string
  tip?: string
  jpSize?: number
  bnSize?: number
}

export const wordDefaults: WordData = {
  level: 'N4', jp: '旅行', romaji: 'Ryokō', bn: 'ভ্রমণ / ট্রিপ',
  exJp: '来年、日本に旅行します。', exBn: 'আগামী বছর জাপান ভ্রমণ করব।',
  tip: 'মনে রাখুন: 旅 (tabi) = journey  行 (iku) = to go', jpSize: 160, bnSize: 44,
}

export function WordPoster({ data, accent, fx, fmt }: {
  data: WordData; accent: Accent; fx: FxState; fmt: Format
}) {
  const dk = accent.dark, txt = dk ? '#fff' : '#1D3557'
  const muted = dk ? 'rgba(255,255,255,0.45)' : 'rgba(29,53,87,0.45)'
  const cardBg = dk ? 'rgba(255,255,255,0.05)' : 'rgba(29,53,87,0.05)'
  const cardBdr = dk ? 'rgba(255,255,255,0.10)' : 'rgba(29,53,87,0.10)'

  return (
    <PosterShell accent={accent} fx={fx} fmt={fmt}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <LogoPill dark={dk} />
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(244,162,97,0.9)', whiteSpace: 'nowrap' }}>{data.level} · আজকের শব্দ</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 3, background: accent.p, borderRadius: 2 }} />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: muted, whiteSpace: 'nowrap' }}>Word of the Day</span>
        </div>
        <div style={{ background: cardBg, border: `1px solid ${cardBdr}`, borderRadius: 20, padding: '40px 50px' }}>
          <div style={{ fontSize: 17, fontFamily: 'Noto Sans Bengali,Inter,sans-serif', color: muted, fontWeight: 500, marginBottom: 10, whiteSpace: 'nowrap' }}>{data.romaji}</div>
          <div style={{ fontSize: data.jpSize || 160, fontWeight: 700, color: txt, lineHeight: 1, marginBottom: 14, whiteSpace: 'nowrap' }}>{data.jp}</div>
          <div style={{ fontSize: data.bnSize || 44, fontFamily: 'Noto Sans Bengali,Inter,sans-serif', fontWeight: 700, color: '#F4A261', whiteSpace: 'nowrap' }}>{data.bn}</div>
        </div>
        {data.exJp && <div style={{ display: 'flex', gap: 18, alignItems: 'stretch' }}>
          <div style={{ width: 4, background: `linear-gradient(180deg,${accent.p},${accent.s})`, borderRadius: 4, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 27, fontWeight: 700, color: txt, lineHeight: 1.4, whiteSpace: 'nowrap' }}>{data.exJp}</div>
            {data.exBn && <div style={{ fontSize: 19, fontFamily: 'Noto Sans Bengali,Inter,sans-serif', color: 'rgba(42,157,143,0.9)', fontWeight: 500, marginTop: 7, whiteSpace: 'nowrap' }}>{data.exBn}</div>}
          </div>
        </div>}
        {data.tip && <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: cardBg, borderRadius: 14, padding: '16px 20px', border: `1px solid ${cardBdr}` }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>💡</span>
          <div style={{ fontFamily: 'Noto Sans Bengali,Inter,sans-serif', fontSize: 18, color: muted, fontWeight: 500, lineHeight: 1.55 }}>{data.tip}</div>
        </div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><DomainPill accent={accent} /></div>
    </PosterShell>
  )
}

export function WordCtrl({ data, onChange }: ControlProps) {
  const SI = (k: keyof WordData) => <StringInput data={data} field={k} onChange={onChange} />
  return <>
    <LevelSelect data={data} onChange={onChange} />
    <div className="field-row">
      <Field label="Japanese">{SI('jp')}</Field>
      <Field label="Romaji">{SI('romaji')}</Field>
    </div>
    <Field label="Bengali Meaning">{SI('bn')}</Field>
    <Field label="Example JP">{SI('exJp')}</Field>
    <Field label="Example BN">{SI('exBn')}</Field>
    <Field label="Memory Tip">
      <textarea value={data.tip || ''} onChange={e => onChange({ ...data, tip: e.target.value })} />
    </Field>
    <div className="sec-label">Font Sizes</div>
    <Slider label="JP Word" data={data} field="jpSize" min={60} max={240} onChange={onChange} />
    <Slider label="BN Meaning" data={data} field="bnSize" min={24} max={80} onChange={onChange} />
  </>
}
