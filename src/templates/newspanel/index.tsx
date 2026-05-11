import { LogoPill } from '@/components/BrandPills'
import { Field, StringInput, Slider } from '@/components/Controls'
import type { Accent, Format, ControlProps } from '@/types'

export interface NewsPanelData {
  channel?: string
  handle?: string
  initials?: string
  website?: string
  category?: string
  headline?: string
  date?: string
  source?: string
  hlSize?: number
}

export const newsPanelDefaults: NewsPanelData = {
  channel: 'Japanese Shikhi', handle: '@japaneseshikhi', initials: 'JS',
  website: 'japaneseshikhi.com', category: 'EDUCATION',
  headline: 'NEW N5 GRAMMAR MODULE NOW AVAILABLE FOR ALL LEARNERS',
  date: 'May 10, 2026', source: 'Japanese Shikhi', hlSize: 52,
}

export function NewsPanelPoster({ data, accent, fmt, bgImage }: {
  data: NewsPanelData; accent: Accent; fmt: Format; bgImage: string | null
}) {
  const dk = accent.id !== 'light'
  const panelBg = dk ? '#080b14' : '#FFFFFF'
  const txt = dk ? '#ffffff' : '#0d111c'
  const muted = dk ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'
  const lineC = dk ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const hasImg = !!bgImage
  const isLandscape = fmt.w > fmt.h
  const imgFrac = isLandscape ? 0.50 : 0.46
  const imgH = Math.round(fmt.h * imgFrac)
  const padH = isLandscape ? 80 : 64

  return (
    <div className="poster" style={{ width: fmt.w, height: fmt.h, background: panelBg, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: imgH, zIndex: 1 }}>
        {hasImg
          ? <img src={bgImage!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
          : <div style={{ width: '100%', height: '100%', background: dk ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ fontSize: 72, opacity: .1 }}>🖼</div>
              <div style={{ fontSize: 16, color: muted, fontWeight: 600 }}>Upload an image in Style tab</div>
            </div>
        }
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: imgH * 0.32, background: `linear-gradient(transparent,${panelBg})` }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: `linear-gradient(90deg,${accent.p},${accent.s})` }} />
      </div>
      <div style={{ position: 'absolute', top: imgH, left: 0, right: 0, bottom: 0, zIndex: 2, display: 'flex', flexDirection: 'column', padding: `28px ${padH}px 50px` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 20, borderBottom: `1px solid ${lineC}`, marginBottom: 26 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, background: `linear-gradient(135deg,${accent.p},${accent.s})`, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{(data.initials || 'JS').toUpperCase()}</span>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: txt, lineHeight: 1 }}>{data.channel}</div>
              <div style={{ fontSize: 11, color: muted, marginTop: 3 }}>{data.handle}</div>
            </div>
          </div>
          {data.category && <div style={{ background: `${accent.p}18`, border: `1px solid ${accent.p}35`, borderRadius: 5, padding: '6px 16px', fontSize: 12, fontWeight: 800, color: accent.p, letterSpacing: '.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{data.category}</div>}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
          <div style={{ fontSize: data.hlSize || 52, fontWeight: 900, color: txt, lineHeight: 1.1, letterSpacing: '-.01em', textTransform: 'uppercase' }}>{data.headline}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 18, borderTop: `1px solid ${lineC}` }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {data.date && <span style={{ fontSize: 14, fontWeight: 700, color: muted, whiteSpace: 'nowrap' }}>{data.date}</span>}
            {data.source && <><span style={{ color: lineC, fontSize: 18 }}>|</span><span style={{ fontSize: 13, fontWeight: 700, color: accent.p, letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Source: {data.source}</span></>}
          </div>
          <LogoPill dark={dk} />
        </div>
      </div>
    </div>
  )
}

export function NewsPanelCtrl({ data, onChange }: ControlProps) {
  const SI = (k: keyof NewsPanelData) => <StringInput data={data} field={k} onChange={onChange} />
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
    <div className="sec-label">Font Sizes</div>
    <Slider label="Headline" data={data} field="hlSize" min={24} max={100} onChange={onChange} />
  </>
}
