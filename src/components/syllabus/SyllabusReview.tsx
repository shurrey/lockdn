import { useState, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import {
  Check,
  Edit2,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Minus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  type SyllabusParseResult,
  type ParsedAssignment,
  type ParsedCourse,
  getConfidenceColor,
  getConfidenceLabel,
} from '@/lib/syllabusParser'
import {
  computeAssignmentDiff,
  type AssignmentDiffSummary,
} from '@/lib/diffUtils'
import type { AssignmentType, Assignment } from '@/types'

interface SyllabusReviewProps {
  result: SyllabusParseResult
  onComplete: (result: SyllabusParseResult) => void
  onBack: () => void
  existingAssignments?: Assignment[]
}

const ASSIGNMENT_TYPES: { value: AssignmentType; label: string }[] = [
  { value: 'exam', label: 'Exam' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'homework', label: 'Homework' },
  { value: 'paper', label: 'Paper' },
  { value: 'project', label: 'Project' },
  { value: 'other', label: 'Other' },
]

export function SyllabusReview({ result, onComplete, onBack, existingAssignments }: SyllabusReviewProps) {
  const [course, setCourse] = useState<ParsedCourse>(result.course)
  const [assignments, setAssignments] = useState<ParsedAssignment[]>(result.assignments)
  const [editingCourse, setEditingCourse] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<number | null>(null)
  const [expandedAssignments, setExpandedAssignments] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)

  // Compute assignment diff if we have existing assignments
  const assignmentDiff = useMemo((): AssignmentDiffSummary | null => {
    if (!existingAssignments || existingAssignments.length === 0) {
      return null
    }
    return computeAssignmentDiff(assignments, existingAssignments)
  }, [assignments, existingAssignments])

  // Get diff item for a specific assignment index
  const getDiffForAssignment = useCallback((index: number) => {
    if (!assignmentDiff) return null
    const assignment = assignments[index]
    if (!assignment) return null
    return assignmentDiff.items.find(item =>
      item.newAssignment?.title === assignment.title &&
      item.newAssignment?.dueDate === assignment.dueDate
    )
  }, [assignmentDiff, assignments])

  const handleUpdateCourse = useCallback((updates: Partial<ParsedCourse>) => {
    setCourse((prev) => ({ ...prev, ...updates }))
  }, [])

  const handleUpdateAssignment = useCallback(
    (index: number, updates: Partial<ParsedAssignment>) => {
      setAssignments((prev) =>
        prev.map((a, i) => (i === index ? { ...a, ...updates } : a))
      )
    },
    []
  )

  const handleRemoveAssignment = useCallback((index: number) => {
    setAssignments((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleAddAssignment = useCallback((assignment: ParsedAssignment) => {
    setAssignments((prev) => [...prev, assignment])
    setShowAddDialog(false)
  }, [])

  const handleComplete = useCallback(() => {
    onComplete({
      course,
      assignments,
      rawResponse: result.rawResponse,
    })
  }, [course, assignments, result.rawResponse, onComplete])

  const lowConfidenceCount = assignments.filter((a) => a.confidence < 0.7).length

  return (
    <div className="space-y-6">
      {/* Course Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Course Information</CardTitle>
              <CardDescription>Review and edit course details</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingCourse(!editingCourse)}
            >
              <Edit2 className="h-4 w-4 mr-1" />
              {editingCourse ? 'Done' : 'Edit'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {editingCourse ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="courseName">Course Name</Label>
                <Input
                  id="courseName"
                  value={course.name}
                  onChange={(e) => handleUpdateCourse({ name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="courseCode">Course Code</Label>
                <Input
                  id="courseCode"
                  value={course.code}
                  onChange={(e) => handleUpdateCourse({ code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instructor">Instructor</Label>
                <Input
                  id="instructor"
                  value={course.instructor || ''}
                  onChange={(e) => handleUpdateCourse({ instructor: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{course.code}</span>
                <span className="text-muted-foreground">-</span>
                <span>{course.name}</span>
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    getConfidenceColor(course.confidence)
                  )}
                >
                  {getConfidenceLabel(course.confidence)} confidence
                </span>
              </div>
              {course.instructor && (
                <p className="text-sm text-muted-foreground">
                  Instructor: {course.instructor}
                </p>
              )}
              {course.description && (
                <p className="text-sm text-muted-foreground">{course.description}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Assignments & Deadlines
                <span className="text-sm font-normal text-muted-foreground">
                  ({assignments.length} items)
                </span>
              </CardTitle>
              {/* Diff summary for re-uploads */}
              {assignmentDiff && (assignmentDiff.modified > 0 || assignmentDiff.removed > 0) ? (
                <CardDescription className="flex items-center gap-3 mt-1 flex-wrap">
                  {assignmentDiff.added > 0 && (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <Plus className="h-3.5 w-3.5" />
                      {assignmentDiff.added} new
                    </span>
                  )}
                  {assignmentDiff.modified > 0 && (
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                      <RefreshCw className="h-3.5 w-3.5" />
                      {assignmentDiff.modified} changed
                    </span>
                  )}
                  {assignmentDiff.unchanged > 0 && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Check className="h-3.5 w-3.5" />
                      {assignmentDiff.unchanged} unchanged
                    </span>
                  )}
                  {assignmentDiff.removed > 0 && (
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                      <Minus className="h-3.5 w-3.5" />
                      {assignmentDiff.removed} removed
                    </span>
                  )}
                </CardDescription>
              ) : lowConfidenceCount > 0 ? (
                <CardDescription className="flex items-center gap-1 text-yellow-600">
                  <AlertTriangle className="h-4 w-4" />
                  {lowConfidenceCount} item{lowConfidenceCount !== 1 ? 's' : ''} may need
                  review
                </CardDescription>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedAssignments(!expandedAssignments)}
              >
                {expandedAssignments ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        {expandedAssignments && (
          <CardContent>
            {assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No assignments found. Click "Add" to manually add assignments.
              </p>
            ) : (
              <div className="space-y-3">
                {assignments.map((assignment, index) => (
                  <AssignmentRow
                    key={index}
                    assignment={assignment}
                    isEditing={editingAssignment === index}
                    onEdit={() =>
                      setEditingAssignment(editingAssignment === index ? null : index)
                    }
                    onUpdate={(updates) => handleUpdateAssignment(index, updates)}
                    onRemove={() => handleRemoveAssignment(index)}
                    diffItem={getDiffForAssignment(index)}
                  />
                ))}

                {/* Show removed assignments */}
                {assignmentDiff && assignmentDiff.removed > 0 && (
                  <>
                    <div className="border-t my-3 pt-3">
                      <p className="text-xs text-muted-foreground mb-2">
                        Not in new syllabus (will be removed):
                      </p>
                    </div>
                    {assignmentDiff.items
                      .filter(item => item.status === 'removed')
                      .map((item, idx) => (
                        <div
                          key={`removed-${idx}`}
                          className="flex items-center gap-3 p-3 border rounded-lg bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900 opacity-75"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2 flex-wrap">
                              <span className="font-medium break-words line-through text-red-600 dark:text-red-400">
                                {item.existingAssignment?.title}
                              </span>
                              <Badge variant="outline" className="text-xs border-red-300 text-red-600 dark:text-red-400">
                                Removing
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm text-muted-foreground">
                                Due: {item.existingAssignment?.dueDate && format(new Date(item.existingAssignment.dueDate), 'MMM d, yyyy')}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </>
                )}
              </div>
            )}
          </CardContent>
        )}
        <CardFooter className="flex justify-between border-t pt-4">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={handleComplete}>
            <Check className="h-4 w-4 mr-2" />
            Confirm & Add to Calendar
          </Button>
        </CardFooter>
      </Card>

      {/* Add Assignment Dialog */}
      <AddAssignmentDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAdd={handleAddAssignment}
      />
    </div>
  )
}

interface AssignmentRowProps {
  assignment: ParsedAssignment
  isEditing: boolean
  onEdit: () => void
  onUpdate: (updates: Partial<ParsedAssignment>) => void
  onRemove: () => void
  diffItem?: { status: string; changes?: { field: string; oldValue: string; newValue: string }[] } | null
}

function AssignmentRow({
  assignment,
  isEditing,
  onEdit,
  onUpdate,
  onRemove,
  diffItem,
}: AssignmentRowProps) {
  if (isEditing) {
    return (
      <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input
              value={assignment.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3"
              value={assignment.type}
              onChange={(e) => onUpdate({ type: e.target.value as AssignmentType })}
            >
              {ASSIGNMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Due Date</Label>
            <Input
              type="date"
              value={assignment.dueDate}
              onChange={(e) => onUpdate({ dueDate: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Weight (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={assignment.weight || ''}
              onChange={(e) =>
                onUpdate({ weight: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={onEdit}>
            Done
          </Button>
        </div>
      </div>
    )
  }

  // Determine styling based on diff status
  const getDiffStyling = () => {
    if (!diffItem) return ''
    switch (diffItem.status) {
      case 'added':
        return 'border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900'
      case 'modified':
        return 'border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900'
      case 'unchanged':
        return 'border-muted bg-muted/20'
      default:
        return ''
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 border rounded-lg',
        assignment.confidence < 0.7 && !diffItem && 'border-yellow-300 bg-yellow-50/50',
        getDiffStyling()
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span className="font-medium break-words">{assignment.title}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
            {assignment.type}
          </span>
          {assignment.weight && (
            <span className="text-xs text-muted-foreground">{assignment.weight}%</span>
          )}
          {/* Diff badge */}
          {diffItem && (
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                diffItem.status === 'added' && 'border-green-300 text-green-600 dark:text-green-400',
                diffItem.status === 'modified' && 'border-blue-300 text-blue-600 dark:text-blue-400',
                diffItem.status === 'unchanged' && 'text-muted-foreground'
              )}
            >
              {diffItem.status === 'added' && 'New'}
              {diffItem.status === 'modified' && 'Changed'}
              {diffItem.status === 'unchanged' && 'Unchanged'}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm text-muted-foreground">
            Due: {format(new Date(assignment.dueDate), 'MMM d, yyyy')}
          </span>
          {!diffItem && (
            <span
              className={cn('text-xs', getConfidenceColor(assignment.confidence))}
            >
              {getConfidenceLabel(assignment.confidence)}
            </span>
          )}
        </div>
        {/* Show changes for modified assignments */}
        {diffItem?.status === 'modified' && diffItem.changes && diffItem.changes.length > 0 && (
          <div className="mt-2 space-y-0.5">
            {diffItem.changes.map((change, idx) => (
              <div key={idx} className="flex items-center gap-1 text-xs">
                <span className="text-muted-foreground">{change.field}:</span>
                <span className="text-red-500 line-through">{change.oldValue}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-green-600 dark:text-green-400">{change.newValue}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

interface AddAssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (assignment: ParsedAssignment) => void
}

function AddAssignmentDialog({ open, onOpenChange, onAdd }: AddAssignmentDialogProps) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<AssignmentType>('homework')
  const [dueDate, setDueDate] = useState('')
  const [weight, setWeight] = useState('')

  const handleSubmit = () => {
    if (!title || !dueDate) return

    onAdd({
      title,
      type,
      dueDate,
      weight: weight ? Number(weight) : undefined,
      confidence: 1.0, // Manual entries are 100% confident
    })

    // Reset form
    setTitle('')
    setType('homework')
    setDueDate('')
    setWeight('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Assignment</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="addTitle">Title</Label>
            <Input
              id="addTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Midterm Exam"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="addType">Type</Label>
              <select
                id="addType"
                className="w-full h-9 rounded-md border border-input bg-background px-3"
                value={type}
                onChange={(e) => setType(e.target.value as AssignmentType)}
              >
                {ASSIGNMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="addWeight">Weight (%)</Label>
              <Input
                id="addWeight"
                type="number"
                min="0"
                max="100"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="addDueDate">Due Date</Label>
            <Input
              id="addDueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!title || !dueDate}>
            Add Assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
