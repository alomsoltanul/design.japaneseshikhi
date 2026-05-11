import { PosterShell } from '@/components/PosterShell'
import { DomainPill, LogoPill } from '@/components/BrandPills'
import { Field, StringInput, Slider } from '@/components/Controls'
import type { Accent, Format, FxState, ControlProps } from '@/types'

export interface TipData {
  category?: string
  tip?: string
  sub?: string
  tipSize?: number
}

export const tipDefaults: TipData = {
  category: 'পড়াশোনার টিপস',
  tip: 'প্রতিদিন মাত্র ১৫ মিনিট রিভিউ করলেই JLPT-তে সফল হওয়া সম্ভব।',
  sub: 'SRS পদ্ধতিতে শিখলে কম সময়ে বেশি শব্দ মনে থাকে।', tipSize: 58,
}

export function TipPoster({ data, accent, fx, fmt }: {
  data: TipData; accent: Accent; fx: FxState; fmt: Format
}) {
  const dk = accent.dark, txt = dk ? '#fff' : '#1D3557'
  const muted = dk ? 'rgba(255,255,255,0.45)' : 'rgba(29,53,87,0.45)'

  return (
    <PosterShell accent={accent} fx={fx} fmt={fmt}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <LogoPill dark={dk} />
        <span style={{ fontFamily: 'Noto Sans Bengali,Inter,sans-serif', fontSize: 15, fontWeight: 700, letterSpacing: '.06em', color: 'rgba(244,162,97,0.9)', whiteSpace: 'nowrap' }}>{data.category}</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 28, padding: '0 30px' }}>
        <div style={{ fontSize: 130, fontFamily: 'DM Serif Display,Georgia,serif', fontWeight: 400, color: `${accent.p}38`, lineHeight: .7, alignSelf: 'flex-start', marginLeft: 10 }}>❝</div>
        <div style={{ fontFamily: 'Noto Sans Bengali,Inter,sans-serif', fontSize: data.tipSize || 58, fontWeight: 700, color: txt, lineHeight: 1.4, marginTop: -50 }}>{data.tip}</div>
        <div style={{ width: 60, height: 3, background: `linear-gradient(90deg,${accent.p},${accent.s})`, borderRadius: 2 }} />
        {data.sub && <div style={{ fontFamily: 'Noto Sans Bengali,Inter,sans-serif', fontSize: 25, color: muted, fontWeight: 500, lineHeight: 1.5 }}>{data.sub}</div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><DomainPill accent={accent} /></div>
    </PosterShell>
  )
}

export function TipCtrl({ data, onChange }: ControlProps) {
  const SI = (k: keyof TipData) => <StringInput data={data} field={k} onChange={onChange} />
  return <>
    <Field label="Category">{SI('category')}</Field>
    <Field label="Main Tip">
      <textarea value={data.tip || ''} onChange={e => onChange({ ...data, tip: e.target.value })} style={{ minHeight: 90 }} />
    </Field>
    <Field label="Sub Text">
      <textarea value={data.sub || ''} onChange={e => onChange({ ...data, sub: e.target.value })} />
    </Field>
    <div className="sec-label">Font Sizes</div>
    <Slider label="Tip" data={data} field="tipSize" min={28} max={100} onChange={onChange} />
  </>
}
