import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'
import type { DailySummary } from '@/types'

interface StudyTimeChartProps {
  dailySummaries: DailySummary[] | undefined
  days: number
}

export function StudyTimeChart({ dailySummaries, days }: StudyTimeChartProps) {
  const chartData = useMemo(() => {
    if (!dailySummaries) return []

    // Create a map of existing data
    const dataMap = new Map(dailySummaries.map((d) => [d.date, d.totalStudyMinutes]))

    // Generate all dates for the range
    const result = []
    const today = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const minutes = dataMap.get(dateStr) || 0

      result.push({
        date: dateStr,
        displayDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        minutes,
        hours: Math.round((minutes / 60) * 10) / 10,
      })
    }

    return result
  }, [dailySummaries, days])

  const totalHours = useMemo(() => {
    const totalMinutes = chartData.reduce((sum, d) => sum + d.minutes, 0)
    return Math.round((totalMinutes / 60) * 10) / 10
  }, [chartData])

  const avgHoursPerDay = useMemo(() => {
    if (chartData.length === 0) return 0
    return Math.round((totalHours / chartData.length) * 10) / 10
  }, [totalHours, chartData.length])

  const hasData = chartData.some((d) => d.minutes > 0)

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Study Time Trend
        </CardTitle>
        <CardDescription>
          {hasData ? (
            <>
              {totalHours} hours total ({avgHoursPerDay} hrs/day avg) over the last {days} days
            </>
          ) : (
            <>Last {days} days of study activity</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="studyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}h`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="bg-popover border rounded-lg p-2 shadow-lg">
                          <p className="text-sm font-medium">{data.displayDate}</p>
                          <p className="text-sm text-muted-foreground">
                            {data.hours} hours ({data.minutes} min)
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="hours"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  fill="url(#studyGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No study sessions recorded yet</p>
              <p className="text-sm">Start a study session to see your progress</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
