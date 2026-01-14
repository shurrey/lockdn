import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen } from 'lucide-react'
import type { Course } from '@/types'

interface CourseBreakdownChartProps {
  studyTimeByCourse: Map<string, number> | undefined
  courses: Course[] | undefined
}

export function CourseBreakdownChart({ studyTimeByCourse, courses }: CourseBreakdownChartProps) {
  const chartData = useMemo(() => {
    if (!studyTimeByCourse || !courses) return []

    const courseMap = new Map(courses.map((c) => [c.id, c]))
    const data: { name: string; value: number; color: string; hours: number }[] = []

    studyTimeByCourse.forEach((minutes, courseId) => {
      const course = courseMap.get(courseId)
      if (course && minutes > 0) {
        data.push({
          name: course.code || course.name,
          value: minutes,
          color: course.color || '#888888',
          hours: Math.round((minutes / 60) * 10) / 10,
        })
      }
    })

    // Sort by value descending
    return data.sort((a, b) => b.value - a.value)
  }, [studyTimeByCourse, courses])

  const totalHours = useMemo(() => {
    const total = chartData.reduce((sum, d) => sum + d.hours, 0)
    return Math.round(total * 10) / 10
  }, [chartData])

  const hasData = chartData.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Study by Course
        </CardTitle>
        <CardDescription>
          {hasData ? `${totalHours} hours across ${chartData.length} course${chartData.length !== 1 ? 's' : ''}` : 'Time distribution by course'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      const percentage = Math.round((data.value / chartData.reduce((s, d) => s + d.value, 0)) * 100)
                      return (
                        <div className="bg-popover border rounded-lg p-2 shadow-lg">
                          <p className="text-sm font-medium">{data.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {data.hours} hours ({percentage}%)
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  formatter={(value) => <span className="text-sm">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No study time recorded yet</p>
              <p className="text-xs">Complete sessions to see course breakdown</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
