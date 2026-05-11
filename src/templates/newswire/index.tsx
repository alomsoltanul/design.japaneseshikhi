import { LogoPill } from '@/components/BrandPills'
import { Orbs } from '@/components/PosterShell'
import { Field, StringInput, Slider } from '@/components/Controls'
import type { Accent, Format, FxState, ControlProps } from '@/types'

export interface NewsWireData {
  channel?: string
  handle?: string
  website?: string
  date?: string
  headline?: string
  story1?: string
  story2?: string
  story3?: string
  source?: string
  hlSize?: number
}

export const newsWireDefaults: NewsWireData = {
  channel: 'Japanese Shikhi', handle: '@japaneseshikhi',
  website: 'japaneseshikhi.com', date: 'May 10, 2026',
  headline: "TODAY'S HIGHLIGHTS",
  story1: 'New N5 Grammar module with 40+ example sentences now live on the platform',
  story2: 'JLPT mock exam scores improved 35% for learners using SRS flashcards daily',
  story3: 'Bengali learners now the fastest growing group — community hits 10,000 members',
  source: 'Japanese Shikhi', hlSize: 44,
}

export function NewsWirePoster({ data, accent, fx, fmt }: {
  data: NewsWireData; accent: Accent; fx: FxState; fmt: Format
}) {
  const dk = accent.id !== 'light'
  const bg = dk ? '#06080f' : '#FFFFFF'
  const txt = dk ? '#ffffff' : '#0d111c'
  const muted = dk ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)'
  const lineC = dk ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'
  const stories = [data.story1, data.story2, data.story3].filter(Boolean)
  const initials = (data.channel || 'JS').substring(0, 2).toUpperCase()
  const isLandscape = fmt.w > fmt.h
  const padH = isLandscape ? 88 : 72
  const padV = isLandscape ? 60 : 76

  return (
    <div className="poster" style={{ width: fmt.w, height: fmt.h, background: bg, position: 'relative', overflow: 'hidden' }}>
      {fx.orbs && <Orbs c1={accent.p} c2={accent.s} />}
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', padding: `${padV}px ${padH}px` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 22, borderBottom: `2px solid ${accent.p}`, marginBottom: 34 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 46, height: 46, background: `linear-gradient(135deg,${accent.p},${accent.s})`, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>{initials}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: txt, letterSpacing: '.01em' }}>{data.channel}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: muted, whiteSpace: 'nowrap' }}>{data.handle}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: muted, whiteSpace: 'nowrap' }}>{data.date}</span>
          </div>
        </div>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: data.hlSize || 44, fontWeight: 900, color: txt, letterSpacing: '-.02em', lineHeight: 1, textTransform: 'uppercase' }}>{data.headline}</div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {stories.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 24, alignItems: 'flex-start', padding: '24px 0', borderBottom: i < stories.length - 1 ? `1px solid ${lineC}` : 'none' }}>
              <div style={{ width: 46, height: 46, borderRadius: 9, background: `${accent.p}18`, border: `1px solid ${accent.p}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: accent.p }}>{i + 1}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: txt, lineHeight: 1.38 }}>{s}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 22, borderTop: `1px solid ${lineC}` }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: muted, whiteSpace: 'nowrap' }}>{data.website}</span>
          <LogoPill dark={dk} />
        </div>
      </div>
    </div>
  )
}

export function NewsWireCtrl({ data, onChange }: ControlProps) {
  const SI = (k: keyof NewsWireData) => <StringInput data={data} field={k} onChange={onChange} />
  return <>
    <div className="field-row">
      <Field label="Channel Name">{SI('channel')}</Field>
      <Field label="Handle">{SI('handle')}</Field>
    </div>
    <div className="field-row">
      <Field label="Website">{SI('website')}</Field>
      <Field label="Date">{SI('date')}</Field>
    </div>
    <Field label="Section Headline">{SI('headline')}</Field>
    <Field label="Story 1">
      <textarea value={data.story1 || ''} onChange={e => onChange({ ...data, story1: e.target.value })} style={{ minHeight: 60 }} />
    </Field>
    <Field label="Story 2">
      <textarea value={data.story2 || ''} onChange={e => onChange({ ...data, story2: e.target.value })} style={{ minHeight: 60 }} />
    </Field>
    <Field label="Story 3">
      <textarea value={data.story3 || ''} onChange={e => onChange({ ...data, story3: e.target.value })} style={{ minHeight: 60 }} />
    </Field>
    <div className="field-row">
      <Field label="Source">{SI('source')}</Field>
    </div>
    <div className="sec-label">Font Sizes</div>
    <Slider label="Section Headline" data={data} field="hlSize" min={24} max={80} onChange={onChange} />
  </>
}
