import React from 'react'
import { ImageResponse } from '@vercel/og'
import { loadJpFont } from './fonts'
import type { CarouselSlide } from './social'

const BRAND = '#E63946'
const CREAM = '#FAF8F5'
const INK = '#1A1A1A'
const W = 1080
const H = 1350 // 4:5 IG ratio

export interface SlideMeta {
  level: string
  total: number // total slides (for "n/total")
}

/** Render one carousel slide to PNG bytes (1080x1350). */
export async function slidePng(slide: CarouselSlide, meta: SlideMeta): Promise<Buffer> {
  const text = `${slide.text} ${slide.cta ?? ''} ${meta.level}`
  const [bold, regular] = await Promise.all([loadJpFont(text, 700), loadJpFont(text, 400)])

  const fonts = [
    bold && { name: 'JP', data: bold, weight: 700 as const, style: 'normal' as const },
    regular && { name: 'JP', data: regular, weight: 400 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }[]

  const ir = new ImageResponse(<Slide slide={slide} meta={meta} />, {
    width: W,
    height: H,
    fonts: fonts.length ? fonts : undefined,
  })
  return Buffer.from(await ir.arrayBuffer())
}

function Slide({ slide, meta }: { slide: CarouselSlide; meta: SlideMeta }) {
  const big = slide.text.length > 60 ? 56 : slide.text.length > 28 ? 76 : 104
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: CREAM,
        fontFamily: 'JP',
        position: 'relative',
      }}
    >
      {/* top accent bar */}
      <div style={{ width: '100%', height: 12, background: BRAND, display: 'flex' }} />

      {/* level badge pill */}
      <div style={{ display: 'flex', padding: '40px 48px 0' }}>
        <div
          style={{
            display: 'flex',
            background: BRAND,
            color: '#fff',
            fontSize: 34,
            fontWeight: 700,
            padding: '12px 30px',
            borderRadius: 999,
          }}
        >
          JLPT {meta.level}
        </div>
      </div>

      {/* centered body */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 80px',
        }}
      >
        {slide.type === 'answer' ? (
          <div
            style={{
              display: 'flex',
              background: BRAND,
              color: '#fff',
              fontSize: big,
              fontWeight: 700,
              padding: '40px 56px',
              borderRadius: 36,
              textAlign: 'center',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.3,
            }}
          >
            {slide.text}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              color: INK,
              fontSize: big,
              fontWeight: 700,
              textAlign: 'center',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.4,
            }}
          >
            {slide.text}
          </div>
        )}

        {slide.type === 'explain' && slide.cta && (
          <div
            style={{
              display: 'flex',
              marginTop: 56,
              background: BRAND,
              color: '#fff',
              fontSize: 38,
              fontWeight: 700,
              padding: '24px 48px',
              borderRadius: 999,
            }}
          >
            {slide.cta}
          </div>
        )}
      </div>

      {/* slide number indicator */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 48px 44px' }}>
        <div style={{ display: 'flex', color: BRAND, fontSize: 34, fontWeight: 700 }}>
          {slide.slide}/{meta.total}
        </div>
      </div>
    </div>
  )
}
