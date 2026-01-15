import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GradeInputProps {
  value?: number
  onChange: (grade: number | undefined) => void
  disabled?: boolean
  className?: string
}

/**
 * Get letter grade equivalent for a percentage
 */
function getLetterGrade(percentage: number): string {
  if (percentage >= 93) return 'A'
  if (percentage >= 90) return 'A-'
  if (percentage >= 87) return 'B+'
  if (percentage >= 83) return 'B'
  if (percentage >= 80) return 'B-'
  if (percentage >= 77) return 'C+'
  if (percentage >= 73) return 'C'
  if (percentage >= 70) return 'C-'
  if (percentage >= 67) return 'D+'
  if (percentage >= 63) return 'D'
  if (percentage >= 60) return 'D-'
  return 'F'
}

/**
 * Get color class for grade
 */
function getGradeColor(percentage: number): string {
  if (percentage >= 90) return 'text-green-600'
  if (percentage >= 80) return 'text-blue-600'
  if (percentage >= 70) return 'text-yellow-600'
  if (percentage >= 60) return 'text-orange-600'
  return 'text-red-600'
}

export function GradeInput({ value, onChange, disabled, className }: GradeInputProps) {
  const [inputValue, setInputValue] = useState(value?.toString() ?? '')

  // Sync internal state with prop changes
  useEffect(() => {
    setInputValue(value?.toString() ?? '')
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value

    // Allow empty input
    if (val === '') {
      setInputValue('')
      onChange(undefined)
      return
    }

    // Only allow numbers
    if (!/^\d*\.?\d*$/.test(val)) return

    setInputValue(val)

    const num = parseFloat(val)
    if (!isNaN(num) && num >= 0 && num <= 100) {
      onChange(num)
    }
  }

  const handleBlur = () => {
    // Clean up input on blur
    if (inputValue === '') {
      onChange(undefined)
      return
    }

    const num = parseFloat(inputValue)
    if (isNaN(num)) {
      setInputValue('')
      onChange(undefined)
    } else {
      // Clamp to 0-100
      const clamped = Math.max(0, Math.min(100, num))
      setInputValue(clamped.toString())
      onChange(clamped)
    }
  }

  const handleClear = () => {
    setInputValue('')
    onChange(undefined)
  }

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            inputMode="decimal"
            placeholder="Grade (0-100)"
            value={inputValue}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={disabled}
            className="pr-8"
          />
          {inputValue && !disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={handleClear}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <span className="text-sm text-muted-foreground w-6">%</span>
      </div>
      {value !== undefined && (
        <p className={cn('text-xs', getGradeColor(value))}>
          Letter grade: {getLetterGrade(value)}
        </p>
      )}
    </div>
  )
}
