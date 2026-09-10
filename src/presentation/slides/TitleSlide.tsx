import type { TitleSlide as TitleSlideType } from '../types'

export function TitleSlide({ slide }: { slide: TitleSlideType }) {
  const brand = slide.brand || 'Japanese Shikhi'
  const brandColor = slide.brandColor || '#E63946'

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="ps-slide-header">
        <div className="ps-slide-brand" style={{ color: brandColor }}>
          {brand}
        </div>
      </div>

      <div
        className="ps-slide-body"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 32,
        }}
      >
        {slide.level && (
          <div
            style={{
              background: 'rgba(230, 57, 70, 0.15)',
              border: `2px solid ${brandColor}`,
              color: '#ffffff',
              fontSize: 24,
              fontWeight: 800,
              padding: '6px 24px',
              borderRadius: 999,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {slide.level}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {slide.keyword && (
            <div
              className="ps-slide-keyword-badge"
              style={{
                backgroundColor: brandColor,
                fontSize: 64,
                padding: '12px 60px',
                borderRadius: 24,
              }}
            >
              {slide.keyword}
            </div>
          )}
          <h1 style={{ fontSize: 56, fontWeight: 800, color: '#ffffff', letterSpacing: '0.02em' }}>
            {slide.title}
          </h1>
        </div>

        {(slide.topicEn || slide.topicBn) && (
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            {slide.topicEn && (
              <span style={{ fontSize: 32, color: '#cbd2e8', fontWeight: 600 }}>{slide.topicEn}</span>
            )}
            {slide.topicEn && slide.topicBn && (
              <span style={{ color: brandColor, fontSize: 28, fontWeight: 700 }}>•</span>
            )}
            {slide.topicBn && (
              <span style={{ fontSize: 32, color: '#ff4757', fontWeight: 700 }}>{slide.topicBn}</span>
            )}
          </div>
        )}

        {slide.bulletPoints && slide.bulletPoints.length > 0 && (
          <div
            style={{
              background: '#14172b',
              border: '1.5px solid rgba(100, 115, 165, 0.24)',
              borderRadius: 20,
              padding: '24px 44px',
              marginTop: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              textAlign: 'left',
              maxWidth: 880,
            }}
          >
            {slide.bulletPoints.map((pt, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  fontSize: 24,
                  color: '#e5e7eb',
                  fontWeight: 500,
                }}
              >
                <span style={{ color: brandColor, fontWeight: 800 }}>✓</span>
                <span>{pt}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
