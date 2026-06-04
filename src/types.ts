export interface Accent {
  id: string
  p: string
  s: string
  bg: string
  dark: boolean
}

export interface Format {
  id: string
  icon: string
  label: string
  dims: string
  sub: string
  w: number
  h: number
}

export interface TemplateMeta {
  id: string
  jp: string
  en: string
}

export interface FxState {
  petals: boolean
  orbs: boolean
}

export interface PosterProps {
  data: any
  accent: Accent
  fx: FxState
  fmt: Format
  bgImage: string | null
}

export interface ControlProps {
  data: any
  onChange: (data: any) => void
  onDownload?: () => void
  onStartBatch?: (rows: Record<string, unknown>[]) => void
}

export interface TemplateDef {
  meta: TemplateMeta
  defaultData: Record<string, unknown>
  Poster: React.FC<any>
  Controls: React.FC<any>
}

export const TAG_COLORS: Record<string, string> = {
  Verb: '#E63946',
  Adj: '#6B21A8',
  Noun: '#2A9D8F',
  Adv: '#F4A261',
  Other: '#374151',
}
