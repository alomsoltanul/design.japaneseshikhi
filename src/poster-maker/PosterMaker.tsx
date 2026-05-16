import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import html2canvas from 'html2canvas'
import {
  PALETTE_OPTIONS,
  TEMPLATE_DEFAULTS,
  TEMPLATE_FIELDS,
  TEMPLATE_META,
  type Field,
  type PaletteKey,
  type TemplateData,
} from '@/poster-maker/data'
import { EditorTemplate } from '@/poster-maker/templates'

const POSTER_W = 1080

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Exclude<Field, { section: string }>
  value: string
  onChange: (next: string) => void
}) {
  const common: CSSProperties = {
    width: '100%',
    background: '#0d1a2d',
    border: '1px solid #1e3a5f',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 13,
    outline: 'none',
    transition: 'border-color .15s',
  }

  if (field.big) {
    return (
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        rows={3}
        style={{ ...common, padding: '9px 12px', resize: 'vertical', lineHeight: 1.5 }}
      />
    )
  }

  return (
    <input
      type="text"
      value={value}
      onChange={event => onChange(event.target.value)}
      style={{ ...common, padding: '9px 12px', height: 38 }}
    />
  )
}

function TemplateCanvas({
  activeId,
  palette,
  data,
}: {
  activeId: string
  palette: PaletteKey
  data: TemplateData
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(0.4)
  const posterH = activeId === 'T13' ? 1920 : 1080

  useEffect(() => {
    const measure = () => {
      if (!wrapRef.current) return
      const parent = wrapRef.current.parentElement
      if (!parent) return
      const availW = parent.clientWidth - 64
      const availH = parent.clientHeight - 80
      const next = Math.min(availW / POSTER_W, availH / posterH, 0.85)
      setScale(Math.max(next, 0.14))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [posterH])

  return (
    <div
      ref={wrapRef}
      style={{
        width: POSTER_W * scale,
        height: posterH * scale,
        position: 'relative',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      <div
        data-poster
        data-story-format={activeId === 'T13' ? 'true' : undefined}
        style={{
          width: POSTER_W,
          height: posterH,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        <EditorTemplate id={activeId} d={data} pal={palette} />
      </div>
    </div>
  )
}

export function PosterMaker() {
  const [activeId, setActiveId] = useState('T01')
  const [palette, setPalette] = useState<PaletteKey>('jade-gold')
  const [saving, setSaving] = useState(false)
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const [templateData, setTemplateData] = useState<Record<string, TemplateData>>(() =>
    Object.fromEntries(TEMPLATE_META.map(meta => [meta.id, { ...TEMPLATE_DEFAULTS[meta.id] }]))
  )

  const activeMeta = useMemo(
    () => TEMPLATE_META.find(meta => meta.id === activeId) ?? TEMPLATE_META[0],
    [activeId]
  )
  const data = templateData[activeId] ?? {}
  const fields = TEMPLATE_FIELDS[activeId] ?? []
  const posterH = activeId === 'T13' ? 1920 : 1080

  const setField = (key: string, val: string) => {
    setTemplateData(prev => ({
      ...prev,
      [activeId]: { ...prev[activeId], [key]: val },
    }))
  }

  const handleDownload = async () => {
    if (!canvasRef.current) return
    setSaving(true)
    try {
      const posterEl = canvasRef.current.querySelector('[data-poster]') as HTMLElement | null
      if (!posterEl) return
      const height = posterEl.dataset.storyFormat ? 1920 : 1080
      const canvas = await html2canvas(posterEl, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        width: POSTER_W,
        height,
        backgroundColor: null,
        logging: false,
      })
      const link = document.createElement('a')
      link.download = `MIJ-${activeId}-${palette}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pm-root">
      <div className="pm-top">
        <div className="pm-brand">
          <img src="/logo.svg" alt="Muslims in Japan" className="pm-logo" />
          <div className="pm-divider" />
          <p className="pm-title">Poster Editor</p>
        </div>
        <div className="pm-right">
          <div className="pm-template-chip">
            <span className="pm-template-id">{activeId}</span>
            <span className="pm-template-name">— {activeMeta.label}</span>
          </div>
          <button className="pm-export" onClick={handleDownload} type="button" disabled={saving}>
            {saving ? 'Capturing…' : '⬇ Export PNG'}
          </button>
        </div>
      </div>

      <div className="pm-mobile-actions">
        <button type="button" onClick={() => setLeftOpen(true)}>Templates</button>
        <button type="button" onClick={() => setRightOpen(true)}>Edit</button>
      </div>

      <div className="pm-body">
        <aside className="pm-left">
          <p className="pm-section-head">Templates</p>
          {TEMPLATE_META.map(meta => {
            const isActive = meta.id === activeId
            const d = TEMPLATE_DEFAULTS[meta.id]
            const story = meta.id === 'T13'
            const h = story ? 1920 : 1080
            const scale = 148 / 1080
            return (
              <button
                key={meta.id}
                className={`pm-thumb${isActive ? ' active' : ''}`}
                onClick={() => setActiveId(meta.id)}
                type="button"
              >
                <div className="pm-thumb-preview" style={{ height: h * scale }}>
                  <div style={{ width: 1080, height: h, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                    <EditorTemplate id={meta.id} d={d} pal={palette} />
                  </div>
                </div>
                <div className="pm-thumb-meta">
                  <p>{meta.id}</p>
                  <span>{meta.label}</span>
                </div>
              </button>
            )
          })}
        </aside>

        <main className="pm-center" ref={canvasRef}>
          <div className="pm-grid-bg" />
          <div className="pm-canvas-wrap">
            <div className="pm-canvas-head">
              <span>{POSTER_W} × {posterH}px</span>
              <span>{activeMeta.tag}</span>
            </div>
            <TemplateCanvas activeId={activeId} palette={palette} data={data} />
          </div>
        </main>

        <aside className="pm-right-panel">
          <div className="pm-panel-header">
            <p>Editing</p>
            <h3>{activeId} — {activeMeta.label}</h3>
            <span>{activeMeta.tag}</span>
          </div>

          <div className="pm-palette">
            <p>Color Palette</p>
            <div>
              {PALETTE_OPTIONS.map(option => (
                <button
                  key={option.key}
                  type="button"
                  className={palette === option.key ? 'active' : ''}
                  onClick={() => setPalette(option.key)}
                >
                  <span style={{ background: option.swatch }} />
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pm-fields">
            {fields.map((field, index) => {
              if ('section' in field) {
                return (
                  <div key={`${field.section}-${index}`} className="pm-fields-section">
                    <p>{field.section}</p>
                    <hr />
                  </div>
                )
              }
              return (
                <div key={field.key} className="pm-field">
                  <label>{field.label}</label>
                  <FieldInput field={field} value={data[field.key] ?? ''} onChange={next => setField(field.key, next)} />
                </div>
              )
            })}
          </div>

          <div className="pm-footer">
            <button className="pm-download" type="button" onClick={handleDownload} disabled={saving}>
              {saving ? 'Capturing…' : '⬇ Download PNG'}
            </button>
            <button
              className="pm-open"
              type="button"
              onClick={() => window.open('/poster-maker', '_blank', 'noopener,noreferrer')}
            >
              ↗ Open Full Size
            </button>
          </div>
        </aside>
      </div>

      {leftOpen && (
        <div className="pm-drawer-overlay" onClick={() => setLeftOpen(false)} role="presentation">
          <aside className="pm-drawer pm-drawer-left" onClick={event => event.stopPropagation()}>
            <button type="button" onClick={() => setLeftOpen(false)} className="pm-close">Close</button>
            <div className="pm-left pm-left-mobile">
              {TEMPLATE_META.map(meta => (
                <button
                  key={meta.id}
                  className={`pm-thumb${meta.id === activeId ? ' active' : ''}`}
                  onClick={() => {
                    setActiveId(meta.id)
                    setLeftOpen(false)
                  }}
                  type="button"
                >
                  <div className="pm-thumb-meta"><p>{meta.id}</p><span>{meta.label}</span></div>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}

      {rightOpen && (
        <div className="pm-drawer-overlay" onClick={() => setRightOpen(false)} role="presentation">
          <aside className="pm-drawer pm-drawer-right" onClick={event => event.stopPropagation()}>
            <button type="button" onClick={() => setRightOpen(false)} className="pm-close">Close</button>
            <div className="pm-right-panel pm-right-mobile">
              <div className="pm-palette">
                <p>Color Palette</p>
                <div>
                  {PALETTE_OPTIONS.map(option => (
                    <button
                      key={option.key}
                      type="button"
                      className={palette === option.key ? 'active' : ''}
                      onClick={() => setPalette(option.key)}
                    >
                      <span style={{ background: option.swatch }} />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pm-fields">
                {fields.map((field, index) =>
                  'section' in field ? (
                    <div key={`${field.section}-${index}`} className="pm-fields-section"><p>{field.section}</p><hr /></div>
                  ) : (
                    <div key={field.key} className="pm-field">
                      <label>{field.label}</label>
                      <FieldInput field={field} value={data[field.key] ?? ''} onChange={next => setField(field.key, next)} />
                    </div>
                  )
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
