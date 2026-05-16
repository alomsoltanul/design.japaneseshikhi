import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { PALETTES, type PaletteKey, type TemplateData } from '@/poster-maker/data'

export type PosterProps = {
  d: TemplateData
  pal: PaletteKey
}

function PosterFrame({
  children,
  style,
  size = 1080,
  height,
}: {
  children: ReactNode
  style?: CSSProperties
  size?: number
  height?: number
}) {
  return (
    <div
      style={{
        width: size,
        height: height ?? size,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Inter', 'Noto Sans JP', sans-serif",
        boxSizing: 'border-box',
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function MIJLogo({ invert = true, size = 28 }: { invert?: boolean; size?: number }) {
  return (
    <img
      src="/logo.svg"
      alt="Muslims in Japan"
      style={{ height: size, width: 'auto', filter: invert ? 'brightness(0) invert(1)' : 'none' }}
    />
  )
}

function DiamondPattern({ color = '#fff', opacity = 0.04 }: { color?: string; opacity?: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity,
        backgroundImage: `repeating-linear-gradient(45deg,${color} 0,${color} 1px,transparent 1px,transparent 36px),repeating-linear-gradient(-45deg,${color} 0,${color} 1px,transparent 1px,transparent 36px)`,
      }}
    />
  )
}

function DotGrid({ color = '#fff', opacity = 0.06 }: { color?: string; opacity?: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity,
        backgroundImage: `radial-gradient(circle,${color} 1.5px,transparent 1.5px)`,
        backgroundSize: '40px 40px',
      }}
    />
  )
}

function ET01({ d, pal }: PosterProps) {
  const c = PALETTES[pal] ?? PALETTES['jade-gold']
  return (
    <PosterFrame style={{ background: c.bg }}>
      <DiamondPattern />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: `linear-gradient(90deg,${c.p},${c.l})` }} />
      <div style={{ position: 'absolute', top: 100, left: 72, width: 5, height: 480, background: `linear-gradient(180deg,${c.p},${c.l})`, borderRadius: 4 }} />
      <div style={{ position: 'absolute', top: 100, left: 108, right: 72, display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: `${c.p}20`, border: `1.5px solid ${c.p}50`, borderRadius: 40, padding: '10px 24px', width: 'fit-content' }}>
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: c.l }} />
          <span style={{ color: c.l, fontSize: 20, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{d.badge}</span>
        </div>
        <h1 style={{ color: '#fff', fontSize: 108, fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.03em', margin: 0 }}>
          {d.headline}
          <br />
          <span style={{ color: c.pale }}>{d.accentWord}</span>
        </h1>
        <p style={{ color: '#cbd5e1', fontSize: 30, lineHeight: 1.55, margin: 0, maxWidth: 700 }}>{d.body}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <span style={{ color: '#94a3b8', fontSize: 24, borderLeft: `4px solid ${c.p}`, paddingLeft: 14 }}>{d.date}</span>
          <span style={{ color: '#94a3b8', fontSize: 24, borderLeft: `4px solid ${c.l}`, paddingLeft: 14 }}>{d.website}</span>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 110, background: `${c.mid}ee`, borderTop: `1px solid ${c.p}25`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 72px' }}>
        <MIJLogo invert size={34} />
        <span style={{ color: c.l, fontSize: 22, letterSpacing: '0.14em', fontWeight: 600 }}>MUSLIMS IN JAPAN</span>
      </div>
    </PosterFrame>
  )
}

function ET02({ d, pal }: PosterProps) {
  const c = PALETTES[pal] ?? PALETTES['jade-gold']
  const items = [
    { icon: '📅', label: 'DATE', value: d.date },
    { icon: '🕐', label: 'TIME', value: d.time },
    { icon: '📍', label: 'LOCATION', value: d.location },
  ]
  return (
    <PosterFrame style={{ background: '#f8fafc' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 340, background: c.p }}>
        <DiamondPattern color="#fff" opacity={0.06} />
        <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 50, background: '#f8fafc', clipPath: 'ellipse(60% 100% at 50% 100%)' }} />
      </div>
      <div style={{ position: 'absolute', top: 60, left: 0, right: 0, textAlign: 'center' }}>
        <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 18, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase' }}>{d.category}</span>
        <h1 style={{ color: '#fff', fontSize: 80, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em', margin: '14px 0 0', padding: '0 60px', whiteSpace: 'pre-line' }}>{d.eventTitle}</h1>
      </div>
      <div style={{ position: 'absolute', top: 370, left: 72, right: 72, display: 'flex', flexDirection: 'column', gap: 36 }}>
        {items.map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <span style={{ fontSize: 48 }}>{item.icon}</span>
            <div>
              <p style={{ color: '#94a3b8', fontSize: 18, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>{item.label}</p>
              <p style={{ color: '#0f172a', fontSize: 34, fontWeight: 700, margin: '4px 0 0' }}>{item.value}</p>
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 110, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 72px' }}>
        <MIJLogo invert size={34} />
        <span style={{ color: c.l, fontSize: 20, letterSpacing: '0.12em', fontWeight: 600 }}>{d.footer}</span>
      </div>
    </PosterFrame>
  )
}

function ET03({ d, pal }: PosterProps) {
  const c = PALETTES[pal] ?? PALETTES['jade-gold']
  return (
    <PosterFrame style={{ background: c.mid }}>
      <DotGrid color={c.l} opacity={0.08} />
      {[{ t: 40, l: 40 }, { t: 40, r: 40 }, { b: 40, l: 40 }, { b: 40, r: 40 }].map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            ...pos,
            width: 60,
            height: 60,
            borderTop: pos.t != null ? `3px solid ${c.l}` : undefined,
            borderBottom: pos.b != null ? `3px solid ${c.l}` : undefined,
            borderLeft: pos.l != null ? `3px solid ${c.l}` : undefined,
            borderRight: pos.r != null ? `3px solid ${c.l}` : undefined,
          }}
        />
      ))}
      <div style={{ position: 'absolute', top: 90, left: 72, fontSize: 280, lineHeight: 1, color: c.l, opacity: 0.12, fontFamily: 'Georgia,serif', fontWeight: 700, userSelect: 'none' }}>"</div>
      <div style={{ position: 'absolute', top: 130, left: 72, right: 72, display: 'flex', flexDirection: 'column', gap: 40 }}>
        <p style={{ color: '#fff', fontSize: 50, fontWeight: 400, lineHeight: 1.45, fontStyle: 'italic', fontFamily: "'Noto Serif', Georgia, serif", margin: 0 }}>{d.quote}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ color: c.l, fontSize: 26, fontWeight: 700 }}>{d.attribution}</span>
          <span style={{ color: '#64748b', fontSize: 20 }}>{d.source}</span>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 110, borderTop: `1px solid ${c.l}30`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 72px' }}>
        <MIJLogo invert size={30} />
        <span style={{ color: c.l, fontSize: 20, letterSpacing: '0.1em', fontWeight: 600 }}>muslimsinjapan.com</span>
      </div>
    </PosterFrame>
  )
}

function ET04({ d, pal }: PosterProps) {
  const c = PALETTES[pal] ?? PALETTES['jade-gold']
  const prayers = [
    { name: 'Fajr', ar: 'الفجر', time: d.fajr, color: c.l },
    { name: 'Dhuhr', ar: 'الظهر', time: d.dhuhr, color: c.pale },
    { name: 'Asr', ar: 'العصر', time: d.asr, color: c.gold },
    { name: 'Maghrib', ar: 'المغرب', time: d.maghrib, color: '#f97316' },
    { name: 'Isha', ar: 'العشاء', time: d.isha, color: '#a78bfa' },
  ]
  return (
    <PosterFrame style={{ background: c.bg }}>
      <DiamondPattern opacity={0.04} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: `linear-gradient(90deg,${c.l},${c.p})` }} />
      <div style={{ position: 'absolute', top: 60, left: 0, right: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ color: c.l, fontSize: 20, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>PRAYER TIMES</span>
        <h2 style={{ color: '#fff', fontSize: 64, fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>{d.city}</h2>
        <span style={{ color: '#94a3b8', fontSize: 24 }}>{d.dateStr} · {d.hijri}</span>
      </div>
      <div style={{ position: 'absolute', top: 256, left: 72, right: 72, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {prayers.map((p, i) => (
          <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: c.soft, border: `1px solid ${p.color}22`, borderLeft: `4px solid ${p.color}`, borderRadius: 16, padding: '26px 36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <span style={{ color: '#475569', fontSize: 22, minWidth: 28 }}>{String(i + 1).padStart(2, '0')}</span>
              <div>
                <p style={{ color: '#fff', fontSize: 34, fontWeight: 700, margin: 0 }}>{p.name}</p>
                <p style={{ color: p.color, fontSize: 20, margin: 0, opacity: 0.8 }}>{p.ar}</p>
              </div>
            </div>
            <span style={{ color: p.color, fontSize: 44, fontWeight: 800, letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' }}>{p.time}</span>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 96, background: `${c.mid}dd`, borderTop: `1px solid ${c.p}20`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 72px' }}>
        <MIJLogo invert size={30} />
        <span style={{ color: '#94a3b8', fontSize: 20 }}>muslimsinjapan.com/prayer-times</span>
      </div>
    </PosterFrame>
  )
}

function ET05({ d, pal }: PosterProps) {
  const c = PALETTES[pal] ?? PALETTES['jade-gold']
  return (
    <PosterFrame style={{ background: '#f8fafc' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 520, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
        <DiamondPattern color="#fff" opacity={0.04} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: 0.4 }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          <span style={{ color: 'white', fontFamily: 'monospace', fontSize: 16 }}>drag photo here</span>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(transparent,rgba(2,6,23,0.8))' }} />
        <div style={{ position: 'absolute', top: 32, left: 40, background: `${c.p}ee`, borderRadius: 40, padding: '8px 24px' }}>
          <span style={{ color: '#fff', fontSize: 20, fontWeight: 700, letterSpacing: '0.08em' }}>{d.cityBadge}</span>
        </div>
      </div>
      <div style={{ position: 'absolute', top: 480, left: 0, right: 0, bottom: 0, background: '#0f172a', padding: '36px 72px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ color: c.l, fontSize: 18, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>FEATURED MOSQUE</span>
          <h2 style={{ color: '#fff', fontSize: 52, fontWeight: 900, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.05 }}>{d.mosqueName}</h2>
          <p style={{ color: '#cbd5e1', fontSize: 24, margin: 0 }}>{d.address}</p>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 90, background: '#020617', borderTop: `1px solid ${c.p}20`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 72px' }}>
        <MIJLogo invert size={28} />
        <span style={{ color: c.l, fontSize: 20, fontWeight: 600, letterSpacing: '0.1em' }}>muslimsinjapan.com/mosques</span>
      </div>
    </PosterFrame>
  )
}

function ET06({ d }: PosterProps) {
  const c = PALETTES['purple-moon']
  return (
    <PosterFrame style={{ background: '#0d0a1e' }}>
      <DotGrid color="#a78bfa" opacity={0.12} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%,rgba(167,139,250,0.15),transparent 65%)' }} />
      <div style={{ position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)', width: 220, height: 220, borderRadius: '50%', boxShadow: `inset -40px -10px 0 ${c.gold}`, filter: `drop-shadow(0 0 24px ${c.gold}40)` }} />
      <div style={{ position: 'absolute', top: 105, left: 'calc(50% + 80px)', width: 20, height: 20, background: c.gold, clipPath: 'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)', filter: `drop-shadow(0 0 8px ${c.gold}90)` }} />
      <div style={{ position: 'absolute', top: 316, left: 0, right: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ color: c.gold, fontSize: 78, fontWeight: 700, margin: 0, fontFamily: "'Noto Serif',Georgia,serif", letterSpacing: '0.05em' }}>{d.arabic}</p>
        <h1 style={{ color: '#e2d9f3', fontSize: 68, fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>{d.heading}</h1>
        <p style={{ color: 'rgba(167,139,250,0.8)', fontSize: 28, margin: '6px 0 0', letterSpacing: '0.06em', padding: '0 60px' }}>{d.subtitle}</p>
      </div>
      <div style={{ position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', width: 640, height: 120, borderRadius: '50% 50% 0 0 / 100% 100% 0 0', border: '1px solid rgba(167,139,250,0.2)', borderBottom: 'none' }} />
      <div style={{ position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)', width: 800, height: 100, borderRadius: '50% 50% 0 0 / 100% 100% 0 0', border: '1px solid rgba(167,139,250,0.1)', borderBottom: 'none' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, borderTop: '1px solid rgba(167,139,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 72px' }}>
        <MIJLogo invert size={30} />
        <span style={{ color: 'rgba(167,139,250,0.6)', fontSize: 20, letterSpacing: '0.1em' }}>muslimsinjapan.com</span>
      </div>
    </PosterFrame>
  )
}

function ET07({ d, pal }: PosterProps) {
  const c = PALETTES[pal] ?? PALETTES['jade-gold']
  return (
    <PosterFrame style={{ background: `linear-gradient(145deg, ${c.mid} 0%, ${c.soft} 60%, ${c.bg} 100%)` }}>
      <DiamondPattern color={c.pale} opacity={0.05} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 7, background: `linear-gradient(90deg,${c.p},${c.pale})` }} />
      <div style={{ position: 'absolute', top: 72, left: 72, right: 72, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ background: c.p, color: '#fff', fontSize: 18, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', padding: '8px 22px', borderRadius: 24 }}>{d.category}</span>
          <span style={{ color: '#94a3b8', fontSize: 20 }}>{d.date}</span>
        </div>
        <div style={{ width: '100%', height: 340, background: `${c.soft}`, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${c.p}20`, flexDirection: 'column', gap: 8 }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
          <span style={{ color: '#475569', fontFamily: 'monospace', fontSize: 16 }}>drag cover image here</span>
        </div>
        <h2 style={{ color: '#fff', fontSize: 52, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.02em', margin: 0 }}>{d.headline}</h2>
        <p style={{ color: 'rgba(203,213,225,0.75)', fontSize: 26, lineHeight: 1.5, margin: 0 }}>{d.body}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 8, borderTop: `1px solid ${c.p}25` }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${c.p}30`, border: `2px solid ${c.p}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: c.pale, fontWeight: 700, fontSize: 18 }}>MJ</span>
          </div>
          <div>
            <p style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>{d.author}</p>
            <p style={{ color: '#64748b', fontSize: 17, margin: 0 }}>muslimsinjapan.com/blog</p>
          </div>
        </div>
      </div>
    </PosterFrame>
  )
}

function ET08({ d, pal }: PosterProps) {
  const c = PALETTES[pal] ?? PALETTES['jade-gold']
  return (
    <PosterFrame style={{ background: '#faf9f5' }}>
      <div style={{ position: 'absolute', inset: 36, border: `1.5px solid ${c.p}30`, borderRadius: 4, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 44, border: `0.5px solid ${c.p}15`, borderRadius: 2, pointerEvents: 'none' }} />
      {[{ top: 34, left: 34 }, { top: 34, right: 34 }, { bottom: 34, left: 34 }, { bottom: 34, right: 34 }].map((pos, i) => (
        <div key={i} style={{ position: 'absolute', ...pos, width: 12, height: 12, background: c.p, transform: 'rotate(45deg)' }} />
      ))}
      <div style={{ position: 'absolute', top: 76, left: 0, right: 0, textAlign: 'center' }}>
        <span style={{ color: c.p, fontSize: 18, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase' }}>DAILY DUA · دعاء اليوم</span>
      </div>
      <div style={{ position: 'absolute', top: 122, left: '50%', transform: 'translateX(-50%)', width: 120, height: 2, background: `linear-gradient(90deg,transparent,${c.p},transparent)` }} />
      <div style={{ position: 'absolute', top: 150, left: 80, right: 80, textAlign: 'center' }}>
        <p style={{ color: '#0f172a', fontSize: 52, lineHeight: 1.7, fontFamily: "'Noto Serif',Georgia,serif", direction: 'rtl', margin: 0, fontWeight: 600 }}>{d.arabic}</p>
      </div>
      <div style={{ position: 'absolute', top: 398, left: '50%', transform: 'translateX(-50%)', width: 80, height: 1, background: `${c.p}40` }} />
      <div style={{ position: 'absolute', top: 420, left: 80, right: 80, textAlign: 'center' }}>
        <p style={{ color: '#64748b', fontSize: 28, fontStyle: 'italic', fontFamily: 'Georgia,serif', lineHeight: 1.5, margin: 0 }}>{d.translit}</p>
      </div>
      <div style={{ position: 'absolute', top: 530, left: 80, right: 80, textAlign: 'center' }}>
        <p style={{ color: '#0f172a', fontSize: 34, fontWeight: 700, lineHeight: 1.4, margin: 0 }}>{d.translation}</p>
      </div>
      <div style={{ position: 'absolute', bottom: 146, left: '50%', transform: 'translateX(-50%)' }}>
        <span style={{ background: `${c.p}15`, border: `1px solid ${c.p}40`, color: c.p, fontSize: 18, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '10px 28px', borderRadius: 32, whiteSpace: 'nowrap' }}>{d.topic}</span>
      </div>
      <div style={{ position: 'absolute', bottom: 54, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 80px' }}>
        <MIJLogo invert={false} size={26} />
        <span style={{ color: '#94a3b8', fontSize: 18, letterSpacing: '0.08em' }}>muslimsinjapan.com/dua</span>
      </div>
    </PosterFrame>
  )
}

function ET09({ d }: PosterProps) {
  const tips = [d.tip1, d.tip2, d.tip3, d.tip4]
  return (
    <PosterFrame style={{ background: '#020617' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 380, background: 'linear-gradient(135deg,#92400e,#d97706)' }}>
        <DiamondPattern color="#fff" opacity={0.06} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 20, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>HALAL GUIDE · ハラール案内</span>
          <h1 style={{ color: '#fff', fontSize: 84, fontWeight: 900, letterSpacing: '-0.03em', margin: 0, textAlign: 'center', lineHeight: 1 }}>{d.title}</h1>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: '#020617', clipPath: 'polygon(0 100%,100% 100%,100% 60%,50% 0%,0 60%)' }} />
      </div>
      <div style={{ position: 'absolute', top: 398, left: 72, right: 72, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {tips.map((tip, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20, background: '#1e293b', border: '1px solid rgba(217,119,6,0.2)', borderLeft: '4px solid #d97706', borderRadius: 16, padding: '20px 28px' }}>
            <p style={{ color: '#cbd5e1', fontSize: 26, lineHeight: 1.4, margin: 0 }}>{tip}</p>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, borderTop: '1px solid rgba(217,119,6,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 72px' }}>
        <MIJLogo invert size={28} />
        <span style={{ color: '#d97706', fontSize: 20, letterSpacing: '0.1em', fontWeight: 600 }}>muslimsinjapan.com</span>
      </div>
    </PosterFrame>
  )
}

function ET10({ d, pal }: PosterProps) {
  const c = PALETTES[pal] ?? PALETTES['jade-gold']
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dates = [[null, null, null, null, 1, 2, 3], [4, 5, 6, 7, 8, 9, 10], [11, 12, 13, 14, 15, 16, 17], [18, 19, 20, 21, 22, 23, 24], [25, 26, 27, 28, 29, 30, null]]
  return (
    <PosterFrame style={{ background: c.bg }}>
      <DiamondPattern opacity={0.03} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: `linear-gradient(90deg,${c.p},${c.l})` }} />
      <div style={{ position: 'absolute', top: 56, left: 72, right: 72, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p style={{ color: c.l, fontSize: 18, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0 }}>ISLAMIC CALENDAR</p>
          <h2 style={{ color: '#fff', fontSize: 58, fontWeight: 900, margin: '6px 0 0', letterSpacing: '-0.02em' }}>{d.month}</h2>
          <p style={{ color: '#94a3b8', fontSize: 22, margin: '2px 0 0' }}>{d.yearAH} · {d.yearCE}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ color: c.gold, fontSize: 22, fontWeight: 700, margin: 0 }}>{d.monthAr}</p>
        </div>
      </div>
      <div style={{ position: 'absolute', top: 230, left: 60, right: 60 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5, marginBottom: 5 }}>
          {days.map(dy => <div key={dy} style={{ textAlign: 'center', color: dy === 'Fri' ? c.l : '#64748b', fontSize: 18, fontWeight: 700, padding: '6px 0', letterSpacing: '0.05em' }}>{dy}</div>)}
        </div>
        {dates.map((row, ri) => (
          <div key={ri} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5, marginBottom: 5 }}>
            {row.map((dt, ci) => {
              const isToday = dt === 16
              const isEid = dt === 10
              const isJumah = ci === 5 && dt !== null
              return (
                <div key={`${ri}-${ci}`} style={{ textAlign: 'center', borderRadius: 10, padding: '10px 4px', background: isToday ? c.p : isEid ? c.gold : `${c.soft}aa`, border: !isToday && !isEid && dt ? `1px solid ${c.p}20` : '1px solid transparent', position: 'relative' }}>
                  {dt && <span style={{ color: isToday || isEid ? '#fff' : isJumah ? c.l : '#fff', fontSize: 26, fontWeight: isToday || isEid ? 800 : 500 }}>{dt}</span>}
                  {isEid && <div style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', color: '#fff', fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap' }}>EID</div>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 88, borderTop: `1px solid ${c.p}20`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 72px' }}>
        <MIJLogo invert size={28} />
        <span style={{ color: '#94a3b8', fontSize: 18 }}>muslimsinjapan.com/calendar</span>
      </div>
    </PosterFrame>
  )
}

function ET11({ d, pal }: PosterProps) {
  const c = PALETTES[pal] ?? PALETTES['jade-gold']
  const tips = [{ n: '01', title: d.t1, body: d.b1 }, { n: '02', title: d.t2, body: d.b2 }, { n: '03', title: d.t3, body: d.b3 }, { n: '04', title: d.t4, body: d.b4 }]
  return (
    <PosterFrame style={{ background: `linear-gradient(150deg,${c.mid} 0%,${c.p} 50%,${c.soft} 100%)` }}>
      <DiamondPattern color="#fff" opacity={0.05} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: `linear-gradient(90deg,${c.l},${c.pale})` }} />
      <div style={{ position: 'absolute', top: 60, left: 72, right: 72 }}>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 20, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0 }}>TRAVEL GUIDE · 旅行ガイド</p>
        <h1 style={{ color: '#fff', fontSize: 70, fontWeight: 900, letterSpacing: '-0.03em', margin: '10px 0 0', lineHeight: 1 }}>{d.title}</h1>
      </div>
      <div style={{ position: 'absolute', top: 320, left: 72, right: 72, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {tips.map(t => (
          <div key={t.n} style={{ display: 'flex', gap: 22, background: 'rgba(255,255,255,0.09)', borderRadius: 16, padding: '22px 26px', border: '1px solid rgba(255,255,255,0.12)' }}>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 18, fontWeight: 800, paddingTop: 3, minWidth: 26 }}>{t.n}</span>
            <div>
              <p style={{ color: '#fff', fontSize: 26, fontWeight: 700, margin: 0 }}>{t.title}</p>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20, lineHeight: 1.45, margin: '3px 0 0' }}>{t.body}</p>
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 96, background: 'rgba(0,0,0,0.25)', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 72px' }}>
        <MIJLogo invert size={28} />
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18, letterSpacing: '0.08em' }}>muslimsinjapan.com</span>
      </div>
    </PosterFrame>
  )
}

function ET12({ d, pal }: PosterProps) {
  const c = PALETTES[pal] ?? PALETTES['jade-gold']
  const stats = [{ val: d.v1, label: d.l1, color: c.p }, { val: d.v2, label: d.l2, color: c.l }, { val: d.v3, label: d.l3, color: '#d97706' }, { val: d.v4, label: d.l4, color: '#bc002d' }]
  return (
    <PosterFrame style={{ background: '#f8fafc' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 7, background: `linear-gradient(90deg,${c.p},${c.l})` }} />
      <div style={{ position: 'absolute', top: 68, left: 72, right: 72 }}>
        <p style={{ color: c.p, fontSize: 18, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', margin: 0 }}>BY THE NUMBERS</p>
        <h1 style={{ color: '#0f172a', fontSize: 72, fontWeight: 900, letterSpacing: '-0.03em', margin: '10px 0 0', lineHeight: 1 }}>{d.title}</h1>
      </div>
      <div style={{ position: 'absolute', top: 290, left: 60, right: 60, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {stats.map(s => (
          <div key={`${s.val}-${s.label}`} style={{ background: '#fff', borderRadius: 24, padding: '44px 36px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', borderTop: `5px solid ${s.color}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ color: s.color, fontSize: 76, fontWeight: 900, letterSpacing: '-0.04em', margin: 0, lineHeight: 1 }}>{s.val}</p>
            <p style={{ color: '#64748b', fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{s.label}</p>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 110, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 72px' }}>
        <MIJLogo invert size={30} />
        <span style={{ color: c.l, fontSize: 20, letterSpacing: '0.1em', fontWeight: 600 }}>muslimsinjapan.com</span>
      </div>
    </PosterFrame>
  )
}

function ET13({ d, pal }: PosterProps) {
  const c = PALETTES[pal] ?? PALETTES['jade-gold']
  return (
    <PosterFrame style={{ background: c.bg }} size={1080} height={1920}>
      <DiamondPattern opacity={0.04} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, background: `linear-gradient(90deg,${c.p},${c.l})` }} />
      <div style={{ position: 'absolute', top: 80, left: 72, right: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <MIJLogo invert size={30} />
        <span style={{ color: c.l, fontSize: 18, letterSpacing: '0.12em', fontWeight: 600 }}>@muslimsinjapan</span>
      </div>
      <div style={{ position: 'absolute', top: 160, left: 72, right: 72, height: 640, background: c.soft, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, border: `1px solid ${c.p}20` }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
        <span style={{ color: '#475569', fontFamily: 'monospace', fontSize: 16 }}>story image · 936×640</span>
      </div>
      <div style={{ position: 'absolute', top: 850, left: 72, right: 72, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <span style={{ background: c.p, color: '#fff', fontSize: 18, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', padding: '8px 22px', borderRadius: 24, width: 'fit-content' }}>{d.badge}</span>
        <h2 style={{ color: '#fff', fontSize: 76, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em', margin: 0 }}>
          {d.headline}
          <br />
          <span style={{ color: c.pale }}>{d.accentWord}</span>
        </h2>
        <p style={{ color: '#cbd5e1', fontSize: 30, lineHeight: 1.5, margin: 0 }}>{d.body}</p>
        <div style={{ flex: 1, background: c.p, borderRadius: 20, padding: '22px 32px', textAlign: 'center', marginTop: 8 }}>
          <p style={{ color: '#fff', fontSize: 26, fontWeight: 800, margin: 0 }}>{d.cta}</p>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, borderTop: `1px solid ${c.p}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: c.l, fontSize: 22, fontWeight: 700, letterSpacing: '0.12em' }}>muslimsinjapan.com</span>
      </div>
    </PosterFrame>
  )
}

function ET14({ d, pal }: PosterProps) {
  const c = PALETTES[pal] ?? PALETTES['jade-gold']
  return (
    <PosterFrame style={{ background: `radial-gradient(ellipse at 50% 40%,${c.mid},${c.bg} 70%)` }}>
      <DotGrid color={c.l} opacity={0.08} />
      <div style={{ position: 'absolute', top: 60, left: 0, right: 0, textAlign: 'center' }}>
        <p style={{ color: c.l, fontSize: 20, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', margin: 0 }}>QIBLA DIRECTION · قبلة</p>
        <h1 style={{ color: '#fff', fontSize: 76, fontWeight: 900, margin: '10px 0 0', letterSpacing: '-0.02em' }}>{d.city}</h1>
        <p style={{ color: '#94a3b8', fontSize: 26, margin: '6px 0 0' }}>{d.coords}</p>
      </div>
      <div style={{ position: 'absolute', top: 248, left: '50%', transform: 'translateX(-50%)', width: 460, height: 460 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${c.l}40` }} />
        <div style={{ position: 'absolute', inset: 20, borderRadius: '50%', border: `1px solid ${c.l}20` }} />
        {[{ l: 'N', top: 10, left: '50%', ml: -8 }, { l: 'S', bottom: 10, left: '50%', ml: -7 }, { l: 'E', right: 10, top: '50%', mt: -12 }, { l: 'W', left: 10, top: '50%', mt: -12 }].map(p => (
          <span key={p.l} style={{ position: 'absolute', color: p.l === 'N' ? '#fff' : '#64748b', fontSize: 24, fontWeight: 700, ...(p as CSSProperties), marginLeft: (p as { ml?: number }).ml, marginTop: (p as { mt?: number }).mt }}>{p.l}</span>
        ))}
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 4, height: 180, marginLeft: -2, marginTop: -170, background: `linear-gradient(${c.l},${c.p})`, borderRadius: 4, transformOrigin: 'bottom center', transform: 'rotate(-70deg)', boxShadow: `0 0 20px ${c.p}80` }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 4, height: 100, marginLeft: -2, background: 'rgba(255,255,255,0.15)', borderRadius: 4, transformOrigin: 'top center', transform: 'rotate(110deg)' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 20, height: 20, borderRadius: '50%', background: c.p, transform: 'translate(-50%,-50%)', boxShadow: `0 0 16px ${c.p}` }} />
        <div style={{ position: 'absolute', top: 28, left: '50%', marginLeft: -16, width: 32, height: 32, background: c.gold, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 16 }}>🕋</span>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 136, left: 0, right: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{ color: c.pale, fontSize: 64, fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>{d.degrees}</p>
        <p style={{ color: '#94a3b8', fontSize: 26 }}>{d.dist}</p>
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, borderTop: `1px solid ${c.l}25`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 72px' }}>
        <MIJLogo invert size={28} />
        <span style={{ color: c.l, fontSize: 18, letterSpacing: '0.1em', fontWeight: 600 }}>muslimsinjapan.com/qibla</span>
      </div>
    </PosterFrame>
  )
}

function ET15({ d, pal }: PosterProps) {
  const c = PALETTES[pal] ?? PALETTES['jade-gold']
  return (
    <PosterFrame style={{ background: '#020617' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 520, bottom: 0, background: `linear-gradient(150deg,${c.mid},${c.soft})` }}>
        <DiamondPattern color={c.pale} opacity={0.05} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 56px', gap: 24 }}>
          <span style={{ color: c.l, fontSize: 18, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>{d.tagline}</span>
          <h1 style={{ color: '#fff', fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.03em', margin: 0, fontSize: '72px' }}>
            {d.heading.split(' ').slice(0, 2).join(' ')}
            <br />
            <span style={{ color: c.pale }}>{d.heading.split(' ').slice(2).join(' ')}</span>
          </h1>
          <p style={{ color: '#cbd5e1', fontSize: 22, lineHeight: 1.5, margin: 0 }}>{d.body}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[d.f1, d.f2, d.f3, d.f4].map((item, i) => <span key={i} style={{ color: c.pale, fontSize: 22, fontWeight: 600 }}>{item}</span>)}
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', top: 60, left: 520, width: 2, bottom: 60, background: `linear-gradient(180deg,transparent,${c.l},transparent)` }} />
      <div style={{ position: 'absolute', top: 0, left: 522, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 28 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: c.gold, fontSize: 44, fontWeight: 700, margin: 0, fontFamily: "'Noto Serif',Georgia,serif", direction: 'rtl' }}>بسم الله</p>
          <p style={{ color: '#cbd5e1', fontSize: 22, margin: '6px 0 0' }}>In the name of Allah</p>
        </div>
        <MIJLogo invert size={36} />
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 90, background: 'rgba(2,6,23,0.8)', borderTop: `1px solid ${c.p}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: c.l, fontSize: 22, letterSpacing: '0.14em', fontWeight: 700 }}>muslimsinjapan.com</span>
      </div>
    </PosterFrame>
  )
}

const TEMPLATE_COMPONENTS: Record<string, (props: PosterProps) => ReactElement> = {
  T01: ET01,
  T02: ET02,
  T03: ET03,
  T04: ET04,
  T05: ET05,
  T06: ET06,
  T07: ET07,
  T08: ET08,
  T09: ET09,
  T10: ET10,
  T11: ET11,
  T12: ET12,
  T13: ET13,
  T14: ET14,
  T15: ET15,
}

export function EditorTemplate({ id, d, pal }: { id: string; d: TemplateData; pal: PaletteKey }) {
  const Comp = TEMPLATE_COMPONENTS[id]
  if (!Comp) {
    return <div style={{ width: 1080, height: 1080, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: '#0f172a', fontSize: 40 }}>Template not found</div>
  }
  return <Comp d={d} pal={pal} />
}
