import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock } from 'lucide-react'

interface ProductivityHeatmapProps {
  heatmapData: number[][] | undefined
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function ProductivityHeatmap({ heatmapData }: ProductivityHeatmapProps) {
  const { normalizedData, maxValue, bestTimes } = useMemo(() => {
    if (!heatmapData) {
      return { normalizedData: null, maxValue: 0, bestTimes: [] }
    }

    // Find max value for normalization
    let max = 0
    for (const day of heatmapData) {
      for (const hour of day) {
        if (hour > max) max = hour
      }
    }

    // Find top 3 best times
    const times: { day: number; hour: number; value: number }[] = []
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (heatmapData[d][h] > 0) {
          times.push({ day: d, hour: h, value: heatmapData[d][h] })
        }
      }
    }
    times.sort((a, b) => b.value - a.value)
    const top3 = times.slice(0, 3)

    return { normalizedData: heatmapData, maxValue: max, bestTimes: top3 }
  }, [heatmapData])

  const hasData = normalizedData && maxValue > 0

  const formatHour = (hour: number) => {
    if (hour === 0) return '12a'
    if (hour === 12) return '12p'
    if (hour < 12) return `${hour}a`
    return `${hour - 12}p`
  }

  const formatBestTime = (day: number, hour: number) => {
    const endHour = (hour + 1) % 24
    return `${DAYS[day]} ${formatHour(hour)}-${formatHour(endHour)}`
  }

  const getIntensity = (value: number) => {
    if (value === 0 || maxValue === 0) return 0
    return Math.ceil((value / maxValue) * 4) // 1-4 intensity levels
  }

  return (
    <Card className="col-span-1 md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Productivity Patterns
        </CardTitle>
        <CardDescription>
          {hasData && bestTimes.length > 0 ? (
            <>Best times: {bestTimes.map((t) => formatBestTime(t.day, t.hour)).join(', ')}</>
          ) : (
            'When you study most effectively'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="space-y-2">
            {/* Hour labels */}
            <div className="flex">
              <div className="w-10" /> {/* Spacer for day labels */}
              <div className="flex-1 flex justify-between text-xs text-muted-foreground px-1">
                {[0, 6, 12, 18, 23].map((h) => (
                  <span key={h} className="w-6 text-center">
                    {formatHour(h)}
                  </span>
                ))}
              </div>
            </div>

            {/* Heatmap grid */}
            <div className="space-y-1">
              {DAYS.map((day, dayIndex) => (
                <div key={day} className="flex items-center">
                  <div className="w-10 text-xs text-muted-foreground">{day}</div>
                  <div className="flex-1 flex gap-[2px]">
                    {HOURS.map((hour) => {
                      const value = normalizedData[dayIndex][hour]
                      const intensity = getIntensity(value)
                      return (
                        <div
                          key={hour}
                          className={`flex-1 h-5 rounded-sm transition-colors ${getIntensityClass(intensity)}`}
                          title={`${day} ${formatHour(hour)}: ${Math.round(value)} min`}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <span className="text-xs text-muted-foreground">Less</span>
              <div className="flex gap-[2px]">
                {[0, 1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`w-3 h-3 rounded-sm ${getIntensityClass(level)}`}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">More</span>
            </div>
          </div>
        ) : (
          <div className="h-[180px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Clock className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No study patterns recorded yet</p>
              <p className="text-xs">Complete sessions to discover your best study times</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getIntensityClass(level: number): string {
  switch (level) {
    case 0:
      return 'bg-muted'
    case 1:
      return 'bg-primary/20'
    case 2:
      return 'bg-primary/40'
    case 3:
      return 'bg-primary/60'
    case 4:
      return 'bg-primary/80'
    default:
      return 'bg-muted'
  }
}
