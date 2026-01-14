import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

/**
 * Hook to detect current theme (dark/light)
 * Watches for changes to the html element's class
 */
export function useThemeMode() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }
    checkTheme()

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          checkTheme()
        }
      })
    })

    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [])

  return isDark
}

/**
 * Theme-aware Wordmark Logo component
 * Switches between light/dark wordmark variants based on current theme
 */
export function Logo({ className, size = 'md' }: LogoProps) {
  const isDark = useThemeMode()
  const [imageError, setImageError] = useState(false)

  const sizeClasses = {
    sm: 'h-5',
    md: 'h-7',
    lg: 'h-10',
    xl: 'h-14',
  }

  // dark-bg variant is for dark mode (light text on dark background)
  // light-bg variant is for light mode (dark text on light background)
  const logoSrc = isDark
    ? '/lockdn-v6-wordmark-dark-bg.svg'
    : '/lockdn-v6-wordmark-light-bg.svg'

  if (imageError) {
    return (
      <span className={cn('font-bold text-foreground', className)}>
        Lockdn
      </span>
    )
  }

  return (
    <img
      src={logoSrc}
      alt="Lockdn"
      className={cn(sizeClasses[size], 'w-auto', className)}
      onError={() => setImageError(true)}
    />
  )
}
