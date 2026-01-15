import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GraduationCap, TrendingUp, TrendingDown, Minus, Clock, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Analytics, Course, CoursePerformance } from '@/types'

interface CoursePerformanceCardProps {
  analytics: Analytics | undefined
  courses: Course[] | undefined
}

function getGradeColor(grade: number): string {
  if (grade >= 90) return 'text-green-500'
  if (grade >= 80) return 'text-blue-500'
  if (grade >= 70) return 'text-yellow-500'
  if (grade >= 60) return 'text-orange-500'
  return 'text-red-500'
}

function getLetterGrade(grade: number): string {
  if (grade >= 97) return 'A+'
  if (grade >= 93) return 'A'
  if (grade >= 90) return 'A-'
  if (grade >= 87) return 'B+'
  if (grade >= 83) return 'B'
  if (grade >= 80) return 'B-'
  if (grade >= 77) return 'C+'
  if (grade >= 73) return 'C'
  if (grade >= 70) return 'C-'
  if (grade >= 67) return 'D+'
  if (grade >= 63) return 'D'
  if (grade >= 60) return 'D-'
  return 'F'
}

function TrendIcon({ trend }: { trend: CoursePerformance['trend'] }) {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="h-4 w-4 text-green-500" />
    case 'declining':
      return <TrendingDown className="h-4 w-4 text-red-500" />
    case 'stable':
      return <Minus className="h-4 w-4 text-muted-foreground" />
    default:
      return null
  }
}

function CoursePerformanceRow({
  performance,
  courseName,
  courseCode,
}: {
  performance: CoursePerformance
  courseName: string
  courseCode: string
}) {
  const gradeColor = getGradeColor(performance.averageGrade)
  const letterGrade = getLetterGrade(performance.averageGrade)

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{courseCode}</span>
          <TrendIcon trend={performance.trend} />
        </div>
        <span className="text-xs text-muted-foreground truncate block">{courseName}</span>
      </div>
      <div className="flex items-center gap-4">
        {/* On-time rate */}
        <div className="text-right hidden sm:block">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{Math.round(performance.onTimeRate)}% on-time</span>
          </div>
        </div>
        {/* Grade */}
        <div className="text-right min-w-[60px]">
          <span className={cn('text-lg font-bold', gradeColor)}>
            {Math.round(performance.averageGrade)}%
          </span>
          <span className={cn('text-xs ml-1', gradeColor)}>{letterGrade}</span>
        </div>
      </div>
    </div>
  )
}

export function CoursePerformanceCard({ analytics, courses }: CoursePerformanceCardProps) {
  const performances = analytics?.coursePerformance
    ? Object.values(analytics.coursePerformance).filter(p => p.assignmentCount > 0)
    : []

  // Sort by average grade (lowest first to highlight struggling courses)
  const sortedPerformances = [...performances].sort((a, b) => a.averageGrade - b.averageGrade)

  const hasData = sortedPerformances.length > 0

  // Calculate overall stats
  const overallAverage = hasData
    ? sortedPerformances.reduce((sum, p) => sum + p.averageGrade, 0) / sortedPerformances.length
    : 0
  const totalGraded = sortedPerformances.reduce((sum, p) => sum + p.assignmentCount, 0)
  const totalLate = sortedPerformances.reduce((sum, p) => sum + p.lateCount, 0)
  const totalCompleted = sortedPerformances.reduce((sum, p) => sum + p.completedCount, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          Course Grades
        </CardTitle>
        <CardDescription>
          {hasData
            ? `${totalGraded} graded assignment${totalGraded !== 1 ? 's' : ''} across ${sortedPerformances.length} course${sortedPerformances.length !== 1 ? 's' : ''}`
            : 'Track your grades across courses'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="space-y-4">
            {/* Overall stats */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Overall Average</span>
              </div>
              <span className={cn('text-xl font-bold', getGradeColor(overallAverage))}>
                {Math.round(overallAverage)}%
              </span>
            </div>

            {/* Completion stats */}
            <div className="flex gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{totalCompleted} completed</span>
              </div>
              {totalLate > 0 && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span>{totalLate} late</span>
                </div>
              )}
            </div>

            {/* Per-course breakdown */}
            <div className="divide-y">
              {sortedPerformances.map((performance) => {
                const course = courses?.find(c => c.id === performance.courseId)
                if (!course) return null
                return (
                  <CoursePerformanceRow
                    key={performance.courseId}
                    performance={performance}
                    courseName={course.name}
                    courseCode={course.code}
                  />
                )
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <GraduationCap className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No grades recorded yet</p>
            <p className="text-xs">Mark assignments complete and enter grades to track performance</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
