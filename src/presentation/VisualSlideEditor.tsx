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

        {/* Grammar Point Specific */}
        {slide.type === 'grammar-point' && (() => {
          const g = slide as any
          const examples = g.examples || []
          const exception = g.exception || {}
          const excExamples = exception.examples || []

          return (
            <>
              <div className="ps-field-group">
                <label>Grammar Meaning (Bangla)</label>
                <input
                  className="ps-input"
                  value={g.meaning || g.banglaMeaning || ''}
                  onChange={e => onUpdateSlide({ ...g, meaning: e.target.value })}
                  placeholder="e.g. কারণ / যেহেতু (Because / Since)"
                />
              </div>

              <div className="ps-field-group">
                <label>Formation Title</label>
                <input
                  className="ps-input"
                  value={g.formation?.title || ''}
                  onChange={e =>
                    onUpdateSlide({
                      ...g,
                      formation: { ...(g.formation || {}), title: e.target.value },
                    })
                  }
                  placeholder="Topic Grammar: How it's made"
                />
              </div>

              <div className="ps-field-group">
                <label>Formation Formula / Example Note</label>
                <input
                  className="ps-input"
                  value={g.formation?.note || g.formation?.formula || ''}
                  onChange={e =>
                    onUpdateSlide({
                      ...g,
                      formation: { ...(g.formation || {}), note: e.target.value },
                    })
                  }
                  placeholder="Example: ので + ..... + です"
                />
              </div>

              {/* Examples Management (Unlimited) */}
              <div className="ps-field-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label>Examples ({examples.length})</label>
                  <button
                    className="ps-btn"
                    style={{ fontSize: 11, padding: '2px 8px' }}
                    type="button"
                    onClick={() => {
                      const newEx = {
                        id: `ex-${Date.now()}`,
                        label: `れい ${examples.length + 1} :`,
                        japanese: '',
                        romaji: '',
                        ans: 'Ans: ',
                      }
                      onUpdateSlide({ ...g, examples: [...examples, newEx] })
                    }}
                  >
                    + Add Example
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                  {examples.map((ex: any, idx: number) => (
                    <div
                      key={ex.id || idx}
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 8,
                        padding: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <input
                          className="ps-input"
                          style={{ width: 100, fontSize: 11, padding: '2px 6px' }}
                          value={ex.label || `れい ${idx + 1} :`}
                          onChange={e => {
                            const updated = [...examples]
                            updated[idx] = { ...updated[idx], label: e.target.value }
                            onUpdateSlide({ ...g, examples: updated })
                          }}
                        />
                        <button
                          className="ps-btn ps-btn-ghost"
                          style={{ fontSize: 11, color: '#ff4757', padding: '1px 6px' }}
                          type="button"
                          onClick={() => {
                            const updated = examples.filter((_: any, i: number) => i !== idx)
                            onUpdateSlide({ ...g, examples: updated })
                          }}
                          title="Delete example"
                        >
                          ✕
                        </button>
                      </div>

                      <input
                        className="ps-input"
                        style={{ fontSize: 12 }}
                        value={ex.japanese || ''}
                        onChange={e => {
                          const updated = [...examples]
                          updated[idx] = { ...updated[idx], japanese: e.target.value }
                          onUpdateSlide({ ...g, examples: updated })
                        }}
                        placeholder="Japanese sentence..."
                      />

                      <input
                        className="ps-input"
                        style={{ fontSize: 11 }}
                        value={ex.romaji || ''}
                        onChange={e => {
                          const updated = [...examples]
                          updated[idx] = { ...updated[idx], romaji: e.target.value }
                          onUpdateSlide({ ...g, examples: updated })
                        }}
                        placeholder="Romaji (optional)..."
                      />

                      <input
                        className="ps-input"
                        style={{ fontSize: 12, color: '#ff6b6b' }}
                        value={ex.ans || ex.translation || ''}
                        onChange={e => {
                          const updated = [...examples]
                          updated[idx] = { ...updated[idx], ans: e.target.value }
                          onUpdateSlide({ ...g, examples: updated })
                        }}
                        placeholder="Ans: Bangla meaning..."
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Exception Rule Management */}
              <div className="ps-field-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
                <label>Exception Rule (Optional)</label>
                <input
                  className="ps-input"
                  value={exception.rule || ''}
                  onChange={e =>
                    onUpdateSlide({
                      ...g,
                      exception: { ...exception, rule: e.target.value },
                    })
                  }
                  placeholder="If any exception: rule."
                />
                <input
                  className="ps-input"
                  style={{ marginTop: 4 }}
                  value={exception.description || ''}
                  onChange={e =>
                    onUpdateSlide({
                      ...g,
                      exception: { ...exception, description: e.target.value },
                    })
                  }
                  placeholder="Exception explanation..."
                />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                    Exception Examples ({excExamples.length})
                  </span>
                  <button
                    className="ps-btn"
                    style={{ fontSize: 11, padding: '2px 8px' }}
                    type="button"
                    onClick={() => {
                      const newEx = {
                        id: `exc-ex-${Date.now()}`,
                        label: `れい ${excExamples.length + 1} :`,
                        japanese: '',
                        ans: 'Ans: ',
                      }
                      onUpdateSlide({
                        ...g,
                        exception: { ...exception, examples: [...excExamples, newEx] },
                      })
                    }}
                  >
                    + Add Exc. Ex.
                  </button>
                </div>
              </div>
            </>
          )
        })()}

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
