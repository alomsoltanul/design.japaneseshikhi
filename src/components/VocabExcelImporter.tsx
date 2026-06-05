import { useState, useEffect, useRef } from 'react'
import type { VocabData, VocabWord } from '@/templates/vocab'

const VOCAB_HELP = {
  headers: 'jp\tromaji\tbengali\ttag',
  rows: '食べる\tTaberu\tখাওয়া\tVerb\n飲む\tNomu\tপান করা\tVerb\n学校\tGakkō\tস্কুল\tNoun\n先生\tSensei\tশিক্ষক\tNoun\n大きい\tŌkii\tবড়\tAdj\n速い\tHayai\tদ্রুত\tAdj',
  note: 'Copy rows from Excel with these exact column headers. Up to 6 words will fill the poster grid. The poster auto-updates when you paste.',
}

interface VocabExcelImporterProps {
  data: VocabData
  onChange: (data: VocabData) => void
  onDownload?: () => void
}

function parsePastedText(raw: string): string[][] {
  if (!raw.trim()) return []
  return raw
    .split(/\r?\n/)
    .map(row => row.split('\t').map(cell => cell.trim()))
    .filter(row => row.length > 1 || (row.length === 1 && row[0] !== ''))
}

export function VocabExcelImporter({ data, onChange, onDownload }: VocabExcelImporterProps) {
  const [raw, setRaw] = useState('')
  const [preview, setPreview] = useState<VocabWord[] | null>(null)
  const [autoApply, setAutoApply] = useState(true)
  const [showHelp, setShowHelp] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const lastParsedRef = useRef('')

  const parseAndBuild = (text: string): VocabWord[] | null => {
    if (!text.trim()) return null
    const rows = parsePastedText(text)
    if (rows.length === 0) return null

    const headers = rows[0].map(h => h.toLowerCase().trim().replace(/\s+/g, '_'))
    const colMap = {
      jp: headers.findIndex(h => h === 'jp' || h === 'word_jp' || h === 'japanese'),
      romaji: headers.findIndex(h => h === 'romaji' || h === 'reading'),
      bn: headers.findIndex(h => h === 'bn' || h === 'bengali' || h === 'meaning_bn' || h === 'meaning'),
      tag: headers.findIndex(h => h === 'tag' || h === 'type' || h === 'pos'),
    }

    const dataRows = rows.length > 1 ? rows.slice(1) : rows
    const words: VocabWord[] = []

    dataRows.forEach(row => {
      const w: VocabWord = {}
      if (colMap.jp >= 0 && row[colMap.jp]) w.jp = row[colMap.jp]
      if (colMap.romaji >= 0 && row[colMap.romaji]) w.romaji = row[colMap.romaji]
      if (colMap.bn >= 0 && row[colMap.bn]) w.bn = row[colMap.bn]
      if (colMap.tag >= 0 && row[colMap.tag]) {
        const t = row[colMap.tag].toLowerCase()
        w.tag = t.includes('verb') ? 'Verb' : t.includes('noun') ? 'Noun' : t.includes('adj') ? 'Adj' : t.includes('adv') ? 'Adv' : 'Other'
      } else {
        w.tag = 'Other'
      }
      if (w.jp) words.push(w)
    })

    return words.slice(0, 6)
  }

  const handleParse = () => {
    const words = parseAndBuild(raw)
    if (!words) {
      setPreview(null)
      setWordCount(0)
      return
    }
    setPreview(words)
    setWordCount(words.length)
    if (autoApply && words.length > 0) {
      onChange({ ...data, words })
    }
  }

  // Auto-parse when raw changes and looks like Excel data
  useEffect(() => {
    if (!autoApply || !raw.trim()) return
    if (raw === lastParsedRef.current) return
    if (!raw.includes('\t') && !raw.includes('\n')) return

    lastParsedRef.current = raw
    setExpanded(true)

    const words = parseAndBuild(raw)
    if (!words) {
      setPreview(null)
      setWordCount(0)
      return
    }
    setPreview(words)
    setWordCount(words.length)
    if (autoApply && words.length > 0) {
      onChange({ ...data, words })
    }
  }, [raw, autoApply, data, onChange])

  const applyWords = () => {
    if (!preview || preview.length === 0) return
    onChange({ ...data, words: preview })
  }

  const handleClear = () => {
    setRaw('')
    setPreview(null)
    setWordCount(0)
    lastParsedRef.current = ''
  }

  return (
    <div className="excel-import-section">
      <button type="button" className="excel-toggle" onClick={() => setExpanded(!expanded)}>
        <span>{expanded ? '▼' : '▶'}</span>
        <span>Vocab Excel Import</span>
        {!expanded && <span className="excel-hint">Paste words to fill 6 slots</span>}
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

          <label className="excel-label">Paste vocabulary rows (jp, romaji, bn, tag)</label>
          <textarea
            className="excel-textarea"
            value={raw}
            onChange={e => setRaw(e.target.value)}
            placeholder={`jp\tromaji\tbengali\ttag\n食べる\tTaberu\tখাওয়া\tVerb\n飲む\tNomu\tপান করা\tVerb`}
            rows={4}
          />
          <div className="excel-actions">
            <button type="button" className="excel-btn" onClick={handleParse}>Parse</button>
            <button type="button" className="excel-btn secondary" onClick={handleClear}>Clear</button>
          </div>

          <div className="excel-help-toggle">
            <button type="button" className="excel-help-btn" onClick={() => setShowHelp(!showHelp)}>
              {showHelp ? 'Hide' : 'Show'} paste format for Vocabulary
            </button>
          </div>

          {showHelp && (
            <div className="excel-help-box">
              <p className="excel-help-note">{VOCAB_HELP.note}</p>
              <div className="excel-help-label">Column headers (first row in Excel):</div>
              <pre className="excel-help-code">{VOCAB_HELP.headers}</pre>
              <div className="excel-help-label">Example data rows (up to 6):</div>
              <pre className="excel-help-code">{VOCAB_HELP.rows}</pre>
              <div className="excel-help-tip">
                <strong>Tip:</strong> Select the header row + data rows in Excel, copy (Ctrl+C), click in the box above, and paste (Ctrl+V). The poster preview updates instantly.
              </div>
            </div>
          )}

          {autoApply && raw.trim() && !preview && (
            <div className="excel-status">Paste above or click Parse to auto-update the poster</div>
          )}

          {preview && preview.length > 0 && (
            <>
              <div className="excel-status" style={{ background: 'rgba(42,157,143,0.1)', borderColor: 'rgba(42,157,143,0.3)', color: 'rgba(42,157,143,0.9)' }}>
                {wordCount} word{wordCount !== 1 ? 's' : ''} parsed — poster updated
              </div>
              <div className="excel-section-title">Preview ({preview.length} words)</div>
              <div className="excel-preview-grid">
                {preview.map((w, i) => (
                  <div key={i} className="excel-preview-cell mapped">
                    <span className="excel-preview-header">Word {i + 1}</span>
                    <span className="excel-preview-value">{w.jp}</span>
                    <span className="excel-preview-mapped">{w.romaji} · {w.bn} · {w.tag}</span>
                  </div>
                ))}
              </div>
              <div className="excel-apply-actions">
                {!autoApply && (
                  <button type="button" className="excel-btn primary" onClick={applyWords}>
                    Apply {preview.length} Words to Poster
                  </button>
                )}
                {onDownload && (
                  <button type="button" className="excel-btn download" onClick={onDownload}>
                    Download Image
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
