import { useState, useCallback } from 'react'
import type { PresentationDeck, Slide } from './types'
import { DARE_PRESENTATION_PRESET, NANI_PRESENTATION_PRESET } from './presets'

interface JsonWorkflowModalProps {
  currentDeck: PresentationDeck
  isOpen: boolean
  onClose: () => void
  onApplyDeck: (deck: PresentationDeck) => void
}

export function JsonWorkflowModal({
  currentDeck,
  isOpen,
  onClose,
  onApplyDeck,
}: JsonWorkflowModalProps) {
  const [rawJson, setRawJson] = useState(() => JSON.stringify(currentDeck, null, 2))
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleFormat = useCallback(() => {
    try {
      const parsed = JSON.parse(rawJson)
      setRawJson(JSON.stringify(parsed, null, 2))
      setError(null)
    } catch (e) {
      setError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`)
    }
  }, [rawJson])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(rawJson)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error('Failed to copy', e)
    }
  }, [rawJson])

  const handleDownload = useCallback(() => {
    try {
      const blob = new Blob([rawJson], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'presentation-workflow.json'
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      console.error('Failed to download', e)
    }
  }, [rawJson])

  const handleLoadPreset = useCallback((preset: PresentationDeck) => {
    setRawJson(JSON.stringify(preset, null, 2))
    setError(null)
  }, [])

  const handleApply = useCallback(() => {
    setError(null)
    if (!rawJson.trim()) {
      setError('Please enter JSON context')
      return
    }

    try {
      const parsed = JSON.parse(rawJson)

      // Flexible validation & normalization
      let deck: PresentationDeck

      if (parsed.slides && Array.isArray(parsed.slides)) {
        // Standard PresentationDeck
        deck = {
          id: parsed.id || `deck-${Date.now()}`,
          title: parsed.title || 'Untitled Presentation',
          description: parsed.description || '',
          brand: parsed.brand || 'Japanese Shikhi',
          brandColor: parsed.brandColor || '#E63946',
          slides: parsed.slides,
        }
      } else if (Array.isArray(parsed)) {
        // User pasted an array of slides
        deck = {
          id: `deck-${Date.now()}`,
          title: currentDeck.title,
          brand: currentDeck.brand,
          brandColor: currentDeck.brandColor,
          slides: parsed as Slide[],
        }
      } else if (parsed.type && (parsed.type === 'qa-grid' || parsed.type === 'conversation' || parsed.type === 'title' || parsed.type === 'vocab-list')) {
        // User pasted a single slide
        deck = {
          id: `deck-${Date.now()}`,
          title: currentDeck.title,
          brand: currentDeck.brand,
          brandColor: currentDeck.brandColor,
          slides: [parsed as Slide],
        }
      } else {
        setError('JSON structure not recognized. Expecting { title: string, slides: Slide[] } or Slide[]')
        return
      }

      onApplyDeck(deck)
      onClose()
    } catch (e) {
      setError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`)
    }
  }, [rawJson, currentDeck, onApplyDeck, onClose])

  if (!isOpen) return null

  return (
    <div className="ps-modal-backdrop" onClick={onClose}>
      <div className="ps-modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="ps-modal-header">
          <h3>
            <span>📋</span> Presentation Workflow JSON
          </h3>
          <button className="ps-btn ps-btn-ghost" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="ps-modal-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Load Presets:</span>
              <button
                className="ps-btn"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => handleLoadPreset(DARE_PRESENTATION_PRESET)}
                type="button"
              >
                🔥 だれ？ 2-Slide Preset
              </button>
              <button
                className="ps-btn"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => handleLoadPreset(NANI_PRESENTATION_PRESET)}
                type="button"
              >
                💡 なに？ Q&A Preset
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button className="ps-btn" style={{ fontSize: 12 }} onClick={handleFormat} type="button">
                Format
              </button>
              <button className="ps-btn" style={{ fontSize: 12 }} onClick={handleCopy} type="button">
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <button className="ps-btn" style={{ fontSize: 12 }} onClick={handleDownload} type="button">
                Download .json
              </button>
            </div>
          </div>

          <textarea
            className="ps-json-editor"
            value={rawJson}
            onChange={e => setRawJson(e.target.value)}
            spellCheck={false}
            placeholder="Paste your presentation slides workflow JSON here..."
          />

          {error && <div className="ps-alert-error">{error}</div>}
        </div>

        {/* Footer */}
        <div className="ps-modal-footer">
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Paste context JSON matching Q&A grids or dialogues. Instant PPTX layout.
          </span>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ps-btn" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="ps-btn ps-btn-primary" onClick={handleApply} type="button">
              Apply Workflow &amp; Render Slides
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
