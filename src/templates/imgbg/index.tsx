import { LogoPill, DomainPill } from '@/components/BrandPills'
import { Orbs } from '@/components/PosterShell'
import { Field, StringInput, Slider } from '@/components/Controls'
import type { Accent, Format, FxState, ControlProps } from '@/types'

export interface ImgBGData {
  eyebrow?: string
  h1?: string
  h2?: string
  body?: string
  cta?: string
  overlayDark?: number
  h1Size?: number
  h2Size?: number
  bodySize?: number
}

export const imgBGDefaults: ImgBGData = {
  eyebrow: 'JLPT Preparation', h1: 'বাংলায় শিখুন', h2: 'জাপানি ভাষা',
  body: 'N5 থেকে N1 — সম্পূর্ণ বাংলায়।', cta: 'বিনামূল্যে শুরু করুন',
  overlayDark: 70, h1Size: 80, h2Size: 90, bodySize: 26,
}

export function ImgBGPoster({ data, accent, fx, fmt, bgImage }: {
  data: ImgBGData; accent: Accent; fx: FxState; fmt: Format; bgImage: string | null
}) {
  const overlay = `rgba(0,0,0,${(data.overlayDark || 70) / 100})`
  const hasImg = !!bgImage

  return (
    <div className="poster" style={{ width: fmt.w, height: fmt.h, background: hasImg ? '#000' : accent.bg, position: 'relative', overflow: 'hidden' }}>
      {hasImg && <img src={bgImage!} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} alt="" />}
      {hasImg
        ? <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${overlay} 0%, rgba(0,0,0,0.3) 35%, ${overlay} 100%)`, zIndex: 1 }} />
        : (fx.orbs && <Orbs c1={accent.p} c2={accent.s} />)
      }
      {!hasImg && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, pointerEvents: 'none' }}>
        <div style={{ fontSize: 120, opacity: .08 }}>🖼</div>
      </div>}
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', padding: fmt.w > 1200 ? '60px 96px' : '72px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <LogoPill dark={true} />
          {data.eyebrow && <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(244,162,97,0.9)', whiteSpace: 'nowrap' }}>{data.eyebrow}</span>}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 20, gap: 18 }}>
          <div>
            <div style={{ fontFamily: 'DM Serif Display,Georgia,serif', fontSize: data.h1Size || 80, fontWeight: 400, color: '#fff', lineHeight: 1.08, whiteSpace: 'nowrap', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>{data.h1}</div>
            <div style={{ fontFamily: 'DM Serif Display,Georgia,serif', fontSize: data.h2Size || 90, fontWeight: 400, color: '#F4A261', lineHeight: 1.08, whiteSpace: 'nowrap', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>{data.h2}</div>
          </div>
          {data.body && <div style={{ fontFamily: 'Noto Sans Bengali,Inter,sans-serif', fontSize: data.bodySize || 26, color: 'rgba(255,255,255,0.85)', fontWeight: 500, lineHeight: 1.6, maxWidth: 700 }}>{data.body}</div>}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            {data.cta && <div style={{ background: `linear-gradient(90deg,${accent.p},${accent.s})`, borderRadius: 14, padding: '16px 40px', fontSize: 24, fontWeight: 700, color: '#fff', fontFamily: 'Noto Sans Bengali,Inter,sans-serif', whiteSpace: 'nowrap' }}>{data.cta}</div>}
            <DomainPill accent={accent} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function ImgBGCtrl({ data, onChange }: ControlProps) {
  const SI = (k: keyof ImgBGData) => <StringInput data={data} field={k} onChange={onChange} />
  return <>
    <Field label="Eyebrow Label">{SI('eyebrow')}</Field>
    <div className="field-row">
      <Field label="Headline 1">{SI('h1')}</Field>
      <Field label="Headline 2">{SI('h2')}</Field>
    </div>
    <Field label="Body Text">
      <textarea value={data.body || ''} onChange={e => onChange({ ...data, body: e.target.value })} />
    </Field>
    <Field label="CTA Button">{SI('cta')}</Field>
    <div className="sec-label">Overlay Darkness</div>
    <Slider label="Darkness" data={data} field="overlayDark" min={0} max={95} onChange={onChange} />
    <div className="sec-label">Font Sizes</div>
    <Slider label="Headline 1" data={data} field="h1Size" min={36} max={140} onChange={onChange} />
    <Slider label="Headline 2" data={data} field="h2Size" min={36} max={140} onChange={onChange} />
    <Slider label="Body" data={data} field="bodySize" min={16} max={48} onChange={onChange} />
  </>
}
