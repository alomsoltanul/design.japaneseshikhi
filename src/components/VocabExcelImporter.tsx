import { useState } from 'react'
import type { VocabData, VocabWord } from '@/templates/vocab'

const vocabFieldMap: Record<string, string> = {
  'jp': 'jp',
  'romaji': 'romaji',
  'bengali': 'bn',
  'bn': 'bn',
  'tag': 'tag',
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

  const parseAndBuild = (text: string): VocabWord[] | null => {
    if (!text.trim()) return null
    const rows = parsePastedText(text)
    if (rows.length === 0) return null

    // Determine column mapping from header
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
      return
    }
    setPreview(words)
    if (autoApply && words.length > 0) {
      onChange({ ...data, words })
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    if (!text.trim()) return
    setRaw(text)

    const words = parseAndBuild(text)
    if (!words) {
      setPreview(null)
      return
    }
    setPreview(words)
    if (autoApply && words.length > 0) {
      onChange({ ...data, words })
    }
  }

  const applyWords = () => {
    if (!preview || preview.length === 0) return
    onChange({ ...data, words: preview })
  }

  return (
    <div className="excel-import-section">
      <button type="button" className="excel-toggle" onClick={() => setPreview(null)}>
        <span>▶</span>
        <span>Vocab Excel Import</span>
        <span className="excel-hint">Paste words to fill 6 slots</span>
      </button>
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
          onPaste={handlePaste}
          placeholder={`jp\tromaji\tbengali\ttag\n食べる\tTaberu\tখাওয়া\tVerb\n飲む\tNomu\tপান করা\tVerb`}
          rows={4}
        />
        <div className="excel-actions">
          <button type="button" className="excel-btn" onClick={handleParse}>Parse</button>
          <button type="button" className="excel-btn secondary" onClick={() => { setRaw(''); setPreview(null) }}>Clear</button>
        </div>

        {autoApply && raw.trim() && !preview && (
          <div className="excel-status">Paste above or click Parse to auto-update the poster</div>
        )}

        {preview && preview.length > 0 && (
          <>
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
    </div>
  )
}
