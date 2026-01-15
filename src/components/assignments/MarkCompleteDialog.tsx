import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { GradeInput } from './GradeInput'
import { markAssignmentComplete } from '@/db/hooks'
import { format, isPast } from 'date-fns'
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import type { Assignment } from '@/types'

interface MarkCompleteDialogProps {
  assignment: Assignment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: () => void
}

export function MarkCompleteDialog({
  assignment,
  open,
  onOpenChange,
  onComplete,
}: MarkCompleteDialogProps) {
  const [grade, setGrade] = useState<number | undefined>(undefined)
  const [wasLate, setWasLate] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset state when dialog opens with new assignment
  useEffect(() => {
    if (open && assignment) {
      setGrade(assignment.grade)
      // Auto-detect late status
      const isLate = isPast(new Date(assignment.dueDate))
      setWasLate(isLate)
    }
  }, [open, assignment])

  const handleSubmit = async () => {
    if (!assignment) return

    setIsSubmitting(true)
    try {
      await markAssignmentComplete(assignment.id, { wasLate, grade })
      toast.success('Assignment marked as complete')
      onOpenChange(false)
      onComplete?.()
    } catch (error) {
      console.error('Failed to mark assignment complete:', error)
      toast.error('Failed to mark assignment complete')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!assignment) return null

  const dueDate = new Date(assignment.dueDate)
  const isOverdue = isPast(dueDate)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Mark Assignment Complete
          </DialogTitle>
          <DialogDescription>
            Record completion and optionally add your grade
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Assignment Info */}
          <div className="space-y-2">
            <h4 className="font-medium">{assignment.title}</h4>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Due: {format(dueDate, 'PPP')}</span>
              {isOverdue && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Overdue
                </Badge>
              )}
            </div>
          </div>

          {/* Late Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="wasLate"
              checked={wasLate}
              onCheckedChange={(checked) => setWasLate(checked === true)}
            />
            <Label htmlFor="wasLate" className="text-sm">
              Submitted late
              {isOverdue && !wasLate && (
                <span className="text-muted-foreground ml-1">
                  (auto-detected as late)
                </span>
              )}
            </Label>
          </div>

          {/* Grade Input */}
          <div className="space-y-2">
            <Label>Grade (optional)</Label>
            <GradeInput value={grade} onChange={setGrade} />
            <p className="text-xs text-muted-foreground">
              You can add or update the grade later when you receive it
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Mark Complete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
