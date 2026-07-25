import { PosterShell } from '@/components/PosterShell'
import { Field, StringInput, Slider } from '@/components/Controls'
import type { Accent, Format, FxState, ControlProps } from '@/types'

export interface YoutubeData {
  badge?: string
  title?: string
  subtitle?: string
  titleSize?: number
  subSize?: number
}

export const youtubeDefaults: YoutubeData = {
  badge: 'FREE LESSON',
  title: 'Learn Japanese in Bangla',
  subtitle: 'JLPT N5 → N1 · Full Course',
  titleSize: 110,
  subSize: 44,
}

export function YoutubePoster({ data, accent, fx, fmt }: {
  data: YoutubeData; accent: Accent; fx: FxState; fmt: Format
}) {
  const dk = accent.dark
  const txt = dk ? '#fff' : '#1D3557'
  const muted = dk ? 'rgba(255,255,255,0.88)' : 'rgba(29,53,87,0.75)'

  return (
    <PosterShell accent={accent} fx={fx} fmt={fmt}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {data.badge ? (
          <div style={{
            background: '#FFFFFF',
            color: accent.bg.startsWith('#') ? accent.bg : accent.p,
            borderRadius: 999,
            padding: '14px 32px',
            fontFamily: 'Inter,Noto Sans Bengali,sans-serif',
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: '.04em',
            whiteSpace: 'nowrap',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          }}>{data.badge}</div>
        ) : <div />}
        <div style={{
          width: 140, height: 140, borderRadius: '50%',
          background: accent.p,
          boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
        }} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24, marginTop: -30 }}>
        <div style={{
          fontFamily: 'DM Serif Display,Georgia,serif',
          fontSize: data.titleSize || 110,
          fontWeight: 400,
          color: txt,
          lineHeight: 1.02,
          letterSpacing: '-.02em',
          textShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}>{data.title}</div>

        {data.subtitle && (
          <div style={{
            fontFamily: 'Noto Sans Bengali,Inter,sans-serif',
            fontSize: data.subSize || 44,
            fontWeight: 600,
            color: muted,
            lineHeight: 1.25,
          }}>{data.subtitle}</div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <img
          src="/assets/logo-light.webp"
          alt="Japanese Shikhi"
          style={{ height: 56, filter: dk ? 'brightness(0) invert(1)' : 'none' }}
        />
        <div style={{
          background: 'rgba(255,255,255,0.18)',
          border: '2px solid rgba(255,255,255,0.35)',
          borderRadius: 999,
          padding: '12px 30px',
          fontSize: 24,
          fontWeight: 800,
          color: '#fff',
          letterSpacing: '.02em',
        }}>japaneseshikhi.com</div>
      </div>
    </PosterShell>
  )
}

export function YoutubeCtrl({ data, onChange }: ControlProps) {
  const SI = (k: keyof YoutubeData) => <StringInput data={data} field={k} onChange={onChange} />
  return <>
    <Field label="Badge">{SI('badge')}</Field>
    <Field label="Title">{SI('title')}</Field>
    <Field label="Subtitle">{SI('subtitle')}</Field>
    <div className="sec-label">Font Sizes</div>
    <Slider label="Title" data={data} field="titleSize" min={60} max={180} onChange={onChange} />
    <Slider label="Subtitle" data={data} field="subSize" min={24} max={80} onChange={onChange} />
  </>
}
