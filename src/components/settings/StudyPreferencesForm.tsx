import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Clock, Coffee, Save, Loader2 } from 'lucide-react'
import { usePreferences, updatePreferences } from '@/db/hooks'
import type { ProductivityHour, BreakPreferences } from '@/types'
import { cn } from '@/lib/utils'

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
]

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`,
}))

const ENERGY_LEVELS = [
  { value: 'high', label: 'High', color: 'bg-green-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'low', label: 'Low', color: 'bg-orange-500' },
] as const

export function StudyPreferencesForm() {
  const preferences = usePreferences()
  const [productivityHours, setProductivityHours] = useState<ProductivityHour[]>([])
  const [breakPrefs, setBreakPrefs] = useState<BreakPreferences>({
    shortBreakDuration: 5,
    longBreakDuration: 15,
    sessionsBeforeLongBreak: 4,
  })
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Load preferences when they change
  useEffect(() => {
    if (preferences) {
      setProductivityHours(preferences.productivityHours || [])
      setBreakPrefs(preferences.breakPreferences)
      setHasChanges(false)
    }
  }, [preferences])

  const handleAddProductivityHour = useCallback(() => {
    const newHour: ProductivityHour = {
      dayOfWeek: 1, // Monday
      startHour: 9,
      endHour: 12,
      energyLevel: 'high',
    }
    setProductivityHours((prev) => [...prev, newHour])
    setHasChanges(true)
  }, [])

  const handleUpdateProductivityHour = useCallback(
    (index: number, updates: Partial<ProductivityHour>) => {
      setProductivityHours((prev) =>
        prev.map((h, i) => (i === index ? { ...h, ...updates } : h))
      )
      setHasChanges(true)
    },
    []
  )

  const handleRemoveProductivityHour = useCallback((index: number) => {
    setProductivityHours((prev) => prev.filter((_, i) => i !== index))
    setHasChanges(true)
  }, [])

  const handleUpdateBreakPrefs = useCallback((updates: Partial<BreakPreferences>) => {
    setBreakPrefs((prev) => ({ ...prev, ...updates }))
    setHasChanges(true)
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await updatePreferences({
        productivityHours,
        breakPreferences: breakPrefs,
      })
      setHasChanges(false)
    } finally {
      setSaving(false)
    }
  }, [productivityHours, breakPrefs])

  // Group productivity hours by day for the visual summary
  const hoursByDay = productivityHours.reduce(
    (acc, hour) => {
      if (!acc[hour.dayOfWeek]) {
        acc[hour.dayOfWeek] = []
      }
      acc[hour.dayOfWeek].push(hour)
      return acc
    },
    {} as Record<number, ProductivityHour[]>
  )

  return (
    <div className="space-y-6">
      {/* Productivity Hours Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Productivity Hours
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Define when you're most productive during the week. The study planner will
            prioritize scheduling sessions during these times.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Weekly Overview */}
          <div className="grid grid-cols-7 gap-1 p-3 bg-muted/50 rounded-lg">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day.value} className="text-center">
                <div className="text-xs font-medium mb-1">{day.short}</div>
                <div className="space-y-0.5">
                  {hoursByDay[day.value]?.map((hour, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'text-xs px-1 py-0.5 rounded text-white truncate',
                        hour.energyLevel === 'high' && 'bg-green-500',
                        hour.energyLevel === 'medium' && 'bg-yellow-500',
                        hour.energyLevel === 'low' && 'bg-orange-500'
                      )}
                      title={`${HOURS[hour.startHour].label} - ${HOURS[hour.endHour].label}`}
                    >
                      {hour.startHour}-{hour.endHour}
                    </div>
                  )) || (
                    <div className="text-xs text-muted-foreground py-0.5">-</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Productivity Hour Entries */}
          <div className="space-y-3">
            {productivityHours.map((hour, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-3 border rounded-lg bg-card"
              >
                <Select
                  value={hour.dayOfWeek.toString()}
                  onValueChange={(v) =>
                    handleUpdateProductivityHour(index, { dayOfWeek: parseInt(v) })
                  }
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day.value} value={day.value.toString()}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={hour.startHour.toString()}
                  onValueChange={(v) =>
                    handleUpdateProductivityHour(index, { startHour: parseInt(v) })
                  }
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => (
                      <SelectItem key={h.value} value={h.value.toString()}>
                        {h.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <span className="text-muted-foreground">to</span>

                <Select
                  value={hour.endHour.toString()}
                  onValueChange={(v) =>
                    handleUpdateProductivityHour(index, { endHour: parseInt(v) })
                  }
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.filter((h) => h.value > hour.startHour).map((h) => (
                      <SelectItem key={h.value} value={h.value.toString()}>
                        {h.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={hour.energyLevel}
                  onValueChange={(v) =>
                    handleUpdateProductivityHour(index, {
                      energyLevel: v as 'high' | 'medium' | 'low',
                    })
                  }
                >
                  <SelectTrigger className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENERGY_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        <div className="flex items-center gap-2">
                          <div className={cn('w-2 h-2 rounded-full', level.color)} />
                          {level.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => handleRemoveProductivityHour(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button
              variant="outline"
              className="w-full"
              onClick={handleAddProductivityHour}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Time Block
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Break Preferences Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coffee className="h-5 w-5" />
            Break Preferences
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure your break schedule based on the Pomodoro technique.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="shortBreak">Short Break (minutes)</Label>
              <Input
                id="shortBreak"
                type="number"
                min="1"
                max="30"
                value={breakPrefs.shortBreakDuration}
                onChange={(e) =>
                  handleUpdateBreakPrefs({
                    shortBreakDuration: parseInt(e.target.value) || 5,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Between study sessions
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="longBreak">Long Break (minutes)</Label>
              <Input
                id="longBreak"
                type="number"
                min="5"
                max="60"
                value={breakPrefs.longBreakDuration}
                onChange={(e) =>
                  handleUpdateBreakPrefs({
                    longBreakDuration: parseInt(e.target.value) || 15,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                After multiple sessions
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sessionsBeforeLong">Sessions Before Long Break</Label>
              <Input
                id="sessionsBeforeLong"
                type="number"
                min="2"
                max="8"
                value={breakPrefs.sessionsBeforeLongBreak}
                onChange={(e) =>
                  handleUpdateBreakPrefs({
                    sessionsBeforeLongBreak: parseInt(e.target.value) || 4,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Number of sessions
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!hasChanges || saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Preferences
        </Button>
      </div>
    </div>
  )
}
