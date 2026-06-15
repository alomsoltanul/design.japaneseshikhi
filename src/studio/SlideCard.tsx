import type { CarouselSlide } from './slides'

/* One carousel slide, rendered at native 1080x1350 (4:5 IG) for html-to-image.
   Uses system fonts so Japanese renders correctly (no satori/tofu issues). */

const BRAND = '#E63946'
const CREAM = '#FAF8F5'
const INK = '#1A1A1A'

const JP_FONT = "'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP','Yu Gothic',sans-serif"

export function SlideCard({ slide, level, total }: { slide: CarouselSlide; level: string; total: number }) {
  const len = slide.text.length
  const big = len > 70 ? 52 : len > 36 ? 68 : 92

  return (
    <div
      style={{
        width: 1080,
        height: 1350,
        background: CREAM,
        position: 'relative',
        fontFamily: JP_FONT,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ height: 14, background: BRAND }} />

      <div style={{ padding: '44px 56px 0' }}>
        <span
          style={{
            display: 'inline-block',
            background: BRAND,
            color: '#fff',
            fontSize: 34,
            fontWeight: 800,
            padding: '12px 32px',
            borderRadius: 999,
            letterSpacing: '0.04em',
          }}
        >
          JLPT {level}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 80px',
          textAlign: 'center',
          gap: 40,
        }}
      >
        {slide.type === 'answer' ? (
          <div
            style={{
              background: BRAND,
              color: '#fff',
              fontSize: big,
              fontWeight: 800,
              padding: '44px 60px',
              borderRadius: 36,
              lineHeight: 1.3,
              whiteSpace: 'pre-wrap',
            }}
          >
            {slide.text}
          </div>
        ) : (
          <div
            style={{
              color: INK,
              fontSize: big,
              fontWeight: 800,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
            }}
          >
            {slide.text}
          </div>
        )}

        {slide.type === 'explain' && slide.cta && (
          <div
            style={{
              background: BRAND,
              color: '#fff',
              fontSize: 34,
              fontWeight: 800,
              padding: '22px 44px',
              borderRadius: 999,
              lineHeight: 1.3,
            }}
          >
            {slide.cta}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 56px 48px' }}>
        <span style={{ color: BRAND, fontSize: 34, fontWeight: 800 }}>
          {slide.slide}/{total}
        </span>
      </div>
    </div>
  )
}

export default SlideCard
