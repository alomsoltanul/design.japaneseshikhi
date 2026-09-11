import { useEffect, useRef, useState, type RefObject } from 'react'
import type { Slide } from './types'
import { QAGridSlide } from './slides/QAGridSlide'
import { ConversationSlide } from './slides/ConversationSlide'
import { TitleSlide } from './slides/TitleSlide'
import { VocabSlide } from './slides/VocabSlide'
import { GrammarSlide } from './slides/GrammarSlide'

interface SlideCanvasProps {
  slide: Slide
  canvasRef?: RefObject<HTMLDivElement | null>
  isThumbnail?: boolean
  thumbnailWidth?: number
  isFullscreen?: boolean
}

export function SlideCanvas({
  slide,
  canvasRef,
  isThumbnail = false,
  thumbnailWidth = 200,
  isFullscreen = false,
}: SlideCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState<number>(isThumbnail ? thumbnailWidth / 1920 : 0.5)

  useEffect(() => {
    if (isThumbnail) {
      setScale(thumbnailWidth / 1920)
      return
    }

    const updateScale = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      // In fullscreen mode, use 100% of available viewport edge-to-edge
      const availW = isFullscreen ? rect.width : Math.max(200, rect.width - 48)
      const availH = isFullscreen ? rect.height : Math.max(150, rect.height - 48)
      const computedScale = Math.min(availW / 1920, availH / 1080)
      setScale(computedScale)
    }

    updateScale()

    const ro = new ResizeObserver(updateScale)
    if (containerRef.current) ro.observe(containerRef.current)
    window.addEventListener('resize', updateScale)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateScale)
    }
  }, [isThumbnail, thumbnailWidth, isFullscreen])

  const renderSlideContent = () => {
    switch (slide.type) {
      case 'qa-grid':
        return <QAGridSlide slide={slide} />
      case 'conversation':
        return <ConversationSlide slide={slide} />
      case 'title':
        return <TitleSlide slide={slide} />
      case 'vocab-list':
        return <VocabSlide slide={slide} />
      case 'grammar-point':
        return <GrammarSlide slide={slide} />
      default:
        return <div style={{ padding: 40 }}>Unknown slide type</div>
    }
  }

  if (isThumbnail) {
    const thumbHeight = thumbnailWidth * (9 / 16)
    return (
      <div
        style={{
          width: thumbnailWidth,
          height: thumbHeight,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 6,
          background: '#090b14',
        }}
      >
        <div
          style={{
            width: 1920,
            height: 1080,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
          className="ps-slide-canvas"
        >
          {renderSlideContent()}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="ps-canvas-viewport"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
        padding: isFullscreen ? 0 : 24,
      }}
    >
      <div
        ref={canvasRef}
        className="ps-slide-canvas"
        style={{
          transform: `scale(${scale})`,
          borderRadius: isFullscreen ? 0 : 12,
          boxShadow: isFullscreen ? 'none' : undefined,
        }}
      >
        {renderSlideContent()}
      </div>
    </div>
  )
}
