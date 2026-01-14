import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowUp, ArrowDown, Minus, Calendar } from 'lucide-react'
import type { DailySummary } from '@/types'

interface WeeklyComparisonCardProps {
  dailySummaries: DailySummary[] | undefined
}

interface WeekStats {
  totalMinutes: number
  sessionCount: number
  tasksCompleted: number
}

export function WeeklyComparisonCard({ dailySummaries }: WeeklyComparisonCardProps) {
  const { thisWeek, lastWeek } = useMemo(() => {
    if (!dailySummaries) {
      return {
        thisWeek: { totalMinutes: 0, sessionCount: 0, tasksCompleted: 0 },
        lastWeek: { totalMinutes: 0, sessionCount: 0, tasksCompleted: 0 },
      }
    }

    const today = new Date()
    const startOfThisWeek = new Date(today)
    startOfThisWeek.setDate(today.getDate() - today.getDay())
    startOfThisWeek.setHours(0, 0, 0, 0)

    const startOfLastWeek = new Date(startOfThisWeek)
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7)

    const thisWeekData: WeekStats = { totalMinutes: 0, sessionCount: 0, tasksCompleted: 0 }
    const lastWeekData: WeekStats = { totalMinutes: 0, sessionCount: 0, tasksCompleted: 0 }

    for (const summary of dailySummaries) {
      const date = new Date(summary.date)
      if (date >= startOfThisWeek) {
        thisWeekData.totalMinutes += summary.totalStudyMinutes
        thisWeekData.sessionCount += summary.sessionCount
        thisWeekData.tasksCompleted += summary.tasksCompleted
      } else if (date >= startOfLastWeek && date < startOfThisWeek) {
        lastWeekData.totalMinutes += summary.totalStudyMinutes
        lastWeekData.sessionCount += summary.sessionCount
        lastWeekData.tasksCompleted += summary.tasksCompleted
      }
    }

    return { thisWeek: thisWeekData, lastWeek: lastWeekData }
  }, [dailySummaries])

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}m`
  }

  const getChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  const timeChange = getChange(thisWeek.totalMinutes, lastWeek.totalMinutes)
  const sessionChange = getChange(thisWeek.sessionCount, lastWeek.sessionCount)
  const taskChange = getChange(thisWeek.tasksCompleted, lastWeek.tasksCompleted)

  const hasData = thisWeek.totalMinutes > 0 || lastWeek.totalMinutes > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          This Week
        </CardTitle>
        <CardDescription>Compared to last week</CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="space-y-4">
            <ComparisonRow
              label="Study Time"
              value={formatDuration(thisWeek.totalMinutes)}
              change={timeChange}
              previousValue={formatDuration(lastWeek.totalMinutes)}
            />
            <ComparisonRow
              label="Sessions"
              value={thisWeek.sessionCount.toString()}
              change={sessionChange}
              previousValue={lastWeek.sessionCount.toString()}
            />
            <ComparisonRow
              label="Tasks Done"
              value={thisWeek.tasksCompleted.toString()}
              change={taskChange}
              previousValue={lastWeek.tasksCompleted.toString()}
            />
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No activity recorded yet</p>
            <p className="text-xs">Complete study sessions to see weekly stats</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface ComparisonRowProps {
  label: string
  value: string
  change: number
  previousValue: string
}

function ComparisonRow({ label, value, change, previousValue }: ComparisonRowProps) {
  const isPositive = change > 0
  const isNegative = change < 0
  const isNeutral = change === 0

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
      <div className="text-right">
        <div className="flex items-center gap-1">
          {isPositive && <ArrowUp className="h-4 w-4 text-green-500" />}
          {isNegative && <ArrowDown className="h-4 w-4 text-red-500" />}
          {isNeutral && <Minus className="h-4 w-4 text-muted-foreground" />}
          <span
            className={`text-sm font-medium ${
              isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-muted-foreground'
            }`}
          >
            {isNeutral ? '0%' : `${isPositive ? '+' : ''}${change}%`}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">vs {previousValue}</p>
      </div>
    </div>
  )
}
