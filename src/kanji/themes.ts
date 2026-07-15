// Kanji Mind Map stage themes. Shared by the DOM component and the canvas
// video renderer — every color both need lives here.

export interface PillTokens {
  bg: string
  border: string
  text: string
}

export interface KanjiTheme {
  id: string
  label: string
  /** Picker chip color. */
  swatch: string
  /** CSS background for the stage (solid hex or full gradient string). */
  stage: string
  /** Canvas gradient stops (vertical). null = `stage` is a solid fillStyle. */
  stageStops: string[] | null
  card: string
  cardBorder: string
  /** Glassy dark cards: skip drop shadows on canvas. */
  glassy: boolean
  connector: string
  /** Kanji + compound word color. */
  heading: string
  kana: string
  /** Hub meaning / example sentence. */
  enStrong: string
  /** Node card English. */
  en: string
  bn: string
  /** Header eyebrow + footer text. */
  sub: string
  onPill: PillTokens
  kunPill: PillTokens
  tealPill: PillTokens
  redPill: PillTokens
  logo: string
}

export const KANJI_THEMES: Record<string, KanjiTheme> = {
  light: {
    id: 'light',
    label: 'Light',
    swatch: '#FAFAFA',
    stage: '#FAFAFA',
    stageStops: null,
    card: '#FFFFFF',
    cardBorder: '#F3F4F6',
    glassy: false,
    connector: '#D1D5DB',
    heading: '#1D3557',
    kana: '#E63946',
    enStrong: '#111827',
    en: '#374151',
    bn: '#6B7280',
    sub: '#6B7280',
    onPill: { bg: 'rgba(230,57,70,0.08)', border: 'rgba(230,57,70,0.2)', text: '#E63946' },
    kunPill: { bg: 'rgba(42,157,143,0.09)', border: 'rgba(42,157,143,0.25)', text: '#2A9D8F' },
    tealPill: { bg: 'rgba(42,157,143,0.09)', border: 'rgba(42,157,143,0.25)', text: '#2A9D8F' },
    redPill: { bg: 'rgba(230,57,70,0.08)', border: 'rgba(230,57,70,0.2)', text: '#E63946' },
    logo: '/assets/logo-light.webp',
  },
  washi: {
    id: 'washi',
    label: 'Washi',
    swatch: '#F4A261',
    stage: '#FBF4E8',
    stageStops: null,
    card: '#FFFDF8',
    cardBorder: '#F0E4D0',
    glassy: false,
    connector: '#D9CBB2',
    heading: '#1D3557',
    kana: '#E63946',
    enStrong: '#40372A',
    en: '#5C5240',
    bn: '#8A7C64',
    sub: '#8A7C64',
    onPill: { bg: 'rgba(230,57,70,0.09)', border: 'rgba(230,57,70,0.22)', text: '#D42E3A' },
    kunPill: { bg: 'rgba(42,157,143,0.11)', border: 'rgba(42,157,143,0.3)', text: '#1F8578' },
    tealPill: { bg: 'rgba(42,157,143,0.11)', border: 'rgba(42,157,143,0.3)', text: '#1F8578' },
    redPill: { bg: 'rgba(244,162,97,0.16)', border: 'rgba(196,120,50,0.4)', text: '#B4691E' },
    logo: '/assets/logo-light.webp',
  },
  slate: {
    id: 'slate',
    label: 'Slate',
    swatch: '#0F172A',
    stage: '#0B1220',
    stageStops: null,
    card: '#0F172A',
    cardBorder: '#1F2937',
    glassy: false,
    connector: 'rgba(255,255,255,0.16)',
    heading: '#F9FAFB',
    kana: '#FF8A93',
    enStrong: '#E5E7EB',
    en: '#CBD5E1',
    bn: '#94A3B8',
    sub: '#94A3B8',
    onPill: { bg: 'rgba(230,57,70,0.16)', border: 'rgba(230,57,70,0.4)', text: '#FF8A93' },
    kunPill: { bg: 'rgba(42,157,143,0.16)', border: 'rgba(42,157,143,0.4)', text: '#5AC8BB' },
    tealPill: { bg: 'rgba(42,157,143,0.16)', border: 'rgba(42,157,143,0.4)', text: '#5AC8BB' },
    redPill: { bg: 'rgba(230,57,70,0.16)', border: 'rgba(230,57,70,0.4)', text: '#FF8A93' },
    logo: '/assets/logo-dark.webp',
  },
  midnight: {
    id: 'midnight',
    label: 'Midnight',
    swatch: '#13102a',
    stage: 'linear-gradient(180deg, #0a0c18 0%, #0f0d1f 50%, #13102a 100%)',
    stageStops: ['#0a0c18', '#0f0d1f', '#13102a'],
    card: 'rgba(255,255,255,0.05)',
    cardBorder: 'rgba(255,255,255,0.10)',
    glassy: true,
    connector: 'rgba(255,255,255,0.16)',
    heading: '#FFFFFF',
    kana: '#F4A261',
    enStrong: '#E5E7EB',
    en: '#D1D5DB',
    bn: '#9CA3AF',
    sub: '#9CA3AF',
    onPill: { bg: '#E63946', border: 'rgba(255,255,255,0.14)', text: '#FFFFFF' },
    kunPill: { bg: '#2A9D8F', border: 'rgba(255,255,255,0.14)', text: '#FFFFFF' },
    tealPill: { bg: 'rgba(42,157,143,0.22)', border: 'rgba(42,157,143,0.45)', text: '#6FDACB' },
    redPill: { bg: 'rgba(230,57,70,0.22)', border: 'rgba(230,57,70,0.45)', text: '#FF9AA2' },
    logo: '/assets/logo-dark.webp',
  },
}

export const KANJI_THEME_LIST = Object.values(KANJI_THEMES)

export function getKanjiTheme(id: string | undefined): KanjiTheme {
  return (id && KANJI_THEMES[id]) || KANJI_THEMES.light
}
