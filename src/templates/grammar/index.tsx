import { PosterShell } from '@/components/PosterShell'
import { DomainPill, LogoPill } from '@/components/BrandPills'
import { Field, StringInput, Slider, LevelSelect } from '@/components/Controls'
import type { Accent, Format, FxState, ControlProps } from '@/types'

export interface GrammarData {
  level?: string
  pattern?: string
  parts?: string
  ex1jp?: string
  ex1bn?: string
  ex2jp?: string
  ex2bn?: string
  ptSize?: number
  exSize?: number
}

export const grammarDefaults: GrammarData = {
  level: 'N5', pattern: '〜は〜です', parts: 'Noun, は, Noun, です',
  ex1jp: '私は学生です。', ex1bn: 'আমি একজন ছাত্র।',
  ex2jp: '彼は先生です。', ex2bn: 'তিনি একজন শিক্ষক।',
  ptSize: 96, exSize: 30,
}

export function GrammarPoster({ data, accent, fx, fmt }: {
  data: GrammarData; accent: Accent; fx: FxState; fmt: Format
}) {
  const dk = accent.dark, txt = dk ? '#fff' : '#1D3557'
  const muted = dk ? 'rgba(255,255,255,0.45)' : 'rgba(29,53,87,0.45)'
  const cardBg = dk ? 'rgba(255,255,255,0.05)' : 'rgba(29,53,87,0.05)'
  const cardBdr = dk ? 'rgba(255,255,255,0.10)' : 'rgba(29,53,87,0.10)'
  const parts = (data.parts || '').split(',').map(p => p.trim()).filter(Boolean)

  return (
    <PosterShell accent={accent} fx={fx} fmt={fmt}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <LogoPill dark={dk} />
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(244,162,97,0.9)', whiteSpace: 'nowrap' }}>{data.level} Grammar</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 3, background: accent.p, borderRadius: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: muted, whiteSpace: 'nowrap' }}>{data.level} Grammar · বাংলায় শিখুন</span>
        </div>
        <div style={{ background: cardBg, border: `1px solid ${cardBdr}`, borderRadius: 20, padding: '38px 46px' }}>
          <div style={{ fontFamily: 'DM Serif Display,Georgia,serif', fontSize: data.ptSize || 96, fontWeight: 400, color: txt, lineHeight: 1.05, letterSpacing: '-.02em', marginBottom: 22, whiteSpace: 'nowrap' }}>{data.pattern}</div>
          {parts.length > 0 && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {parts.map((p, i) => (
              <div key={i} style={{
                background: i % 2 === 1 ? `${accent.p}33` : dk ? 'rgba(255,255,255,0.08)' : 'rgba(29,53,87,0.08)',
                border: `1px solid ${i % 2 === 1 ? accent.p + '55' : cardBdr}`,
                borderRadius: 8, padding: '7px 16px', fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap',
                color: i % 2 === 1 ? '#F4A261' : muted
              }}>{p}</div>
            ))}
          </div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {[[data.ex1jp, data.ex1bn, accent.p, accent.s, 'rgba(244,162,97,0.9)'], [data.ex2jp, data.ex2bn, '#2A9D8F', '#1D3557', 'rgba(42,157,143,0.9)']]
            .filter(([jp]) => jp)
            .map(([jp, bn, ca, cb, bnColor], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'stretch', gap: 18 }}>
                <div style={{ width: 4, background: `linear-gradient(180deg,${ca},${cb})`, borderRadius: 4, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: data.exSize || 30, fontWeight: 700, color: txt, lineHeight: 1.35, whiteSpace: 'nowrap' }}>{jp}</div>
                  {bn && <div style={{ fontSize: 19, color: bnColor as string, fontWeight: 500, marginTop: 6, fontFamily: 'Noto Sans Bengali,Inter,sans-serif', whiteSpace: 'nowrap' }}>{bn}</div>}
                </div>
              </div>
            ))}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'Noto Sans Bengali,Inter,sans-serif', fontSize: 17, color: muted, fontWeight: 500, whiteSpace: 'nowrap' }}>বাংলায় জাপানি ব্যাকরণ শিখুন</span>
        <DomainPill accent={accent} />
      </div>
    </PosterShell>
  )
}

export function GrammarCtrl({ data, onChange }: ControlProps) {
  const SI = (k: keyof GrammarData) => <StringInput data={data} field={k} onChange={onChange} />
  return <>
    <LevelSelect data={data} onChange={onChange} />
    <Field label="Grammar Pattern">{SI('pattern')}</Field>
    <Field label="Parts (comma-separated)">{SI('parts')}</Field>
    <div className="field-row">
      <Field label="Example 1 JP">{SI('ex1jp')}</Field>
      <Field label="Example 1 BN">{SI('ex1bn')}</Field>
    </div>
    <div className="field-row">
      <Field label="Example 2 JP">{SI('ex2jp')}</Field>
      <Field label="Example 2 BN">{SI('ex2bn')}</Field>
    </div>
    <div className="sec-label">Font Sizes</div>
    <Slider label="Pattern" data={data} field="ptSize" min={40} max={140} onChange={onChange} />
    <Slider label="Examples" data={data} field="exSize" min={16} max={60} onChange={onChange} />
  </>
}
