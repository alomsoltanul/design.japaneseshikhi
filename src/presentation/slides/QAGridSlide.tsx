import type { QAGridSlide as QAGridSlideType } from '../types'

export function QAGridSlide({ slide }: { slide: QAGridSlideType }) {
  const brand = slide.brand || 'Japanese Shikhi'
  const brandColor = slide.brandColor || '#E63946'
  const keyword = slide.keyword || 'だれ？'

  // If titleHighlight is provided, split the title around it
  const renderTitle = () => {
    if (!slide.title) return null
    if (!slide.titleHighlight) {
      return <span className="ps-title-plain">{slide.title}</span>
    }

    const parts = slide.title.split(slide.titleHighlight)
    return (
      <>
        {parts[0] && <span className="ps-title-plain">{parts[0]}</span>}
        <span className="ps-title-highlight">{slide.titleHighlight}</span>
        {parts.slice(1).join(slide.titleHighlight) && (
          <span className="ps-title-plain">{parts.slice(1).join(slide.titleHighlight)}</span>
        )}
      </>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="ps-slide-header">
        <div className="ps-slide-brand" style={{ color: brandColor }}>
          {brand}
        </div>
        <div className="ps-slide-header-row">
          <div className="ps-slide-keyword-badge" style={{ backgroundColor: brandColor }}>
            {keyword}
          </div>
          {slide.title && (
            <div className="ps-slide-title-banner">
              {renderTitle()}
            </div>
          )}
        </div>
      </div>

      {/* Body Grid */}
      <div className="ps-slide-body">
        <div className="ps-qa-grid-container">
          {slide.columns?.map((col, cIdx) => (
            <div key={col.id || cIdx} className="ps-qa-column">
              {col.cards?.map((card, cardIdx) => (
                <div key={card.id || cardIdx} className="ps-qa-card">
                  {card.items?.map((item, itemIdx) => (
                    <div key={item.id || itemIdx} className="ps-qa-item">
                      <div className="ps-qa-left">
                        <div className="ps-qa-jp">{item.japanese}</div>
                        {item.romaji && <div className="ps-qa-romaji">{item.romaji}</div>}
                      </div>

                      <div className="ps-qa-arrow">→</div>

                      <div className="ps-qa-right">
                        <div className="ps-qa-bn">{item.translation}</div>
                        {item.reply && (
                          <div className="ps-qa-reply">
                            <span className="ps-qa-reply-subarrow">↳</span>
                            <span>{item.reply}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
