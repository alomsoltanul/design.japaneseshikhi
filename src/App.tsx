import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { toPng } from 'html-to-image'
import { useAuth } from '@/auth/AuthContext'
import { AuthGuard } from '@/auth/AuthGuard'
import { LoginPage } from '@/auth/LoginPage'
import { SignupPage } from '@/auth/SignupPage'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { GlobalNav } from '@/components/GlobalNav'
import { ImageUpload } from '@/components/ImageUpload'
import { ImagePromptExtractor } from '@/components/ImagePromptExtractor'
import { JsonImporter } from '@/components/JsonImporter'
import { PosterMaker } from '@/poster-maker/PosterMaker'
import { ListeningStudio } from '@/listening/ListeningStudio'
import { StudioMode } from '@/studio/StudioMode'
import { ContentFactory } from '@/studio/ContentFactory'
import { BASE_ACCENTS, FORMATS } from '@/themes'
import { TEMPLATES, TEMPLATE_MAP } from '@/templates'
import type { Accent, Format, FxState } from '@/types'

const STORAGE_KEY = 'js-poster-studio-v2'
const VIEW_STORAGE_KEY = 'js-poster-studio-view'

export type AppView = 'home' | 'poster' | 'prompt' | 'poster-maker' | 'listening' | 'json-import'

interface StoredState {
  tpl: string
  accentId: string
  fmtId: string
  datas: Record<string, Record<string, unknown>>
  fx: FxState
  customAccents: Accent[]
}

function loadState(): Partial<StoredState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveState(state: StoredState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function buildDefaultDatas() {
  const out: Record<string, Record<string, unknown>> = {}
  for (const t of TEMPLATES) {
    out[t.id] = { ...TEMPLATE_MAP[t.id].defaultData }
  }
  return out
}

function getInitialView(): AppView {
  const path = window.location.pathname
  if (path.startsWith('/poster-maker')) return 'poster-maker'
  if (path.startsWith('/listening')) return 'listening'
  if (path.startsWith('/json-import')) return 'json-import'
  if (path.startsWith('/prompt')) return 'prompt'
  if (path.startsWith('/poster')) return 'poster'
  const raw = localStorage.getItem(VIEW_STORAGE_KEY)
  if (raw === 'prompt') return 'prompt'
  if (raw === 'poster') return 'poster'
  if (raw === 'json-import') return 'json-import'
  return 'home'
}

export default function App() {
  // Studio Mode (Module 2) is fully chromeless and auth-free so OBS browser
  // sources can load it. Short-circuit before nav + auth gate.
  if (window.location.pathname.startsWith('/listening/studio')) {
    return <StudioMode />
  }

  const { user } = useAuth()
  const [authPage, setAuthPage] = useState<'login' | 'signup'>('login')
  const [view, setView] = useState<AppView>(getInitialView)

  const saved = loadState()

  const [tpl, setTpl] = useState(saved.tpl || 'grammar')
  const [accents, setAccents] = useState<Accent[]>([
    ...BASE_ACCENTS,
    ...(saved.customAccents || [])
  ])
  const [accent, setAccent] = useState<Accent>(
    accents.find(a => a.id === saved.accentId) || accents[0]
  )
  const [fmt, setFmt] = useState<Format>(FORMATS.find(f => f.id === saved.fmtId) || FORMATS[0])
  const [datas, setDatas] = useState<Record<string, Record<string, unknown>>>(
    { ...buildDefaultDatas(), ...(saved.datas || {}) }
  )
  const [fx, setFx] = useState<FxState>(saved.fx || { petals: true, orbs: true })
  const [bgImage, setBgImg] = useState<string | null>(null)
  const [tab, setTab] = useState<'style' | 'content'>('style')
  const [dl, setDl] = useState(false)
  const hiddenRef = useRef<HTMLDivElement>(null)

  const [editingTheme, setEditingTheme] = useState(false)
  const [newTheme, setNewTheme] = useState<Accent>({
    id: '', p: '#E63946', s: '#6B21A8',
    bg: 'linear-gradient(150deg,#0a0c18 0%,#0f0d1f 55%,#13102a 100%)',
    dark: true
  })

  useEffect(() => {
    const custom = accents.filter(a => !BASE_ACCENTS.some(b => b.id === a.id))
    saveState({ tpl, accentId: accent.id, fmtId: fmt.id, datas, fx, customAccents: custom })
  }, [tpl, accent, fmt, datas, fx, accents])

  useEffect(() => {
    if (view !== 'poster-maker' && view !== 'listening') {
      localStorage.setItem(VIEW_STORAGE_KEY, view)
    }
  }, [view])

  useEffect(() => {
    const sync = () => setView(getInitialView())
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  const handleChangeView = useCallback((next: AppView) => {
    setView(next)
    const target =
      next === 'poster-maker' ? '/poster-maker' :
      next === 'listening' ? '/listening' :
      next === 'json-import' ? '/json-import' :
      next === 'prompt' ? '/prompt' :
      next === 'poster' ? '/poster' :
      '/'
    if (window.location.pathname !== target) {
      window.history.pushState({}, '', target)
    }
  }, [])

  const handleJsonImport = useCallback((payload: { template: string; data: Record<string, unknown> }) => {
    setDatas(prev => ({ ...prev, [payload.template]: payload.data }))
    setTpl(payload.template)
    handleChangeView('poster')
  }, [handleChangeView])

  const [winSz, setWinSz] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const upd = () => setWinSz({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', upd)
    return () => window.removeEventListener('resize', upd)
  }, [])

  const isMobile = winSz.w <= 768
  const availW = Math.max(isMobile ? winSz.w - 32 : winSz.w - 400, 0)
  const availH = Math.max(isMobile ? winSz.h * 0.45 - 48 : winSz.h - 120, 0)
  const scaleByW = availW / fmt.w
  const scaleByH = availH / fmt.h
  const previewScale = Math.min(scaleByW, scaleByH, 640 / Math.max(fmt.w, fmt.h))
  const prevW = Math.round(fmt.w * previewScale)
  const prevH = Math.round(fmt.h * previewScale)

  const data = datas[tpl]
  const setData = useCallback((d: Record<string, unknown>) => {
    setDatas(prev => ({ ...prev, [tpl]: d }))
  }, [tpl])

  const isImgTpl = ['imgbg', 'imgcard', 'newsflash', 'newspanel'].includes(tpl)

  async function download(customFilename?: string) {
    if (!hiddenRef.current) return
    setDl(true)
    try {
      await document.fonts.ready
      await toPng(hiddenRef.current, { width: fmt.w, height: fmt.h, pixelRatio: 1, cacheBust: true })
      await new Promise(r => setTimeout(r, 350))
      const url = await toPng(hiddenRef.current, {
        width: fmt.w, height: fmt.h, pixelRatio: 2, cacheBust: true,
        style: { transform: 'none', transformOrigin: 'top left' },
      })
      const a = document.createElement('a')
      a.href = url
      a.download = customFilename || `japanese-shikhi-${tpl}-${fmt.id}-${Date.now()}.png`
      a.click()
    } catch (e) { console.error(e) }
    setDl(false)
  }

  const [batchQueue, setBatchQueue] = useState<Record<string, unknown>[]>([])
  const batchIndexRef = useRef(0)

  const handleStartBatch = useCallback((rows: Record<string, unknown>[]) => {
    if (rows.length === 0) return
    setBatchQueue(rows)
    batchIndexRef.current = 0
  }, [])

  useEffect(() => {
    if (batchQueue.length === 0 || batchIndexRef.current >= batchQueue.length) return
    const idx = batchIndexRef.current
    const rowData = batchQueue[idx]
    // Apply data
    setDatas(prev => ({ ...prev, [tpl]: rowData }))
    // Wait for render then download
    const timer = setTimeout(async () => {
      const filename = `JS-${tpl}-${String(idx + 1).padStart(3, '0')}.png`
      await download(filename)
      batchIndexRef.current += 1
      if (batchIndexRef.current >= batchQueue.length) {
        setBatchQueue([])
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [batchQueue, tpl])

  const tDef = TEMPLATE_MAP[tpl]
  const PosterComp = tDef.Poster
  const CtrlComp = tDef.Controls
  const tplMeta = TEMPLATES.find(t => t.id === tpl)!

  const posterProps = useMemo(() => ({ data, accent, fx, fmt, bgImage }), [data, accent, fx, fmt, bgImage])

  const handleAddTheme = () => {
    if (!newTheme.id.trim()) return
    const theme: Accent = { ...newTheme, id: newTheme.id.trim().toLowerCase().replace(/\s+/g, '-') }
    if (accents.some(a => a.id === theme.id)) return
    setAccents(prev => [...prev, theme])
    setAccent(theme)
    setEditingTheme(false)
    setNewTheme({ id: '', p: '#E63946', s: '#6B21A8', bg: 'linear-gradient(150deg,#0a0c18 0%,#0f0d1f 55%,#13102a 100%)', dark: true })
  }

  // ── Auth gates ──
  if (!user) {
    return (
      <div style={{ height: '100vh', overflow: 'hidden' }}>
        {authPage === 'login'
          ? <LoginPage onSwitch={() => setAuthPage('signup')} />
          : <SignupPage onSwitch={() => setAuthPage('login')} />
        }
      </div>
    )
  }

  return (
    <AuthGuard>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <GlobalNav view={view} onChange={handleChangeView} />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {view === 'home' && (
            <div className="home-view">
              <div className="home-hero">
                <h1>Japanese Shikhi</h1>
                <p>Content Studio — Create, design, and publish.</p>
              </div>
              <div className="home-grid">
                {[
                  { id: 'poster' as AppView, label: 'Poster Studio', desc: 'Design beautiful Japanese learning posters.', icon: '🎨' },
                  { id: 'json-import' as AppView, label: 'JSON Import', desc: 'Paste JSON to auto-create content.', icon: '📋' },
                  { id: 'prompt' as AppView, label: 'Prompt Extractor', desc: 'Extract image prompts from JSON data.', icon: '🖼️' },
                  { id: 'poster-maker' as AppView, label: 'Poster Maker', desc: 'Create custom posters with templates.', icon: '🖌️' },
                  { id: 'listening' as AppView, label: 'Listening Studio', desc: 'Build and edit listening practice tracks.', icon: '🎧' },
                ].map(tool => (
                  <button key={tool.id} className="home-card" onClick={() => handleChangeView(tool.id)}>
                    <div className="home-card-icon">{tool.icon}</div>
                    <div className="home-card-title">{tool.label}</div>
                    <div className="home-card-desc">{tool.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <ErrorBoundary>
            {view === 'json-import' && <JsonImporter onImport={handleJsonImport} />}
          </ErrorBoundary>
          <ErrorBoundary>
            {view === 'prompt' && <ImagePromptExtractor view={view} onChangeView={handleChangeView} />}
          </ErrorBoundary>
          <ErrorBoundary>
            {view === 'poster-maker' && <PosterMaker />}
          </ErrorBoundary>
          <ErrorBoundary>
            {view === 'listening' && (
              <div style={{ height: '100%', overflow: 'auto', background: 'radial-gradient(1200px 600px at 50% -10%, #1b1430 0%, #0c0e16 60%)' }}>
                <ContentFactory />
                <details style={{ maxWidth: 1080, margin: '0 auto 40px', padding: '0 24px' }}>
                  <summary style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 700, padding: '10px 0' }}>
                    Advanced · VOICEVOX track editor (legacy)
                  </summary>
                  <div style={{ marginTop: 12 }}><ListeningStudio /></div>
                </details>
              </div>
            )}
          </ErrorBoundary>

          <ErrorBoundary>
            {view === 'poster' && (
              <div className="app">
              <div className="sidebar">
                <div className="sidebar-head">
                  <div className="sidebar-head-left">
                    <img className="sidebar-logo" src="/assets/logo-light.webp" alt="Japanese Shikhi" />
                    <span className="sidebar-badge">Poster Studio</span>
                  </div>
                </div>

                <div className="tabs">
                  {(['style', 'content'] as const).map(t => (
                    <button key={t} className={`tab${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>
                      {t === 'style' ? 'Style & Format' : 'Content'}
                    </button>
                  ))}
                </div>

                <div className="scroll">
                  {tab === 'style' && <>
                    <div className="sec-label">Template</div>
                    <div className="tpl-grid">
                      {TEMPLATES.map(t => (
                        <button key={t.id} className={`tpl-btn${tpl === t.id ? ' on' : ''}`}
                          onClick={() => setTpl(t.id)}>
                          <div className="tpl-jp">{t.jp}</div>
                          <div className="tpl-en">{t.en}</div>
                        </button>
                      ))}
                    </div>

                    <div className="sec-label">Format / Size</div>
                    <div className="fmt-grid">
                      {FORMATS.map(f => (
                        <button key={f.id} className={`fmt-btn${fmt.id === f.id ? ' on' : ''}`} onClick={() => setFmt(f)}>
                          <div className="fmt-name"><span className="fmt-icon">{f.icon}</span>{f.label}</div>
                          <div className="fmt-dims">{f.dims}</div>
                          <div className="fmt-dims" style={{ color: '#374151' }}>{f.sub}</div>
                        </button>
                      ))}
                    </div>

                    <div className="sec-label">Accent Color</div>
                    <div className="swatch-row">
                      {accents.map(a => (
                        <div key={a.id} className={`swatch${accent.id === a.id ? ' on' : ''}`}
                          style={{ background: a.id === 'light' ? 'linear-gradient(135deg,#F9FAFB,#E5E7EB)' : `linear-gradient(135deg,${a.p},${a.s})` }}
                          onClick={() => setAccent(a)} title={a.id} />
                      ))}
                      <div className="custom-swatch-wrap">
                        <button className="custom-swatch-add" onClick={() => setEditingTheme(true)} title="Add custom theme">+</button>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 14, marginTop: -6, fontWeight: 500, lineHeight: 1.6 }}>
                      {accents.map(a => a.id.charAt(0).toUpperCase() + a.id.slice(1)).join(' · ')}
                    </div>

                    {editingTheme && (
                      <div className="theme-editor">
                        <div className="theme-row">
                          <label>Name</label>
                          <input type="text" value={newTheme.id} placeholder="my-theme"
                            onChange={e => setNewTheme(p => ({ ...p, id: e.target.value }))} />
                        </div>
                        <div className="theme-row">
                          <label>Primary</label>
                          <input type="color" value={newTheme.p}
                            onChange={e => setNewTheme(p => ({ ...p, p: e.target.value }))} />
                          <input type="text" value={newTheme.p}
                            onChange={e => setNewTheme(p => ({ ...p, p: e.target.value }))} />
                        </div>
                        <div className="theme-row">
                          <label>Secondary</label>
                          <input type="color" value={newTheme.s}
                            onChange={e => setNewTheme(p => ({ ...p, s: e.target.value }))} />
                          <input type="text" value={newTheme.s}
                            onChange={e => setNewTheme(p => ({ ...p, s: e.target.value }))} />
                        </div>
                        <div className="theme-row">
                          <label>Bg</label>
                          <input type="text" value={newTheme.bg} style={{ flex: 1 }}
                            onChange={e => setNewTheme(p => ({ ...p, bg: e.target.value }))} />
                        </div>
                        <div className="toggle-row" style={{ marginTop: 8 }}>
                          <span className="toggle-label">Dark mode</span>
                          <button className={`toggle-btn${newTheme.dark ? ' on' : ''}`}
                            onClick={() => setNewTheme(p => ({ ...p, dark: !p.dark }))} />
                        </div>
                        <div className="theme-actions">
                          <button className="btn-save" onClick={handleAddTheme}>Save Theme</button>
                          <button className="btn-cancel" onClick={() => setEditingTheme(false)}>Cancel</button>
                        </div>
                      </div>
                    )}

                    <div className="sec-label">Effects</div>
                    <div className="toggle-row">
                      <span className="toggle-label">Sakura Petals</span>
                      <button className={`toggle-btn${fx.petals ? ' on' : ''}`}
                        onClick={() => setFx(f => ({ ...f, petals: !f.petals }))} />
                    </div>
                    <div className="toggle-row">
                      <span className="toggle-label">Color Orbs</span>
                      <button className={`toggle-btn${fx.orbs ? ' on' : ''}`}
                        onClick={() => setFx(f => ({ ...f, orbs: !f.orbs }))} />
                    </div>

                    <ImageUpload bgImage={bgImage} onChange={setBgImg} />
                  </>}

                  {tab === 'content' && <>
                    <div className="sec-label">{tplMeta.jp} {tplMeta.en} — Content</div>
                    {isImgTpl && !bgImage && (
                      <div style={{ background: 'rgba(244,162,97,0.1)', border: '1px solid rgba(244,162,97,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: 'rgba(244,162,97,0.9)', fontWeight: 500, lineHeight: 1.5 }}>
                        Upload an image in Style tab for best results
                      </div>
                    )}
                    <CtrlComp data={data as never} onChange={setData as never} onDownload={download} onStartBatch={handleStartBatch} />
                  </>}
                </div>

                <div className="dl-wrap">
                  <button className="dl-btn" onClick={download} disabled={dl}>
                    {dl ? 'Rendering…' : `Download  ${fmt.dims}`}
                  </button>
                </div>
              </div>

              <div className="preview-area">
                <div className="preview-wrap" style={{ width: prevW, height: prevH }}>
                  <div style={{ width: fmt.w, height: fmt.h, transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                    <PosterComp {...posterProps} />
                  </div>
                </div>
                <div className="preview-label">{fmt.dims} px  ·  2× HQ  ·  {fmt.sub}</div>
              </div>

              <div style={{ position: 'fixed', left: -(fmt.w + 100), top: -(fmt.h + 100), width: fmt.w, height: fmt.h, pointerEvents: 'none', zIndex: -999, overflow: 'hidden' }}>
                <div ref={hiddenRef} style={{ width: fmt.w, height: fmt.h }}>
                  <PosterComp {...posterProps} />
                </div>
              </div>
            </div>
          )}
          </ErrorBoundary>
        </div>
      </div>
    </AuthGuard>
  )
}
