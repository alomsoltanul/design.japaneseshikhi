import { useState } from 'react'

export type AppView = 'home' | 'poster' | 'prompt' | 'poster-maker' | 'listening'

export function GlobalNav({
  view,
  onChange,
}: {
  view: AppView
  onChange: (view: AppView) => void
}) {
  const [open, setOpen] = useState(false)

  const items: { id: AppView; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'poster', label: 'Poster Studio', icon: '🎨' },
    { id: 'prompt', label: 'Prompt Extractor', icon: '🖼️' },
    { id: 'poster-maker', label: 'Poster Maker', icon: '🖌️' },
    { id: 'listening', label: 'Listening Studio', icon: '🎧' },
  ]

  return (
    <nav className="global-nav">
      <div className="global-nav-brand">
        <img
          className="global-nav-logo"
          src="/assets/logo-light.webp"
          alt="Japanese Shikhi"
        />
        <span className="global-nav-title">Content Studio</span>
      </div>

      <div className={`global-nav-links${open ? ' open' : ''}`}>
        {items.map(item => (
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

      <button
        className="global-nav-toggle"
        onClick={() => setOpen(!open)}
        type="button"
        aria-label="Toggle menu"
      >
        {open ? '✕' : '☰'}
      </button>
    </nav>
  )
}
