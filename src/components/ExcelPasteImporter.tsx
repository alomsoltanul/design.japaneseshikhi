import { useState, useCallback } from 'react'

export interface FieldMap {
  [excelColumnIndex: number]: string // maps column index → template data key
}

interface ExcelPasteImporterProps {
  data: Record<string, unknown>
  onChange: (data: Record<string, unknown>) => void
  fieldMap: Record<string, string> // suggested mapping: excel header name (lowercase) → template data key
  templateName: string
  onDownload?: () => void
  onStartBatch?: (rows: Record<string, unknown>[]) => void
}

function parsePastedText(raw: string): string[][] {
  if (!raw.trim()) return []
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

function buildRowData(
  row: string[],
  mapping: FieldMap,
  baseData: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...baseData }
  Object.entries(mapping).forEach(([colIdx, fieldKey]) => {
    const idx = Number(colIdx)
    if (idx < row.length) {
      next[fieldKey] = row[idx]
    }
  })
  return next
}

export function ExcelPasteImporter({
  data,
  onChange,
  fieldMap: suggestedFieldMap,
  templateName,
  onDownload,
  onStartBatch,
}: ExcelPasteImporterProps) {
  const [raw, setRaw] = useState('')
  const [parsed, setParsed] = useState<string[][] | null>(null)
  const [mapping, setMapping] = useState<FieldMap>({})
  const [currentRow, setCurrentRow] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [batching, setBatching] = useState(false)

  const handleParse = useCallback(() => {
    const rows = parsePastedText(raw)
    if (rows.length === 0) {
      setParsed(null)
      setMapping({})
      return
    }
    const headers = rows[0]
    const guessed = guessColumnMapping(headers, suggestedFieldMap)
    setParsed(rows)
    setMapping(guessed)
    setCurrentRow(rows.length > 1 ? 1 : 0)
    setBatching(false)
  }, [raw, suggestedFieldMap])

  const applyRow = useCallback((rowIndex: number) => {
    if (!parsed || rowIndex >= parsed.length) return
    const row = parsed[rowIndex]
    onChange(buildRowData(row, mapping, data))
  }, [parsed, mapping, data, onChange])

  const applyCurrent = () => applyRow(currentRow)

  const handleBatchDownload = useCallback(() => {
    if (!parsed || parsed.length <= 1 || !onStartBatch) return
    const dataRows = parsed.slice(1) // skip header
    const batchData = dataRows.map(row => buildRowData(row, mapping, data))
    onStartBatch(batchData)
    setBatching(true)
  }, [parsed, mapping, data, onStartBatch])

  const handleDownloadCurrent = useCallback(() => {
    applyCurrent()
    setTimeout(() => onDownload?.(), 400)
  }, [applyCurrent, onDownload])

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
  const dataRowStart = isMultiRow ? 1 : 0
  const dataRowCount = isMultiRow ? parsed!.length - 1 : parsed?.length || 0

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
            <button type="button" className="excel-btn secondary" onClick={() => { setRaw(''); setParsed(null); setMapping({}); setBatching(false); }}>
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
                    disabled={currentRow <= dataRowStart}
                    onClick={() => setCurrentRow(Math.max(dataRowStart, currentRow - 1))}
                  >
                    ← Prev
                  </button>
                  <span className="excel-row-count">
                    Row {currentRow + 1 - dataRowStart} of {dataRowCount}
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
                  Apply to Poster
                </button>
                {onDownload && (
                  <button type="button" className="excel-btn" onClick={handleDownloadCurrent}>
                    Apply & Download
                  </button>
                )}
                {isMultiRow && onStartBatch && (
                  <button
                    type="button"
                    className="excel-btn"
                    onClick={handleBatchDownload}
                    disabled={batching}
                  >
                    {batching ? 'Batching…' : `Download All ${dataRowCount} Posters`}
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
