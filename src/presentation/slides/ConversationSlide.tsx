import type { ConversationSlide as ConversationSlideType } from '../types'

export function ConversationSlide({ slide }: { slide: ConversationSlideType }) {
  const brand = slide.brand || 'Japanese Shikhi'
  const brandColor = slide.brandColor || '#E63946'
  const keyword = slide.keyword || 'だれ？'
  const imageUrl = slide.image?.url || '/assets/slides-anime-hallway.png'

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
            <div className="ps-slide-title-text">
              {slide.title}
            </div>
          )}
        </div>
      </div>

      {/* Body: Left Image & Right Dialogue */}
      <div className="ps-slide-body">
        <div className="ps-kaiwa-container">
          {/* Left Column: Anime/Scene Illustration */}
          <div className="ps-kaiwa-image-col">
            <img
              src={imageUrl}
              alt={slide.image?.alt || 'Scene illustration'}
              className="ps-kaiwa-img"
              onError={e => {
                // Fallback to local hallway image if URL fails
                const img = e.target as HTMLImageElement
                if (img.src !== window.location.origin + '/assets/slides-anime-hallway.png') {
                  img.src = '/assets/slides-anime-hallway.png'
                }
              }}
            />
          </div>

          {/* Right Column: Dialogue Card */}
          <div className="ps-kaiwa-dialogue-col">
            {slide.dialogue?.title && (
              <div className="ps-kaiwa-title">{slide.dialogue.title}</div>
            )}
            <div className="ps-kaiwa-lines">
              {slide.dialogue?.lines?.map((line, idx) => (
                <div key={line.id || idx} className="ps-kaiwa-line-group">
                  <div
                    className="ps-kaiwa-speaker"
                    style={line.speakerColor ? { color: line.speakerColor } : undefined}
                  >
                    {line.speaker}：
                  </div>
                  <div className="ps-kaiwa-speech">{line.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
