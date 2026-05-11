import { PosterShell } from '@/components/PosterShell'
import { DomainPill, LogoPill } from '@/components/BrandPills'
import { Field, StringInput, Slider, LevelSelect } from '@/components/Controls'
import type { Accent, Format, FxState, ControlProps } from '@/types'

export interface ChallengeData {
  level?: string
  qBn?: string
  q?: string
  opts?: string
  answer?: string
  exBn?: string
  qSize?: number
}

export const challengeDefaults: ChallengeData = {
  level: 'N5', qBn: 'শূন্যস্থানে কোনটি সঠিক?', q: '私___学生です。',
  opts: 'が, は, を, に', answer: '1',
  exBn: '「は」টি subject marker — তাই এখানে 「は」 সঠিক।', qSize: 72,
}

export function ChallengePoster({ data, accent, fx, fmt }: {
  data: ChallengeData; accent: Accent; fx: FxState; fmt: Format
}) {
  const dk = accent.dark, txt = dk ? '#fff' : '#1D3557'
  const muted = dk ? 'rgba(255,255,255,0.45)' : 'rgba(29,53,87,0.45)'
  const cardBg = dk ? 'rgba(255,255,255,0.05)' : 'rgba(29,53,87,0.05)'
  const cardBdr = dk ? 'rgba(255,255,255,0.10)' : 'rgba(29,53,87,0.10)'
  const opts = (data.opts || '').split(',').map(o => o.trim()).filter(Boolean)
  const ansIdx = parseInt(data.answer || '0')

  return (
    <PosterShell accent={accent} fx={fx} fmt={fmt}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <LogoPill dark={dk} />
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(244,162,97,0.9)', whiteSpace: 'nowrap' }}>{data.level} · আজকের চ্যালেঞ্জ</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28 }}>
        <div style={{ fontFamily: 'Noto Sans Bengali,Inter,sans-serif', fontSize: 26, color: muted, fontWeight: 600 }}>{data.qBn}</div>
        <div style={{ background: cardBg, border: `1px solid ${cardBdr}`, borderRadius: 20, padding: '36px 46px' }}>
          <div style={{ fontSize: data.qSize || 72, fontWeight: 700, color: txt, lineHeight: 1.3 }}>{data.q}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {opts.map((opt, i) => {
            const isAns = i === ansIdx
            return (
              <div key={i} style={{
                background: isAns ? `${accent.p}20` : cardBg,
                border: `2px solid ${isAns ? accent.p : cardBdr}`,
                borderRadius: 14, padding: '16px 24px', display: 'flex', gap: 14, alignItems: 'center'
              }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: isAns ? accent.p : muted, flexShrink: 0 }}>{String.fromCharCode(65 + i)}</span>
                <span style={{ fontSize: 34, fontWeight: 700, color: isAns ? txt : muted, whiteSpace: 'nowrap' }}>{opt}</span>
                {isAns && <span style={{ marginLeft: 'auto', color: '#2A9D8F', fontSize: 22, flexShrink: 0 }}>✓</span>}
              </div>
            )
          })}
        </div>
        {data.exBn && <div style={{ background: `${accent.p}12`, border: `1px solid ${accent.p}30`, borderRadius: 14, padding: '18px 26px' }}>
          <div style={{ fontFamily: 'Noto Sans Bengali,Inter,sans-serif', fontSize: 21, color: dk ? 'rgba(244,162,97,0.9)' : accent.p, fontWeight: 600, lineHeight: 1.5 }}>💡 {data.exBn}</div>
        </div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><DomainPill accent={accent} /></div>
    </PosterShell>
  )
}

export function ChallengeCtrl({ data, onChange }: ControlProps) {
  const SI = (k: keyof ChallengeData) => <StringInput data={data} field={k} onChange={onChange} />
  return <>
    <LevelSelect data={data} onChange={onChange} />
    <Field label="Question label (BN)">{SI('qBn')}</Field>
    <Field label="Question (JP)">
      <textarea value={data.q || ''} onChange={e => onChange({ ...data, q: e.target.value })} />
    </Field>
    <Field label="Options (comma-separated)">{SI('opts')}</Field>
    <Field label="Correct Answer">
      <select value={data.answer || '0'} onChange={e => onChange({ ...data, answer: e.target.value })}>
        {['0', '1', '2', '3'].map(n => <option key={n} value={n}>{String.fromCharCode(65 + parseInt(n))}</option>)}
      </select>
    </Field>
    <Field label="Explanation (BN)">
      <textarea value={data.exBn || ''} onChange={e => onChange({ ...data, exBn: e.target.value })} />
    </Field>
    <div className="sec-label">Font Sizes</div>
    <Slider label="Question" data={data} field="qSize" min={28} max={110} onChange={onChange} />
  </>
}
