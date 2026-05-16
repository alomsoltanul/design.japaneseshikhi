export type AppView = 'poster' | 'prompt' | 'poster-maker'

export function ToolMenu({
  view,
  onChange,
  compact = false,
  className = '',
}: {
  view: AppView
  onChange: (view: AppView) => void
  compact?: boolean
  className?: string
}) {
  return (
    <div className={`tool-menu${compact ? ' compact' : ''} ${className}`.trim()}>
      <button
        className={`tool-tab${view === 'poster' ? ' on' : ''}`}
        onClick={() => onChange('poster')}
        type="button"
      >
        Poster Studio
      </button>
      <button
        className={`tool-tab${view === 'prompt' ? ' on' : ''}`}
        onClick={() => onChange('prompt')}
        type="button"
      >
        Image Prompt Extractor
      </button>
      <button
        className={`tool-tab${view === 'poster-maker' ? ' on' : ''}`}
        onClick={() => onChange('poster-maker')}
        type="button"
      >
        Create: Poster Maker
      </button>
    </div>
  )
}
