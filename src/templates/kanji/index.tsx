import { PosterShell } from '@/components/PosterShell'
import { DomainPill, LogoPill } from '@/components/BrandPills'
import { Field, StringInput, Slider, LevelSelect } from '@/components/Controls'
import { ExcelPasteImporter } from '@/components/ExcelPasteImporter'
import type { Accent, Format, FxState, ControlProps } from '@/types'

export interface KanjiData {
  level?: string
  kanji?: string
  kun?: string
  on?: string
  meaningEn?: string
  meaningBn?: string
  exJp?: string
  exRomaji?: string
  exBn?: string
  strokes?: string
  kanjiSize?: number
}

export const kanjiDefaults: KanjiData = {
  level: 'N5', kanji: '山', kun: 'やま', on: 'サン',
  meaningEn: 'Mountain', meaningBn: 'পাহাড়',
  exJp: '富士山', exRomaji: 'Fujisan', exBn: 'ফুজি পর্বত', strokes: '3', kanjiSize: 220,
}

const kanjiFieldMap: Record<string, string> = {
  'kanji': 'kanji',
  'kun': 'kun',
  'on': 'on',
  'meaning_en': 'meaningEn',
  'meaning_bn': 'meaningBn',
  'example_jp': 'exJp',
  'example_romaji': 'exRomaji',
  'example_bn': 'exBn',
  'strokes': 'strokes',
}

export function KanjiPoster({ data, accent, fx, fmt }: {
  data: KanjiData; accent: Accent; fx: FxState; fmt: Format
}) {
  const bg = accent.id === 'light' ? '#FFFFFF' : 'linear-gradient(135deg,#1D3557 0%,#0f1e35 50%,#0a1525 100%)'
  const dk = accent.id !== 'light', txt = dk ? '#fff' : '#1D3557'
  const muted = dk ? 'rgba(255,255,255,0.45)' : 'rgba(29,53,87,0.45)'
  const cardBg = dk ? 'rgba(255,255,255,0.06)' : 'rgba(29,53,87,0.06)'
  const cardBdr = dk ? 'rgba(255,255,255,0.10)' : 'rgba(29,53,87,0.10)'

  return (
    <PosterShell accent={accent} fx={fx} bgOverride={bg} gridLines fmt={fmt}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <LogoPill dark={dk} />
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(244,162,97,0.9)', whiteSpace: 'nowrap' }}>{data.level} · 漢字カード</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: data.kanjiSize || 220, fontWeight: 700, color: txt, lineHeight: 1, textAlign: 'center' }}>{data.kanji}</div>
          {data.strokes && <div style={{ position: 'absolute', top: -8, right: -44, background: `${accent.p}22`, border: `1px solid ${accent.p}44`, borderRadius: 8, padding: '5px 11px', fontSize: 14, fontWeight: 700, color: accent.p, whiteSpace: 'nowrap' }}>{data.strokes} 画</div>}
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {[['くん', data.kun], ['おん', data.on]].map(([label, val], i) => (
            <div key={i} style={{ textAlign: 'center', background: cardBg, border: `1px solid ${cardBdr}`, borderRadius: 14, padding: '16px 32px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', color: accent.p, marginBottom: 7, whiteSpace: 'nowrap' }}>{label}</div>
              <div style={{ fontSize: 34, fontWeight: 700, color: txt, whiteSpace: 'nowrap' }}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 44, fontWeight: 700, color: txt, whiteSpace: 'nowrap' }}>{data.meaningEn}</div>
          <div style={{ fontSize: 34, fontFamily: 'Noto Sans Bengali,Inter,sans-serif', color: 'rgba(244,162,97,0.9)', fontWeight: 600, marginTop: 8, whiteSpace: 'nowrap' }}>{data.meaningBn}</div>
        </div>
        {data.exJp && <div style={{ textAlign: 'center', background: cardBg, border: `1px solid ${cardBdr}`, borderRadius: 14, padding: '18px 36px' }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: txt, whiteSpace: 'nowrap' }}>{data.exJp}</div>
          {data.exRomaji && <div style={{ fontSize: 17, color: muted, fontWeight: 500, marginTop: 5, whiteSpace: 'nowrap' }}>{data.exRomaji}</div>}
          {data.exBn && <div style={{ fontSize: 20, fontFamily: 'Noto Sans Bengali,Inter,sans-serif', color: 'rgba(42,157,143,0.9)', fontWeight: 500, marginTop: 5, whiteSpace: 'nowrap' }}>{data.exBn}</div>}
        </div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><DomainPill accent={accent} /></div>
    </PosterShell>
  )
}

export function KanjiCtrl({ data, onChange, onDownload, onStartBatch }: ControlProps) {
  const SI = (k: keyof KanjiData) => <StringInput data={data} field={k} onChange={onChange} />
  return <>
    <ExcelPasteImporter
      data={data}
      onChange={onChange}
      fieldMap={kanjiFieldMap}
      templateName="Kanji"
      onDownload={onDownload}
      onStartBatch={onStartBatch}
    />
    <LevelSelect data={data} onChange={onChange} />
    <div className="field-row">
      <Field label="Kanji">{SI('kanji')}</Field>
      <Field label="Strokes">{SI('strokes')}</Field>
    </div>
    <div className="field-row">
      <Field label="Kun (くん)">{SI('kun')}</Field>
      <Field label="On (おん)">{SI('on')}</Field>
    </div>
    <div className="field-row">
      <Field label="Meaning EN">{SI('meaningEn')}</Field>
      <Field label="Meaning BN">{SI('meaningBn')}</Field>
    </div>
    <Field label="Example JP">{SI('exJp')}</Field>
    <div className="field-row">
      <Field label="Romaji">{SI('exRomaji')}</Field>
      <Field label="Example BN">{SI('exBn')}</Field>
    </div>
    <div className="sec-label">Font Sizes</div>
    <Slider label="Kanji Size" data={data} field="kanjiSize" min={80} max={320} onChange={onChange} />
  </>
}
