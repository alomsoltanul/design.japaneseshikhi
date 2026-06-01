import { useState, useCallback } from 'react'
import { TEMPLATE_MAP } from '@/templates'

export type JsonImportPayload = {
  template: string
  data: Record<string, unknown>
}

export function JsonImporter({
  onImport,
}: {
  onImport: (payload: JsonImportPayload) => void
}) {
  const [raw, setRaw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [preview, setPreview] = useState<JsonImportPayload | null>(null)

  const handleParse = useCallback(() => {
    setError(null)
    setSuccess(null)
    setPreview(null)

    if (!raw.trim()) {
      setError('Please paste some JSON first.')
      return
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (e) {
      setError(`Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`)
      return
    }

    if (!parsed || typeof parsed !== 'object') {
      setError('JSON must be an object.')
      return
    }

    const obj = parsed as Record<string, unknown>
    const template = String(obj.template || obj.type || '')
    const data = (obj.data || obj) as Record<string, unknown>

    if (!template) {
      setError('JSON must have a "template" or "type" field.')
      return
    }

    if (!TEMPLATE_MAP[template]) {
      const valid = Object.keys(TEMPLATE_MAP).join(', ')
      setError(`Unknown template "${template}". Valid templates: ${valid}`)
      return
    }

    const payload: JsonImportPayload = { template, data }
    setPreview(payload)
    setSuccess(`Parsed successfully! Template: ${template}`)
  }, [raw])

  const handleImport = useCallback(() => {
    if (!preview) return
    onImport(preview)
    setSuccess('Imported and applied!')
    setRaw('')
    setPreview(null)
  }, [preview, onImport])

  const sampleJson = `{
  "template": "kanji",
  "data": {
    "level": "N5",
    "kanji": "山",
    "kun": "やま",
    "on": "サン",
    "meaningEn": "Mountain",
    "meaningBn": "পাহাড়",
    "exJp": "富士山",
    "exRomaji": "Fujisan",
    "exBn": "ফুজি পর্বত",
    "strokes": "3"
  }
}`

  return (
    <div className="json-import-view">
      <div className="json-import-header">
        <h2>📋 JSON Content Importer</h2>
        <p>Paste JSON to automatically populate any poster template.</p>
      </div>

      <div className="json-import-body">
        <div className="json-import-left">
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Paste JSON here
          </label>
          <textarea
            className="json-textarea"
            value={raw}
            onChange={e => setRaw(e.target.value)}
            placeholder={sampleJson}
            spellCheck={false}
          />
          {error && <div className="json-error">{error}</div>}
          {success && <div className="json-success">{success}</div>}
          <div className="json-import-actions">
            <button className="json-import-btn" onClick={handleParse} type="button">
              🔍 Preview
            </button>
            <button className="json-clear-btn" onClick={() => { setRaw(''); setError(null); setSuccess(null); setPreview(null); }} type="button">
              Clear
            </button>
          </div>
          {preview && (
            <button className="json-import-btn" onClick={handleImport} type="button" style={{ marginTop: 4 }}>
              ✨ Import to Poster Studio
            </button>
          )}
        </div>

        <div className="json-import-right">
          <div className="json-preview-card">
            <h4>How to use</h4>
            <pre>{`{
  "template": "kanji",
  "data": {
    "kanji": "山",
    "meaningEn": "Mountain",
    ...
  }
}`}</pre>
          </div>
          <div className="json-preview-card">
            <h4>Available Templates</h4>
            <pre>{Object.keys(TEMPLATE_MAP).join(', ')}</pre>
          </div>
          {preview && (
            <div className="json-preview-card">
              <h4>Preview: {preview.template}</h4>
              <pre>{JSON.stringify(preview.data, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
