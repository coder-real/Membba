import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

function getSystemDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('membba-theme') || 'system')
  const [systemDark, setSystemDark] = useState(() => getSystemDark())

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemDark(media.matches)
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [])

  const dark = theme === 'system' ? systemDark : theme === 'dark'

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', dark)
    root.classList.toggle('light', !dark)
    localStorage.setItem('membba-theme', theme)
  }, [dark, theme])

  const toggleTheme = () => setTheme(dark ? 'light' : 'dark')

  const value = useMemo(() => ({ dark, theme, setTheme, toggleTheme, systemDark }), [dark, theme, systemDark])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
