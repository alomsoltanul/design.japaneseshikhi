import type { VocabSlide as VocabSlideType } from '../types'

export function VocabSlide({ slide }: { slide: VocabSlideType }) {
  const brand = slide.brand || 'Japanese Shikhi'
  const brandColor = slide.brandColor || '#E63946'
  const keyword = slide.keyword || '語彙'

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="ps-slide-header">
        <div className="ps-slide-brand" style={{ color: brandColor }}>
          {brand}
        </div>
        <div className="ps-slide-header-row">
          <div className="ps-slide-keyword-badge" style={{ backgroundColor: brandColor }}>
            {keyword}
          </div>
          {slide.title && <div className="ps-slide-title-text">{slide.title}</div>}
        </div>
      </div>

      <div className="ps-slide-body">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 24,
            width: '100%',
          }}
        >
          {slide.items?.map((item, idx) => (
            <div
              key={item.id || idx}
              style={{
                background: '#14172b',
                border: '1.5px solid rgba(100, 115, 165, 0.24)',
                borderRadius: 16,
                padding: '18px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ fontSize: 30, fontWeight: 800, color: '#ffffff' }}>
                    {item.word}
                  </span>
                  {item.furigana && (
                    <span style={{ fontSize: 18, color: '#ff4757', fontWeight: 600 }}>
                      [{item.furigana}]
                    </span>
                  )}
                  {item.romaji && (
                    <span style={{ fontSize: 16, fontStyle: 'italic', color: '#9ea5c7' }}>
                      {item.romaji}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#ff4757' }}>
                  {item.meaning}
                </div>
              </div>

              {item.example && (
                <div
                  style={{
                    background: 'rgba(0,0,0,0.25)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    marginTop: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                >
                  <div style={{ fontSize: 19, fontWeight: 600, color: '#e5e7eb' }}>
                    {item.example}
                  </div>
                  {item.exampleMeaning && (
                    <div style={{ fontSize: 15, color: '#a5adc9' }}>
                      ↳ {item.exampleMeaning}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
