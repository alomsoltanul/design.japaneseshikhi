import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { AuthGuard } from '@/auth/AuthGuard'
import { LoginPage } from '@/auth/LoginPage'
import { SignupPage } from '@/auth/SignupPage'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { GlobalNav } from '@/components/GlobalNav'
import { ImagePromptExtractor } from '@/components/ImagePromptExtractor'
import { JsonImporter } from '@/components/JsonImporter'
import { PosterMaker } from '@/poster-maker/PosterMaker'
import { PosterStudio } from '@/poster/PosterStudio'
import { ListeningStudio } from '@/listening/ListeningStudio'
import { StudioMode } from '@/studio/StudioMode'
import { ContentFactory } from '@/studio/ContentFactory'
import { SubtitleStudio } from '@/subtitles/SubtitleStudio'
import { ClipFinder } from '@/clips/ClipFinder'
import { KanjiStudio } from '@/kanji/KanjiStudio'
import { NewPage } from '@/newpage/NewPage'

const STORAGE_KEY = 'js-poster-studio-v2'
const VIEW_STORAGE_KEY = 'js-poster-studio-view'

export type AppView = 'home' | 'poster' | 'prompt' | 'poster-maker' | 'listening' | 'json-import' | 'reel-studio' | 'clips' | 'subtitles' | 'kanji' | 'newpage'

function getInitialView(): AppView {
  const path = window.location.pathname
  if (path.startsWith('/newpage')) return 'newpage'
  if (path.startsWith('/kanji')) return 'kanji'
  if (path.startsWith('/subtitles')) return 'subtitles'
  if (path.startsWith('/clips')) return 'clips'
  if (path.startsWith('/reel-studio')) return 'reel-studio'
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

  useEffect(() => {
    if (view !== 'poster-maker' && view !== 'listening' && view !== 'reel-studio' && view !== 'clips' && view !== 'subtitles' && view !== 'kanji' && view !== 'newpage') {
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
      next === 'newpage' ? '/newpage' :
      next === 'kanji' ? '/kanji' :
      next === 'subtitles' ? '/subtitles' :
      next === 'clips' ? '/clips' :
      next === 'reel-studio' ? '/reel-studio' :
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
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const prev = raw ? JSON.parse(raw) : {}
      const next = {
        ...prev,
        tpl: payload.template,
        datas: { ...(prev.datas || {}), [payload.template]: payload.data },
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch (e) {
      console.error('json import save failed', e)
    }
    handleChangeView('poster')
  }, [handleChangeView])

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
                  { id: 'reel-studio' as AppView, label: 'Reel Studio', desc: 'Animate vocab/grammar/kanji cards into a 9:16 video — single or word-of-the-day multi-card reel.', icon: '🎬' },
                  { id: 'clips' as AppView, label: 'Clip Finder', desc: 'Search a Japanese word, keep real clips of native speakers saying it, and export the subtitle JSON.', icon: '🔎' },
                  { id: 'subtitles' as AppView, label: 'Subtitle Studio', desc: 'Karaoke-style Japanese subtitles with furigana, romaji, Bangla + tap-to-sync timing.', icon: '💬' },
                  { id: 'kanji' as AppView, label: 'Kanji Mind Map', desc: 'One kanji, eight words — animated map with quiz + Reel/FB/YouTube video export.', icon: '🧠' },
                  { id: 'newpage' as AppView, label: 'Word Reel Preview', desc: 'Live preview of the word-of-the-day reel design (1080×1920) with theme picker.', icon: '📽️' },
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
            {view === 'reel-studio' && (
              <iframe
                src="/tools/learning-reel-studio.html"
                title="Learning Reel Studio"
                allow="autoplay"
                style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
              />
            )}
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
            {view === 'poster' && <PosterStudio onExitToHome={() => handleChangeView('home')} />}
          </ErrorBoundary>
          <ErrorBoundary>
            {view === 'clips' && <ClipFinder onOpenStudio={() => handleChangeView('subtitles')} />}
          </ErrorBoundary>
          <ErrorBoundary>
            {view === 'subtitles' && <SubtitleStudio />}
          </ErrorBoundary>
          <ErrorBoundary>
            {view === 'kanji' && <KanjiStudio />}
          </ErrorBoundary>
          <ErrorBoundary>
            {view === 'newpage' && <NewPage />}
          </ErrorBoundary>
        </div>
      </div>
    </AuthGuard>
  )
}
