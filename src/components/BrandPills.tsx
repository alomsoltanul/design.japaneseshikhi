import type { Accent } from '@/types'

export function LogoPill({ dark = true }: { dark?: boolean }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: dark ? 'rgba(255,255,255,0.10)' : 'rgba(29,53,87,0.08)',
      border: `1px solid ${dark ? 'rgba(255,255,255,0.14)' : 'rgba(29,53,87,0.14)'}`,
      borderRadius: 999, padding: '8px 18px'
    }}>
      <img src="/assets/logo-light.webp" style={{ height: 22, filter: dark ? 'brightness(0) invert(1)' : 'none' }} alt="" />
    </div>
  )
}

export function DomainPill({ accent }: { accent: Accent }) {
  return (
    <div style={{
      background: `linear-gradient(90deg,${accent.p},${accent.s})`,
      borderRadius: 999, padding: '10px 26px',
      fontSize: 16, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap'
    }}>
      japaneseshikhi.com
    </div>
  )
}
