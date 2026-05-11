import type { Accent } from './types'

export const BASE_ACCENTS: Accent[] = [
  { id: 'red',    p: '#E63946', s: '#6B21A8', bg: 'linear-gradient(150deg,#0a0c18 0%,#0f0d1f 55%,#13102a 100%)', dark: true  },
  { id: 'navy',   p: '#1D4ED8', s: '#2A9D8F', bg: 'linear-gradient(135deg,#0d1b2a 0%,#122238 55%,#0d1b2a 100%)', dark: true  },
  { id: 'teal',   p: '#2A9D8F', s: '#1D3557', bg: 'linear-gradient(150deg,#051614 0%,#0b2320 55%,#051614 100%)', dark: true  },
  { id: 'purple', p: '#6B21A8', s: '#E63946', bg: 'linear-gradient(150deg,#0c0618 0%,#150c28 55%,#0c0618 100%)', dark: true  },
  { id: 'amber',  p: '#F4A261', s: '#E63946', bg: 'linear-gradient(150deg,#180e02 0%,#251404 55%,#180e02 100%)', dark: true  },
  { id: 'light',  p: '#E63946', s: '#1D3557', bg: '#FFFFFF',                                                    dark: false },
]

export const FORMATS: import('./types').Format[] = [
  { id: 'square',   icon: '■', label: 'Square',    dims: '1080 × 1080', sub: 'Facebook · Instagram', w: 1080, h: 1080 },
  { id: 'portrait', icon: '▮', label: 'Portrait',  dims: '1080 × 1350', sub: 'Instagram 4:5',        w: 1080, h: 1350 },
  { id: 'story',    icon: '▯', label: 'Story',     dims: '1080 × 1920', sub: 'Stories · Reels',      w: 1080, h: 1920 },
  { id: 'twitter',  icon: '▬', label: 'Twitter/X', dims: '1600 × 900',  sub: 'Twitter · LinkedIn',   w: 1600, h: 900  },
]
