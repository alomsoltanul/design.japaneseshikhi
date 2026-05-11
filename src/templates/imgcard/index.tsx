import { LogoPill, DomainPill } from '@/components/BrandPills'
import { Orbs } from '@/components/PosterShell'
import { Field, StringInput, Slider, LevelSelect } from '@/components/Controls'
import type { Accent, Format, FxState, ControlProps } from '@/types'

export interface ImgCardData {
  level?: string
  eyebrow?: string
  h1?: string
  h2?: string
  body?: string
  h1Size?: number
  h2Size?: number
  bodySize?: number
}

export const imgCardDefaults: ImgCardData = {
  level: 'N5', eyebrow: 'আজকের Grammar',
  h1: '〜は〜です', h2: 'Noun + は + Noun + です',
  body: 'এটি সবচেয়ে মৌলিক বাক্য গঠন।', h1Size: 80, bodySize: 26,
}

export function ImgCardPoster({ data, accent, fx, fmt, bgImage }: {
  data: ImgCardData; accent: Accent; fx: FxState; fmt: Format; bgImage: string | null
}) {
  const dk = accent.dark, txt = dk ? '#fff' : '#1D3557'
  const muted = dk ? 'rgba(255,255,255,0.55)' : 'rgba(29,53,87,0.55)'
  const isLandscape = fmt.w > fmt.h
  const imgFrac = isLandscape ? 0.52 : 0.44
  const imgH = Math.round(fmt.h * imgFrac)
  const hasImg = !!bgImage
  const padH = isLandscape ? 80 : 64

  return (
    <div className="poster" style={{ width: fmt.w, height: fmt.h, background: accent.bg, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: imgH, zIndex: 1 }}>
        {hasImg
          ? <img src={bgImage!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
          : <div style={{ width: '100%', height: '100%', background: dk ? 'rgba(255,255,255,0.04)' : 'rgba(29,53,87,0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ fontSize: 64, opacity: .15 }}>🖼</div>
              <div style={{ fontSize: 16, color: muted, fontWeight: 600 }}>Drag an image here</div>
            </div>
        }
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: imgH * 0.35, background: `linear-gradient(180deg,transparent,${accent.bg})` }} />
      </div>
      {fx.orbs && <div style={{ position: 'absolute', top: imgH, left: 0, right: 0, bottom: 0, overflow: 'hidden', zIndex: 0 }}>
        <Orbs c1={accent.p} c2={accent.s} />
      </div>}
      <div style={{ position: 'absolute', top: imgH, left: 0, right: 0, bottom: 0, zIndex: 2, display: 'flex', flexDirection: 'column', padding: `28px ${padH}px 52px` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <LogoPill dark={dk} />
          {data.level && <div style={{ background: `${accent.p}22`, border: `1px solid ${accent.p}44`, borderRadius: 999, padding: '6px 18px', fontSize: 14, fontWeight: 700, color: accent.p, whiteSpace: 'nowrap' }}>{data.level} · {data.eyebrow}</div>}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
          <div style={{ fontFamily: 'DM Serif Display,Georgia,serif', fontSize: data.h1Size || 80, fontWeight: 400, color: txt, lineHeight: 1.05, whiteSpace: 'nowrap' }}>{data.h1}</div>
          {data.h2 && <div style={{ fontFamily: 'Noto Sans Bengali,Inter,sans-serif', fontSize: data.h2Size || 32, fontWeight: 600, color: muted, lineHeight: 1.4, whiteSpace: 'nowrap' }}>{data.h2}</div>}
          {data.body && <div style={{ fontFamily: 'Noto Sans Bengali,Inter,sans-serif', fontSize: data.bodySize || 26, color: muted, fontWeight: 500, lineHeight: 1.6 }}>{data.body}</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><DomainPill accent={accent} /></div>
      </div>
    </div>
  )
}

export function ImgCardCtrl({ data, onChange }: ControlProps) {
  const SI = (k: keyof ImgCardData) => <StringInput data={data} field={k} onChange={onChange} />
  return <>
    <LevelSelect data={data} onChange={onChange} />
    <Field label="Eyebrow Label">{SI('eyebrow')}</Field>
    <Field label="Main Heading (JP)">{SI('h1')}</Field>
    <Field label="Sub-heading">{SI('h2')}</Field>
    <Field label="Body Text">
      <textarea value={data.body || ''} onChange={e => onChange({ ...data, body: e.target.value })} />
    </Field>
    <div className="sec-label">Font Sizes</div>
    <Slider label="Heading" data={data} field="h1Size" min={36} max={140} onChange={onChange} />
    <Slider label="Sub-heading" data={data} field="h2Size" min={18} max={64} onChange={onChange} />
    <Slider label="Body" data={data} field="bodySize" min={16} max={48} onChange={onChange} />
  </>
}
