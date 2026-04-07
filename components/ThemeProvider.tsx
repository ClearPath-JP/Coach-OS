'use client'
import { createContext, useContext, useEffect, type ReactNode } from 'react'

type ThemeContextValue = {
  theme: 'dark'
  setTheme: (theme: 'dark') => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
    // Clear any stored light preference
    try { localStorage.removeItem('clearpath-theme') } catch { /* ignore */ }
  }, [])

  const value: ThemeContextValue = {
    theme: 'dark',
    setTheme: () => {},
    toggleTheme: () => {},
  }
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
