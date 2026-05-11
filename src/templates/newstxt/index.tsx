import { LogoPill } from '@/components/BrandPills'
import { Field, StringInput, Slider } from '@/components/Controls'
import type { Accent, Format, ControlProps } from '@/types'

export interface NewsTxtData {
  channel?: string
  handle?: string
  initials?: string
  website?: string
  category?: string
  headline?: string
  body?: string
  date?: string
  source?: string
  hlSize?: number
}

export const newsTxtDefaults: NewsTxtData = {
  channel: 'Japanese Shikhi', handle: '@japaneseshikhi', initials: 'JS',
  website: 'japaneseshikhi.com', category: 'LEARNING UPDATE',
  headline: 'NEW N5 GRAMMAR MODULE NOW AVAILABLE FOR ALL LEARNERS',
  body: '', date: 'May 10, 2026', source: 'Japanese Shikhi', hlSize: 64,
}

export function NewsTxtPoster({ data, accent, fmt }: {
  data: NewsTxtData; accent: Accent; fmt: Format
}) {
  const dk = accent.id !== 'light'
  const bg = dk ? '#080b14' : '#F8F9FA'
  const txt = dk ? '#ffffff' : '#0d111c'
  const muted = dk ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'
  const lineC = dk ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)'
  const isLandscape = fmt.w > fmt.h
  const padH = isLandscape ? 88 : 72
  const padV = isLandscape ? 60 : 76

  return (
    <div className="poster" style={{ width: fmt.w, height: fmt.h, background: bg, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle,${dk ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.035)'} 1px,transparent 1px)`, backgroundSize: '44px 44px', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 10, background: `linear-gradient(180deg,${accent.p},${accent.s})`, zIndex: 2 }} />
      <div style={{ position: 'relative', zIndex: 3, height: '100%', display: 'flex', flexDirection: 'column', padding: `${padV}px ${padH}px`, paddingLeft: padH + 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 54, height: 54, background: `linear-gradient(135deg,${accent.p},${accent.s})`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 17, fontWeight: 900, color: '#fff', letterSpacing: '-.01em' }}>{(data.initials || 'JS').toUpperCase()}</span>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: txt, letterSpacing: '.01em', lineHeight: 1.1 }}>{data.channel}</div>
              <div style={{ fontSize: 13, color: muted, fontWeight: 500, marginTop: 3 }}>{data.handle}</div>
            </div>
          </div>
          {data.website && <div style={{ fontSize: 12, fontWeight: 600, color: muted, border: `1px solid ${lineC}`, borderRadius: 6, padding: '6px 14px', whiteSpace: 'nowrap' }}>{data.website}</div>}
        </div>
        {data.category && (
          <div style={{ alignSelf: 'flex-start', marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: accent.p, borderRadius: 5, padding: '8px 20px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 900, color: '#fff', letterSpacing: '.18em', textTransform: 'uppercase' }}>{data.category}</span>
            </div>
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22 }}>
          <div style={{ fontSize: data.hlSize || 64, fontWeight: 900, color: txt, lineHeight: 1.1, letterSpacing: '-.01em', textTransform: 'uppercase', fontFamily: 'Inter,sans-serif' }}>{data.headline}</div>
          {data.body && <div style={{ fontSize: 22, color: muted, fontWeight: 500, lineHeight: 1.65 }}>{data.body}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 22, borderTop: `1px solid ${lineC}` }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            {data.date && <span style={{ fontSize: 15, fontWeight: 700, color: muted, whiteSpace: 'nowrap' }}>{data.date}</span>}
            {data.source && <><span style={{ color: lineC, fontSize: 18 }}>|</span><span style={{ fontSize: 14, fontWeight: 700, color: accent.p, letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Source: {data.source}</span></>}
          </div>
          <LogoPill dark={dk} />
        </div>
      </div>
    </div>
  )
}

export function NewsTxtCtrl({ data, onChange }: ControlProps) {
  const SI = (k: keyof NewsTxtData) => <StringInput data={data} field={k} onChange={onChange} />
  return <>
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
    <Field label="Body Text (optional)">
      <textarea value={data.body || ''} onChange={e => onChange({ ...data, body: e.target.value })} />
    </Field>
    <div className="field-row">
      <Field label="Date">{SI('date')}</Field>
      <Field label="Source">{SI('source')}</Field>
    </div>
    <div className="sec-label">Font Sizes</div>
    <Slider label="Headline" data={data} field="hlSize" min={28} max={120} onChange={onChange} />
  </>
}
