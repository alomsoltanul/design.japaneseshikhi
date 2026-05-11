import { LogoPill } from '@/components/BrandPills'
import { Orbs } from '@/components/PosterShell'
import { Field, StringInput, Slider } from '@/components/Controls'
import type { Accent, Format, FxState, ControlProps } from '@/types'

export interface NewsFlashData {
  channel?: string
  handle?: string
  initials?: string
  website?: string
  category?: string
  headline?: string
  date?: string
  source?: string
  overlayDark?: number
  hlSize?: number
}

export const newsFlashDefaults: NewsFlashData = {
  channel: 'Japanese Shikhi', handle: '@japaneseshikhi', initials: 'JS',
  website: 'japaneseshikhi.com', category: 'EXCLUSIVE',
  headline: 'NEW N5 GRAMMAR MODULE NOW AVAILABLE FOR ALL LEARNERS',
  date: 'May 10, 2026', source: 'Japanese Shikhi', overlayDark: 65, hlSize: 68,
}

export function NewsFlashPoster({ data, accent, fx, fmt, bgImage }: {
  data: NewsFlashData; accent: Accent; fx: FxState; fmt: Format; bgImage: string | null
}) {
  const hasImg = !!bgImage
  const isLandscape = fmt.w > fmt.h
  const padH = isLandscape ? 88 : 72
  const padV = isLandscape ? 60 : 76
  const darkVal = (data.overlayDark || 65) / 100

  return (
    <div className="poster" style={{ width: fmt.w, height: fmt.h, position: 'relative', overflow: 'hidden', background: '#06080f' }}>
      {hasImg && <img src={bgImage!} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} alt="" />}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: hasImg
        ? `linear-gradient(180deg,rgba(0,0,0,0.55) 0%,rgba(0,0,0,0.18) 38%,rgba(0,0,0,${darkVal}) 100%)`
        : `linear-gradient(150deg,#0a0c18,#0f0d1f,#13102a)` }} />
      {!hasImg && fx.orbs && <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}><Orbs c1={accent.p} c2={accent.s} /></div>}
      {!hasImg && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, opacity: .05, pointerEvents: 'none' }}>
        <div style={{ fontSize: 200, lineHeight: 1 }}>🖼</div>
      </div>}
      <div style={{ position: 'relative', zIndex: 3, height: '100%', display: 'flex', flexDirection: 'column', padding: `${padV}px ${padH}px` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(10px)', borderRadius: 12, padding: '10px 18px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ width: 38, height: 38, background: `linear-gradient(135deg,${accent.p},${accent.s})`, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>{(data.initials || 'JS').toUpperCase()}</span>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{data.channel}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{data.handle}</div>
            </div>
          </div>
          {data.website && <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', borderRadius: 6, padding: '6px 14px', border: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>{data.website}</div>}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {data.category && (
            <div style={{ alignSelf: 'flex-start', background: accent.p, borderRadius: 4, padding: '7px 18px', display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 900, color: '#fff', letterSpacing: '.16em', textTransform: 'uppercase' }}>{data.category}</span>
            </div>
          )}
          <div style={{ fontSize: data.hlSize || 68, fontWeight: 900, color: '#fff', lineHeight: 1.08, letterSpacing: '-.01em', textTransform: 'uppercase', textShadow: '0 2px 24px rgba(0,0,0,0.65)' }}>{data.headline}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.14)' }}>
            {data.date && <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>{data.date}</span>}
            {data.source && <><span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 18 }}>|</span><span style={{ fontSize: 14, fontWeight: 700, color: accent.p, letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Source: {data.source}</span></>}
            <div style={{ marginLeft: 'auto' }}><LogoPill dark={true} /></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function NewsFlashCtrl({ data, onChange }: ControlProps) {
  const SI = (k: keyof NewsFlashData) => <StringInput data={data} field={k} onChange={onChange} />
  return <>
    <div style={{ background: 'rgba(244,162,97,0.1)', border: '1px solid rgba(244,162,97,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: 'rgba(244,162,97,0.9)', fontWeight: 500, lineHeight: 1.5 }}>
      💡 Upload an image in Style tab for best results
    </div>
    <div className="field-row">
      <Field label="Channel Name">{SI('channel')}</Field>
      <Field label="Initials">{SI('initials')}</Field>
    </div>
    <div className="field-row">
      <Field label="Handle">{SI('handle')}</Field>
      <Field label="Website">{SI('website')}</Field>
    </div>
    <Field label="Category / Tag">{SI('category')}</Field>
    <Field label="Headline">
      <textarea value={data.headline || ''} onChange={e => onChange({ ...data, headline: e.target.value })} style={{ minHeight: 80 }} />
    </Field>
    <div className="field-row">
      <Field label="Date">{SI('date')}</Field>
      <Field label="Source">{SI('source')}</Field>
    </div>
    <div className="sec-label">Overlay Darkness</div>
    <Slider label="Darkness" data={data} field="overlayDark" min={0} max={95} onChange={onChange} />
    <div className="sec-label">Font Sizes</div>
    <Slider label="Headline" data={data} field="hlSize" min={28} max={120} onChange={onChange} />
  </>
}
