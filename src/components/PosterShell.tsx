import type { Accent, Format, FxState } from '@/types'

interface PosterShellProps {
  accent: Accent
  fx: FxState
  bgOverride?: string
  gridLines?: boolean
  children: React.ReactNode
  fmt: Format
}

export function PosterShell({ accent, fx, bgOverride, gridLines, children, fmt }: PosterShellProps) {
  const bg = bgOverride || accent.bg
  const isLandscape = fmt.w > fmt.h
  const padV = fmt.h >= 1800 ? 100 : isLandscape ? 60 : 72
  const padH = isLandscape ? 96 : 80

  return (
    <div className="poster" style={{ width: fmt.w, height: fmt.h, background: bg }}>
      {fx.orbs && <Orbs c1={accent.p} c2={accent.s} />}
      {fx.petals && <Petals count={fmt.h >= 1800 ? 14 : 10} />}
      {gridLines && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)',
          backgroundSize: '80px 80px'
        }} />
      )}
      <div style={{
        position: 'relative', zIndex: 2, height: '100%',
        display: 'flex', flexDirection: 'column',
        padding: `${padV}px ${padH}px`
      }}>
        {children}
      </div>
    </div>
  )
}

export function Orbs({ c1 = '#E63946', c2 = '#6B21A8', c3 = '#F4A261' }: { c1?: string; c2?: string; c3?: string }) {
  const orbs: [string, string|null, string|null, string|null, string|null, number, number, string][] = [
    [c1, '-8%', '-5%', null, null, 500, 500, 'orb1 18s ease-in-out infinite'],
    [c2, null, null, '-5%', '-8%', 460, 460, 'orb2 22s ease-in-out infinite'],
    [c3, '40%', null, null, '18%', 340, 340, 'orb3 16s ease-in-out infinite'],
  ]
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {orbs.map(([c, t, l, b, r, w, h, anim], i) => (
        <div key={i} style={{
          position: 'absolute', borderRadius: '50%',
          top: t ?? undefined, left: l ?? undefined,
          bottom: b ?? undefined, right: r ?? undefined,
          width: w, height: h,
          background: `radial-gradient(circle,${c}22 0%,transparent 70%)`,
          animation: anim
        }} />
      ))}
    </div>
  )
}

function Petals({ count = 10 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="petal" style={{
          left: `${4 + i * (96 / count)}%`, top: 0,
          animationDelay: `${(i * 1.13).toFixed(1)}s`,
          animationDuration: `${9 + (i % 4) * 1.5}s`,
          width: i % 3 === 0 ? 13 : 9,
          height: i % 3 === 0 ? 18 : 13,
        }} />
      ))}
    </>
  )
}
