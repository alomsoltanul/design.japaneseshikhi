import type { GrammarPointSlide as GrammarPointSlideType } from '../types'

export function GrammarSlide({ slide }: { slide: GrammarPointSlideType }) {
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
  let jpFontSize = 27
  let ansFontSize = 23
  let romajiFontSize = 17
  let cardPadding = '16px 22px'

  if (exampleCount === 2) {
    gridCols = '1fr 1fr'
  } else if (exampleCount === 3 || exampleCount === 4) {
    gridCols = '1fr 1fr'
    jpFontSize = 25
    ansFontSize = 21
    cardPadding = '14px 20px'
  } else if (exampleCount >= 5 && exampleCount <= 6) {
    gridCols = '1fr 1fr 1fr'
    jpFontSize = 22
    ansFontSize = 19
    romajiFontSize = 15
    cardPadding = '12px 16px'
  } else if (exampleCount > 6) {
    gridCols = 'repeat(auto-fit, minmax(380px, 1fr))'
    jpFontSize = 20
    ansFontSize = 17
    romajiFontSize = 14
    cardPadding = '10px 14px'
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
                fontSize: 18,
                fontWeight: 800,
                color: '#ffffff',
                background: 'rgba(230, 57, 70, 0.2)',
                border: `1.5px solid ${brandColor}`,
                padding: '4px 16px',
                borderRadius: 999,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {slide.level}
            </div>
          )}
        </div>

        <div className="ps-slide-header-row" style={{ gap: 24, marginTop: 4 }}>
          {/* Grammar Topic Badge */}
          <div
            className="ps-slide-keyword-badge"
            style={{
              backgroundColor: brandColor,
              fontSize: 42,
              padding: '6px 36px',
              borderRadius: 16,
            }}
          >
            {topic}
          </div>

          {/* Grammar Topic & Meaning Banner */}
          <div className="ps-slide-title-banner" style={{ padding: '10px 24px' }}>
            <span className="ps-title-highlight" style={{ fontSize: 28, color: '#ff4757' }}>
              {slide.titleHighlight || topic}
            </span>
            {meaning && (
              <span className="ps-title-plain" style={{ fontSize: 28, fontWeight: 700, marginLeft: 8 }}>
                {meaning.startsWith('(') || meaning.startsWith('—') ? meaning : `(${meaning})`}
              </span>
            )}
            {!meaning && slide.title && (
              <span className="ps-title-plain" style={{ fontSize: 28, fontWeight: 700, marginLeft: 8 }}>
                {slide.title}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Body ── */}
      <div
        className="ps-slide-body"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          paddingTop: 20,
          paddingBottom: 32,
          overflowY: 'auto',
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
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <span className="ps-grammar-rei-label" style={{ background: 'rgba(244, 162, 97, 0.2)', color: '#f4a261' }}>
                        {ex.label || `れい ${exIdx + 1} :`}
                      </span>
                      <span className="ps-grammar-jp-sentence" style={{ fontSize: 24 }}>
                        {ex.japanese}
                      </span>
                      {ex.romaji && (
                        <span className="ps-grammar-romaji" style={{ fontSize: 16 }}>
                          ({ex.romaji})
                        </span>
                      )}
                    </div>

                    {getAnsText(ex) && (
                      <div className="ps-grammar-ans-row" style={{ marginTop: 4 }}>
                        <span className="ps-grammar-ans-badge" style={{ color: '#f4a261' }}>Ans:</span>
                        <span className="ps-grammar-ans-arrow">→</span>
                        <span className="ps-grammar-ans-text">
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
    </div>
  )
}
