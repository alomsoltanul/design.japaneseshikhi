import { createContext, useContext, useState, useEffect, useCallback } from 'react'

type ThemeMode = 'dark' | 'light'
type FontFamily = 'inter' | 'serif' | 'jp' | 'mono'

interface ThemeContextType {
  mode: ThemeMode
  font: FontFamily
  toggleMode: () => void
  setFont: (font: FontFamily) => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  font: 'inter',
  toggleMode: () => {},
  setFont: () => {},
  isDark: true,
})

const THEME_MODE_KEY = 'js-theme-mode'
const THEME_FONT_KEY = 'js-theme-font'

function getSavedMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_MODE_KEY) as ThemeMode | null
    return saved === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

function getSavedFont(): FontFamily {
  try {
    const saved = localStorage.getItem(THEME_FONT_KEY) as FontFamily | null
    const valid: FontFamily[] = ['inter', 'serif', 'jp', 'mono']
    return saved && valid.includes(saved) ? saved : 'inter'
  } catch {
    return 'inter'
  }
}

const FONT_CSS_VARS: Record<FontFamily, string> = {
  inter: "'Inter', 'Noto Sans JP', sans-serif",
  serif: "'Noto Serif', Georgia, 'Noto Sans Bengali', serif",
  jp: "'Noto Sans JP', 'Inter', 'Noto Sans Bengali', sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(getSavedMode)
  const [font, setFontState] = useState<FontFamily>(getSavedFont)

  useEffect(() => {
    localStorage.setItem(THEME_MODE_KEY, mode)
    document.documentElement.setAttribute('data-theme', mode)
  }, [mode])

  useEffect(() => {
    localStorage.setItem(THEME_FONT_KEY, font)
    document.documentElement.style.setProperty('--font-body', FONT_CSS_VARS[font])
    document.documentElement.style.setProperty('--font-heading', font === 'serif' ? "'Noto Serif', Georgia, serif" : FONT_CSS_VARS[font])
  }, [font])

  const toggleMode = useCallback(() => {
    setMode(prev => prev === 'dark' ? 'light' : 'dark')
  }, [])

  const setFont = useCallback((next: FontFamily) => {
    setFontState(next)
  }, [])

  const isDark = mode === 'dark'

  return (
    <ThemeContext.Provider value={{ mode, font, toggleMode, setFont, isDark }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
