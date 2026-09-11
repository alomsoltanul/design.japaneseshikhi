import type { GrammarPointSlide as GrammarPointSlideType } from '../types'

interface GrammarSlideProps {
  slide: GrammarPointSlideType
  isThumbnail?: boolean
  isFullscreen?: boolean
  showFacecamGuide?: boolean
}

export function GrammarSlide({
  slide,
  showFacecamGuide = true,
}: GrammarSlideProps) {
  const brand = slide.brand || 'Japanese Shikhi'
  const brandColor = slide.brandColor || '#E63946'
  const topic = slide.grammarTopic || slide.keyword || '〜ので'
  const meaning = slide.meaning || slide.banglaMeaning || ''
  const examples = slide.examples || []
  const formation = slide.formation
  const exception = slide.exception

  // Auto-adapt grid column style and font sizing based on example count
  const exampleCount = examples.length
  let gridCols = '1fr'
  let jpFontSize = 34
  let ansFontSize = 28
  let romajiFontSize = 21
  let cardPadding = '18px 26px'

  if (exampleCount <= 2) {
    // Rei 1 and Rei 2 stacked vertically on the left column
    gridCols = '1fr'
    jpFontSize = 32
    ansFontSize = 26
    romajiFontSize = 20
    cardPadding = '16px 24px'
  } else if (exampleCount === 3) {
    gridCols = '1fr'
    jpFontSize = 28
    ansFontSize = 24
    romajiFontSize = 18
    cardPadding = '14px 20px'
  } else if (exampleCount === 4) {
    gridCols = '1fr 1fr'
    jpFontSize = 26
    ansFontSize = 22
    romajiFontSize = 17
    cardPadding = '12px 18px'
  } else if (exampleCount >= 5) {
    gridCols = '1fr 1fr'
    jpFontSize = 24
    ansFontSize = 20
    romajiFontSize = 16
    cardPadding = '12px 16px'
  }

  const getAnsText = (ex: any) => {
    const raw = ex.ans || ex.meaningBn || ex.meaning || ex.translation || ''
    return raw.replace(/^Ans:\s*/i, '')
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ── */}
      <div className="ps-slide-header" style={{ paddingBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="ps-slide-brand" style={{ color: brandColor }}>
            {brand}
          </div>
          {slide.level && (
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: '#ffffff',
                background: 'rgba(230, 57, 70, 0.2)',
                border: `2px solid ${brandColor}`,
                padding: '6px 20px',
                borderRadius: 999,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {slide.level}
            </div>
          )}
        </div>

        <div className="ps-slide-header-row" style={{ gap: 28, marginTop: 4 }}>
          {/* Grammar Topic Badge */}
          <div
            className="ps-slide-keyword-badge"
            style={{
              backgroundColor: brandColor,
              fontSize: 50,
              padding: '8px 46px',
              borderRadius: 18,
            }}
          >
            {topic}
          </div>

          {/* Grammar Topic & Meaning Banner */}
          <div className="ps-slide-title-banner" style={{ padding: '12px 28px' }}>
            <span className="ps-title-highlight" style={{ fontSize: 34, color: '#ff4757' }}>
              {slide.titleHighlight || topic}
            </span>
            {meaning && (
              <span className="ps-title-plain" style={{ fontSize: 34, fontWeight: 700, marginLeft: 10, color: '#ffffff' }}>
                {meaning.startsWith('(') || meaning.startsWith('—') ? meaning : `(${meaning})`}
              </span>
            )}
            {!meaning && slide.title && (
              <span className="ps-title-plain" style={{ fontSize: 34, fontWeight: 700, marginLeft: 10, color: '#ffffff' }}>
                {slide.title}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Body with Left 79% Content Column and Right 21% Free for Facecam ── */}
      <div
        className="ps-slide-body"
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 28,
          paddingTop: 20,
          paddingBottom: 32,
          overflowY: 'auto',
        }}
      >
        {/* Left Column (79%): Formation Box + Examples (Rei 1 & Rei 2) + Exception Box */}
        <div
          style={{
            flex: '0 0 79%',
            maxWidth: '79%',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* 1. Formation Box ("topic Grammar how it made") */}
          {formation && (
            <div className="ps-grammar-formation-card">
              <div className="ps-grammar-formation-header">
                <span className="ps-grammar-tag">
                  {formation.title || "[ topic Grammar: How it's made / গঠন প্রণালী ]"}
                </span>
                {(formation.note || (formation as any).notes) && (
                  <span className="ps-grammar-formation-note">
                    {formation.note || (formation as any).notes}
                  </span>
                )}
              </div>

              {/* Render structured rules if array is provided */}
              {formation.rules && formation.rules.length > 0 ? (
                <div className="ps-grammar-rules-row">
                  {formation.rules.map((rule: any, idx: number) => {
                    if (typeof rule === 'string') {
                      return (
                        <div key={idx} className="ps-grammar-rule-pill">
                          <span className="ps-rule-part">{rule}</span>
                        </div>
                      )
                    }
                    return (
                      <div key={idx} className="ps-grammar-rule-pill">
                        <span className="ps-rule-part">{rule.part}</span>
                        {rule.connector && <span className="ps-rule-connector">{rule.connector}</span>}
                      </div>
                    )
                  })}
                </div>
              ) : formation.formula ? (
                <div className="ps-grammar-formula-text">
                  {formation.formula.split('|').map((part, pIdx) => (
                    <span key={pIdx} className="ps-grammar-rule-pill">
                      {part.trim()}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {/* 2. Examples Section ("れい 1 :", "Rei 2 :", ...) */}
          {examples.length > 0 && (
            <div
              className="ps-grammar-examples-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: gridCols,
                gap: 16,
              }}
            >
              {examples.map((ex, idx) => {
                const ansText = getAnsText(ex)
                return (
                  <div
                    key={ex.id || idx}
                    className="ps-grammar-example-card"
                    style={{ padding: cardPadding }}
                  >
                    <div className="ps-grammar-example-header">
                      <span className="ps-grammar-rei-label">
                        {ex.label || (idx % 2 === 0 ? `れい ${idx + 1} :` : `Rei ${idx + 1} :`)}
                      </span>
                    </div>

                    <div className="ps-grammar-example-content">
                      <div className="ps-grammar-jp-sentence" style={{ fontSize: jpFontSize }}>
                        {ex.japanese}
                      </div>
                      {ex.romaji && (
                        <div className="ps-grammar-romaji" style={{ fontSize: romajiFontSize }}>
                          {ex.romaji}
                        </div>
                      )}

                      {ansText && (
                        <div className="ps-grammar-ans-row">
                          <span className="ps-grammar-ans-badge" style={{ fontSize: ansFontSize }}>
                            Ans:
                          </span>
                          <span className="ps-grammar-ans-arrow">→</span>
                          <span className="ps-grammar-ans-text" style={{ fontSize: ansFontSize }}>
                            {ansText}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 3. Exception Box ("if any exception: rule.") */}
          {exception && (exception.rule || exception.description || (exception.examples && exception.examples.length > 0)) && (
            <div className="ps-grammar-exception-card">
              <div className="ps-grammar-exception-header">
                <span className="ps-grammar-exception-title">
                  ⚠️ {exception.rule || 'If any exception: rule.'}
                </span>
                {exception.description && (
                  <span className="ps-grammar-exception-desc">
                    {exception.description}
                  </span>
                )}
              </div>

              {exception.examples && exception.examples.length > 0 && (
                <div className="ps-grammar-exception-examples">
                  {exception.examples.map((ex, exIdx) => (
                    <div key={ex.id || exIdx} className="ps-grammar-exception-item">
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                        <span className="ps-grammar-rei-label" style={{ background: 'rgba(244, 162, 97, 0.2)', color: '#f4a261', fontSize: 20 }}>
                          {ex.label || `れい ${exIdx + 1} :`}
                        </span>
                        <span className="ps-grammar-jp-sentence" style={{ fontSize: 28, color: '#ffffff' }}>
                          {ex.japanese}
                        </span>
                        {ex.romaji && (
                          <span className="ps-grammar-romaji" style={{ fontSize: 20, color: '#e2e8f0' }}>
                            ({ex.romaji})
                          </span>
                        )}
                      </div>

                      {getAnsText(ex) && (
                        <div className="ps-grammar-ans-row" style={{ marginTop: 6 }}>
                          <span className="ps-grammar-ans-badge" style={{ color: '#f4a261', fontSize: 26 }}>Ans:</span>
                          <span className="ps-grammar-ans-arrow" style={{ fontSize: 24 }}>→</span>
                          <span className="ps-grammar-ans-text" style={{ fontSize: 26, color: '#ffffff' }}>
                            {getAnsText(ex)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right 21% Reserved Free Zone for Facecam */}
        <div
          className="ps-facecam-reserved-zone"
          style={{
            flex: '0 0 calc(21% - 28px)',
            maxWidth: 'calc(21% - 28px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingBottom: 8,
          }}
        >
          {showFacecamGuide && (
            <div className="ps-facecam-guide-box">
              <span style={{ fontSize: 26 }}>📹</span>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' }}>
                Facecam Zone
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.4)' }}>
                (20% Free Space)
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
