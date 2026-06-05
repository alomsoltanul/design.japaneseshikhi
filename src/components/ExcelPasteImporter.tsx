import { useState, useCallback, useEffect, useRef } from 'react'

const TEMPLATE_EXAMPLES: Record<string, { headers: string; row: string; note: string }> = {
  Grammar: {
    headers: 'pattern\tpattern_reading\tmeaning_bangla\tmeaning_english\tstructure_formula\tparts\tex1jp\tex1bn\tex2jp\tex2bn',
    row: '〜は〜です\t〜wa〜desu\t~ হল ~\t~ is ~\tNoun + は + Noun + です\tNoun, は, Noun, です\t私は学生です。\tআমি একজন ছাত্র।\t彼は先生です。\tতিনি একজন শিক্ষক।',
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
  [excelColumnIndex: number]: string
}

interface ExcelPasteImporterProps {
  data: Record<string, unknown>
  onChange: (data: Record<string, unknown>) => void
  fieldMap: Record<string, string>
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

// ─── Smart Mapping ───

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/[\s\-_]+/g, '_')
}

/** Try exact match first, then fuzzy match */
function guessColumnMapping(
  headers: string[],
  suggestedMap: Record<string, string>
): FieldMap {
  const mapping: FieldMap = {}
  const usedFields = new Set<string>()

  // Pass 1: exact normalized match
  headers.forEach((h, i) => {
    const key = normalizeHeader(h)
    if (suggestedMap[key] && !usedFields.has(suggestedMap[key])) {
      mapping[i] = suggestedMap[key]
      usedFields.add(suggestedMap[key])
    }
  })

  // Pass 2: keyword / partial match
  const fuzzyRules: { test: (h: string) => boolean; field: string }[] = buildFuzzyRules(suggestedMap)
  headers.forEach((h, i) => {
    if (mapping[i]) return // already mapped
    const nh = normalizeHeader(h)
    for (const rule of fuzzyRules) {
      if (rule.test(nh) && !usedFields.has(rule.field)) {
        mapping[i] = rule.field
        usedFields.add(rule.field)
        break
      }
    }
  })

  return mapping
}

function buildFuzzyRules(suggestedMap: Record<string, string>): { test: (h: string) => boolean; field: string }[] {
  const rules: { test: (h: string) => boolean; field: string }[] = []
  const has = (k: string) => Object.prototype.hasOwnProperty.call(suggestedMap, k)

  const add = (field: string, keywords: string[]) => {
    rules.push({
      test: (h: string) => keywords.some(k => h.includes(k)),
      field,
    })
  }

  // Grammar
  if (has('pattern')) add('pattern', ['pattern', 'grammar', 'grammer'])
  if (has('pattern_reading')) add('patternReading', ['pattern_reading', 'patternreading', 'reading'])
  if (has('pattern_romaji')) add('patternRomaji', ['pattern_romaji', 'patternromaji', 'romaji'])
  if (has('meaning_bangla')) add('meaningBn', ['meaning_bangla', 'meaningbangla', 'meaning_bn', 'meaningbengali', 'bengali', 'bangla', 'bn_meaning', 'meaning'])
  if (has('meaning_english')) add('meaningEn', ['meaning_english', 'meaningenglish', 'english', 'en_meaning', 'meaning_en'])
  if (has('structure_formula')) add('structureFormula', ['structure', 'formula', 'struct'])
  if (has('parts')) add('parts', ['parts', 'component', 'breakdown'])
  if (has('ex1jp')) add('ex1jp', ['ex1jp', 'example1_jp', 'example_1_jp', 'example1', 'ex1', 'example_jp'])
  if (has('ex1bn')) add('ex1bn', ['ex1bn', 'example1_bn', 'example_1_bn', 'example_bn'])
  if (has('ex2jp')) add('ex2jp', ['ex2jp', 'example2_jp', 'example_2_jp', 'example2', 'ex2'])
  if (has('ex2bn')) add('ex2bn', ['ex2bn', 'example2_bn', 'example_2_bn'])

  // Kanji
  if (has('kanji')) add('kanji', ['kanji', 'character', 'symbol'])
  if (has('kun')) add('kun', ['kun', 'kunyomi', 'くん読み'])
  if (has('on')) add('on', ['on', 'onyomi', 'おん読み'])
  if (has('meaning_en')) add('meaningEn', ['meaning_en', 'meaningen', 'meaning_english', 'english_meaning', 'english', 'en'])
  if (has('meaning_bn')) add('meaningBn', ['meaning_bn', 'meaningbn', 'bengali', 'bangla', 'bn'])
  if (has('example_jp')) add('exJp', ['example_jp', 'examplejp', 'ex_jp', 'sentence_jp'])
  if (has('example_romaji')) add('exRomaji', ['example_romaji', 'exampleromaji', 'ex_romaji', 'romaji'])
  if (has('example_bn')) add('exBn', ['example_bn', 'examplebn', 'ex_bn', 'sentence_bn'])
  if (has('strokes')) add('strokes', ['strokes', 'stroke', '画', 'stroke_count'])

  // Word
  if (has('word_jp')) add('jp', ['word_jp', 'wordjp', 'japanese', 'word', 'jp_word'])
  if (has('romaji')) add('romaji', ['romaji', 'reading', 'pronunciation'])
  if (has('meaning_bn')) add('bn', ['meaning_bn', 'meaningbn', 'bengali', 'bangla', 'meaning', 'bn'])
  if (has('example_jp')) add('exJp', ['example_jp', 'examplejp', 'ex_jp', 'sentence'])
  if (has('example_bn')) add('exBn', ['example_bn', 'examplebn', 'ex_bn'])
  if (has('tip')) add('tip', ['tip', 'hint', 'mnemonic', 'memory'])

  return rules
}

/** Detect if first row looks like data instead of headers */
function looksLikeDataRow(row: string[]): boolean {
  // If any cell has Japanese or Bengali script, it's probably data
  const hasJP = row.some(c => /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(c))
  const hasBN = row.some(c => /[\u0980-\u09FF]/.test(c))
  if (hasJP || hasBN) return true

  // If first cell starts with Japanese grammar marker 〜, it's data
  if (row[0]?.startsWith('〜') || row[0]?.startsWith('~')) return true

  // If most cells look like content (long, with spaces/punctuation) rather than short labels
  const avgLen = row.reduce((sum, c) => sum + c.length, 0) / row.length
  if (avgLen > 15) return true

  return false
}

/** Try to infer mapping from content when no headers match */
function inferMappingFromContent(
  firstDataRow: string[],
  suggestedMap: Record<string, string>
): FieldMap {
  const mapping: FieldMap = {}
  const usedFields = new Set<string>()
  const has = (k: string) => Object.prototype.hasOwnProperty.call(suggestedMap, k)

  firstDataRow.forEach((cell, i) => {
    if (!cell) return
    const c = cell.trim()

    // Japanese text → pattern / kanji / jp
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF〜]/.test(c)) {
      if (has('pattern') && !usedFields.has('pattern')) { mapping[i] = 'pattern'; usedFields.add('pattern'); return }
      if (has('kanji') && !usedFields.has('kanji')) { mapping[i] = 'kanji'; usedFields.add('kanji'); return }
      if (has('word_jp') && !usedFields.has('word_jp')) { mapping[i] = 'word_jp'; usedFields.add('word_jp'); return }
      if (has('jp') && !usedFields.has('jp')) { mapping[i] = 'jp'; usedFields.add('jp'); return }
      if (has('example_jp') && !usedFields.has('example_jp') && c.length > 10) { mapping[i] = 'example_jp'; usedFields.add('example_jp'); return }
      if (has('exJp') && !usedFields.has('exJp') && c.length > 10) { mapping[i] = 'exJp'; usedFields.add('exJp'); return }
    }

    // Bengali text → meaning_bn / bn / exBn
    if (/[\u0980-\u09FF]/.test(c)) {
      if (has('meaning_bangla') && !usedFields.has('meaning_bangla')) { mapping[i] = 'meaning_bangla'; usedFields.add('meaning_bangla'); return }
      if (has('meaning_bn') && !usedFields.has('meaning_bn')) { mapping[i] = 'meaning_bn'; usedFields.add('meaning_bn'); return }
      if (has('bn') && !usedFields.has('bn')) { mapping[i] = 'bn'; usedFields.add('bn'); return }
      if (has('example_bn') && !usedFields.has('example_bn') && c.length > 10) { mapping[i] = 'example_bn'; usedFields.add('example_bn'); return }
      if (has('exBn') && !usedFields.has('exBn') && c.length > 10) { mapping[i] = 'exBn'; usedFields.add('exBn'); return }
      if (has('ex1bn') && !usedFields.has('ex1bn') && c.length > 10) { mapping[i] = 'ex1bn'; usedFields.add('ex1bn'); return }
      if (has('ex2bn') && !usedFields.has('ex2bn') && c.length > 10) { mapping[i] = 'ex2bn'; usedFields.add('ex2bn'); return }
    }

    // Short kana reading → kun / on / pattern_reading
    if (/^[\u3040-\u309F\u30A0-\u30FF]+$/.test(c)) {
      if (has('kun') && !usedFields.has('kun')) { mapping[i] = 'kun'; usedFields.add('kun'); return }
      if (has('on') && !usedFields.has('on')) { mapping[i] = 'on'; usedFields.add('on'); return }
      if (has('pattern_reading') && !usedFields.has('pattern_reading')) { mapping[i] = 'pattern_reading'; usedFields.add('pattern_reading'); return }
    }

    // Romaji (latin with diacritics or macrons) → romaji / patternRomaji / exRomaji
    if (/^[a-zA-Z\sāīūēō\-\d]+$/.test(c) && c.length < 30) {
      if (has('romaji') && !usedFields.has('romaji')) { mapping[i] = 'romaji'; usedFields.add('romaji'); return }
      if (has('pattern_romaji') && !usedFields.has('pattern_romaji')) { mapping[i] = 'pattern_romaji'; usedFields.add('pattern_romaji'); return }
      if (has('example_romaji') && !usedFields.has('example_romaji')) { mapping[i] = 'example_romaji'; usedFields.add('example_romaji'); return }
      if (has('exRomaji') && !usedFields.has('exRomaji')) { mapping[i] = 'exRomaji'; usedFields.add('exRomaji'); return }
    }

    // English word / short phrase → meaning_en / meaningEn
    if (/^[a-zA-Z\s]+$/.test(c) && c.length < 20) {
      if (has('meaning_en') && !usedFields.has('meaning_en')) { mapping[i] = 'meaning_en'; usedFields.add('meaning_en'); return }
      if (has('meaning_english') && !usedFields.has('meaning_english')) { mapping[i] = 'meaning_english'; usedFields.add('meaning_english'); return }
      if (has('meaningEn') && !usedFields.has('meaningEn')) { mapping[i] = 'meaningEn'; usedFields.add('meaningEn'); return }
    }

    // Number → strokes
    if (/^\d+$/.test(c) && has('strokes') && !usedFields.has('strokes')) {
      mapping[i] = 'strokes'
      usedFields.add('strokes')
      return
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
  const [mappedCount, setMappedCount] = useState(0)
  const [detectedNoHeader, setDetectedNoHeader] = useState(false)
  const [forceNoHeader, setForceNoHeader] = useState(false)
  const lastParsedRef = useRef('')

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

  const runParse = useCallback((text: string, overrideNoHeader?: boolean) => {
    const rows = parsePastedText(text)
    if (rows.length === 0) {
      return { rows: null, guessed: {} as FieldMap, startRow: 0, noHeaderDetected: false }
    }

    // Try header-based mapping first
    const headerMapping = guessColumnMapping(rows[0], suggestedFieldMap)
    const headerMatches = Object.keys(headerMapping).length

    let guessed: FieldMap
    let startRow: number
    let noHeaderDetected = false
    const useNoHeader = overrideNoHeader !== undefined ? overrideNoHeader : forceNoHeader

    if (headerMatches === 0 || useNoHeader) {
      // No headers matched — check if row 0 looks like data
      const looksLikeData = useNoHeader || looksLikeDataRow(rows[0])
      if (looksLikeData) {
        noHeaderDetected = true
        // Try to infer from content
        guessed = inferMappingFromContent(rows[0], suggestedFieldMap)
        startRow = 0
      } else {
        // Treat first row as headers anyway (user might have weird headers)
        guessed = headerMapping
        startRow = rows.length > 1 ? 1 : 0
      }
    } else {
      guessed = headerMapping
      startRow = rows.length > 1 ? 1 : 0
    }

    return { rows, guessed, startRow, noHeaderDetected }
  }, [suggestedFieldMap, forceNoHeader])

  const handleParse = useCallback(() => {
    const { rows, guessed, startRow, noHeaderDetected } = runParse(raw)
    if (!rows) {
      setParsed(null)
      setMapping({})
      setMappedCount(0)
      setDetectedNoHeader(false)
      return
    }
    setParsed(rows)
    setMapping(guessed)
    setMappedCount(Object.keys(guessed).length)
    setCurrentRow(startRow)
    setBatching(false)
    setDetectedNoHeader(noHeaderDetected)
    if (autoApply) {
      onChange(buildRowData(rows[startRow], guessed, data))
    }
  }, [raw, runParse, autoApply, data, onChange])

  // Auto-parse when raw changes and looks like Excel data
  useEffect(() => {
    if (!autoApply || !raw.trim()) return
    if (raw === lastParsedRef.current) return
    if (!raw.includes('\t') && !raw.includes('\n')) return

    lastParsedRef.current = raw
    setExpanded(true)

    const { rows, guessed, startRow, noHeaderDetected } = runParse(raw)
    if (!rows) {
      setParsed(null)
      setMapping({})
      setMappedCount(0)
      setDetectedNoHeader(false)
      return
    }
    setParsed(rows)
    setMapping(guessed)
    setMappedCount(Object.keys(guessed).length)
    setCurrentRow(startRow)
    setBatching(false)
    setDetectedNoHeader(noHeaderDetected)
    onChange(buildRowData(rows[startRow], guessed, data))
  }, [raw, autoApply, runParse, data, onChange])

  const handleDownloadCurrent = useCallback(() => {
    if (!autoApply) {
      applyRow(currentRow)
    }
    setTimeout(() => onDownload?.(), 600)
  }, [autoApply, applyRow, currentRow, onDownload])

  const handleBatchDownload = useCallback(() => {
    if (!parsed || parsed.length <= 1 || !onStartBatch) return
    const dataRows = parsed.slice(1)
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
      setMappedCount(Object.keys(next).length)
      return next
    })
  }

  const handleClear = () => {
    setRaw('')
    setParsed(null)
    setMapping({})
    setBatching(false)
    setMappedCount(0)
    setDetectedNoHeader(false)
    setForceNoHeader(false)
    lastParsedRef.current = ''
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
            placeholder={`Example: copy a row from Excel with columns separated by tabs\n\npattern\tpattern_reading\tmeaning_bangla\tstructure_formula\n〜とはいえ\t〜to wa ie\tযদিও ~\t[Plain sentence] + とはいえ`}
            rows={3}
          />
          <div className="excel-actions">
            <button type="button" className="excel-btn" onClick={handleParse}>
              Parse & Map
            </button>
            <button type="button" className="excel-btn secondary" onClick={handleClear}>
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
              {mappedCount === 0 && (
                <>
                  <div className="excel-status" style={{ background: 'rgba(230,57,70,0.1)', borderColor: 'rgba(230,57,70,0.3)', color: 'rgba(230,57,70,0.9)' }}>
                    No columns auto-matched. Your Excel may not have headers, or the headers don't match expected names.
                  </div>
                  {(detectedNoHeader || forceNoHeader) && (
                    <div className="excel-status" style={{ background: 'rgba(244,162,97,0.1)', borderColor: 'rgba(244,162,97,0.3)', color: 'rgba(244,162,97,0.9)' }}>
                      First row detected as data (no headers). Mapping inferred from content. You can adjust the dropdowns below.
                    </div>
                  )}
                  <div className="excel-auto-row" style={{ marginTop: 8 }}>
                    <label className="excel-auto-label">
                      <input
                        type="checkbox"
                        checked={forceNoHeader}
                        onChange={e => {
                          setForceNoHeader(e.target.checked)
                          // Re-parse immediately with new setting
                          if (raw.trim()) {
                            const { rows, guessed, startRow, noHeaderDetected } = runParse(raw, e.target.checked)
                            if (rows) {
                              setParsed(rows)
                              setMapping(guessed)
                              setMappedCount(Object.keys(guessed).length)
                              setCurrentRow(startRow)
                              setDetectedNoHeader(noHeaderDetected)
                              if (autoApply) {
                                onChange(buildRowData(rows[startRow], guessed, data))
                              }
                            }
                          }
                        }}
                      />
                      First row is data (no headers) — force content-based mapping
                    </label>
                  </div>
                </>
              )}
              {mappedCount > 0 && (
                <div className="excel-status" style={{ background: 'rgba(42,157,143,0.1)', borderColor: 'rgba(42,157,143,0.3)', color: 'rgba(42,157,143,0.9)' }}>
                  {mappedCount} column{mappedCount !== 1 ? 's' : ''} auto-mapped — poster updated
                  {detectedNoHeader && ' (data-only mode, inferred from content)'}
                </div>
              )}

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
