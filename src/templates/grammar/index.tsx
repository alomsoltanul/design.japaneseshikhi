import { PosterShell } from '@/components/PosterShell'
import { DomainPill, LogoPill } from '@/components/BrandPills'
import { Field, StringInput, Slider, LevelSelect } from '@/components/Controls'
import { ExcelPasteImporter } from '@/components/ExcelPasteImporter'
import type { Accent, Format, FxState, ControlProps } from '@/types'

export interface GrammarData {
  level?: string
  pattern?: string
  patternReading?: string
  patternRomaji?: string
  meaningBn?: string
  meaningEn?: string
  structureFormula?: string
  parts?: string
  ex1jp?: string
  ex1bn?: string
  ex2jp?: string
  ex2bn?: string
  ptSize?: number
  exSize?: number
}

export const grammarDefaults: GrammarData = {
  level: 'N5', pattern: '〜は〜です',
  patternReading: '〜wa〜desu', patternRomaji: '~wa~desu',
  meaningBn: 'ব্যাকরণ প্যাটার্ন', meaningEn: 'Grammar pattern',
  structureFormula: 'Noun + は + Noun + です',
  parts: 'Noun, は, Noun, です',
  ex1jp: '私は学生です。', ex1bn: 'আমি একজন ছাত্র।',
  ex2jp: '彼は先生です。', ex2bn: 'তিনি একজন শিক্ষক।',
  ptSize: 96, exSize: 30,
}

const grammarFieldMap: Record<string, string> = {
  'pattern': 'pattern',
  'pattern_reading': 'patternReading',
  'pattern_romaji': 'patternRomaji',
  'meaning_bangla': 'meaningBn',
  'meaning_english': 'meaningEn',
  'structure_formula': 'structureFormula',
  'parts': 'parts',
  'ex1jp': 'ex1jp',
  'ex1bn': 'ex1bn',
  'ex2jp': 'ex2jp',
  'ex2bn': 'ex2bn',
}

export function GrammarPoster({ data, accent, fx, fmt }: {
  data: GrammarData; accent: Accent; fx: FxState; fmt: Format
}) {
  const dk = accent.dark, txt = dk ? '#fff' : '#1D3557'
  const muted = dk ? 'rgba(255,255,255,0.45)' : 'rgba(29,53,87,0.45)'
  const cardBg = dk ? 'rgba(255,255,255,0.05)' : 'rgba(29,53,87,0.05)'
  const cardBdr = dk ? 'rgba(255,255,255,0.10)' : 'rgba(29,53,87,0.10)'
  const parts = (data.parts || '').split(',').map(p => p.trim()).filter(Boolean)

  return (
    <PosterShell accent={accent} fx={fx} fmt={fmt}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <LogoPill dark={dk} />
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(244,162,97,0.9)', whiteSpace: 'nowrap' }}>{data.level} Grammar</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 3, background: accent.p, borderRadius: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: muted, whiteSpace: 'nowrap' }}>{data.level} Grammar · বাংলায় শিখুন</span>
        </div>

        {/* Pattern Card */}
        <div style={{ background: cardBg, border: `1px solid ${cardBdr}`, borderRadius: 20, padding: '38px 46px' }}>
          <div style={{ fontFamily: 'DM Serif Display,Georgia,serif', fontSize: data.ptSize || 96, fontWeight: 400, color: txt, lineHeight: 1.05, letterSpacing: '-.02em', marginBottom: 12, whiteSpace: 'nowrap' }}>{data.pattern}</div>
          {(data.patternReading || data.patternRomaji) && (
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              {data.patternReading && <span style={{ fontSize: 20, color: muted, fontWeight: 500 }}>{data.patternReading}</span>}
              {data.patternRomaji && <span style={{ fontSize: 20, color: muted, fontWeight: 500 }}>{data.patternRomaji}</span>}
            </div>
          )}
          {parts.length > 0 && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {parts.map((p, i) => (
              <div key={i} style={{
                background: i % 2 === 1 ? `${accent.p}33` : dk ? 'rgba(255,255,255,0.08)' : 'rgba(29,53,87,0.08)',
                border: `1px solid ${i % 2 === 1 ? accent.p + '55' : cardBdr}`,
                borderRadius: 8, padding: '7px 16px', fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap',
                color: i % 2 === 1 ? '#F4A261' : muted
              }}>{p}</div>
            ))}
          </div>}
        </div>

        {/* Meaning Section */}
        {(data.meaningBn || data.meaningEn) && (
          <div style={{ display: 'flex', gap: 14 }}>
            {data.meaningBn && (
              <div style={{ flex: 1, background: cardBg, border: `1px solid ${cardBdr}`, borderRadius: 16, padding: '22px 28px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(244,162,97,0.8)', marginBottom: 8 }}>Meaning (Bangla)</div>
                <div style={{ fontSize: 22, fontFamily: 'Noto Sans Bengali,Inter,sans-serif', fontWeight: 600, color: 'rgba(244,162,97,0.9)', lineHeight: 1.4 }}>{data.meaningBn}</div>
              </div>
            )}
            {data.meaningEn && (
              <div style={{ flex: 1, background: cardBg, border: `1px solid ${cardBdr}`, borderRadius: 16, padding: '22px 28px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(42,157,143,0.7)', marginBottom: 8 }}>Meaning (English)</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: 'rgba(42,157,143,0.9)', lineHeight: 1.4 }}>{data.meaningEn}</div>
              </div>
            )}
          </div>
        )}

        {/* Structure Formula */}
        {data.structureFormula && (
          <div style={{ background: cardBg, border: `1px solid ${cardBdr}`, borderRadius: 14, padding: '18px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent.s }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: muted }}>Structure Formula</span>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, color: txt, fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.5 }}>
              {data.structureFormula}
            </div>
          </div>
        )}

        {/* Examples */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {[[data.ex1jp, data.ex1bn, accent.p, accent.s, 'rgba(244,162,97,0.9)'], [data.ex2jp, data.ex2bn, '#2A9D8F', '#1D3557', 'rgba(42,157,143,0.9)']]
            .filter(([jp]) => jp)
            .map(([jp, bn, ca, cb, bnColor], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'stretch', gap: 18 }}>
                <div style={{ width: 4, background: `linear-gradient(180deg,${ca},${cb})`, borderRadius: 4, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: data.exSize || 30, fontWeight: 700, color: txt, lineHeight: 1.35, whiteSpace: 'nowrap' }}>{jp}</div>
                  {bn && <div style={{ fontSize: 19, color: bnColor as string, fontWeight: 500, marginTop: 6, fontFamily: 'Noto Sans Bengali,Inter,sans-serif', whiteSpace: 'nowrap' }}>{bn}</div>}
                </div>
              </div>
            ))}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'Noto Sans Bengali,Inter,sans-serif', fontSize: 17, color: muted, fontWeight: 500, whiteSpace: 'nowrap' }}>বাংলায় জাপানি ব্যাকরণ শিখুন</span>
        <DomainPill accent={accent} />
      </div>
    </PosterShell>
  )
}

export function GrammarCtrl({ data, onChange, onDownload, onStartBatch }: ControlProps) {
  const SI = (k: keyof GrammarData) => <StringInput data={data} field={k} onChange={onChange} />
  return <>
    <ExcelPasteImporter
      data={data}
      onChange={onChange}
      fieldMap={grammarFieldMap}
      templateName="Grammar"
      onDownload={onDownload}
      onStartBatch={onStartBatch}
    />
    <LevelSelect data={data} onChange={onChange} />
    <Field label="Grammar Pattern">{SI('pattern')}</Field>
    <div className="field-row">
      <Field label="Reading">{SI('patternReading')}</Field>
      <Field label="Romaji">{SI('patternRomaji')}</Field>
    </div>
    <Field label="Parts (comma-separated)">{SI('parts')}</Field>
    <div className="field-row">
      <Field label="Meaning BN">{SI('meaningBn')}</Field>
      <Field label="Meaning EN">{SI('meaningEn')}</Field>
    </div>
    <Field label="Structure Formula">{SI('structureFormula')}</Field>
    <div className="field-row">
      <Field label="Example 1 JP">{SI('ex1jp')}</Field>
      <Field label="Example 1 BN">{SI('ex1bn')}</Field>
    </div>
    <div className="field-row">
      <Field label="Example 2 JP">{SI('ex2jp')}</Field>
      <Field label="Example 2 BN">{SI('ex2bn')}</Field>
    </div>
    <div className="sec-label">Font Sizes</div>
    <Slider label="Pattern" data={data} field="ptSize" min={40} max={140} onChange={onChange} />
    <Slider label="Examples" data={data} field="exSize" min={16} max={60} onChange={onChange} />
  </>
}
