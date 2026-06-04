import { useState } from 'react'
import { ExcelPasteImporter } from './ExcelPasteImporter'
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
}

export function VocabExcelImporter({ data, onChange }: VocabExcelImporterProps) {
  const [raw, setRaw] = useState('')
  const [preview, setPreview] = useState<VocabWord[] | null>(null)

  const handleParse = () => {
    if (!raw.trim()) return
    const rows = raw
      .split(/\r?\n/)
      .map(row => row.split('\t').map(cell => cell.trim()))
      .filter(row => row.length > 1 || (row.length === 1 && row[0] !== ''))

    if (rows.length === 0) return

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

    setPreview(words.slice(0, 6))
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
          <button type="button" className="excel-btn secondary" onClick={() => { setRaw(''); setPreview(null) }}>Clear</button>
        </div>
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
              <button type="button" className="excel-btn primary" onClick={applyWords}>
                Apply {preview.length} Words to Poster
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
