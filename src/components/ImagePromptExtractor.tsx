import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { extractPrompts, type ExtractedPrompts } from '@/lib/extractPrompts'
import type { AppView } from '@/components/ToolMenu'
import { ToolMenu } from '@/components/ToolMenu'

const WIDTH_STORAGE_KEY = 'js-image-prompt-extractor-left-width'

const EMPTY_PLACEHOLDER = `Paste listening test JSON here...\n\n{\n  "level": "N5",\n  "test_number": 2,\n  "problems": [...]\n}`

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function ImagePromptExtractor({
  view,
  onChangeView,
}: {
  view: AppView
  onChangeView: (view: AppView) => void
}) {
  const [jsonInput, setJsonInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ExtractedPrompts | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [leftWidth, setLeftWidth] = useState(() => {
    const raw = localStorage.getItem(WIDTH_STORAGE_KEY)
    const parsed = raw ? Number(raw) : 380
    return Number.isFinite(parsed) ? parsed : 380
  })
  const [dragging, setDragging] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [copied, setCopied] = useState<Record<string, boolean>>({})

  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    localStorage.setItem(WIDTH_STORAGE_KEY, String(leftWidth))
  }, [leftWidth])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(id)
  }, [toast])

  useEffect(() => {
    if (!dragging) return
    const handleMove = (event: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const next = clamp(event.clientX - rect.left, 260, 560)
      setLeftWidth(next)
    }

    const handleUp = () => setDragging(false)

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
      document.body.style.userSelect = ''
    }
  }, [dragging])

  const { promptCount, problemCount } = useMemo(() => {
    if (!results) return { promptCount: 0, problemCount: 0 }
    return { promptCount: results.promptCount, problemCount: results.problemCount }
  }, [results])

  const runExtract = useCallback(() => {
    const trimmed = jsonInput.trim()
    if (!trimmed) {
      setError('No JSON provided. Paste a listening test JSON or drop a file.')
      setResults(null)
      return
    }

    try {
      const extracted = extractPrompts(trimmed)
      setResults(extracted)
      setError(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid JSON.'
      setError(msg)
      setResults(null)
    }
  }, [jsonInput])

  const handleFile = useCallback(async (file: File) => {
    const text = await file.text()
    setJsonInput(text)
    setError(null)
    try {
      const extracted = extractPrompts(text)
      setResults(extracted)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid JSON.'
      setError(msg)
      setResults(null)
    }
  }, [])

  const handleCopy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(prev => ({ ...prev, [id]: true }))
    setToast('Copied to clipboard')
    window.setTimeout(() => {
      setCopied(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }, 2000)
  }, [])

  const handleCopyAll = useCallback(() => {
    if (!results || results.allPrompts.length === 0) return
    const joined = results.allPrompts
      .map((prompt, index) => `[Prompt ${index + 1}]\n${prompt}`)
      .join('\n\n')
    navigator.clipboard.writeText(joined)
    setToast('All prompts copied')
  }, [results])

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setDragOver(false)
      const file = event.dataTransfer.files[0]
      if (file) {
        await handleFile(file)
      }
    },
    [handleFile]
  )

  const hasResults = Boolean(results && results.promptCount > 0)

  return (
    <div className="ipe-app" ref={containerRef}>
      <div className="ipe-glow ipe-glow-left" />
      <div className="ipe-glow ipe-glow-right" />

      <header className="ipe-header">
        <div className="ipe-header-left">
          <div className="ipe-logo">JS</div>
          <div className="ipe-brand">Japanese Shikhi</div>
          <div className="ipe-sep" />
          <div className="ipe-tool">Image Prompt Extractor</div>
        </div>
        <div className="ipe-header-right">
          <div className="ipe-kbd-row">
            <span className="ipe-kbd">⌘</span>
            <span className="ipe-kbd">↵</span>
            <span className="ipe-kbd-label">Extract</span>
          </div>
          <ToolMenu view={view} onChange={onChangeView} compact />
          <div className="ipe-admin">ADMIN TOOL</div>
        </div>
      </header>

      <div className="ipe-workspace">
        <section className="ipe-left" style={{ width: leftWidth }}>
          <div className="ipe-section-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M5 4h9l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="#374151" strokeWidth="1.5" />
              <path d="M14 4v5h5" stroke="#374151" strokeWidth="1.5" />
            </svg>
            JSON Input
          </div>

          <div
            className={`ipe-drop${dragOver ? ' drag' : ''}`}
            onDragOver={event => {
              event.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="ipe-drop-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M5 4h9l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="#6b7280" strokeWidth="1.5" />
                <path d="M9 14h6M9 10h3" stroke="#6b7280" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="ipe-drop-text">
              <div className="ipe-drop-title">Drop JSON file or browse</div>
              <div className="ipe-drop-sub">Accepts <span>.json</span> listening test files</div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={event => {
                const file = event.target.files?.[0]
                if (file) {
                  handleFile(file)
                }
              }}
            />
          </div>

          <textarea
            className="ipe-textarea"
            value={jsonInput}
            placeholder={EMPTY_PLACEHOLDER}
            onChange={event => setJsonInput(event.target.value)}
            onKeyDown={event => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                runExtract()
              }
            }}
          />

          {error && (
            <div className="ipe-error">
              {error}
            </div>
          )}

          <button className="ipe-extract" onClick={runExtract} type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M7 10l5-5 5 5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Extract Image Prompts
          </button>
        </section>

        <div
          className={`ipe-handle${dragging ? ' on' : ''}`}
          onMouseDown={() => setDragging(true)}
        />

        <section className="ipe-right">
          <div className="ipe-topbar">
            <div className="ipe-pill-row">
              <span className={`ipe-pill${promptCount > 0 ? ' lit' : ''}`}>
                {promptCount} prompts
              </span>
              <span className={`ipe-pill${problemCount > 0 ? ' lit' : ''}`}>
                {problemCount} problems
              </span>
            </div>
            {hasResults && (
              <button className="ipe-copy-all" onClick={handleCopyAll} type="button">
                Copy All
              </button>
            )}
          </div>

          <div className="ipe-results">
            {!hasResults && (
              <div className="ipe-empty">
                <div className="ipe-empty-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="7" stroke="#252940" strokeWidth="1.5" />
                    <path d="M16.5 16.5L20 20" stroke="#252940" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="ipe-empty-title">No prompts extracted yet</div>
                <div className="ipe-empty-sub">Paste or drop a listening JSON, then click Extract.</div>
              </div>
            )}

            {results?.groups.map((group, groupIndex) => (
              <div className="ipe-group" key={`${group.problemNumber}-${groupIndex}`}>
                <div className="ipe-group-head">
                  <span className="ipe-group-badge">問題 {group.problemNumber}</span>
                  <span className="ipe-group-title">{group.title}</span>
                  <span className="ipe-group-count">{group.items.length} images</span>
                </div>

                {group.items.map((item, index) => {
                  const id = `${item.problemNumber}-${item.questionNumber}-${index}`
                  const copiedOn = Boolean(copied[id])
                  return (
                    <div
                      className="ipe-card"
                      key={id}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <div className="ipe-card-top">
                        <div>
                          <div className="ipe-meta">
                            {item.level} · Test {item.testNumber} · 問題{item.problemNumber} · Q{item.questionNumber}
                          </div>
                          <div className="ipe-question">{item.questionText}</div>
                        </div>
                        <button
                          className={`ipe-copy${copiedOn ? ' on' : ''}`}
                          onClick={() => handleCopy(id, item.prompt)}
                          type="button"
                        >
                          {copiedOn ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                              <path d="M5 13l4 4L19 7" stroke="#2A9D8F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                              <path d="M9 9h9v9H9z" stroke="#6b7280" strokeWidth="1.6" />
                              <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="#6b7280" strokeWidth="1.6" />
                            </svg>
                          )}
                          {copiedOn ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="ipe-prompt">{item.prompt}</pre>
                      {item.filename && (
                        <div className="ipe-file-row">
                          <span className="ipe-file-label">Filename</span>
                          <span className="ipe-file-chip">{item.filename}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </section>
      </div>

      {toast && (
        <div className="ipe-toast">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#2A9D8F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {toast}
        </div>
      )}
    </div>
  )
}
