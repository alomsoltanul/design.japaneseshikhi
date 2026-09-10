import { useState, useEffect, useRef, useCallback } from 'react'
import type { PresentationDeck, Slide, SlideType } from './types'
import { DARE_PRESENTATION_PRESET, PRESET_LIBRARY } from './presets'
import { SlideCanvas } from './SlideCanvas'
import { JsonWorkflowModal } from './JsonWorkflowModal'
import { VisualSlideEditor } from './VisualSlideEditor'
import { exportSlidePng, exportDeckZip } from './exportPresentation'
import './presentation.css'

const STORAGE_KEY = 'js-presentation-deck-v1'

function loadSavedDeck(): PresentationDeck {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.slides?.length) return parsed
    }
  } catch (e) {
    console.error('Failed to load presentation deck from storage', e)
  }
  return DARE_PRESENTATION_PRESET
}

export function PresentationStudio() {
  const [deck, setDeck] = useState<PresentationDeck>(loadSavedDeck)
  const [activeIdx, setActiveIdx] = useState<number>(0)
  const [isPresenting, setIsPresenting] = useState<boolean>(false)
  const [isJsonModalOpen, setIsJsonModalOpen] = useState<boolean>(false)
  const [isVisualEditorOpen, setIsVisualEditorOpen] = useState<boolean>(false)
  const [isNotesOpen, setIsNotesOpen] = useState<boolean>(true)
  const [laserActive, setLaserActive] = useState<boolean>(false)
  const [laserPos, setLaserPos] = useState<{ x: number; y: number }>({ x: -100, y: -100 })
  const [exporting, setExporting] = useState<boolean>(false)
  const [exportStatus, setExportStatus] = useState<string>('')
  const [offscreenSlideIdx, setOffscreenSlideIdx] = useState<number | null>(null)

  const activeCanvasRef = useRef<HTMLDivElement>(null)
  const offscreenCanvasRef = useRef<HTMLDivElement>(null)

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(deck))
    } catch (e) {
      console.error('Failed to save deck', e)
    }
  }, [deck])

  // Clamp active index
  const safeIdx = Math.max(0, Math.min(activeIdx, deck.slides.length - 1))
  const currentSlide = deck.slides[safeIdx] || deck.slides[0]

  const handleNextSlide = useCallback(() => {
    setActiveIdx(prev => Math.min(prev + 1, deck.slides.length - 1))
  }, [deck.slides.length])

  const handlePrevSlide = useCallback(() => {
    setActiveIdx(prev => Math.max(prev - 1, 0))
  }, [])

  const enterFullscreen = useCallback(() => {
    setIsPresenting(true)
    const el = document.documentElement
    if (el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen().catch(() => {
        // Fallback to overlay if browser blocks requestFullscreen
      })
    }
  }, [])

  const exitFullscreen = useCallback(() => {
    setIsPresenting(false)
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (isPresenting || document.fullscreenElement) {
      exitFullscreen()
    } else {
      enterFullscreen()
    }
  }, [isPresenting, enterFullscreen, exitFullscreen])

  // Sync with browser native fullscreen events (e.g. user hits Esc)
  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        setIsPresenting(false)
      } else {
        setIsPresenting(true)
      }
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    document.addEventListener('webkitfullscreenchange', handleFsChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange)
      document.removeEventListener('webkitfullscreenchange', handleFsChange)
    }
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return

      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault()
        handleNextSlide()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        handlePrevSlide()
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        toggleFullscreen()
      } else if (e.key === 'Escape' && isPresenting) {
        exitFullscreen()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNextSlide, handlePrevSlide, isPresenting, toggleFullscreen, exitFullscreen])

  // Mouse tracking for laser pointer
  const handleMouseMove = (e: React.MouseEvent) => {
    if (laserActive) {
      setLaserPos({ x: e.clientX, y: e.clientY })
    }
  }

  // Slide CRUD
  const handleAddSlide = (type: SlideType = 'qa-grid') => {
    let newSlide: Slide
    if (type === 'conversation') {
      newSlide = {
        id: `slide-${Date.now()}`,
        type: 'conversation',
        brand: deck.brand,
        brandColor: deck.brandColor,
        keyword: '会話',
        title: '会話 — Reading Practice',
        image: { url: '/assets/slides-anime-hallway.png' },
        dialogue: {
          title: '日常会話',
          lines: [
            { speaker: 'A', text: 'こんにちは！' },
            { speaker: 'B', text: 'こんにちは、お元気ですか？' },
          ],
        },
      }
    } else if (type === 'title') {
      newSlide = {
        id: `slide-${Date.now()}`,
        type: 'title',
        brand: deck.brand,
        brandColor: deck.brandColor,
        level: 'JLPT N5',
        title: 'Japanese Lesson',
        topicEn: 'Essential Questions',
        topicBn: 'প্রয়োজনীয় প্রশ্নাবলী',
        bulletPoints: ['Understand question structures', 'Practice real conversations'],
      }
    } else if (type === 'vocab-list') {
      newSlide = {
        id: `slide-${Date.now()}`,
        type: 'vocab-list',
        brand: deck.brand,
        brandColor: deck.brandColor,
        keyword: '単語',
        title: 'Essential Vocabulary',
        items: [
          { word: '人', furigana: 'ひと', romaji: 'hito', meaning: 'ব্যক্তি / Person', example: 'あの人はだれ？' },
          { word: '先生', furigana: 'せんせい', romaji: 'sensei', meaning: 'শিক্ষক / Teacher', example: '日本語の先生です。' },
        ],
      }
    } else {
      newSlide = {
        id: `slide-${Date.now()}`,
        type: 'qa-grid',
        brand: deck.brand,
        brandColor: deck.brandColor,
        keyword: 'だれ？',
        title: '「だれ」 দিয়ে প্রশ্ন শিখুন',
        titleHighlight: '「だれ」',
        columns: [
          {
            id: `col-${Date.now()}-1`,
            cards: [
              {
                id: `card-${Date.now()}-1`,
                items: [
                  {
                    japanese: 'この人はだれですか？',
                    romaji: 'Kono hito wa dare desu ka?',
                    translation: 'এই ব্যক্তিটি কে?',
                    reply: '友達です。',
                  },
                ],
              },
            ],
          },
          {
            id: `col-${Date.now()}-2`,
            cards: [
              {
                id: `card-${Date.now()}-2`,
                items: [
                  {
                    japanese: 'だれと行きますか？',
                    romaji: 'Dare to ikimasu ka?',
                    translation: 'কার সাথে যাবেন?',
                    reply: '家族と行きます。',
                  },
                ],
              },
            ],
          },
        ],
      }
    }

    const updatedSlides = [...deck.slides, newSlide]
    setDeck({ ...deck, slides: updatedSlides })
    setActiveIdx(updatedSlides.length - 1)
  }

  const handleDuplicateSlide = (idx: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const target = deck.slides[idx]
    if (!target) return
    const duplicated: Slide = JSON.parse(JSON.stringify(target))
    duplicated.id = `slide-${Date.now()}`
    const updated = [...deck.slides]
    updated.splice(idx + 1, 0, duplicated)
    setDeck({ ...deck, slides: updated })
    setActiveIdx(idx + 1)
  }

  const handleDeleteSlide = (idx: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (deck.slides.length <= 1) {
      alert('The deck must have at least one slide.')
      return
    }
    const updated = deck.slides.filter((_, i) => i !== idx)
    setDeck({ ...deck, slides: updated })
    setActiveIdx(prev => Math.min(prev, updated.length - 1))
  }

  const handleMoveSlide = (fromIdx: number, toIdx: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (toIdx < 0 || toIdx >= deck.slides.length) return
    const updated = [...deck.slides]
    const [moved] = updated.splice(fromIdx, 1)
    updated.splice(toIdx, 0, moved)
    setDeck({ ...deck, slides: updated })
    setActiveIdx(toIdx)
  }

  const handleUpdateCurrentSlide = (updated: Slide) => {
    const updatedSlides = [...deck.slides]
    updatedSlides[safeIdx] = updated
    setDeck({ ...deck, slides: updatedSlides })
  }

  // Export Slide PNG
  const handleExportPng = async () => {
    if (!activeCanvasRef.current) return
    try {
      setExporting(true)
      setExportStatus('Rendering 1920×1080 slide...')
      const filename = `slide-${safeIdx + 1}-${(currentSlide.keyword || 'presentation').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
      await exportSlidePng(activeCanvasRef.current, filename)
    } catch (e) {
      console.error('Failed to export PNG', e)
      alert(`Export failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setExporting(false)
      setExportStatus('')
    }
  }

  // Export Deck ZIP
  const handleExportZip = async () => {
    try {
      setExporting(true)
      await exportDeckZip(
        deck,
        async (slideIdx: number) => {
          setOffscreenSlideIdx(slideIdx)
          // Wait for DOM to render offscreen slide
          await new Promise(r => setTimeout(r, 200))
          if (!offscreenCanvasRef.current) throw new Error('Offscreen canvas not found')
          return offscreenCanvasRef.current
        },
        progress => setExportStatus(progress)
      )
    } catch (e) {
      console.error('Failed to export ZIP', e)
      alert(`Export failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setOffscreenSlideIdx(null)
      setExporting(false)
      setExportStatus('')
    }
  }

  return (
    <div className="ps-root" onMouseMove={handleMouseMove}>
      {/* Laser Pointer Dot */}
      {laserActive && (
        <div
          className="ps-laser-dot"
          style={{ left: laserPos.x, top: laserPos.y }}
        />
      )}

      {/* Top Action Bar */}
      <header className="ps-topbar">
        <div className="ps-topbar-left">
          <span className="ps-deck-badge">Presentation Studio</span>
          <input
            className="ps-deck-title-input"
            value={deck.title}
            onChange={e => setDeck({ ...deck, title: e.target.value })}
            placeholder="Deck Title..."
          />
        </div>

        <div className="ps-topbar-actions">
          {/* Preset Selector */}
          <select
            className="ps-btn"
            style={{ padding: '6px 10px', fontSize: 12 }}
            onChange={e => {
              const p = PRESET_LIBRARY[e.target.value]
              if (p) {
                setDeck(p)
                setActiveIdx(0)
              }
            }}
            value=""
          >
            <option value="" disabled>Load Presets...</option>
            <option value="dare-preset">🔥 だれ？ 2-Slide Guide</option>
            <option value="nani-preset">💡 なに？ Q&A Guide</option>
          </select>

          {/* Workflow JSON */}
          <button
            className="ps-btn"
            onClick={() => setIsJsonModalOpen(true)}
            type="button"
            title="Paste or edit workflow JSON"
          >
            <span>📋</span> Workflow JSON
          </button>

          {/* Visual Editor Toggle */}
          <button
            className={`ps-btn${isVisualEditorOpen ? ' ps-btn-primary' : ''}`}
            onClick={() => setIsVisualEditorOpen(prev => !prev)}
            type="button"
            title="Edit current slide visually"
          >
            <span>✏️</span> Edit Slide
          </button>

          {/* Export PNG */}
          <button
            className="ps-btn"
            onClick={handleExportPng}
            disabled={exporting}
            type="button"
            title="Export this slide as 1920x1080 PNG"
          >
            <span>🖼️</span> Export PNG
          </button>

          {/* Export ZIP */}
          <button
            className="ps-btn"
            onClick={handleExportZip}
            disabled={exporting}
            type="button"
            title="Download all slides + notes as ZIP"
          >
            <span>📦</span> Export ZIP
          </button>

          {/* Present Fullscreen */}
          <button
            className="ps-btn ps-btn-present"
            onClick={enterFullscreen}
            type="button"
            title="Full-screen Presentation Mode (F)"
          >
            <span>▶</span> Present (F)
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="ps-main-body">
        {/* Left Thumbnails Rail */}
        <aside className="ps-thumb-rail">
          <div className="ps-thumb-header">
            <span>Slides ({deck.slides.length})</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="ps-btn ps-btn-ghost"
                style={{ padding: '2px 6px', fontSize: 11 }}
                onClick={() => handleAddSlide('qa-grid')}
                title="Add Q&A Grid Slide"
                type="button"
              >
                + QA
              </button>
              <button
                className="ps-btn ps-btn-ghost"
                style={{ padding: '2px 6px', fontSize: 11 }}
                onClick={() => handleAddSlide('conversation')}
                title="Add Conversation Slide"
                type="button"
              >
                + Kaiwa
              </button>
            </div>
          </div>

          <div className="ps-thumb-list">
            {deck.slides.map((s, idx) => (
              <div
                key={s.id || idx}
                className={`ps-thumb-item${idx === safeIdx ? ' active' : ''}`}
                onClick={() => setActiveIdx(idx)}
              >
                <div className="ps-thumb-meta">
                  <span className="ps-thumb-num">#{idx + 1}</span>
                  <span className="ps-thumb-type-tag">{s.type}</span>
                  <div className="ps-thumb-controls">
                    {idx > 0 && (
                      <button
                        className="ps-thumb-btn"
                        onClick={e => handleMoveSlide(idx, idx - 1, e)}
                        title="Move Up"
                        type="button"
                      >
                        ▲
                      </button>
                    )}
                    {idx < deck.slides.length - 1 && (
                      <button
                        className="ps-thumb-btn"
                        onClick={e => handleMoveSlide(idx, idx + 1, e)}
                        title="Move Down"
                        type="button"
                      >
                        ▼
                      </button>
                    )}
                    <button
                      className="ps-thumb-btn"
                      onClick={e => handleDuplicateSlide(idx, e)}
                      title="Duplicate"
                      type="button"
                    >
                      ⧉
                    </button>
                    {deck.slides.length > 1 && (
                      <button
                        className="ps-thumb-btn"
                        onClick={e => handleDeleteSlide(idx, e)}
                        title="Delete"
                        type="button"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div className="ps-thumb-preview-box">
                  <SlideCanvas slide={s} isThumbnail thumbnailWidth={184} />
                </div>
              </div>
            ))}
          </div>

          <div className="ps-thumb-footer">
            <button
              className="ps-btn"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => handleAddSlide('qa-grid')}
              type="button"
            >
              + Add Q&amp;A Slide
            </button>
          </div>
        </aside>

        {/* Center Presentation Stage */}
        <main className="ps-center-stage">
          {currentSlide && (
            <SlideCanvas slide={currentSlide} canvasRef={activeCanvasRef} />
          )}

          {/* Bottom Bar: Slide Controls & Speaker Notes Toggle */}
          <div className="ps-bottom-bar">
            <div className="ps-nav-controls">
              <button
                className="ps-btn"
                onClick={handlePrevSlide}
                disabled={safeIdx === 0}
                type="button"
                title="Previous Slide (Left Arrow)"
              >
                ◀ Prev
              </button>
              <div className="ps-slide-counter">
                Slide {safeIdx + 1} / {deck.slides.length}
              </div>
              <button
                className="ps-btn"
                onClick={handleNextSlide}
                disabled={safeIdx === deck.slides.length - 1}
                type="button"
                title="Next Slide (Right Arrow / Space)"
              >
                Next ▶
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {exporting && (
                <span style={{ fontSize: 12, color: '#F4A261', fontWeight: 600 }}>
                  ⏳ {exportStatus || 'Processing...'}
                </span>
              )}

              <div
                className={`ps-laser-toggle${laserActive ? ' active' : ''}`}
                onClick={() => setLaserActive(prev => !prev)}
                title="Toggle laser pointer dot"
              >
                <span>🔴</span> Laser Pointer
              </div>

              <button
                className="ps-btn ps-btn-ghost"
                style={{ fontSize: 12 }}
                onClick={() => setIsNotesOpen(prev => !prev)}
                type="button"
              >
                {isNotesOpen ? '▼ Hide Script' : '▲ Speaker Notes'}
              </button>
            </div>
          </div>

          {/* Speaker Notes Drawer */}
          <div className={`ps-notes-drawer${isNotesOpen ? '' : ' collapsed'}`}>
            <div className="ps-notes-header">
              <span className="ps-notes-label">
                <span>🎙️</span> Video Recording Guide / Speaker Notes
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Visible only to creator during prep
              </span>
            </div>
            <textarea
              className="ps-notes-textarea"
              value={currentSlide?.speakerNotes || ''}
              onChange={e => {
                const updated = { ...currentSlide, speakerNotes: e.target.value } as Slide
                handleUpdateCurrentSlide(updated)
              }}
              placeholder="Write your speaking script or cue points for recording this slide..."
            />
          </div>
        </main>

        {/* Visual Slide Editor Drawer */}
        <VisualSlideEditor
          slide={currentSlide}
          isOpen={isVisualEditorOpen}
          onClose={() => setIsVisualEditorOpen(false)}
          onUpdateSlide={handleUpdateCurrentSlide}
        />
      </div>

      {/* Fullscreen Presentation Mode */}
      {isPresenting && (
        <div className="ps-present-mode">
          <SlideCanvas slide={currentSlide} />

          <div className="ps-present-controls">
            <button
              className="ps-btn"
              onClick={handlePrevSlide}
              disabled={safeIdx === 0}
              type="button"
            >
              ◀
            </button>
            <span style={{ color: '#ffffff', fontSize: 13, fontWeight: 700 }}>
              {safeIdx + 1} / {deck.slides.length}
            </span>
            <button
              className="ps-btn"
              onClick={handleNextSlide}
              disabled={safeIdx === deck.slides.length - 1}
              type="button"
            >
              ▶
            </button>
            <button
              className={`ps-btn${laserActive ? ' ps-btn-primary' : ''}`}
              onClick={() => setLaserActive(prev => !prev)}
              type="button"
              title="Laser pointer"
            >
              🔴
            </button>
            <button
              className="ps-btn"
              onClick={exitFullscreen}
              type="button"
              title="Exit fullscreen (Esc)"
            >
              ✕ Exit
            </button>
          </div>
        </div>
      )}

      {/* Offscreen Node for ZIP Render */}
      {offscreenSlideIdx !== null && deck.slides[offscreenSlideIdx] && (
        <div
          style={{
            position: 'fixed',
            left: -99999,
            top: -99999,
            width: 1920,
            height: 1080,
            pointerEvents: 'none',
          }}
        >
          <SlideCanvas
            slide={deck.slides[offscreenSlideIdx]}
            canvasRef={offscreenCanvasRef}
          />
        </div>
      )}

      {/* JSON Workflow Modal */}
      <JsonWorkflowModal
        currentDeck={deck}
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        onApplyDeck={newDeck => {
          setDeck(newDeck)
          setActiveIdx(0)
        }}
      />
    </div>
  )
}
