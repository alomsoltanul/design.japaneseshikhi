import { PosterShell } from '@/components/PosterShell'
import { DomainPill, LogoPill } from '@/components/BrandPills'
import { Field, StringInput, Slider } from '@/components/Controls'
import type { Accent, Format, FxState, ControlProps } from '@/types'

export interface AnnounceData {
  badge?: string
  h1?: string
  h2?: string
  price?: string
  sub?: string
  detail?: string
  cta?: string
  h1Size?: number
  h2Size?: number
}

export const announceDefaults: AnnounceData = {
  badge: '🎉 নতুন ব্যাচ শুরু', h1: 'N5 কোর্স', h2: 'চালু হচ্ছে',
  price: '৳৩,৫৯৯', sub: 'সম্পূর্ণ বাংলায় JLPT N5 প্রস্তুতি',
  detail: 'ভর্তি চলছে · সীমিত আসন', cta: 'এখনই ভর্তি হন', h1Size: 88, h2Size: 88,
}

export function AnnouncePoster({ data, accent, fx, fmt }: {
  data: AnnounceData; accent: Accent; fx: FxState; fmt: Format
}) {
  const dk = accent.dark, txt = dk ? '#fff' : '#1D3557'
  const muted = dk ? 'rgba(255,255,255,0.55)' : 'rgba(29,53,87,0.55)'

  return (
    <PosterShell accent={accent} fx={fx} fmt={fmt}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><LogoPill dark={dk} /></div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22 }}>
        {data.badge && <div style={{ alignSelf: 'flex-start', background: `${accent.p}20`, border: `1px solid ${accent.p}40`, borderRadius: 999, padding: '10px 26px', fontFamily: 'Noto Sans Bengali,Inter,sans-serif', fontSize: 21, fontWeight: 700, color: accent.p, whiteSpace: 'nowrap' }}>{data.badge}</div>}
        <div>
          <div style={{ fontFamily: 'DM Serif Display,Georgia,serif', fontSize: data.h1Size || 88, fontWeight: 400, color: txt, lineHeight: 1.05, whiteSpace: 'nowrap' }}>{data.h1}</div>
          <div style={{ fontFamily: 'DM Serif Display,Georgia,serif', fontSize: data.h2Size || 88, fontWeight: 400, color: '#F4A261', lineHeight: 1.05, whiteSpace: 'nowrap' }}>{data.h2}</div>
        </div>
        {data.price && <div style={{ fontSize: 56, fontWeight: 800, color: accent.p, whiteSpace: 'nowrap', letterSpacing: '-.01em' }}>{data.price}</div>}
        <div>
          {data.sub && <div style={{ fontFamily: 'Noto Sans Bengali,Inter,sans-serif', fontSize: 27, color: muted, fontWeight: 500, marginBottom: 8, whiteSpace: 'nowrap' }}>{data.sub}</div>}
          {data.detail && <div style={{ fontFamily: 'Noto Sans Bengali,Inter,sans-serif', fontSize: 21, color: muted, fontWeight: 500, whiteSpace: 'nowrap' }}>{data.detail}</div>}
        </div>
        {data.cta && <div style={{ display: 'inline-flex', alignSelf: 'flex-start', marginTop: 6 }}>
          <div style={{ background: `linear-gradient(90deg,${accent.p},${accent.s})`, borderRadius: 14, padding: '18px 46px', fontSize: 26, fontWeight: 700, color: '#fff', fontFamily: 'Noto Sans Bengali,Inter,sans-serif', whiteSpace: 'nowrap' }}>{data.cta}</div>
        </div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><DomainPill accent={accent} /></div>
    </PosterShell>
  )
}

export function AnnounceCtrl({ data, onChange }: ControlProps) {
  const SI = (k: keyof AnnounceData) => <StringInput data={data} field={k} onChange={onChange} />
  return <>
    <Field label="Badge">{SI('badge')}</Field>
    <div className="field-row">
      <Field label="Headline 1">{SI('h1')}</Field>
      <Field label="Headline 2">{SI('h2')}</Field>
    </div>
    <Field label="Price">{SI('price')}</Field>
    <Field label="Sub-text">{SI('sub')}</Field>
    <Field label="Detail">{SI('detail')}</Field>
    <Field label="CTA Button">{SI('cta')}</Field>
    <div className="sec-label">Font Sizes</div>
    <Slider label="Headline 1" data={data} field="h1Size" min={40} max={150} onChange={onChange} />
    <Slider label="Headline 2" data={data} field="h2Size" min={40} max={150} onChange={onChange} />
  </>
}
