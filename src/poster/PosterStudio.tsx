import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toPng, toJpeg } from 'html-to-image'
import { BASE_ACCENTS, FORMATS } from '@/themes'
import { TEMPLATES, TEMPLATE_MAP } from '@/templates'
import type { Accent, Format, FxState } from '@/types'
import { ImageUpload } from '@/components/ImageUpload'
import './posterStudio.css'

const STORAGE_KEY = 'js-poster-studio-v2'
const VIEW_TAB_KEY = 'ps-tab-v1'

type Tab = 'paste' | 'upload' | 'manual'

interface StoredState {
  tpl: string
  accentId: string
  fmtId: string
  datas: Record<string, Record<string, unknown>>
  fx: FxState
  customAccents: Accent[]
}

function loadStored(): Partial<StoredState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveStored(s: StoredState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

function buildDefaults(): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {}
  for (const t of TEMPLATES) {
    out[t.id] = { ...TEMPLATE_MAP[t.id].defaultData }
  }
  return out
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else q = false
      } else cur += ch
    } else {
      if (ch === '"') q = true
      else if (ch === ',') { out.push(cur); cur = '' }
      else cur += ch
    }
  }
  out.push(cur)
  return out
}

function parseSpreadsheet(text: string): string[][] {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim().length)
  if (!lines.length) return []
  return lines.map(l => l.indexOf('\t') >= 0 ? l.split('\t') : splitCsvLine(l))
}

/** Sample rows shown/loaded per template (tab-separated). */
const TEMPLATE_SAMPLES: Record<string, string[][]> = {
  grammar: [
    ['〜とはいえ', 'to wa ie', 'যদিও ~; তবুও ~; একটা সত্য যে ~ কিন্তু তারপরও', 'Even though ~; That said, ~', '[Plain sentence / Noun / な-adj] + とはいえ、[unexpected result]', 'とはいえ、', '春とはいえ、寒い。', 'বসন্ত হলেও, শীত।', '好きとはいえ、食べない。', 'পছন্দ হলেও, খাই না।'],
    ['〜はもとより', 'wa moto yori', '~ তো বটেই; ~ তো বলাই বাহুল্য, তার উপরে ~', 'Not only ~ (as a matter of course); let alone ~', '[Noun A] + はもとより、[Noun B] + も〜', 'はもとより、…も〜', '英語はもとより、中国語もできる。', 'ইংরেজি তো বটেই, চীনা ভাষাও পারে।', '味はもとより、見た目もいい。', 'স্বাদ তো বটেই, দেখতেও ভালো।'],
    ['〜に即して', 'ni sokushite', '~ অনুযায়ী; ~ মেনে; বাস্তবতার ভিত্তিতে', 'In accordance with ~; based strictly on ~', '[Noun (facts / reality)] + に即して / に即した + [action]', 'に即して / に即した', '事実に即して、話す。', 'সত্যের ভিত্তিতে কথা বলি।', 'ルールに即して、決める。', 'নিয়ম অনুযায়ী সিদ্ধান্ত নিই।'],
  ],
  kanji: [
    ['例', 'レイ', 'たと(える)', 'উদাহরণ', 'Example, instance', '例えば', 'উদাহরণস্বরূপ', ''],
    ['勉', 'ベン', '—', 'অধ্যবসায় / প্রচেষ্টা', 'Exertion, diligence', '勉強', 'পড়াশোনা', ''],
  ],
  vocab: [
    ['勉強', 'べんきょう', 'benkyō', 'পড়াশোনা', 'Study', '毎日日本語を勉強します。', 'প্রতিদিন জাপানি পড়ি।'],
    ['約束', 'やくそく', 'yakusoku', 'প্রতিশ্রুতি', 'Promise', '友達と約束した。', 'বন্ধুর সাথে প্রতিশ্রুতি দিয়েছি।'],
  ],
  word: [
    ['大丈夫', 'だいじょうぶ', 'daijōbu', 'ঠিক আছে / নিরাপদ', 'Okay, all right', '一人でも大丈夫。', 'একা হলেও ঠিক আছে।', ''],
  ],
  tip: [['ছোট ছোট বাক্য পড়ুন', 'প্রতিদিন ৩টি ছোট বাক্য জোরে পড়লে উচ্চারণ ও মুখস্থ দুটোই দ্রুত ভালো হয়।']],
  challenge: [['この漢字の読み方は？「雨」', 'জাপানে অনেক হয় এই জিনিসটি!']],
  'kanji-quiz': [['「犬」の意味は？', 'A. বিড়াল  B. কুকুর  C. পাখি']],
  announce: [['নতুন N3 কোর্স শুরু!', '১৫ জুলাই থেকে লাইভ ক্লাস। এখনই এনরোল করুন।']],
  promo: [['Pro প্ল্যান', '৩০% ছাড়', 'এখনই শুরু করুন']],
  newstxt: [['JLPT রেজিস্ট্রেশন খুলেছে', 'ডিসেম্বর সেশনের জন্য আবেদন শুরু হয়েছে। আসন সীমিত।']],
  newswire: [['বাংলায় জাপানি শিখুন', 'N5 থেকে N1']],
  newsflash: [['桜', 'sakura — চেরি ফুল']],
  newspanel: [['সাপ্তাহিক রিভিউ', 'এই সপ্তাহে শেখা ৪০টি শব্দ']],
  imgbg: [['জাপানে কাজের স্বপ্ন', 'আজই শুরু করুন']],
  imgcard: [['আজকের শব্দ', '桃 — momo — পিচ ফল']],
}

/** Template-aware ordered field keys — matches column order from Content Studio design. */
const TEMPLATE_FIELD_ORDER: Record<string, string[]> = {
  grammar: ['pattern', 'patternRomaji', 'meaningBn', 'meaningEn', 'structureFormula', 'parts', 'ex1jp', 'ex1bn', 'ex2jp', 'ex2bn'],
  kanji: ['kanji', 'on', 'kun', 'meaningEn', 'meaningBn', 'example_jp', 'example_bn', 'strokes'],
  vocab: ['wordJp', 'reading', 'romaji', 'meaningBn', 'meaningEn', 'exampleJp', 'exampleBn'],
  word: ['word_jp', 'romaji', 'meaning_bn', 'example_jp', 'example_bn', 'tip'],
  tip: ['title', 'body'],
  challenge: ['question', 'hint'],
  'kanji-quiz': ['question', 'options'],
  announce: ['headline', 'detail'],
  promo: ['headline', 'offer', 'cta'],
  newstxt: ['headline', 'body'],
  newswire: ['headline', 'kicker'],
  newsflash: ['word', 'caption'],
  newspanel: ['title', 'body'],
  imgbg: ['headline', 'caption'],
  imgcard: ['title', 'body'],
}

/** Header keywords that mark row 1 as a header row. */
const HEADER_KEYWORDS = /pattern|meaning|kanji|word|reading|romaji|example|formula|structure|headline|title|parts|on.yomi|kun.yomi|kicker|caption|body|hint|option|offer|cta|detail/

function parseIntoRows(tplId: string, text: string): Record<string, unknown>[] {
  const cells = parseSpreadsheet(text)
  if (!cells.length) return []
  const fieldOrder = TEMPLATE_FIELD_ORDER[tplId] ?? []
  const firstJoined = cells[0].join(' ').toLowerCase()
  const dataRows = HEADER_KEYWORDS.test(firstJoined) ? cells.slice(1) : cells
  return dataRows
    .map(row => {
      const obj: Record<string, unknown> = { ...TEMPLATE_MAP[tplId].defaultData }
      fieldOrder.forEach((key, i) => {
        const v = (row[i] || '').trim()
        if (v) obj[key] = v
      })
      return obj
    })
    .filter(o => fieldOrder.some(k => String(o[k] ?? '').length))
}

interface Props {
  onExitToHome?: () => void
}

export function PosterStudio(_props: Props) {
  const saved = loadStored()

  const [tpl, setTpl] = useState<string>(saved.tpl || 'grammar')
  const [accents] = useState<Accent[]>([
    ...BASE_ACCENTS,
    ...(saved.customAccents || []),
  ])
  const [accent, setAccent] = useState<Accent>(
    accents.find(a => a.id === saved.accentId) || accents[0]
  )
  const [fmt, setFmt] = useState<Format>(FORMATS.find(f => f.id === saved.fmtId) || FORMATS[1])
  const [fx, setFx] = useState<FxState>(saved.fx || { petals: true, orbs: true })
  const [bgImage, setBgImage] = useState<string | null>(null)

  const [datasByTpl, setDatasByTpl] = useState<Record<string, Record<string, unknown>>>(
    { ...buildDefaults(), ...(saved.datas || {}) }
  )
  const [rowsByTpl, setRowsByTpl] = useState<Record<string, Record<string, unknown>[]>>({})
  const [idxByTpl, setIdxByTpl] = useState<Record<string, number>>({})

  const [tab, setTab] = useState<Tab>(() => (localStorage.getItem(VIEW_TAB_KEY) as Tab) || 'paste')
  const [pasteText, setPasteText] = useState('')
  const [parseStatus, setParseStatus] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')
  const [dragging, setDragging] = useState(false)
  const [toast, setToast] = useState('')
  const [exporting, setExporting] = useState(false)
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit')
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < 900)

  const previewRef = useRef<HTMLDivElement | null>(null)
  const posterRef = useRef<HTMLDivElement | null>(null)
  const hiddenRef = useRef<HTMLDivElement | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const rows = rowsByTpl[tpl] ?? []
  const rowIndex = Math.min(idxByTpl[tpl] ?? 0, Math.max(0, rows.length - 1))
  const singleData = datasByTpl[tpl] ?? {}
  const currentRow = rows.length ? rows[rowIndex] : singleData

  const tDef = TEMPLATE_MAP[tpl]
  const PosterComp = tDef.Poster
  const tplMeta = TEMPLATES.find(t => t.id === tpl)!

  const posterProps = useMemo(
    () => ({ data: currentRow, accent, fx, fmt, bgImage }),
    [currentRow, accent, fx, fmt, bgImage]
  )

  useEffect(() => {
    const custom = accents.filter(a => !BASE_ACCENTS.some(b => b.id === a.id))
    saveStored({
      tpl,
      accentId: accent.id,
      fmtId: fmt.id,
      datas: datasByTpl,
      fx,
      customAccents: custom,
    })
  }, [tpl, accent, fmt, datasByTpl, fx, accents])

  useEffect(() => {
    localStorage.setItem(VIEW_TAB_KEY, tab)
  }, [tab])

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 900)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }, [])

  const [previewScale, setPreviewScale] = useState(0.35)
  useEffect(() => {
    const measure = () => {
      const node = previewRef.current
      if (!node) return
      const availW = node.clientWidth - 40
      const availH = node.clientHeight - 40
      const s = Math.min(availW / fmt.w, availH / fmt.h, 0.85)
      setPreviewScale(Math.max(0.12, s))
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (previewRef.current) ro.observe(previewRef.current)
    return () => ro.disconnect()
  }, [fmt.w, fmt.h])

  const selectTemplate = (id: string) => {
    setTpl(id)
    setParseStatus('')
    setUploadStatus('')
  }

  const loadRows = useCallback((newRows: Record<string, unknown>[], sourceLabel: string) => {
    if (!newRows.length) {
      setParseStatus('No rows found — check the data.')
      return
    }
    setRowsByTpl(prev => ({ ...prev, [tpl]: newRows }))
    setIdxByTpl(prev => ({ ...prev, [tpl]: 0 }))
    setDatasByTpl(prev => ({ ...prev, [tpl]: newRows[0] }))
    setParseStatus(`${newRows.length} poster${newRows.length > 1 ? 's' : ''} loaded`)
    showToast(`${newRows.length} poster${newRows.length > 1 ? 's' : ''} ready · ${sourceLabel}`)
  }, [tpl, showToast])

  const onParse = () => loadRows(parseIntoRows(tpl, pasteText), 'pasted')

  const onPasteEvent = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const t = e.clipboardData.getData('text')
    if (t && (t.indexOf('\t') >= 0 || t.indexOf('\n') >= 0)) {
      setTimeout(() => {
        setPasteText(t)
        loadRows(parseIntoRows(tpl, t), 'pasted')
      }, 0)
    }
  }

  const readFile = (file?: File | null) => {
    if (!file) return
    if (/\.xlsx$/i.test(file.name)) {
      setUploadStatus('XLSX not supported here — paste the rows or use CSV/TSV.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseIntoRows(tpl, String(reader.result || ''))
      loadRows(parsed, file.name)
      setUploadStatus(`${parsed.length} rows from ${file.name}`)
    }
    reader.readAsText(file)
  }

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setDragging(false)
    readFile(e.dataTransfer.files?.[0])
  }

  const updateField = (key: string, val: string) => {
    if (rows.length) {
      setRowsByTpl(prev => {
        const arr = (prev[tpl] || []).slice()
        arr[rowIndex] = { ...arr[rowIndex], [key]: val }
        setDatasByTpl(d => ({ ...d, [tpl]: arr[rowIndex] }))
        return { ...prev, [tpl]: arr }
      })
    } else {
      setDatasByTpl(prev => ({ ...prev, [tpl]: { ...prev[tpl], [key]: val } }))
    }
  }

  const addBlank = () => {
    const blank = { ...TEMPLATE_MAP[tpl].defaultData }
    setRowsByTpl(prev => {
      const arr = (prev[tpl] || []).slice()
      arr.push(blank)
      setIdxByTpl(i => ({ ...i, [tpl]: arr.length - 1 }))
      setDatasByTpl(d => ({ ...d, [tpl]: blank }))
      return { ...prev, [tpl]: arr }
    })
    setTab('manual')
  }

  const go = (delta: number) => {
    const n = rows.length
    if (!n) return
    const next = (rowIndex + delta + n) % n
    setIdxByTpl(prev => ({ ...prev, [tpl]: next }))
    setDatasByTpl(d => ({ ...d, [tpl]: rows[next] }))
  }

  const goTo = (i: number) => {
    if (!rows[i]) return
    setIdxByTpl(prev => ({ ...prev, [tpl]: i }))
    setDatasByTpl(d => ({ ...d, [tpl]: rows[i] }))
  }

  const fileBase = () => {
    const r: Record<string, unknown> = currentRow || {}
    const tag = String(
      r.patternRomaji || r.romaji || r.kanji || r.wordJp || r.word_jp || r.title || r.headline || `row${rowIndex + 1}`
    )
    const safe = tag.replace(/[^\w぀-ヿ一-鿿-]+/g, '').slice(0, 24) || `row${rowIndex + 1}`
    return `js-${tpl}-${safe}`
  }

  const snap = async (type: 'png' | 'jpg') => {
    const node = hiddenRef.current
    if (!node) return null
    if (document.fonts?.ready) { try { await document.fonts.ready } catch {} }
    const base = { width: fmt.w, height: fmt.h, pixelRatio: 2, cacheBust: true }
    return type === 'jpg'
      ? toJpeg(node, { ...base, quality: 0.95, backgroundColor: '#0b0b14' })
      : toPng(node, base)
  }

  const download = (dataUrl: string, name: string) => {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const exportOne = async (type: 'png' | 'jpg') => {
    setExporting(true)
    try {
      const url = await snap(type)
      if (url) {
        download(url, `${fileBase()}.${type}`)
        showToast(`Exported ${type.toUpperCase()}`)
      }
    } catch (e) {
      showToast('Export failed — see console')
      console.error(e)
    } finally {
      setExporting(false)
    }
  }

  const exportAll = async () => {
    if (!rows.length) return
    setExporting(true)
    for (let i = 0; i < rows.length; i++) {
      goTo(i)
      await new Promise(r => setTimeout(r, 420))
      try {
        const url = await snap('png')
        if (url) download(url, `${fileBase()}.png`)
      } catch (e) {
        console.error(e)
      }
      await new Promise(r => setTimeout(r, 160))
    }
    setExporting(false)
    showToast(`Exported ${rows.length} posters`)
  }

  const hasRows = rows.length > 0
  const fieldOrder = TEMPLATE_FIELD_ORDER[tpl] ?? Object.keys(TEMPLATE_MAP[tpl].defaultData)

  const showLeft = !isNarrow || mobileView === 'edit'
  const showRight = !isNarrow || mobileView === 'preview'

  const previewW = Math.round(fmt.w * previewScale)
  const previewH = Math.round(fmt.h * previewScale)

  const expectedCols = (TEMPLATE_FIELD_ORDER[tpl] ?? Object.keys(TEMPLATE_MAP[tpl].defaultData)).join('\t')
  const sampleRowsText = (TEMPLATE_SAMPLES[tpl] || []).map(r => r.join('\t')).join('\n')
  const sampleSheet = sampleRowsText ? `${expectedCols}\n${sampleRowsText}` : ''
  const claudePrompt = `Give me 10 more rows for a Japanese Shikhi "${tplMeta.en}" (${tplMeta.jp}) poster.

Return ONLY a tab-separated table (no code fences, no commentary).

Column order (exactly this, in this order):
${expectedCols}

Example row for shape/tone:
${(TEMPLATE_SAMPLES[tpl]?.[0] || []).join('\t')}

Rules:
- One row per line, columns separated by a single TAB
- Do NOT include the header row in your output
- Bangla in Bangla script, Japanese in kanji/kana, romaji lowercase
- Keep each cell short enough for a poster (no paragraphs)
`

  const loadSample = () => {
    if (!sampleSheet) { showToast('No sample for this template'); return }
    setPasteText(sampleSheet)
    loadRows(parseIntoRows(tpl, sampleSheet), 'sample')
  }
  const copySample = async () => {
    if (!sampleSheet) return
    await navigator.clipboard?.writeText(sampleSheet)
    showToast('Sample sheet copied — paste into Google Sheets')
  }
  const copyClaudePrompt = async () => {
    await navigator.clipboard?.writeText(claudePrompt)
    showToast('Claude prompt copied — paste into Claude chat')
  }

  return (
    <div className="ps-root">
      {isNarrow && (
        <div className="ps-mobile-toggle">
          <button className={mobileView === 'edit' ? 'on' : ''} onClick={() => setMobileView('edit')}>1·2 Edit</button>
          <button className={mobileView === 'preview' ? 'on' : ''} onClick={() => setMobileView('preview')}>3 Preview</button>
        </div>
      )}

      <div className="ps-body">
        {/* LEFT */}
        <section className={`ps-left${!showLeft ? ' hidden-mobile' : ''}`}>
          <div className="ps-left-inner">
            {/* WORKFLOW GUIDE */}
            <details className="ps-workflow" open>
              <summary>
                <span className="ps-workflow-badge">Workflow</span>
                Sheet → Poster in 4 steps
              </summary>
              <ol className="ps-workflow-list">
                <li>
                  <b>Open your Google Sheet or Excel</b> with one row per poster.
                  Column headers optional — first row auto-detected.
                </li>
                <li>
                  <b>Copy the rows</b> (⌘/Ctrl+C). Tabs between columns are preserved.
                </li>
                <li>
                  <b>Pick a template</b> below, then paste (⌘/Ctrl+V) into the Paste box.
                  All rows load instantly.
                </li>
                <li>
                  <b>Preview each row</b> with ‹ › on the right, then hit
                  <b> ⬇ PNG</b> for one or <b>Export all →</b> for the whole batch.
                </li>
              </ol>
              <div className="ps-workflow-cols">
                <div className="ps-workflow-cols-label">
                  Expected column order for <b>{tplMeta.jp} · {tplMeta.en}</b>
                </div>
                <code className="ps-workflow-cols-code">{expectedCols}</code>
                <button
                  className="ps-btn-ghost"
                  style={{ marginTop: 8, padding: '6px 12px', fontSize: 12 }}
                  onClick={() => {
                    navigator.clipboard?.writeText(expectedCols)
                    showToast('Column headers copied')
                  }}
                >
                  Copy headers row
                </button>
              </div>
            </details>

            {/* STEP 1 */}
            <div className="ps-section-head">
              <span className="ps-num">1</span>
              <h2 className="ps-section-title">Pick a template</h2>
              <span className="ps-section-note">{tplMeta.jp} · {tplMeta.en}</span>
            </div>
            <div className="ps-tpl-strip">
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  className={`ps-tpl-chip${tpl === t.id ? ' on' : ''}`}
                  onClick={() => selectTemplate(t.id)}
                  title={t.en}
                  type="button"
                >
                  <span className="ps-tpl-jp">{t.jp}</span>
                  <span className="ps-tpl-en">{t.en}</span>
                </button>
              ))}
            </div>

            {/* Format */}
            <div className="ps-fmt-row">
              {FORMATS.map(f => (
                <button
                  key={f.id}
                  className={`ps-fmt-btn${fmt.id === f.id ? ' on' : ''}`}
                  onClick={() => setFmt(f)}
                  type="button"
                >
                  <span>{f.icon} {f.label}</span>
                  <small>{f.dims} · {f.sub}</small>
                </button>
              ))}
            </div>

            {/* Accent + Effects */}
            <div className="ps-accent-row">
              {accents.map(a => (
                <div
                  key={a.id}
                  className={`ps-accent-swatch${accent.id === a.id ? ' on' : ''}`}
                  style={{
                    background: a.id === 'light'
                      ? 'linear-gradient(135deg,#F9FAFB,#E5E7EB)'
                      : `linear-gradient(135deg,${a.p},${a.s})`,
                  }}
                  onClick={() => setAccent(a)}
                  title={a.id}
                />
              ))}
            </div>
            <div className="ps-fx-row">
              <button className={`ps-fx-btn${fx.petals ? ' on' : ''}`} onClick={() => setFx(v => ({ ...v, petals: !v.petals }))}>Sakura</button>
              <button className={`ps-fx-btn${fx.orbs ? ' on' : ''}`} onClick={() => setFx(v => ({ ...v, orbs: !v.orbs }))}>Orbs</button>
              <ImageUpload bgImage={bgImage} onChange={setBgImage} />
            </div>

            {/* STEP 2 */}
            <div className="ps-section-head">
              <span className="ps-num">2</span>
              <h2 className="ps-section-title">Add your data</h2>
            </div>

            <div className="ps-tabs">
              {(['paste', 'upload', 'manual'] as const).map(t => (
                <button key={t} className={`ps-tab${tab === t ? ' on' : ''}`} onClick={() => setTab(t)} type="button">
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {tab === 'paste' && (
              <div>
                <p className="ps-help-text">
                  Copy rows from Google&nbsp;Sheets or Excel and paste below — columns are detected automatically.{' '}
                  <span className="ps-muted">No formatting is lost.</span>
                </p>
                <textarea
                  className="ps-textarea"
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  onPaste={onPasteEvent}
                  placeholder={'pattern\tromaji\tmeaning\t…\n〜とはいえ\tto wa ie\tযদিও ~ … (paste from Sheets/Excel)'}
                  spellCheck={false}
                />
                <div className="ps-actions-row">
                  <button className="ps-btn-primary" onClick={onParse}>Parse &amp; load rows</button>
                  <button className="ps-btn-ghost" onClick={loadSample} disabled={!sampleSheet}>Load sample</button>
                  <span className="ps-status">{parseStatus}</span>
                </div>

                {sampleSheet && (
                  <div className="ps-sample">
                    <div className="ps-sample-head">
                      <span className="ps-sample-badge">Sample sheet</span>
                      <span className="ps-sample-title">
                        {tplMeta.jp} · {tplMeta.en} — copy this into Google Sheets, then edit
                      </span>
                    </div>
                    <pre className="ps-sample-code">{sampleSheet}</pre>
                    <div className="ps-sample-actions">
                      <button className="ps-btn-ghost" onClick={copySample}>Copy sample sheet</button>
                      <button className="ps-btn-ghost" onClick={copyClaudePrompt}>Copy Claude prompt (make 10 more)</button>
                    </div>
                    <p className="ps-sample-hint">
                      Flow: <b>Copy Claude prompt</b> → paste in Claude chat → Claude returns rows →
                      paste rows into your Google Sheet → your employee copies whole sheet back into
                      the Paste box above → hit <b>Parse &amp; load rows</b>.
                    </p>
                  </div>
                )}
              </div>
            )}

            {tab === 'upload' && (
              <div>
                <label
                  className={`ps-drop${dragging ? ' dragging' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={e => { e.preventDefault(); setDragging(false) }}
                  onDrop={onDrop}
                >
                  <input type="file" accept=".csv,.tsv,.txt" onChange={e => readFile(e.target.files?.[0])} style={{ display: 'none' }} />
                  <div style={{ fontSize: 30 }}>📄</div>
                  <div className="ps-drop-title">Drop a CSV / TSV file, or click to browse</div>
                  <div className="ps-drop-sub">First row treated as headers · one poster per row</div>
                  <span className="ps-status">{uploadStatus}</span>
                </label>
              </div>
            )}

            {tab === 'manual' && (
              <div className="ps-manual">
                {fieldOrder.map(key => {
                  const val = String((currentRow as Record<string, unknown>)[key] ?? '')
                  const rows = /body|meaning|formula|detail|caption|option/i.test(key) ? 2 : 1
                  return (
                    <label key={key} className="ps-field-label">
                      <span>{key}</span>
                      <textarea
                        className="ps-field-input"
                        rows={rows}
                        value={val}
                        onChange={e => updateField(key, e.target.value)}
                      />
                    </label>
                  )
                })}
                <button className="ps-btn-ghost" onClick={addBlank} style={{ alignSelf: 'flex-start', borderStyle: 'dashed', color: 'var(--js-primary)', borderColor: 'var(--js-primary)' }}>
                  + New blank poster
                </button>
              </div>
            )}

            {hasRows && tab !== 'manual' && (
              <div className="ps-table-wrap">
                <div className="ps-table-head">Loaded data · {rows.length} rows</div>
                <div className="ps-table-scroll">
                  <table className="ps-table">
                    <thead>
                      <tr>
                        {fieldOrder.slice(0, 6).map(h => <th key={h}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className={i === rowIndex ? 'on' : ''} onClick={() => goTo(i)}>
                          {fieldOrder.slice(0, 6).map(h => (
                            <td key={h}>{String((r as Record<string, unknown>)[h] ?? '—')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT */}
        <section className={`ps-right${!showRight ? ' hidden-mobile' : ''}`}>
          <div className="ps-right-head">
            <span className="ps-right-num">3</span>
            <h2 className="ps-right-title">Preview &amp; export</h2>
            <div style={{ flex: 1 }} />
            {rows.length > 1 && (
              <div className="ps-nav">
                <button className="ps-nav-btn" onClick={() => go(-1)}>‹</button>
                <span className="ps-nav-label">{rowIndex + 1} / {rows.length}</span>
                <button className="ps-nav-btn" onClick={() => go(1)}>›</button>
              </div>
            )}
          </div>

          <div className="ps-preview-area" ref={previewRef}>
            <div
              className="ps-frame"
              ref={posterRef}
              style={{ width: previewW, height: previewH }}
            >
              <div
                className="ps-scale"
                style={{
                  width: fmt.w,
                  height: fmt.h,
                  transform: `scale(${previewScale})`,
                }}
              >
                <PosterComp {...posterProps} />
              </div>
            </div>
          </div>

          <div className="ps-export-bar">
            <button className="ps-export-btn" onClick={() => exportOne('png')} disabled={exporting}>⬇ PNG</button>
            <button className="ps-export-btn jpg" onClick={() => exportOne('jpg')} disabled={exporting}>⬇ JPG</button>
            <div style={{ flex: 1 }} />
            <button className="ps-export-all" onClick={exportAll} disabled={exporting || rows.length < 2}>
              {exporting ? 'Exporting…' : rows.length > 1 ? `Export all ${rows.length} →` : 'Export all →'}
            </button>
          </div>
        </section>
      </div>

      {/* hidden render for export at full resolution */}
      <div
        style={{
          position: 'fixed',
          left: -(fmt.w + 100),
          top: -(fmt.h + 100),
          width: fmt.w,
          height: fmt.h,
          pointerEvents: 'none',
          zIndex: -999,
          overflow: 'hidden',
        }}
      >
        <div ref={hiddenRef} style={{ width: fmt.w, height: fmt.h }}>
          <PosterComp {...posterProps} />
        </div>
      </div>

      {toast && <div className="ps-toast">{toast}</div>}
    </div>
  )
}
