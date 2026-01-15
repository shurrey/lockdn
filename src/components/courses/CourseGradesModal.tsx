import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { GradeInput } from '@/components/assignments/GradeInput'
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  HelpCircle,
  GraduationCap,
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  calculateWeightedGrade,
  getLetterGrade,
  getGradeColor,
  getGradeBgColor,
  type GradeBreakdownItem,
} from '@/lib/gradeCalculator'
import { useAssignments, updateAssignmentGrade } from '@/db/hooks'
import { toast } from 'sonner'
import type { Course } from '@/types'

interface CourseGradesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  course: Course
}

const ASSIGNMENT_TYPE_LABELS: Record<string, string> = {
  homework: 'HW',
  quiz: 'Quiz',
  exam: 'Exam',
  paper: 'Paper',
  project: 'Project',
  other: 'Other',
}

function AssignmentRow({
  item,
  showContribution,
}: {
  item: GradeBreakdownItem
  showContribution: boolean
}) {
  const [isSaving, setIsSaving] = useState(false)
  const assignment = item.assignment
  const isOverdue = item.effectiveGrade === 0 && item.contribution === 0
  const isPending = item.effectiveGrade === null

  const handleGradeChange = async (grade: number | undefined) => {
    setIsSaving(true)
    try {
      await updateAssignmentGrade(assignment.id, grade)
      toast.success('Grade updated')
    } catch (error) {
      toast.error('Failed to update grade')
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border',
        isOverdue && 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900',
        isPending && 'bg-muted/50'
      )}
    >
      {/* Status icon */}
      <div className="flex-shrink-0">
        {item.effectiveGrade !== null && item.effectiveGrade > 0 ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : isOverdue ? (
          <AlertTriangle className="h-5 w-5 text-red-500" />
        ) : (
          <Clock className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      {/* Assignment info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{assignment.title}</span>
          <Badge variant="outline" className="text-xs flex-shrink-0">
            {ASSIGNMENT_TYPE_LABELS[assignment.type] || assignment.type}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{format(new Date(assignment.dueDate), 'MMM d, yyyy')}</span>
          {isOverdue && <span className="text-red-500 font-medium">Overdue - counted as 0%</span>}
          {isPending && <span>Not yet due</span>}
        </div>
      </div>

      {/* Weight */}
      <div className="text-right flex-shrink-0 w-16">
        {assignment.weight !== undefined ? (
          <span className="text-sm font-medium">{assignment.weight}%</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </div>

      {/* Grade input */}
      <div className="flex-shrink-0 w-28">
        <GradeInput
          value={assignment.grade}
          onChange={handleGradeChange}
          disabled={isSaving}
          className="[&>div>div]:pr-6"
        />
      </div>

      {/* Contribution */}
      {showContribution && (
        <div className="text-right flex-shrink-0 w-20">
          {item.contribution !== null ? (
            <span
              className={cn(
                'text-sm font-medium',
                item.contribution > 0 ? getGradeColor(item.effectiveGrade!) : 'text-red-500'
              )}
            >
              +{item.contribution.toFixed(1)} pts
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
      )}
    </div>
  )
}

function GradeBreakdownBar({
  graded,
  pastDueZero,
  pending,
  totalWeight,
}: {
  graded: GradeBreakdownItem[]
  pastDueZero: GradeBreakdownItem[]
  pending: GradeBreakdownItem[]
  totalWeight: number
}) {
  const maxWeight = totalWeight + pending.reduce((sum, i) => sum + (i.assignment.weight || 0), 0)

  if (maxWeight === 0) return null

  return (
    <TooltipProvider>
      <div className="space-y-2">
        <div className="flex h-6 rounded-lg overflow-hidden bg-muted">
          {/* Graded segments */}
          {graded.map((item) => {
            const width = ((item.assignment.weight || 0) / maxWeight) * 100
            return (
              <Tooltip key={item.assignment.id}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'h-full transition-all cursor-pointer hover:opacity-80',
                      getGradeBgColor(item.effectiveGrade || 0)
                    )}
                    style={{ width: `${width}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{item.assignment.title}</p>
                  <p className="text-xs">
                    {item.assignment.weight}% weight | {item.effectiveGrade}% grade |{' '}
                    +{item.contribution?.toFixed(1)} pts
                  </p>
                </TooltipContent>
              </Tooltip>
            )
          })}

          {/* Past due zero segments */}
          {pastDueZero.map((item) => {
            const width = ((item.assignment.weight || 0) / maxWeight) * 100
            return (
              <Tooltip key={item.assignment.id}>
                <TooltipTrigger asChild>
                  <div
                    className="h-full bg-red-500 transition-all cursor-pointer hover:opacity-80"
                    style={{ width: `${width}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{item.assignment.title}</p>
                  <p className="text-xs text-red-500">
                    Overdue - counted as 0% | {item.assignment.weight}% weight
                  </p>
                </TooltipContent>
              </Tooltip>
            )
          })}

          {/* Pending segments */}
          {pending.map((item) => {
            const width = ((item.assignment.weight || 0) / maxWeight) * 100
            return (
              <Tooltip key={item.assignment.id}>
                <TooltipTrigger asChild>
                  <div
                    className="h-full bg-muted-foreground/20 transition-all cursor-pointer hover:opacity-80"
                    style={{
                      width: `${width}%`,
                      backgroundImage:
                        'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.1) 4px, rgba(0,0,0,0.1) 8px)',
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{item.assignment.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Pending | {item.assignment.weight}% weight | Due{' '}
                    {format(new Date(item.assignment.dueDate), 'MMM d')}
                  </p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs">
          {graded.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span className="text-muted-foreground">Graded</span>
            </div>
          )}
          {pastDueZero.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span className="text-muted-foreground">Overdue (0%)</span>
            </div>
          )}
          {pending.length > 0 && (
            <div className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded bg-muted-foreground/20"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
                }}
              />
              <span className="text-muted-foreground">Pending</span>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

export function CourseGradesModal({ open, onOpenChange, course }: CourseGradesModalProps) {
  const assignments = useAssignments(course.id)

  const result = useMemo(() => {
    if (!assignments) return null
    return calculateWeightedGrade(assignments)
  }, [assignments])

  if (!result) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Loading...</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }

  const { weightedGrade, totalWeight, maxPossibleWeight, breakdown } = result
  const hasNoWeightItems = breakdown.noWeight.length > 0
  const weightSum = maxPossibleWeight
  const hasIncompleteWeights = weightSum > 0 && weightSum !== 100

  // All items with weights (for the breakdown bar)
  const weightedItems = [
    ...breakdown.graded,
    ...breakdown.pastDueZero,
    ...breakdown.pending,
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div
              className="h-4 w-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: course.color }}
            />
            <DialogTitle>{course.code} - Grades</DialogTitle>
          </div>
          <DialogDescription>{course.name}</DialogDescription>
        </DialogHeader>

        {/* Grade Summary */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">
                {result.isEqualWeight ? 'Average Grade' : 'Weighted Grade'}
                {result.isEqualWeight && (
                  <span className="ml-1 text-xs">(equal weight)</span>
                )}
              </p>
              {weightedGrade !== null ? (
                <div className="flex items-baseline gap-2">
                  <span className={cn('text-3xl font-bold', getGradeColor(weightedGrade))}>
                    {weightedGrade.toFixed(1)}%
                  </span>
                  <span className={cn('text-xl font-semibold', getGradeColor(weightedGrade))}>
                    {getLetterGrade(weightedGrade)}
                  </span>
                </div>
              ) : (
                <span className="text-2xl font-bold text-muted-foreground">—</span>
              )}
            </div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>
              {result.isEqualWeight
                ? `${breakdown.graded.length + breakdown.pastDueZero.length} of ${weightedItems.length} graded`
                : `${totalWeight.toFixed(0)}% of grade calculated`}
            </p>
            <p>
              {breakdown.graded.length + breakdown.pastDueZero.length} of{' '}
              {weightedItems.length} assignments
            </p>
          </div>
        </div>

        {/* Warnings */}
        {hasIncompleteWeights && (
          <Alert>
            <HelpCircle className="h-4 w-4" />
            <AlertDescription>
              Assignment weights sum to {weightSum.toFixed(0)}%
              {weightSum < 100
                ? ` — ${(100 - weightSum).toFixed(0)}% of your grade is not yet tracked`
                : ` — exceeds 100%`}
            </AlertDescription>
          </Alert>
        )}

        {hasNoWeightItems && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {breakdown.noWeight.length} assignment{breakdown.noWeight.length !== 1 ? 's' : ''}{' '}
              missing weight — not included in grade calculation
            </AlertDescription>
          </Alert>
        )}

        {/* Grade Breakdown Bar */}
        {weightedItems.length > 0 && (
          <GradeBreakdownBar
            graded={breakdown.graded}
            pastDueZero={breakdown.pastDueZero}
            pending={breakdown.pending}
            totalWeight={totalWeight}
          />
        )}

        {/* Assignment List */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-4">
            {/* Graded */}
            {breakdown.graded.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Graded ({breakdown.graded.length})
                </h3>
                <div className="space-y-2">
                  {breakdown.graded
                    .sort(
                      (a, b) =>
                        new Date(a.assignment.dueDate).getTime() -
                        new Date(b.assignment.dueDate).getTime()
                    )
                    .map((item) => (
                      <AssignmentRow key={item.assignment.id} item={item} showContribution />
                    ))}
                </div>
              </div>
            )}

            {/* Past Due */}
            {breakdown.pastDueZero.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Overdue - Counted as 0% ({breakdown.pastDueZero.length})
                </h3>
                <div className="space-y-2">
                  {breakdown.pastDueZero
                    .sort(
                      (a, b) =>
                        new Date(a.assignment.dueDate).getTime() -
                        new Date(b.assignment.dueDate).getTime()
                    )
                    .map((item) => (
                      <AssignmentRow key={item.assignment.id} item={item} showContribution />
                    ))}
                </div>
              </div>
            )}

            {/* Pending */}
            {breakdown.pending.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Pending - Not Yet Counted ({breakdown.pending.length})
                </h3>
                <div className="space-y-2">
                  {breakdown.pending
                    .sort(
                      (a, b) =>
                        new Date(a.assignment.dueDate).getTime() -
                        new Date(b.assignment.dueDate).getTime()
                    )
                    .map((item) => (
                      <AssignmentRow
                        key={item.assignment.id}
                        item={item}
                        showContribution={false}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* No Weight */}
            {breakdown.noWeight.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                  <HelpCircle className="h-4 w-4" />
                  No Weight Defined - Excluded ({breakdown.noWeight.length})
                </h3>
                <div className="space-y-2">
                  {breakdown.noWeight.map((item) => (
                    <AssignmentRow
                      key={item.assignment.id}
                      item={item}
                      showContribution={false}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {assignments?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No assignments for this course yet</p>
                <p className="text-sm">Add assignments to track your grades</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
