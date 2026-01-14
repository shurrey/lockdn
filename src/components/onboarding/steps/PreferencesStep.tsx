import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowRight,
  ArrowLeft,
  Sun,
  Moon,
  Monitor,
  Clock,
  Coffee,
  Zap,
  Brain,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { updatePreferences, usePreferences } from '@/db/hooks'
import type { ProductivityHour } from '@/types'

interface PreferencesStepProps {
  onNext: () => void
  onBack: () => void
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TIME_BLOCKS = [
  { label: 'Early Morning', start: 5, end: 9, icon: Sun },
  { label: 'Morning', start: 9, end: 12, icon: Coffee },
  { label: 'Afternoon', start: 12, end: 17, icon: Zap },
  { label: 'Evening', start: 17, end: 21, icon: Moon },
  { label: 'Night', start: 21, end: 24, icon: Brain },
]

type Theme = 'light' | 'dark' | 'system'

export function PreferencesStep({ onNext, onBack }: PreferencesStepProps) {
  const preferences = usePreferences()
  const [selectedTheme, setSelectedTheme] = useState<Theme>(preferences?.theme || 'system')
  const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set())

  const handleThemeChange = async (theme: Theme) => {
    setSelectedTheme(theme)
    await updatePreferences({ theme })
  }

  const toggleBlock = (day: number, blockIndex: number) => {
    const key = `${day}-${blockIndex}`
    const newSet = new Set(selectedBlocks)
    if (newSet.has(key)) {
      newSet.delete(key)
    } else {
      newSet.add(key)
    }
    setSelectedBlocks(newSet)
  }

  const handleSaveProductivity = async () => {
    // Convert selected blocks to ProductivityHour format
    const productivityHours: ProductivityHour[] = []

    selectedBlocks.forEach(key => {
      const [day, blockIndex] = key.split('-').map(Number)
      const block = TIME_BLOCKS[blockIndex]
      productivityHours.push({
        dayOfWeek: day,
        startHour: block.start,
        endHour: block.end,
        energyLevel: 'high',
      })
    })

    await updatePreferences({ productivityHours })
  }

  const handleNext = async () => {
    await handleSaveProductivity()
    onNext()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Set Your Preferences</h2>
        <p className="text-muted-foreground">
          Customize the app appearance and tell us when you're most productive.
          This helps us suggest optimal study times.
        </p>
      </div>

      {/* Theme selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Choose your preferred color scheme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className={cn(
                'flex-1 flex flex-col items-center gap-2 h-auto py-4',
                selectedTheme === 'light' &&
                  'border-2 border-primary bg-primary/5'
              )}
              onClick={() => handleThemeChange('light')}
            >
              <Sun className="h-5 w-5" />
              <span className="text-sm">Light</span>
            </Button>
            <Button
              variant="outline"
              className={cn(
                'flex-1 flex flex-col items-center gap-2 h-auto py-4',
                selectedTheme === 'dark' &&
                  'border-2 border-primary bg-primary/5'
              )}
              onClick={() => handleThemeChange('dark')}
            >
              <Moon className="h-5 w-5" />
              <span className="text-sm">Dark</span>
            </Button>
            <Button
              variant="outline"
              className={cn(
                'flex-1 flex flex-col items-center gap-2 h-auto py-4',
                selectedTheme === 'system' &&
                  'border-2 border-primary bg-primary/5'
              )}
              onClick={() => handleThemeChange('system')}
            >
              <Monitor className="h-5 w-5" />
              <span className="text-sm">System</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Productivity hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            When Are You Most Productive?
          </CardTitle>
          <CardDescription>
            Select the time blocks when you have the most energy for focused studying.
            This is optional but helps optimize your study plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Time block legend */}
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {TIME_BLOCKS.map((block, index) => {
                const Icon = block.icon
                return (
                  <div key={index} className="flex items-center gap-1">
                    <Icon className="h-3 w-3" />
                    <span>{block.label}</span>
                    <span className="text-muted-foreground/60">
                      ({block.start}:00-{block.end}:00)
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Grid */}
            <div className="overflow-x-auto">
              <div className="min-w-[400px]">
                {/* Header row */}
                <div className="grid grid-cols-[60px_repeat(5,1fr)] gap-1 mb-1">
                  <div />
                  {TIME_BLOCKS.map((block, index) => {
                    const Icon = block.icon
                    return (
                      <div
                        key={index}
                        className="text-center text-xs text-muted-foreground p-1"
                      >
                        <Icon className="h-3 w-3 mx-auto mb-1" />
                        <span className="hidden sm:inline">{block.label}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Day rows */}
                {DAYS.map((day, dayIndex) => (
                  <div
                    key={dayIndex}
                    className="grid grid-cols-[60px_repeat(5,1fr)] gap-1 mb-1"
                  >
                    <div className="text-sm font-medium py-2 px-1">{day}</div>
                    {TIME_BLOCKS.map((_, blockIndex) => {
                      const key = `${dayIndex}-${blockIndex}`
                      const isSelected = selectedBlocks.has(key)
                      return (
                        <button
                          key={blockIndex}
                          type="button"
                          onClick={() => toggleBlock(dayIndex, blockIndex)}
                          className={cn(
                            'h-10 rounded transition-colors border',
                            isSelected
                              ? 'bg-primary/20 border-primary'
                              : 'bg-muted/30 border-transparent hover:bg-muted/50'
                          )}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            {selectedBlocks.size > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedBlocks.size} time block{selectedBlocks.size !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={handleNext}>
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
