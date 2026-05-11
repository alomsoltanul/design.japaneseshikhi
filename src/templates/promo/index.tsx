import { PosterShell } from '@/components/PosterShell'
import { DomainPill, LogoPill } from '@/components/BrandPills'
import { Field, StringInput, Slider } from '@/components/Controls'
import type { Accent, Format, FxState, ControlProps } from '@/types'

export interface PromoData {
  h1?: string
  h2?: string
  body?: string
  bullets?: string
  cta?: string
  h1Size?: number
  h2Size?: number
}

export const promoDefaults: PromoData = {
  h1: 'বাংলায় শিখুন', h2: 'জাপানি ভাষা',
  body: 'N5 থেকে N1 — সম্পূর্ণ বাংলায়। AI টিউটর, SRS ফ্ল্যাশকার্ড ও মক পরীক্ষা।',
  bullets: 'AI বাংলা টিউটর\nSRS ফ্ল্যাশকার্ড\nJLPT মক পরীক্ষা',
  cta: 'বিনামূল্যে শুরু করুন', h1Size: 80, h2Size: 90,
}

export function PromoPoster({ data, accent, fx, fmt }: {
  data: PromoData; accent: Accent; fx: FxState; fmt: Format
}) {
  const dk = accent.dark, txt = dk ? '#fff' : '#1D3557'
  const muted = dk ? 'rgba(255,255,255,0.55)' : 'rgba(29,53,87,0.55)'
  const bullets = (data.bullets || '').split('\n').filter(Boolean)

  return (
    <PosterShell accent={accent} fx={fx} fmt={fmt}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <LogoPill dark={dk} /><span style={{ fontSize: 36 }}>🎌</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22 }}>
        <div>
          <div style={{ fontFamily: 'DM Serif Display,Georgia,serif', fontSize: data.h1Size || 80, fontWeight: 400, color: txt, lineHeight: 1.08, whiteSpace: 'nowrap' }}>{data.h1}</div>
          <div style={{ fontFamily: 'DM Serif Display,Georgia,serif', fontSize: data.h2Size || 90, fontWeight: 400, color: '#F4A261', lineHeight: 1.08, whiteSpace: 'nowrap' }}>{data.h2}</div>
        </div>
        {data.body && <div style={{ fontFamily: 'Noto Sans Bengali,Inter,sans-serif', fontSize: 24, color: muted, fontWeight: 500, lineHeight: 1.6, maxWidth: 720 }}>{data.body}</div>}
        {bullets.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {bullets.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 24, height: 24, borderRadius: 7, background: `${accent.p}22`, border: `1px solid ${accent.p}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 13, color: accent.p, fontWeight: 700 }}>✓</span>
              </div>
              <span style={{ fontFamily: 'Noto Sans Bengali,Inter,sans-serif', fontSize: 23, color: txt, fontWeight: 600, whiteSpace: 'nowrap' }}>{b}</span>
            </div>
          ))}
        </div>}
        {data.cta && <div style={{ display: 'inline-flex', alignSelf: 'flex-start', marginTop: 6 }}>
          <div style={{ background: `linear-gradient(90deg,${accent.p},${accent.s})`, borderRadius: 14, padding: '18px 46px', fontSize: 26, fontWeight: 700, color: '#fff', fontFamily: 'Noto Sans Bengali,Inter,sans-serif', whiteSpace: 'nowrap' }}>{data.cta}</div>
        </div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><DomainPill accent={accent} /></div>
    </PosterShell>
  )
}

export function PromoCtrl({ data, onChange }: ControlProps) {
  const SI = (k: keyof PromoData) => <StringInput data={data} field={k} onChange={onChange} />
  return <>
    <div className="field-row">
      <Field label="Headline 1">{SI('h1')}</Field>
      <Field label="Headline 2">{SI('h2')}</Field>
    </div>
    <Field label="Body Text">
      <textarea value={data.body || ''} onChange={e => onChange({ ...data, body: e.target.value })} />
    </Field>
    <Field label="Bullets (one per line)">
      <textarea value={data.bullets || ''} onChange={e => onChange({ ...data, bullets: e.target.value })} />
    </Field>
    <Field label="CTA Button">{SI('cta')}</Field>
    <div className="sec-label">Font Sizes</div>
    <Slider label="Headline 1" data={data} field="h1Size" min={36} max={140} onChange={onChange} />
    <Slider label="Headline 2" data={data} field="h2Size" min={36} max={140} onChange={onChange} />
  </>
}
