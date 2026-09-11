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
                background: '#000000',
                border: '2px solid rgba(255, 255, 255, 0.22)',
                borderRadius: 16,
                padding: '20px 26px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                  <span style={{ fontSize: 34, fontWeight: 800, color: '#ffffff' }}>
                    {item.word}
                  </span>
                  {item.furigana && (
                    <span style={{ fontSize: 20, color: '#ff4757', fontWeight: 700 }}>
                      [{item.furigana}]
                    </span>
                  )}
                  {item.romaji && (
                    <span style={{ fontSize: 18, fontStyle: 'italic', color: '#e2e8f0' }}>
                      {item.romaji}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#ff4757' }}>
                  {item.meaning}
                </div>
              </div>

              {item.example && (
                <div
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    padding: '12px 16px',
                    marginTop: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#ffffff' }}>
                    {item.example}
                  </div>
                  {item.exampleMeaning && (
                    <div style={{ fontSize: 18, color: '#e2e8f0' }}>
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
