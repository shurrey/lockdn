import { useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Trash2,
  Calendar,
  Clock,
  Edit,
  MapPin,
  Upload,
  FileText,
  Loader2,
  AlertCircle,
  Sparkles,
  CheckCircle,
  ChevronLeft,
  Archive,
  Flame,
  RefreshCw,
  Minus,
  ArrowRight,
  Check,
} from 'lucide-react'
import { FileUpload, type UploadedFile } from '@/components/syllabus/FileUpload'
import {
  useCourses,
  useAssignments,
  useAnalytics,
  createCourse,
  updateCourse,
  createAssignment,
  updateAssignment,
  archiveCourse,
  archiveAssignment,
} from '@/db/hooks'
import { db } from '@/db'
import { ArchiveDialog } from '@/components/ui/archive-dialog'
import { now } from '@/db'
import {
  parseSyllabusForCourse,
  type ParsedAssignment,
  type CourseContext,
  getConfidenceColor,
  getConfidenceLabel,
} from '@/lib/syllabusParser'
import { extractFromFiles } from '@/lib/fileExtractor'
import { hasConfiguredProvider } from '@/lib/ai'
import {
  computeAssignmentDiff,
  type AssignmentDiffSummary,
} from '@/lib/diffUtils'
import { ScheduleUploadDialog } from '@/components/schedule'
import { SourceImageViewer, filesToSourceImages, type SourceImage } from '@/components/ui/source-image-viewer'
import type { Course, Assignment, AssignmentType, ClassMeeting, DayOfWeek, CourseStreak } from '@/types'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { COURSE_COLORS, getNextAvailableColor, getColorsWithAvailability } from '@/lib/courseColors'
import { Mascot } from '@/components/Mascot'

const DAYS_OF_WEEK: { label: string; short: string; value: DayOfWeek }[] = [
  { label: 'Monday', short: 'M', value: 'monday' },
  { label: 'Tuesday', short: 'T', value: 'tuesday' },
  { label: 'Wednesday', short: 'W', value: 'wednesday' },
  { label: 'Thursday', short: 'Th', value: 'thursday' },
  { label: 'Friday', short: 'F', value: 'friday' },
  { label: 'Saturday', short: 'Sa', value: 'saturday' },
  { label: 'Sunday', short: 'Su', value: 'sunday' },
]

const ASSIGNMENT_TYPES: { label: string; value: AssignmentType }[] = [
  { label: 'Homework', value: 'homework' },
  { label: 'Quiz', value: 'quiz' },
  { label: 'Exam', value: 'exam' },
  { label: 'Paper', value: 'paper' },
  { label: 'Project', value: 'project' },
  { label: 'Other', value: 'other' },
]

export function CoursesPage() {
  const courses = useCourses()
  const analytics = useAnalytics()
  const allAssignments = useAssignments()

  // Get used colors from existing courses
  const usedColors = useMemo(() => {
    return courses?.map(c => c.color) || []
  }, [courses])

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditCourseDialog, setShowEditCourseDialog] = useState(false)
  const [showEditAssignmentDialog, setShowEditAssignmentDialog] = useState(false)
  const [showAddAssignmentDialog, setShowAddAssignmentDialog] = useState(false)
  const [showSyllabusUploadDialog, setShowSyllabusUploadDialog] = useState(false)
  const [showScheduleUploadDialog, setShowScheduleUploadDialog] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null)

  // Manual course form state
  const [manualCourseName, setManualCourseName] = useState('')
  const [manualCourseCode, setManualCourseCode] = useState('')
  const [manualCourseColor, setManualCourseColor] = useState<string>(COURSE_COLORS[0].value)
  const [manualCourseInstructor, setManualCourseInstructor] = useState('')
  const [manualSchedule, setManualSchedule] = useState<ClassMeeting[]>([])
  const [manualSemesterStart, setManualSemesterStart] = useState('')
  const [manualSemesterEnd, setManualSemesterEnd] = useState('')

  // Edit course form state
  const [editCourseName, setEditCourseName] = useState('')
  const [editCourseCode, setEditCourseCode] = useState('')
  const [editCourseColor, setEditCourseColor] = useState('')
  const [editCourseInstructor, setEditCourseInstructor] = useState('')
  const [editSchedule, setEditSchedule] = useState<ClassMeeting[]>([])
  const [editSemesterStart, setEditSemesterStart] = useState('')
  const [editSemesterEnd, setEditSemesterEnd] = useState('')

  // Assignment form state
  const [assignmentTitle, setAssignmentTitle] = useState('')
  const [assignmentType, setAssignmentType] = useState<AssignmentType>('homework')
  const [assignmentDueDate, setAssignmentDueDate] = useState('')
  const [assignmentDueTime, setAssignmentDueTime] = useState('23:59')
  const [assignmentWeight, setAssignmentWeight] = useState('')
  const [assignmentDescription, setAssignmentDescription] = useState('')

  // Archive dialog state
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [archiveCourseId, setArchiveCourseId] = useState<string | null>(null)
  const [archiveRelatedItems, setArchiveRelatedItems] = useState<{
    assignments?: number
    notes?: number
    studyMaterials?: number
    studySessions?: number
    tutoringConversations?: number
  }>({})

  const resetManualForm = useCallback(() => {
    setManualCourseName('')
    setManualCourseCode('')
    setManualCourseColor(getNextAvailableColor(usedColors))
    setManualCourseInstructor('')
    setManualSchedule([])
    setManualSemesterStart('')
    setManualSemesterEnd('')
  }, [usedColors])

  const handleManualCourseCreate = useCallback(async () => {
    if (!manualCourseName.trim() || !manualCourseCode.trim()) {
      toast.error('Please enter course name and code')
      return
    }

    try {
      await createCourse({
        name: manualCourseName.trim(),
        code: manualCourseCode.trim(),
        color: manualCourseColor,
        instructor: manualCourseInstructor.trim() || undefined,
        schedule: manualSchedule.length > 0 ? manualSchedule : undefined,
        semesterStart: manualSemesterStart ? new Date(manualSemesterStart) : undefined,
        semesterEnd: manualSemesterEnd ? new Date(manualSemesterEnd) : undefined,
      })

      toast.success(`Added ${manualCourseCode}`)
      resetManualForm()
      setShowAddDialog(false)
    } catch (error) {
      toast.error('Failed to create course')
      console.error(error)
    }
  }, [manualCourseName, manualCourseCode, manualCourseColor, manualCourseInstructor, manualSchedule, manualSemesterStart, manualSemesterEnd, resetManualForm])

  const handleOpenAddDialog = useCallback(() => {
    setManualCourseColor(getNextAvailableColor(usedColors))
    setShowAddDialog(true)
  }, [usedColors])

  const handleEditCourse = useCallback((course: Course) => {
    setSelectedCourse(course)
    setEditCourseName(course.name)
    setEditCourseCode(course.code)
    setEditCourseColor(course.color)
    setEditCourseInstructor(course.instructor || '')
    setEditSchedule(course.schedule || [])
    setEditSemesterStart(course.semesterStart ? format(new Date(course.semesterStart), 'yyyy-MM-dd') : '')
    setEditSemesterEnd(course.semesterEnd ? format(new Date(course.semesterEnd), 'yyyy-MM-dd') : '')
    setShowEditCourseDialog(true)
  }, [])

  const handleSaveCourseEdit = useCallback(async () => {
    if (!selectedCourse) return

    try {
      await updateCourse(selectedCourse.id, {
        name: editCourseName.trim(),
        code: editCourseCode.trim(),
        color: editCourseColor,
        instructor: editCourseInstructor.trim() || undefined,
        schedule: editSchedule.length > 0 ? editSchedule : undefined,
        semesterStart: editSemesterStart ? new Date(editSemesterStart) : undefined,
        semesterEnd: editSemesterEnd ? new Date(editSemesterEnd) : undefined,
      })

      toast.success('Course updated')
      setShowEditCourseDialog(false)
      setSelectedCourse(null)
    } catch (error) {
      toast.error('Failed to update course')
      console.error(error)
    }
  }, [selectedCourse, editCourseName, editCourseCode, editCourseColor, editCourseInstructor, editSchedule, editSemesterStart, editSemesterEnd])

  const handleArchiveCourse = useCallback(async (courseId: string) => {
    // Count related items for the archive dialog
    const [assignments, notes, studyMaterials, studySessions, tutoringConversations] = await Promise.all([
      db.assignments.where('courseId').equals(courseId).count(),
      db.notes.where('courseId').equals(courseId).count(),
      db.studyMaterials.where('courseId').equals(courseId).count(),
      db.studySessions.where('courseId').equals(courseId).count(),
      db.tutoringConversations.where('courseId').equals(courseId).count(),
    ])

    setArchiveRelatedItems({ assignments, notes, studyMaterials, studySessions, tutoringConversations })
    setArchiveCourseId(courseId)
    setShowArchiveDialog(true)
  }, [])

  const handleConfirmArchive = useCallback(async (options?: { keepNotesAndMaterials?: boolean }) => {
    if (!archiveCourseId) return

    try {
      await archiveCourse(archiveCourseId, options)
      toast.success('Course archived')
      setSelectedCourse(null)
      setShowArchiveDialog(false)
      setArchiveCourseId(null)
    } catch (error) {
      toast.error('Failed to archive course')
      console.error(error)
    }
  }, [archiveCourseId])

  const handleUploadSyllabus = useCallback((course: Course) => {
    setSelectedCourse(course)
    setShowSyllabusUploadDialog(true)
  }, [])

  const handleEditAssignment = useCallback((assignment: Assignment, course: Course) => {
    setSelectedCourse(course)
    setSelectedAssignment(assignment)
    setAssignmentTitle(assignment.title)
    setAssignmentType(assignment.type)
    setAssignmentDueDate(format(new Date(assignment.dueDate), 'yyyy-MM-dd'))
    setAssignmentDueTime(format(new Date(assignment.dueDate), 'HH:mm'))
    setAssignmentWeight(assignment.weight?.toString() || '')
    setAssignmentDescription(assignment.description || '')
    setShowEditAssignmentDialog(true)
  }, [])

  const resetAssignmentForm = useCallback(() => {
    setAssignmentTitle('')
    setAssignmentType('homework')
    setAssignmentDueDate('')
    setAssignmentDueTime('23:59')
    setAssignmentWeight('')
    setAssignmentDescription('')
  }, [])

  const handleSaveAssignmentEdit = useCallback(async () => {
    if (!selectedAssignment) return

    try {
      const dueDateTime = new Date(`${assignmentDueDate}T${assignmentDueTime}`)
      await updateAssignment(selectedAssignment.id, {
        title: assignmentTitle.trim(),
        type: assignmentType,
        dueDate: dueDateTime,
        weight: assignmentWeight ? parseFloat(assignmentWeight) : undefined,
        description: assignmentDescription.trim() || undefined,
      })

      toast.success('Assignment updated')
      setShowEditAssignmentDialog(false)
      setSelectedAssignment(null)
      resetAssignmentForm()
    } catch (error) {
      toast.error('Failed to update assignment')
      console.error(error)
    }
  }, [selectedAssignment, assignmentTitle, assignmentType, assignmentDueDate, assignmentDueTime, assignmentWeight, assignmentDescription, resetAssignmentForm])

  const handleAddAssignment = useCallback((course: Course) => {
    setSelectedCourse(course)
    resetAssignmentForm()
    setShowAddAssignmentDialog(true)
  }, [resetAssignmentForm])

  const handleCreateAssignment = useCallback(async () => {
    if (!selectedCourse || !assignmentTitle.trim() || !assignmentDueDate) {
      toast.error('Please fill in required fields')
      return
    }

    try {
      const dueDateTime = new Date(`${assignmentDueDate}T${assignmentDueTime}`)
      await createAssignment({
        courseId: selectedCourse.id,
        title: assignmentTitle.trim(),
        type: assignmentType,
        dueDate: dueDateTime,
        weight: assignmentWeight ? parseFloat(assignmentWeight) : undefined,
        description: assignmentDescription.trim() || undefined,
        confidenceScore: 1, // Manual entry = 100% confidence
        status: 'pending',
      })

      toast.success('Assignment added')
      setShowAddAssignmentDialog(false)
      resetAssignmentForm()
    } catch (error) {
      toast.error('Failed to create assignment')
      console.error(error)
    }
  }, [selectedCourse, assignmentTitle, assignmentType, assignmentDueDate, assignmentDueTime, assignmentWeight, assignmentDescription, resetAssignmentForm])

  const handleArchiveAssignment = useCallback(async (assignmentId: string) => {
    if (!confirm('Archive this assignment? You can restore it later from the Archive page.')) return

    try {
      await archiveAssignment(assignmentId)
      toast.success('Assignment archived')
    } catch (error) {
      toast.error('Failed to archive assignment')
      console.error(error)
    }
  }, [])

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Courses</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage your courses, schedules, and assignments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => setShowScheduleUploadDialog(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import Schedule
          </Button>
          <Button size="sm" className="flex-1 sm:flex-none" onClick={() => handleOpenAddDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Course
          </Button>
        </div>
      </div>

      {courses && courses.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              courseStreak={analytics?.courseStreaks?.[course.id]}
              onEdit={() => handleEditCourse(course)}
              onArchive={() => handleArchiveCourse(course.id)}
              onUploadSyllabus={() => handleUploadSyllabus(course)}
              onAddAssignment={() => handleAddAssignment(course)}
              onEditAssignment={(a) => handleEditAssignment(a, course)}
              onArchiveAssignment={handleArchiveAssignment}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mascot size="lg" />
            <h3 className="text-lg font-medium mb-2 mt-4">No courses yet</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Add a course manually or import your schedule to get started.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowScheduleUploadDialog(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Import Schedule
              </Button>
              <Button onClick={() => handleOpenAddDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Course
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Course Dialog (Manual Entry Only) */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Course</DialogTitle>
            <DialogDescription>
              Create a course manually. You can upload a syllabus to extract assignments after creating the course.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="course-code">Course Code *</Label>
                <Input
                  id="course-code"
                  placeholder="e.g., CHEM 101"
                  value={manualCourseCode}
                  onChange={(e) => setManualCourseCode(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="course-name">Course Name *</Label>
                <Input
                  id="course-name"
                  placeholder="e.g., Introduction to Chemistry"
                  value={manualCourseName}
                  onChange={(e) => setManualCourseName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="instructor">Instructor</Label>
                <Input
                  id="instructor"
                  placeholder="e.g., Dr. Smith"
                  value={manualCourseInstructor}
                  onChange={(e) => setManualCourseInstructor(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  {getColorsWithAvailability(usedColors).map((color) => (
                    <button
                      key={color.value}
                      className={cn(
                        'w-8 h-8 rounded-full transition-all relative',
                        manualCourseColor === color.value && 'ring-2 ring-offset-2 ring-primary'
                      )}
                      style={{ backgroundColor: color.value }}
                      onClick={() => setManualCourseColor(color.value)}
                      title={color.inUse ? `${color.name} (in use)` : color.name}
                    >
                      {color.inUse && (
                        <span className="absolute inset-0 flex items-center justify-center text-white/80 text-xs font-bold">
                          ✓
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="semester-start">Semester Start</Label>
                <Input
                  id="semester-start"
                  type="date"
                  value={manualSemesterStart}
                  onChange={(e) => setManualSemesterStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="semester-end">Semester End</Label>
                <Input
                  id="semester-end"
                  type="date"
                  value={manualSemesterEnd}
                  onChange={(e) => setManualSemesterEnd(e.target.value)}
                />
              </div>
            </div>

            <ScheduleEditor
              schedule={manualSchedule}
              onChange={setManualSchedule}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleManualCourseCreate}>
              Create Course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Course Dialog */}
      <Dialog open={showEditCourseDialog} onOpenChange={setShowEditCourseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-course-code">Course Code</Label>
                <Input
                  id="edit-course-code"
                  value={editCourseCode}
                  onChange={(e) => setEditCourseCode(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-course-name">Course Name</Label>
                <Input
                  id="edit-course-name"
                  value={editCourseName}
                  onChange={(e) => setEditCourseName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-instructor">Instructor</Label>
                <Input
                  id="edit-instructor"
                  value={editCourseInstructor}
                  onChange={(e) => setEditCourseInstructor(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  {getColorsWithAvailability(usedColors, selectedCourse?.color).map((color) => (
                    <button
                      key={color.value}
                      className={cn(
                        'w-8 h-8 rounded-full transition-all relative',
                        editCourseColor === color.value && 'ring-2 ring-offset-2 ring-primary'
                      )}
                      style={{ backgroundColor: color.value }}
                      onClick={() => setEditCourseColor(color.value)}
                      title={color.inUse ? `${color.name} (in use)` : color.name}
                    >
                      {color.inUse && (
                        <span className="absolute inset-0 flex items-center justify-center text-white/80 text-xs font-bold">
                          ✓
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-semester-start">Semester Start</Label>
                <Input
                  id="edit-semester-start"
                  type="date"
                  value={editSemesterStart}
                  onChange={(e) => setEditSemesterStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-semester-end">Semester End</Label>
                <Input
                  id="edit-semester-end"
                  type="date"
                  value={editSemesterEnd}
                  onChange={(e) => setEditSemesterEnd(e.target.value)}
                />
              </div>
            </div>

            <ScheduleEditor
              schedule={editSchedule}
              onChange={setEditSchedule}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditCourseDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCourseEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Assignment Dialog */}
      <Dialog open={showEditAssignmentDialog} onOpenChange={setShowEditAssignmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Assignment</DialogTitle>
          </DialogHeader>

          <AssignmentForm
            title={assignmentTitle}
            type={assignmentType}
            dueDate={assignmentDueDate}
            dueTime={assignmentDueTime}
            weight={assignmentWeight}
            description={assignmentDescription}
            onTitleChange={setAssignmentTitle}
            onTypeChange={setAssignmentType}
            onDueDateChange={setAssignmentDueDate}
            onDueTimeChange={setAssignmentDueTime}
            onWeightChange={setAssignmentWeight}
            onDescriptionChange={setAssignmentDescription}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditAssignmentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAssignmentEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Assignment Dialog */}
      <Dialog open={showAddAssignmentDialog} onOpenChange={setShowAddAssignmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Assignment</DialogTitle>
            {selectedCourse && (
              <DialogDescription>
                Adding to {selectedCourse.code}: {selectedCourse.name}
              </DialogDescription>
            )}
          </DialogHeader>

          <AssignmentForm
            title={assignmentTitle}
            type={assignmentType}
            dueDate={assignmentDueDate}
            dueTime={assignmentDueTime}
            weight={assignmentWeight}
            description={assignmentDescription}
            onTitleChange={setAssignmentTitle}
            onTypeChange={setAssignmentType}
            onDueDateChange={setAssignmentDueDate}
            onDueTimeChange={setAssignmentDueTime}
            onWeightChange={setAssignmentWeight}
            onDescriptionChange={setAssignmentDescription}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAssignmentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAssignment}>
              Add Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Syllabus Upload Dialog */}
      <SyllabusUploadDialog
        open={showSyllabusUploadDialog}
        onOpenChange={setShowSyllabusUploadDialog}
        course={selectedCourse}
        existingAssignments={selectedCourse ? allAssignments?.filter(a => a.courseId === selectedCourse.id) : []}
      />

      {/* Course Schedule Upload Dialog */}
      <ScheduleUploadDialog
        open={showScheduleUploadDialog}
        onOpenChange={setShowScheduleUploadDialog}
      />

      {/* Archive Course Dialog */}
      {archiveCourseId && (
        <ArchiveDialog
          open={showArchiveDialog}
          onOpenChange={(open) => {
            setShowArchiveDialog(open)
            if (!open) setArchiveCourseId(null)
          }}
          itemType="course"
          itemName={courses?.find((c) => c.id === archiveCourseId)?.code || 'Course'}
          onConfirm={handleConfirmArchive}
          relatedItems={archiveRelatedItems}
        />
      )}
    </div>
  )
}

// Schedule Editor Component
interface ScheduleEditorProps {
  schedule: ClassMeeting[]
  onChange: (schedule: ClassMeeting[]) => void
}

function ScheduleEditor({ schedule, onChange }: ScheduleEditorProps) {
  const [days, setDays] = useState<Set<DayOfWeek>>(new Set())
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('09:50')
  const [location, setLocation] = useState('')

  const handleAddMeeting = useCallback(() => {
    if (days.size === 0) {
      toast.error('Select at least one day')
      return
    }

    const newMeeting: ClassMeeting = {
      days: Array.from(days),
      startTime,
      endTime,
      location: location.trim() || undefined,
    }

    onChange([...schedule, newMeeting])
    setDays(new Set())
    setLocation('')
  }, [days, startTime, endTime, location, schedule, onChange])

  const handleRemoveMeeting = useCallback((index: number) => {
    onChange(schedule.filter((_, i) => i !== index))
  }, [schedule, onChange])

  const toggleDay = useCallback((day: DayOfWeek) => {
    setDays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) {
        next.delete(day)
      } else {
        next.add(day)
      }
      return next
    })
  }, [])

  const formatMeetingDays = (meeting: ClassMeeting) => {
    return meeting.days
      .map((d) => DAYS_OF_WEEK.find((dw) => dw.value === d)?.short)
      .join('')
  }

  return (
    <div className="space-y-4">
      <Label>Class Schedule</Label>

      {/* Existing meetings */}
      {schedule.length > 0 && (
        <div className="space-y-2">
          {schedule.map((meeting, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-muted rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{formatMeetingDays(meeting)}</Badge>
                <span className="text-sm">
                  {meeting.startTime} - {meeting.endTime}
                </span>
                {meeting.location && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {meeting.location}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => handleRemoveMeeting(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new meeting */}
      <div className="border rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium">Add meeting time</p>

        <div className="flex gap-1">
          {DAYS_OF_WEEK.map((day) => (
            <button
              key={day.value}
              className={cn(
                'w-9 h-9 rounded-full text-xs font-medium transition-all',
                days.has(day.value)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              )}
              onClick={() => toggleDay(day.value)}
            >
              {day.short}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Start Time</Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">End Time</Label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Location</Label>
            <Input
              placeholder="Room 101"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={handleAddMeeting}>
          <Plus className="h-4 w-4 mr-1" />
          Add Time
        </Button>
      </div>
    </div>
  )
}

// Assignment Form Component
interface AssignmentFormProps {
  title: string
  type: AssignmentType
  dueDate: string
  dueTime: string
  weight: string
  description: string
  onTitleChange: (value: string) => void
  onTypeChange: (value: AssignmentType) => void
  onDueDateChange: (value: string) => void
  onDueTimeChange: (value: string) => void
  onWeightChange: (value: string) => void
  onDescriptionChange: (value: string) => void
}

function AssignmentForm({
  title,
  type,
  dueDate,
  dueTime,
  weight,
  description,
  onTitleChange,
  onTypeChange,
  onDueDateChange,
  onDueTimeChange,
  onWeightChange,
  onDescriptionChange,
}: AssignmentFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="assignment-title">Title *</Label>
        <Input
          id="assignment-title"
          placeholder="e.g., Chapter 5 Homework"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="assignment-type">Type</Label>
          <Select value={type} onValueChange={onTypeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSIGNMENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="assignment-weight">Weight (%)</Label>
          <Input
            id="assignment-weight"
            type="number"
            min="0"
            max="100"
            placeholder="e.g., 10"
            value={weight}
            onChange={(e) => onWeightChange(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="assignment-due-date">Due Date *</Label>
          <Input
            id="assignment-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => onDueDateChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="assignment-due-time">Due Time</Label>
          <Input
            id="assignment-due-time"
            type="time"
            value={dueTime}
            onChange={(e) => onDueTimeChange(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="assignment-description">Description</Label>
        <Input
          id="assignment-description"
          placeholder="Optional notes..."
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
      </div>
    </div>
  )
}

// Course Card Component
interface CourseCardProps {
  course: Course
  courseStreak?: CourseStreak
  onEdit: () => void
  onArchive: () => void
  onUploadSyllabus: () => void
  onAddAssignment: () => void
  onEditAssignment: (assignment: Assignment) => void
  onArchiveAssignment: (id: string) => void
}

function CourseCard({
  course,
  courseStreak,
  onEdit,
  onArchive,
  onUploadSyllabus,
  onAddAssignment,
  onEditAssignment,
  onArchiveAssignment,
}: CourseCardProps) {
  const assignments = useAssignments(course.id)

  const formatSchedule = useMemo(() => {
    if (!course.schedule || course.schedule.length === 0) return null
    return course.schedule.map((meeting) => {
      const days = meeting.days
        .map((d) => DAYS_OF_WEEK.find((dw) => dw.value === d)?.short)
        .join('')
      return `${days} ${meeting.startTime}-${meeting.endTime}`
    }).join(', ')
  }, [course.schedule])

  const upcomingAssignments = useMemo(() => {
    if (!assignments) return []
    return assignments
      .filter((a) => a.status !== 'completed')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5)
  }, [assignments])

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div
              className="h-4 w-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: course.color }}
            />
            <CardTitle className="text-base">{course.code}</CardTitle>
            {courseStreak && courseStreak.currentStreak > 0 && (
              <div className="flex items-center gap-0.5 text-orange-500" title={`${courseStreak.currentStreak} day streak`}>
                <Flame className="h-4 w-4" />
                <span className="text-xs font-medium">{courseStreak.currentStreak}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onUploadSyllabus}
              title="Upload Syllabus"
            >
              <FileText className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onEdit}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-orange-600 hover:text-orange-700"
              onClick={onArchive}
              title="Archive Course"
            >
              <Archive className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="font-medium">{course.name}</p>

        {course.instructor && (
          <p className="text-sm text-muted-foreground">{course.instructor}</p>
        )}

        {formatSchedule && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {formatSchedule}
          </div>
        )}

        {course.syllabusData && (
          <Badge variant="outline" className="text-xs">
            <CheckCircle className="h-3 w-3 mr-1" />
            Syllabus uploaded
          </Badge>
        )}

        {/* Assignments Section */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Assignments ({assignments?.length || 0})
            </span>
            <Button variant="ghost" size="sm" onClick={onAddAssignment}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          {upcomingAssignments.length > 0 ? (
            <div className="space-y-2">
              {upcomingAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{assignment.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(assignment.dueDate), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onEditAssignment(assignment)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-orange-600 hover:text-orange-700"
                      onClick={() => onArchiveAssignment(assignment.id)}
                      title="Archive Assignment"
                    >
                      <Archive className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {assignments && assignments.length > 5 && (
                <Button variant="ghost" size="sm" className="w-full" asChild>
                  <Link to="/calendar">
                    <Calendar className="mr-2 h-4 w-4" />
                    View all in Calendar
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">No upcoming assignments</p>
              {!course.syllabusData && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed"
                  onClick={onUploadSyllabus}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Upload Syllabus to Extract Assignments
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Calculate optimal modal width based on image dimensions
function calculateOptimalModalWidth(imageWidth: number, imageHeight: number): string {
  // Available height for image panel is roughly 70vh (90vh modal - header/footer/padding)
  const availableHeight = window.innerHeight * 0.70
  // Calculate width needed for image at that height, maintaining aspect ratio
  const imageAspectRatio = imageWidth / imageHeight
  const imageWidthNeeded = availableHeight * imageAspectRatio
  // The image panel is 60% of the modal (3fr out of 5fr total in grid-cols-[3fr_2fr])
  // So total modal width = imageWidthNeeded / 0.6
  const totalWidthNeeded = imageWidthNeeded / 0.6
  // Add some padding (48px on each side roughly)
  const modalWidth = totalWidthNeeded + 96
  // Clamp between reasonable bounds (600px min, 95vw max)
  const maxWidth = window.innerWidth * 0.95
  const clampedWidth = Math.max(600, Math.min(modalWidth, maxWidth))
  return `${Math.round(clampedWidth)}px`
}

// Syllabus Upload Dialog Component
interface SyllabusUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  course: Course | null
  existingAssignments?: Assignment[]
}

function SyllabusUploadDialog({ open, onOpenChange, course, existingAssignments = [] }: SyllabusUploadDialogProps) {
  const [step, setStep] = useState<'upload' | 'processing' | 'review'>('upload')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [sourceImages, setSourceImages] = useState<SourceImage[]>([])
  const [parsedAssignments, setParsedAssignments] = useState<ParsedAssignment[]>([])
  const [selectedAssignments, setSelectedAssignments] = useState<Set<number>>(new Set())
  const [hoveredAssignment, setHoveredAssignment] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasProvider, setHasProvider] = useState<boolean | null>(null)
  const [uploadKey, setUploadKey] = useState(0) // Used to reset FileUpload component
  const [optimalModalWidth, setOptimalModalWidth] = useState<string | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  // Compute assignment diff if we have existing assignments
  const assignmentDiff = useMemo((): AssignmentDiffSummary | null => {
    if (existingAssignments.length === 0 || parsedAssignments.length === 0) {
      return null
    }
    return computeAssignmentDiff(parsedAssignments, existingAssignments)
  }, [parsedAssignments, existingAssignments])

  // Get diff item for a specific assignment index
  const getDiffForAssignment = useCallback((index: number) => {
    if (!assignmentDiff) return null
    const assignment = parsedAssignments[index]
    if (!assignment) return null
    return assignmentDiff.items.find(item =>
      item.newAssignment?.title === assignment.title &&
      item.newAssignment?.dueDate === assignment.dueDate
    )
  }, [assignmentDiff, parsedAssignments])

  // Check provider on mount
  useState(() => {
    hasConfiguredProvider().then(setHasProvider)
  })

  const handleFilesSelected = useCallback((selectedFiles: UploadedFile[]) => {
    setFiles(selectedFiles)
    setError(null)
  }, [])

  const handleProcess = useCallback(async () => {
    if (!course || files.length === 0) return

    setStep('processing')
    setError(null)

    try {
      // Convert files to source images for display
      const images = await filesToSourceImages(files.map(f => f.file))
      setSourceImages(images)

      // Calculate optimal modal width based on first image dimensions
      if (images.length > 0) {
        const img = new Image()
        img.src = images[0].dataUrl
        await new Promise<void>((resolve) => {
          img.onload = () => {
            setOptimalModalWidth(calculateOptimalModalWidth(img.naturalWidth, img.naturalHeight))
            resolve()
          }
          img.onerror = () => resolve()
        })
      }

      const { combinedText, allImages } = await extractFromFiles(files.map((f) => f.file))

      const context: CourseContext = {
        name: course.name,
        code: course.code,
        semesterStart: course.semesterStart ? new Date(course.semesterStart) : undefined,
        semesterEnd: course.semesterEnd ? new Date(course.semesterEnd) : undefined,
        schedule: course.schedule,
      }

      const assignments = await parseSyllabusForCourse(combinedText, allImages, context)
      setParsedAssignments(assignments)
      setSelectedAssignments(new Set(assignments.map((_, i) => i)))
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process syllabus')
      setStep('upload')
    }
  }, [course, files])

  const resetDialog = useCallback(() => {
    setStep('upload')
    setFiles([])
    setSourceImages([])
    setParsedAssignments([])
    setSelectedAssignments(new Set())
    setHoveredAssignment(null)
    setError(null)
    setUploadKey(k => k + 1) // Force FileUpload to remount
    setOptimalModalWidth(null)
    setEditingIndex(null)
  }, [])

  const handleSave = useCallback(async () => {
    if (!course) return

    try {
      let addedCount = 0
      for (const index of selectedAssignments) {
        const assignment = parsedAssignments[index]
        if (assignment) {
          await createAssignment({
            courseId: course.id,
            title: assignment.title,
            type: assignment.type,
            dueDate: new Date(assignment.dueDate),
            weight: assignment.weight,
            description: assignment.description,
            confidenceScore: assignment.confidence,
            status: 'pending',
          })
          addedCount++
        }
      }

      // Update course with syllabus data
      await updateCourse(course.id, {
        syllabusData: {
          rawText: 'parsed',
          extractedAt: now(),
          sourceFileName: files[0]?.file.name || 'syllabus',
          sourceFileType: files[0]?.file.type || 'unknown',
        },
      })

      toast.success(`Added ${addedCount} assignments to ${course.code}`)
      onOpenChange(false)
      resetDialog()
    } catch (err) {
      toast.error('Failed to save assignments')
      console.error(err)
    }
  }, [course, selectedAssignments, parsedAssignments, files, onOpenChange, resetDialog])

  const toggleAssignment = useCallback((index: number) => {
    setSelectedAssignments((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  const updateAssignmentField = useCallback((index: number, field: keyof ParsedAssignment, value: unknown) => {
    setParsedAssignments((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }, [])

  if (!course) return null

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetDialog() }}>
      <DialogContent
        className={cn(
          'overflow-hidden flex flex-col',
          step === 'review' ? 'h-[90vh]' : 'sm:max-w-3xl max-h-[90vh]'
        )}
        style={step === 'review' && optimalModalWidth ? { width: optimalModalWidth, maxWidth: '95vw' } : undefined}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Upload Syllabus for {course.code}
          </DialogTitle>
          <DialogDescription>
            Upload a syllabus to automatically extract assignments using AI.
          </DialogDescription>
        </DialogHeader>

        {hasProvider === false && (
          <Alert className="flex-shrink-0">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please configure an API key in <Link to="/settings" className="underline">Settings</Link> to enable AI-powered syllabus parsing.
            </AlertDescription>
          </Alert>
        )}

        {hasProvider && step === 'upload' && (
          <div className="space-y-4 overflow-y-auto">
            <FileUpload key={uploadKey} onFilesSelected={handleFilesSelected} />

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!course.semesterStart && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This course doesn't have a semester start date set. For best results with syllabi that use "Week X" format, edit the course and set the semester start date.
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleProcess} disabled={files.length === 0}>
                <Sparkles className="mr-2 h-4 w-4" />
                Extract Assignments
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Processing syllabus...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Extracting assignments for {course.code}
            </p>
          </div>
        )}

        {step === 'review' && (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Diff Summary */}
            {assignmentDiff && (assignmentDiff.modified > 0 || assignmentDiff.removed > 0) ? (
              <div className="flex items-center gap-4 text-sm mb-4 flex-shrink-0 flex-wrap">
                <span className="text-muted-foreground">Changes:</span>
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
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4 flex-shrink-0">
                Found {parsedAssignments.length} assignments. Hover over an assignment to verify it in the source.
              </p>
            )}

            {/* Split View: Images Left, Assignments Right */}
            <div className="flex-1 min-h-0 grid grid-cols-[3fr_2fr] gap-6">
              {/* Source Images */}
              <div className="min-h-0 flex flex-col">
                <h3 className="text-sm font-medium text-muted-foreground mb-2 flex-shrink-0">
                  Source Syllabus
                  {hoveredAssignment !== null && (
                    <span className="ml-2 text-primary animate-pulse">← Verify here</span>
                  )}
                </h3>
                <div className={cn(
                  'flex-1 min-h-0 rounded-lg border-2 transition-all duration-200',
                  hoveredAssignment !== null
                    ? 'ring-4 ring-primary/30 border-primary shadow-lg shadow-primary/20'
                    : 'border-border'
                )}>
                  <SourceImageViewer
                    images={sourceImages}
                    className="h-full"
                  />
                </div>
              </div>

              {/* Extracted Assignments / Edit Panel */}
              <div className="min-h-0 flex flex-col relative overflow-hidden">
                {/* Assignment List */}
                <div className={cn(
                  'absolute inset-0 flex flex-col transition-transform duration-200',
                  editingIndex !== null ? '-translate-x-full' : 'translate-x-0'
                )}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 flex-shrink-0">
                    Extracted Assignments ({selectedAssignments.size} selected)
                  </h3>
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-2">
                    {parsedAssignments.map((assignment, index) => {
                      const diffItem = getDiffForAssignment(index)
                      return (
                        <div
                          key={index}
                          className={cn(
                            'flex items-start gap-3 p-3 border rounded-lg transition-all',
                            selectedAssignments.has(index) ? 'bg-primary/10 border-primary' : 'hover:bg-muted',
                            hoveredAssignment === index && 'ring-2 ring-primary shadow-md',
                            diffItem?.status === 'added' && 'border-green-200 bg-green-50/50 dark:bg-green-950/20',
                            diffItem?.status === 'modified' && 'border-blue-200 bg-blue-50/50 dark:bg-blue-950/20',
                            diffItem?.status === 'unchanged' && 'border-muted bg-muted/20'
                          )}
                          onMouseEnter={() => setHoveredAssignment(index)}
                          onMouseLeave={() => setHoveredAssignment(null)}
                        >
                          <div
                            className={cn(
                              'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 cursor-pointer',
                              selectedAssignments.has(index) ? 'border-primary bg-primary' : 'border-muted-foreground'
                            )}
                            onClick={() => toggleAssignment(index)}
                          >
                            {selectedAssignments.has(index) && (
                              <CheckCircle className="h-3 w-3 text-primary-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium">{assignment.title}</p>
                              <Badge variant="outline" className="text-xs">{assignment.type}</Badge>
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
                            <p className="text-sm text-muted-foreground">
                              Due: {format(new Date(assignment.dueDate), 'MMM d, yyyy')}
                              {assignment.weight && ` • ${assignment.weight}%`}
                            </p>
                            {/* Show changes for modified assignments */}
                            {diffItem?.status === 'modified' && diffItem.changes && diffItem.changes.length > 0 && (
                              <div className="mt-1 space-y-0.5">
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
                            {!diffItem && (
                              <p className={cn('text-xs mt-1', getConfidenceColor(assignment.confidence))}>
                                Confidence: {getConfidenceLabel(assignment.confidence)}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingIndex(index)
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}

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
                </div>

                {/* Edit Panel */}
                <div className={cn(
                  'absolute inset-0 flex flex-col transition-transform duration-200',
                  editingIndex !== null ? 'translate-x-0' : 'translate-x-full'
                )}>
                  {editingIndex !== null && parsedAssignments[editingIndex] && (
                    <>
                      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditingIndex(null)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <h3 className="text-sm font-medium">Edit Assignment</h3>
                      </div>
                      <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-title">Title</Label>
                          <Input
                            id="edit-title"
                            value={parsedAssignments[editingIndex].title}
                            onChange={(e) => updateAssignmentField(editingIndex, 'title', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-type">Type</Label>
                          <Select
                            value={parsedAssignments[editingIndex].type}
                            onValueChange={(value) => updateAssignmentField(editingIndex, 'type', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ASSIGNMENT_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="edit-due-date">Due Date</Label>
                            <Input
                              id="edit-due-date"
                              type="date"
                              value={format(new Date(parsedAssignments[editingIndex].dueDate), 'yyyy-MM-dd')}
                              onChange={(e) => {
                                const currentDate = new Date(parsedAssignments[editingIndex].dueDate)
                                const newDate = new Date(e.target.value)
                                newDate.setHours(currentDate.getHours(), currentDate.getMinutes())
                                updateAssignmentField(editingIndex, 'dueDate', newDate.toISOString())
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-due-time">Due Time</Label>
                            <Input
                              id="edit-due-time"
                              type="time"
                              value={format(new Date(parsedAssignments[editingIndex].dueDate), 'HH:mm')}
                              onChange={(e) => {
                                const currentDate = new Date(parsedAssignments[editingIndex].dueDate)
                                const [hours, minutes] = e.target.value.split(':').map(Number)
                                currentDate.setHours(hours, minutes)
                                updateAssignmentField(editingIndex, 'dueDate', currentDate.toISOString())
                              }}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-weight">Weight (%)</Label>
                          <Input
                            id="edit-weight"
                            type="number"
                            min="0"
                            max="100"
                            value={parsedAssignments[editingIndex].weight || ''}
                            onChange={(e) => updateAssignmentField(editingIndex, 'weight', e.target.value ? parseFloat(e.target.value) : undefined)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-description">Description</Label>
                          <textarea
                            id="edit-description"
                            className="w-full min-h-[100px] p-3 border rounded-lg bg-background text-sm resize-none"
                            value={parsedAssignments[editingIndex].description || ''}
                            onChange={(e) => updateAssignmentField(editingIndex, 'description', e.target.value || undefined)}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="flex-shrink-0 mt-4">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={handleSave} disabled={selectedAssignments.size === 0}>
                Add {selectedAssignments.size} Assignments
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

