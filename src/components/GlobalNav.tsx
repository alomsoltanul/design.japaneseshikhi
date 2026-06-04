import { useState, useRef, useEffect } from 'react'
import { useTheme } from '@/ThemeContext'
import { useAuth } from '@/auth/AuthContext'

export type AppView = 'home' | 'poster' | 'prompt' | 'poster-maker' | 'listening' | 'json-import'

export function GlobalNav({
  view,
  onChange,
}: {
  view: AppView
  onChange: (view: AppView) => void
}) {
  const [open, setOpen] = useState(false)
  const { toggleMode, font, setFont, isDark } = useTheme()
  const { user, signOut, isAdmin } = useAuth()
  const [showAccount, setShowAccount] = useState(false)
  const [showFontMenu, setShowFontMenu] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)
  const fontRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setShowAccount(false)
      if (fontRef.current && !fontRef.current.contains(e.target as Node)) setShowFontMenu(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const navItems: { id: AppView; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'poster', label: 'Poster Studio', icon: '🎨' },
    { id: 'poster-maker', label: 'Poster Maker', icon: '🖌️' },
    { id: 'listening', label: 'Listening Studio', icon: '🎧' },
    { id: 'prompt', label: 'Prompts', icon: '🖼️' },
    { id: 'json-import', label: 'JSON Import', icon: '📋' },
  ]

  const fontOptions: { key: typeof font; label: string }[] = [
    { key: 'inter', label: 'Inter' },
    { key: 'serif', label: 'Noto Serif' },
    { key: 'jp', label: 'Noto Sans JP' },
    { key: 'mono', label: 'JetBrains Mono' },
  ]

  return (
    <nav className="global-nav">
      <div className="global-nav-brand">
        <img
          className="global-nav-logo"
          src={isDark ? '/assets/logo-light.webp' : '/assets/logo-dark.webp'}
          alt="Japanese Shikhi"
          onError={(e) => { (e.target as HTMLImageElement).src = '/assets/logo-light.webp' }}
        />
        <span className="global-nav-title">Content Studio</span>
        {isAdmin && <span className="global-nav-admin">Admin</span>}
      </div>

      <div className={`global-nav-links${open ? ' open' : ''}`}>
        {navItems.map(item => (
          <button
            key={item.id}
            className={`global-nav-link${view === item.id ? ' active' : ''}`}
            onClick={() => {
              onChange(item.id)
              setOpen(false)
            }}
            type="button"
          >
            <span className="global-nav-icon">{item.icon}</span>
            <span className="global-nav-label">{item.label}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Theme toggle */}
        <button
          className="theme-toggle"
          onClick={toggleMode}
          type="button"
          title={isDark ? 'Switch to Light' : 'Switch to Dark'}
        >
          {isDark ? '☀️' : '🌙'}
        </button>

        {/* Font family picker */}
        <div ref={fontRef} style={{ position: 'relative' }}>
          <button
            className="font-toggle"
            onClick={() => setShowFontMenu(!showFontMenu)}
            type="button"
            title="Font family"
          >
            Aa
          </button>
          {showFontMenu && (
            <div className="font-dropdown">
              {fontOptions.map(opt => (
                <button
                  key={opt.key}
                  className={font === opt.key ? 'active' : ''}
                  onClick={() => { setFont(opt.key); setShowFontMenu(false) }}
                  type="button"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Account */}
        <div ref={accountRef} style={{ position: 'relative' }}>
          <button
            className="account-pill"
            onClick={() => setShowAccount(!showAccount)}
            type="button"
          >
            <div className="account-avatar">
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <span className="account-name">{user?.name ?? 'User'}</span>
          </button>
          {showAccount && (
            <div className="account-dropdown">
              <div className="account-info">
                <div className="account-info-name">{user?.name}</div>
                <div className="account-info-email">{user?.email}</div>
                <div className="account-info-role">{user?.role}</div>
              </div>
              <hr />
              <button className="account-dropdown-item" onClick={() => { signOut(); setShowAccount(false) }} type="button">
                Sign Out
              </button>
            </div>
          )}
        </div>

        <button
          className="global-nav-toggle"
          onClick={() => setOpen(!open)}
          type="button"
          aria-label="Toggle menu"
        >
          {open ? '✕' : '☰'}
        </button>
      </div>
    </nav>
  )
}
