import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GraduationCap, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { ExamAttempt } from '@/types'

interface ExamPerformanceChartProps {
  examAttempts: ExamAttempt[] | undefined
}

export function ExamPerformanceChart({ examAttempts }: ExamPerformanceChartProps) {
  const chartData = useMemo(() => {
    if (!examAttempts || examAttempts.length === 0) return []

    return examAttempts
      .map((attempt) => ({
        date: new Date(attempt.completedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        percentage: attempt.percentage,
        score: attempt.score,
        total: attempt.totalQuestions,
        attempt: attempt.attemptNumber,
      }))
      .slice(-20) // Show last 20 attempts
  }, [examAttempts])

  const trend = useMemo(() => {
    if (chartData.length < 2) return { direction: 'neutral' as const, change: 0 }

    const firstHalf = chartData.slice(0, Math.floor(chartData.length / 2))
    const secondHalf = chartData.slice(Math.floor(chartData.length / 2))

    const firstAvg = firstHalf.reduce((sum, d) => sum + d.percentage, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((sum, d) => sum + d.percentage, 0) / secondHalf.length

    const change = Math.round(secondAvg - firstAvg)

    return {
      direction: change > 2 ? ('up' as const) : change < -2 ? ('down' as const) : ('neutral' as const),
      change: Math.abs(change),
    }
  }, [chartData])

  const averageScore = useMemo(() => {
    if (chartData.length === 0) return 0
    return Math.round(chartData.reduce((sum, d) => sum + d.percentage, 0) / chartData.length)
  }, [chartData])

  const hasData = chartData.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          Practice Exam Scores
        </CardTitle>
        <CardDescription>
          {hasData ? (
            <span className="flex items-center gap-1">
              {averageScore}% average
              {trend.direction === 'up' && (
                <>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-green-500">+{trend.change}% trend</span>
                </>
              )}
              {trend.direction === 'down' && (
                <>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="text-red-500">-{trend.change}% trend</span>
                </>
              )}
              {trend.direction === 'neutral' && (
                <>
                  <Minus className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">steady</span>
                </>
              )}
            </span>
          ) : (
            'Track your practice exam performance'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}%`}
                />
                <ReferenceLine y={70} stroke="var(--color-muted-foreground)" strokeDasharray="3 3" opacity={0.5} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="bg-popover border rounded-lg p-2 shadow-lg">
                          <p className="text-sm font-medium">{data.date}</p>
                          <p className="text-sm text-muted-foreground">
                            Score: {data.score}/{data.total} ({data.percentage}%)
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="percentage"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--color-chart-2)', strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <GraduationCap className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No practice exams taken yet</p>
              <p className="text-xs">Complete practice exams to track your progress</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
