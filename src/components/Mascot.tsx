import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useThemeMode } from './Logo'

interface MascotProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Optional message to display below the mascot */
  message?: string
}

/**
 * Theme-aware Mascot component for empty states
 * Displays the Lockdn mascot with optional message
 */
export function Mascot({ className, size = 'md', message }: MascotProps) {
  const isDark = useThemeMode()
  const [imageError, setImageError] = useState(false)

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
    xl: 'w-48 h-48',
  }

  // dark-bg variant is for dark mode, light-bg variant is for light mode
  const mascotSrc = isDark
    ? '/lockdn-final-mascot-dark-bg.svg'
    : '/lockdn-final-mascot-light-bg.svg'

  if (imageError) {
    // Fallback to a simple icon or nothing
    return null
  }

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className={cn(
        sizeClasses[size],
        'rounded-full bg-white flex items-center justify-center p-4'
      )}>
        <img
          src={mascotSrc}
          alt="Lockdn mascot"
          className="w-full h-full object-contain"
          onError={() => setImageError(true)}
        />
      </div>
      {message && (
        <p className="mt-3 text-sm text-muted-foreground text-center max-w-xs">
          {message}
        </p>
      )}
    </div>
  )
}
