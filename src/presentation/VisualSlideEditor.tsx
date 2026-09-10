import type { Slide, QAGridSlide, ConversationSlide, TitleSlide } from './types'

interface VisualSlideEditorProps {
  slide: Slide
  isOpen: boolean
  onClose: () => void
  onUpdateSlide: (updated: Slide) => void
}

export function VisualSlideEditor({
  slide,
  isOpen,
  onClose,
  onUpdateSlide,
}: VisualSlideEditorProps) {
  if (!isOpen) return null

  const handleFieldChange = (field: keyof Slide, val: unknown) => {
    onUpdateSlide({
      ...slide,
      [field]: val,
    } as Slide)
  }

  return (
    <div className="ps-editor-drawer">
      <div className="ps-editor-header">
        <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          ✏️ Visual Editor ({slide.type})
        </span>
        <button className="ps-btn ps-btn-ghost" onClick={onClose} type="button">
          ✕
        </button>
      </div>

      <div className="ps-editor-body">
        {/* Keyword Badge */}
        <div className="ps-field-group">
          <label>Topic / Keyword Badge</label>
          <input
            className="ps-input"
            value={slide.keyword || ''}
            onChange={e => handleFieldChange('keyword', e.target.value)}
            placeholder="e.g. だれ？ or なに？"
          />
        </div>

        {/* Title */}
        <div className="ps-field-group">
          <label>Slide Title</label>
          <input
            className="ps-input"
            value={slide.title || ''}
            onChange={e => handleFieldChange('title', e.target.value)}
            placeholder="e.g. 「だれ」 (dare) দিয়ে জাপানি প্রশ্ন শিখে নিন"
          />
        </div>

        {/* Title Highlight (for Q&A banners) */}
        {slide.type === 'qa-grid' && (
          <div className="ps-field-group">
            <label>Title Highlight Text (Red in banner)</label>
            <input
              className="ps-input"
              value={slide.titleHighlight || ''}
              onChange={e => handleFieldChange('titleHighlight', e.target.value)}
              placeholder="e.g. 「だれ」"
            />
          </div>
        )}

        {/* Conversation Specific: Image URL & Dialogue */}
        {slide.type === 'conversation' && (
          <>
            <div className="ps-field-group">
              <label>Scene / Illustration Image URL</label>
              <input
                className="ps-input"
                value={(slide as ConversationSlide).image?.url || ''}
                onChange={e => {
                  const conv = slide as ConversationSlide
                  onUpdateSlide({
                    ...conv,
                    image: { ...(conv.image || {}), url: e.target.value },
                  })
                }}
                placeholder="/assets/slides-anime-hallway.png"
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button
                  className="ps-btn"
                  style={{ fontSize: 11, padding: '3px 8px' }}
                  type="button"
                  onClick={() => {
                    const conv = slide as ConversationSlide
                    onUpdateSlide({
                      ...conv,
                      image: { ...(conv.image || {}), url: '/assets/slides-anime-hallway.png' },
                    })
                  }}
                >
                  🏫 School Hallway
                </button>
              </div>
            </div>

            <div className="ps-field-group">
              <label>Dialogue Title</label>
              <input
                className="ps-input"
                value={(slide as ConversationSlide).dialogue?.title || ''}
                onChange={e => {
                  const conv = slide as ConversationSlide
                  onUpdateSlide({
                    ...conv,
                    dialogue: { ...(conv.dialogue || { lines: [] }), title: e.target.value },
                  })
                }}
                placeholder="e.g. ユキとハルの会話"
              />
            </div>
          </>
        )}

        {/* Title Slide Specific */}
        {slide.type === 'title' && (
          <>
            <div className="ps-field-group">
              <label>JLPT Level</label>
              <input
                className="ps-input"
                value={(slide as TitleSlide).level || ''}
                onChange={e => {
                  const t = slide as TitleSlide
                  onUpdateSlide({ ...t, level: e.target.value })
                }}
                placeholder="e.g. JLPT N5"
              />
            </div>
            <div className="ps-field-group">
              <label>Topic (English)</label>
              <input
                className="ps-input"
                value={(slide as TitleSlide).topicEn || ''}
                onChange={e => {
                  const t = slide as TitleSlide
                  onUpdateSlide({ ...t, topicEn: e.target.value })
                }}
              />
            </div>
            <div className="ps-field-group">
              <label>Topic (Bangla)</label>
              <input
                className="ps-input"
                value={(slide as TitleSlide).topicBn || ''}
                onChange={e => {
                  const t = slide as TitleSlide
                  onUpdateSlide({ ...t, topicBn: e.target.value })
                }}
              />
            </div>
          </>
        )}

        {/* Speaker Notes */}
        <div className="ps-field-group">
          <label>Speaker Notes / Video Guide Script</label>
          <textarea
            className="ps-notes-textarea"
            rows={4}
            value={slide.speakerNotes || ''}
            onChange={e => handleFieldChange('speakerNotes', e.target.value)}
            placeholder="Write cues or speaking script for recording this slide..."
          />
        </div>
      </div>
    </div>
  )
}
