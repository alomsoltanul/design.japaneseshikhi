import { useState, useCallback } from 'react'

export interface FieldMap {
  [excelColumnIndex: number]: string // maps column index → template data key
}

interface ExcelPasteImporterProps {
  data: Record<string, unknown>
  onChange: (data: Record<string, unknown>) => void
  fieldMap: Record<string, string> // suggested mapping: excel header name (lowercase) → template data key
  templateName: string
}

function parsePastedText(raw: string): string[][] {
  if (!raw.trim()) return []
  // Split by newline, then by tab
  return raw
    .split(/\r?\n/)
    .map(row => row.split('\t').map(cell => cell.trim()))
    .filter(row => row.length > 1 || (row.length === 1 && row[0] !== ''))
}

function guessColumnMapping(
  headers: string[],
  suggestedMap: Record<string, string>
): FieldMap {
  const mapping: FieldMap = {}
  headers.forEach((h, i) => {
    const key = h.toLowerCase().trim().replace(/\s+/g, '_')
    if (suggestedMap[key]) {
      mapping[i] = suggestedMap[key]
    }
  })
  return mapping
}

export function ExcelPasteImporter({
  data,
  onChange,
  fieldMap: suggestedFieldMap,
  templateName,
}: ExcelPasteImporterProps) {
  const [raw, setRaw] = useState('')
  const [parsed, setParsed] = useState<string[][] | null>(null)
  const [mapping, setMapping] = useState<FieldMap>({})
  const [currentRow, setCurrentRow] = useState(0)
  const [expanded, setExpanded] = useState(false)

  const handleParse = useCallback(() => {
    const rows = parsePastedText(raw)
    if (rows.length === 0) {
      setParsed(null)
      setMapping({})
      return
    }

    // Try to detect header row (first row)
    const headers = rows[0]
    const guessed = guessColumnMapping(headers, suggestedFieldMap)

    setParsed(rows)
    setMapping(guessed)
    setCurrentRow(rows.length > 1 ? 1 : 0) // skip header if present
  }, [raw, suggestedFieldMap])

  const applyRow = useCallback((rowIndex: number) => {
    if (!parsed || rowIndex >= parsed.length) return
    const row = parsed[rowIndex]
    const next = { ...data }
    Object.entries(mapping).forEach(([colIdx, fieldKey]) => {
      const idx = Number(colIdx)
      if (idx < row.length) {
        next[fieldKey] = row[idx]
      }
    })
    onChange(next)
  }, [parsed, mapping, data, onChange])

  const applyCurrent = () => applyRow(currentRow)

  const applyAll = useCallback(() => {
    if (!parsed) return
    // For single-row paste, just apply current
    if (parsed.length <= 1) {
      applyCurrent()
      return
    }
    // Apply each row sequentially with a small delay so user can see
    const dataRows = parsed.length > 1 && parsed[0].every((h, i) => suggestedFieldMap[h.toLowerCase().trim()])
      ? parsed.slice(1)
      : parsed

    dataRows.forEach((row, i) => {
      setTimeout(() => {
        const next = { ...data }
        Object.entries(mapping).forEach(([colIdx, fieldKey]) => {
          const idx = Number(colIdx)
          if (idx < row.length) {
            next[fieldKey] = row[idx]
          }
        })
        onChange(next)
        setCurrentRow(parsed.length > 1 ? i + 1 : i)
      }, i * 200)
    })
  }, [parsed, mapping, data, onChange, applyCurrent, suggestedFieldMap])

  const handleMappingChange = (colIndex: number, fieldKey: string) => {
    setMapping(prev => {
      const next = { ...prev }
      if (fieldKey === '__none__') {
        delete next[colIndex]
      } else {
        next[colIndex] = fieldKey
      }
      return next
    })
  }

  const availableFields = Object.values(suggestedFieldMap)
  const hasData = parsed && parsed.length > 0
  const isMultiRow = hasData && parsed!.length > 1

  return (
    <div className="excel-import-section">
      <button
        type="button"
        className="excel-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <span>{expanded ? '▼' : '▶'}</span>
        <span>Excel Paste Import</span>
        {!expanded && <span className="excel-hint">Paste from Excel to auto-fill fields</span>}
      </button>

      {expanded && (
        <div className="excel-body">
          <label className="excel-label">Paste Excel row(s) here (tab-separated)</label>
          <textarea
            className="excel-textarea"
            value={raw}
            onChange={e => setRaw(e.target.value)}
            placeholder={`Example: copy a row from Excel with columns separated by tabs\n\npattern\tpattern_reading\tmeaning_bangla\tstructure_formula\n〜とはいえ\t〜to wa ie\tযদিও ~\t[Plain sentence] + とはいえ`}
            rows={3}
          />
          <div className="excel-actions">
            <button type="button" className="excel-btn" onClick={handleParse}>
              Parse & Map
            </button>
            <button type="button" className="excel-btn secondary" onClick={() => { setRaw(''); setParsed(null); setMapping({}) }}>
              Clear
            </button>
          </div>

          {hasData && (
            <>
              <div className="excel-mapping">
                <p className="excel-section-title">Column Mapping</p>
                {parsed![0].map((header, i) => (
                  <div key={i} className="excel-map-row">
                    <span className="excel-col-name" title={header}>{header || `(Col ${i + 1})`}</span>
                    <select
                      value={mapping[i] || '__none__'}
                      onChange={e => handleMappingChange(i, e.target.value)}
                    >
                      <option value="__none__">— Ignore —</option>
                      {availableFields.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {isMultiRow && (
                <div className="excel-row-nav">
                  <button
                    type="button"
                    className="excel-nav-btn"
                    disabled={currentRow <= (parsed!.length > 1 ? 1 : 0)}
                    onClick={() => {
                      const minRow = parsed!.length > 1 ? 1 : 0
                      setCurrentRow(Math.max(minRow, currentRow - 1))
                    }}
                  >
                    ← Prev
                  </button>
                  <span className="excel-row-count">
                    Row {currentRow + 1} of {parsed!.length}
                    {parsed!.length > 1 ? ' (skipping header)' : ''}
                  </span>
                  <button
                    type="button"
                    className="excel-nav-btn"
                    disabled={currentRow >= parsed!.length - 1}
                    onClick={() => setCurrentRow(Math.min(parsed!.length - 1, currentRow + 1))}
                  >
                    Next →
                  </button>
                </div>
              )}

              <div className="excel-apply-actions">
                <button type="button" className="excel-btn primary" onClick={applyCurrent}>
                  Apply Row {currentRow + 1} to Poster
                </button>
                {isMultiRow && (
                  <button type="button" className="excel-btn" onClick={applyAll}>
                    Apply All Rows
                  </button>
                )}
              </div>

              {parsed && parsed[currentRow] && (
                <div className="excel-preview">
                  <p className="excel-section-title">Preview (Row {currentRow + 1})</p>
                  <div className="excel-preview-grid">
                    {parsed[currentRow].map((cell, i) => (
                      <div key={i} className={`excel-preview-cell${mapping[i] ? ' mapped' : ''}`}>
                        <span className="excel-preview-header">{parsed![0][i] || `Col ${i + 1}`}</span>
                        <span className="excel-preview-value">{cell}</span>
                        {mapping[i] && <span className="excel-preview-mapped">→ {mapping[i]}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
