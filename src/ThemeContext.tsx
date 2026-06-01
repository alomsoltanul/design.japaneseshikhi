import { createContext, useContext, useState, useEffect } from 'react'

type ThemeMode = 'dark' | 'offwhite'

interface ThemeContextType {
  mode: ThemeMode
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextType>({ mode: 'dark', toggle: () => {} })

const THEME_KEY = 'js-theme-mode'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY) as ThemeMode | null
      return saved || 'dark'
    } catch {
      return 'dark'
    }
  })

  useEffect(() => {
    localStorage.setItem(THEME_KEY, mode)
    document.documentElement.setAttribute('data-theme', mode)
  }, [mode])

  const toggle = () => setMode(prev => prev === 'dark' ? 'offwhite' : 'dark')

  return (
    <ThemeContext.Provider value={{ mode, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
