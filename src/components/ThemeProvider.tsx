import { useEffect } from 'react'
import { usePreferences } from '@/db/hooks'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preferences = usePreferences()
  const theme = preferences?.theme || 'system'

  useEffect(() => {
    const root = window.document.documentElement

    // Remove existing theme class
    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      // Check system preference
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      root.classList.add(systemTheme)

      // Listen for system theme changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (e: MediaQueryListEvent) => {
        root.classList.remove('light', 'dark')
        root.classList.add(e.matches ? 'dark' : 'light')
      }
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    } else {
      root.classList.add(theme)
    }
  }, [theme])

  return <>{children}</>
}
