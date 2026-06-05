import { useState, useCallback } from 'react'

const TEMPLATE_EXAMPLES: Record<string, { headers: string; row: string; note: string }> = {
  Grammar: {
    headers: 'pattern\tpattern_reading\tmeaning_bangla\tmeaning_english\tstructure_formula\tparts\tex1jp\tex1bn\tex2jp\tex2bn',
    row: '〜は〜です\t〜wa〜desu\t~ হল ~\t~ is ~\tNoun + は + Noun + です\tNoun, は, Noun, です\t私は学生です。\tআমি একজন ছাত্র।\t彼は先生です।\tতিনি একজন শিক্ষক।',
    note: 'Copy a row from Excel with these exact column headers. The poster will auto-update when you paste.',
  },
  Kanji: {
    headers: 'kanji\tkun\ton\tmeaning_en\tmeaning_bn\texample_jp\texample_romaji\texample_bn\tstrokes',
    row: '山\tやま\tサン\tMountain\tপাহাড়\t富士山\tFujisan\tফুজি পর্বত\t3',
    note: 'Copy a row from Excel with these exact column headers. The poster will auto-update when you paste.',
  },
  Word: {
    headers: 'word_jp\tromaji\tmeaning_bn\texample_jp\texample_bn\ttip',
    row: '旅行\tRyokō\tভ্রমণ / ট্রিপ\t来年、日本に旅行します।\tআগামী বছর জাপান ভ্রমণ করব।\t旅=tabi, 行=iku',
    note: 'Copy a row from Excel with these exact column headers. The poster will auto-update when you paste.',
  },
}

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
  const [autoApply, setAutoApply] = useState(true)
  const [showHelp, setShowHelp] = useState(false)

  const applyRow = useCallback((rowIndex: number) => {
    if (!parsed || rowIndex >= parsed.length) return
    const row = parsed[rowIndex]
    onChange(buildRowData(row, mapping, data))
  }, [parsed, mapping, data, onChange])

  const goToRow = useCallback((rowIndex: number) => {
    setCurrentRow(rowIndex)
    if (parsed && rowIndex < parsed.length && autoApply) {
      onChange(buildRowData(parsed[rowIndex], mapping, data))
    }
  }, [parsed, mapping, data, onChange, autoApply])

  const parseText = useCallback((text: string): { rows: string[][] | null; guessed: FieldMap; startRow: number } => {
    const rows = parsePastedText(text)
    if (rows.length === 0) {
      return { rows: null, guessed: {}, startRow: 0 }
    }
    const headers = rows[0]
    const guessed = guessColumnMapping(headers, suggestedFieldMap)
    const startRow = rows.length > 1 ? 1 : 0
    return { rows, guessed, startRow }
  }, [suggestedFieldMap])

  const handleParse = useCallback(() => {
    const { rows, guessed, startRow } = parseText(raw)
    if (!rows) {
      setParsed(null)
      setMapping({})
      return
    }
    setParsed(rows)
    setMapping(guessed)
    setCurrentRow(startRow)
    setBatching(false)
    if (autoApply) {
      onChange(buildRowData(rows[startRow], guessed, data))
    }
  }, [raw, parseText, autoApply, data, onChange])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    if (!text.trim()) return

    setRaw(text)
    setExpanded(true)

    const { rows, guessed, startRow } = parseText(text)
    if (!rows) {
      setParsed(null)
      setMapping({})
      return
    }
    setParsed(rows)
    setMapping(guessed)
    setCurrentRow(startRow)
    setBatching(false)

    if (autoApply) {
      onChange(buildRowData(rows[startRow], guessed, data))
    }
  }, [parseText, autoApply, data, onChange])

  const handleDownloadCurrent = useCallback(() => {
    if (autoApply) {
      // Data already applied — just download
      onDownload?.()
    } else {
      applyRow(currentRow)
      setTimeout(() => onDownload?.(), 400)
    }
  }, [autoApply, applyRow, currentRow, onDownload])

  const handleBatchDownload = useCallback(() => {
    if (!parsed || parsed.length <= 1 || !onStartBatch) return
    const dataRows = parsed.slice(1) // skip header
    const batchData = dataRows.map(row => buildRowData(row, mapping, data))
    onStartBatch(batchData)
    setBatching(true)
  }, [parsed, mapping, data, onStartBatch])

  const handleMappingChange = (colIndex: number, fieldKey: string) => {
    setMapping(prev => {
      const next = { ...prev }
      if (fieldKey === '__none__') {
        delete next[colIndex]
      } else {
        next[colIndex] = fieldKey
      }
      if (autoApply && parsed && currentRow < parsed.length) {
        onChange(buildRowData(parsed[currentRow], next, data))
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
          <div className="excel-auto-row">
            <label className="excel-auto-label">
              <input
                type="checkbox"
                checked={autoApply}
                onChange={e => setAutoApply(e.target.checked)}
              />
              Auto-update poster on paste
            </label>
          </div>

          <label className="excel-label">Paste Excel row(s) here (tab-separated)</label>
          <textarea
            className="excel-textarea"
            value={raw}
            onChange={e => setRaw(e.target.value)}
            onPaste={handlePaste}
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

          <div className="excel-help-toggle">
            <button type="button" className="excel-help-btn" onClick={() => setShowHelp(!showHelp)}>
              {showHelp ? 'Hide' : 'Show'} paste format for {templateName}
            </button>
          </div>

          {showHelp && TEMPLATE_EXAMPLES[templateName] && (
            <div className="excel-help-box">
              <p className="excel-help-note">{TEMPLATE_EXAMPLES[templateName].note}</p>
              <div className="excel-help-label">Column headers (first row in Excel):</div>
              <pre className="excel-help-code">{TEMPLATE_EXAMPLES[templateName].headers}</pre>
              <div className="excel-help-label">Example data row:</div>
              <pre className="excel-help-code">{TEMPLATE_EXAMPLES[templateName].row}</pre>
              <div className="excel-help-tip">
                <strong>Tip:</strong> Copy a row from Excel (including headers), then click in the box above and press Ctrl+V. The poster preview will update automatically.
              </div>
            </div>
          )}

          {autoApply && raw.trim() && !parsed && (
            <div className="excel-status">Paste above or click Parse to auto-update the poster</div>
          )}

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
                    onClick={() => goToRow(Math.max(dataRowStart, currentRow - 1))}
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
                    onClick={() => goToRow(Math.min(parsed!.length - 1, currentRow + 1))}
                  >
                    Next →
                  </button>
                </div>
              )}

              <div className="excel-apply-actions">
                {!autoApply && (
                  <button type="button" className="excel-btn primary" onClick={() => applyRow(currentRow)}>
                    Apply to Poster
                  </button>
                )}
                {onDownload && (
                  <button type="button" className="excel-btn download" onClick={handleDownloadCurrent}>
                    Download Image
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
