import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Circle, Clock } from 'lucide-react'
import type { Assignment } from '@/types'

interface CompletionRateCardProps {
  assignments: Assignment[] | undefined
}

export function CompletionRateCard({ assignments }: CompletionRateCardProps) {
  const stats = useMemo(() => {
    if (!assignments || assignments.length === 0) {
      return { completed: 0, pending: 0, inProgress: 0, total: 0, percentage: 0, onTimeRate: 0 }
    }

    let completed = 0
    let pending = 0
    let inProgress = 0
    let onTime = 0
    const now = new Date()

    for (const assignment of assignments) {
      if (assignment.status === 'completed') {
        completed++
        // Check if completed before due date (rough check)
        if (assignment.dueDate >= now || assignment.updatedAt <= assignment.dueDate) {
          onTime++
        }
      } else if (assignment.status === 'in_progress') {
        inProgress++
      } else {
        pending++
      }
    }

    const total = assignments.length
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
    const onTimeRate = completed > 0 ? Math.round((onTime / completed) * 100) : 0

    return { completed, pending, inProgress, total, percentage, onTimeRate }
  }, [assignments])

  const hasAssignments = stats.total > 0

  // Calculate the stroke dasharray for the progress ring
  const radius = 45
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (stats.percentage / 100) * circumference

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          Assignment Progress
        </CardTitle>
        <CardDescription>
          {hasAssignments
            ? `${stats.completed} of ${stats.total} completed`
            : 'Track your assignment completion'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasAssignments ? (
          <div className="flex items-center gap-6">
            {/* Progress Ring */}
            <div className="relative w-28 h-28 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke="var(--color-muted)"
                  strokeWidth="8"
                />
                {/* Progress circle */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke="var(--color-chart-2)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">{stats.percentage}%</span>
              </div>
            </div>

            {/* Stats breakdown */}
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  <span className="font-medium">{stats.completed}</span>{' '}
                  <span className="text-muted-foreground">completed</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">
                  <span className="font-medium">{stats.inProgress}</span>{' '}
                  <span className="text-muted-foreground">in progress</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Circle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-medium">{stats.pending}</span>{' '}
                  <span className="text-muted-foreground">pending</span>
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No assignments yet</p>
            <p className="text-xs">Add courses with assignments to track progress</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
