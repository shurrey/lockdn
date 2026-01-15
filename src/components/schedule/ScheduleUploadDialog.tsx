import { useState, useCallback, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Upload,
  Clock,
  MapPin,
  Loader2,
  AlertCircle,
  Sparkles,
  CheckCircle,
  Calendar,
  Edit,
  ChevronLeft,
  ArrowRight,
  Plus,
  RefreshCw,
  Minus,
} from 'lucide-react'
import { FileUpload, type UploadedFile } from '@/components/syllabus/FileUpload'
import { SourceImageViewer, filesToSourceImages, type SourceImage } from '@/components/ui/source-image-viewer'
import { createCourse, updateCourse, useCourses } from '@/db/hooks'
import {
  parseCourseSchedule,
  type ParsedScheduleEntry,
  getConfidenceColor,
  getConfidenceLabel,
} from '@/lib/syllabusParser'
import {
  computeScheduleDiff,
  type ScheduleDiffSummary,
} from '@/lib/diffUtils'
import { extractFromFiles } from '@/lib/fileExtractor'
import { hasConfiguredProvider } from '@/lib/ai'
import { getNextAvailableColor } from '@/lib/courseColors'
import type { DayOfWeek } from '@/types'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

const DAYS_OF_WEEK: { short: string; value: DayOfWeek }[] = [
  { short: 'M', value: 'monday' },
  { short: 'T', value: 'tuesday' },
  { short: 'W', value: 'wednesday' },
  { short: 'Th', value: 'thursday' },
  { short: 'F', value: 'friday' },
  { short: 'Sa', value: 'saturday' },
  { short: 'Su', value: 'sunday' },
]

interface ScheduleUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
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

export function ScheduleUploadDialog({ open, onOpenChange }: ScheduleUploadDialogProps) {
  const existingCourses = useCourses()
  const [step, setStep] = useState<'upload' | 'processing' | 'review'>('upload')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [sourceImages, setSourceImages] = useState<SourceImage[]>([])
  const [parsedCourses, setParsedCourses] = useState<ParsedScheduleEntry[]>([])
  const [selectedCourses, setSelectedCourses] = useState<Set<number>>(new Set())
  const [hoveredCourse, setHoveredCourse] = useState<number | null>(null)
  const [semesterStart, setSemesterStart] = useState('')
  const [semesterEnd, setSemesterEnd] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [hasProvider, setHasProvider] = useState<boolean | null>(null)
  const [uploadKey, setUploadKey] = useState(0) // Used to reset FileUpload component
  const [optimalModalWidth, setOptimalModalWidth] = useState<string | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  // Manual links: parsed course index -> existing course ID
  const [manualCourseLinks, setManualCourseLinks] = useState<Map<number, string>>(new Map())

  // Normalize course code for matching
  const normalizeCode = useCallback((code: string) =>
    code.toLowerCase().replace(/\s+/g, ' ').trim()
  , [])

  // Compute which parsed courses auto-match to existing courses
  const courseMatches = useMemo(() => {
    if (!existingCourses || !parsedCourses.length) return new Map<number, string | null>()

    const existingByCode = new Map(
      existingCourses.map(c => [normalizeCode(c.code), c.id])
    )

    const matches = new Map<number, string | null>()
    parsedCourses.forEach((course, index) => {
      const normalizedCode = normalizeCode(course.code)
      const existingId = existingByCode.get(normalizedCode) || null
      matches.set(index, existingId)
    })
    return matches
  }, [existingCourses, parsedCourses, normalizeCode])

  // Get the effective link for a course (manual override or auto-match)
  const getEffectiveLink = useCallback((index: number): string | null => {
    return manualCourseLinks.get(index) ?? courseMatches.get(index) ?? null
  }, [manualCourseLinks, courseMatches])

  // Compute schedule diff for showing what changed
  const scheduleDiff = useMemo((): ScheduleDiffSummary | null => {
    if (!existingCourses || existingCourses.length === 0 || parsedCourses.length === 0) {
      return null
    }
    return computeScheduleDiff(parsedCourses, existingCourses)
  }, [existingCourses, parsedCourses])

  // Get diff item for a specific parsed course index
  const getDiffForCourse = useCallback((index: number) => {
    if (!scheduleDiff) return null
    const course = parsedCourses[index]
    if (!course) return null
    return scheduleDiff.items.find(item =>
      item.newCourse?.code.toLowerCase() === course.code.toLowerCase()
    )
  }, [scheduleDiff, parsedCourses])

  // Check provider on mount
  useState(() => {
    hasConfiguredProvider().then(setHasProvider)
  })

  const handleFilesSelected = useCallback((selectedFiles: UploadedFile[]) => {
    setFiles(selectedFiles)
    setError(null)
  }, [])

  const handleProcess = useCallback(async () => {
    if (files.length === 0) return

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
      const courses = await parseCourseSchedule(combinedText, allImages)

      setParsedCourses(courses)
      setSelectedCourses(new Set(courses.map((_, i) => i)))
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process schedule')
      setStep('upload')
    }
  }, [files])

  const resetDialog = useCallback(() => {
    setStep('upload')
    setFiles([])
    setSourceImages([])
    setParsedCourses([])
    setSelectedCourses(new Set())
    setHoveredCourse(null)
    setSemesterStart('')
    setSemesterEnd('')
    setError(null)
    setUploadKey(k => k + 1) // Force FileUpload to remount
    setOptimalModalWidth(null)
    setEditingIndex(null)
    setManualCourseLinks(new Map())
  }, [])

  const handleSave = useCallback(async () => {
    try {
      let addedCount = 0
      let updatedCount = 0
      // Track used colors: start with existing course colors
      const usedColors = existingCourses?.map(c => c.color) || []

      // Create a map of existing courses by ID for quick lookup
      const existingCourseById = new Map(
        (existingCourses || []).map(c => [c.id, c])
      )

      for (const index of selectedCourses) {
        const course = parsedCourses[index]
        if (course) {
          // Use merged schedules if available, otherwise single schedule
          const schedule = course.schedules || [{
            days: course.days,
            startTime: course.startTime,
            endTime: course.endTime,
            location: course.location,
          }]

          // Use extracted dates if available, fall back to manual entry
          const startDate = course.classStartDate || semesterStart
          const endDate = course.classEndDate || semesterEnd

          // Check if course already exists (auto-match or manual link)
          const linkedCourseId = getEffectiveLink(index)
          const existingCourse = linkedCourseId ? existingCourseById.get(linkedCourseId) : null

          if (existingCourse) {
            // Update all course fields from the new import, but preserve assignments and syllabus data
            await updateCourse(existingCourse.id, {
              name: course.name,
              code: course.code,
              instructor: course.instructor,
              schedule,
              semesterStart: startDate ? new Date(startDate) : undefined,
              semesterEnd: endDate ? new Date(endDate) : undefined,
              // Note: color, syllabusData, and assignments are NOT touched
            })
            updatedCount++
          } else {
            // Create new course
            const color = getNextAvailableColor(usedColors)
            usedColors.push(color)

            await createCourse({
              name: course.name,
              code: course.code,
              color,
              instructor: course.instructor,
              schedule,
              semesterStart: startDate ? new Date(startDate) : undefined,
              semesterEnd: endDate ? new Date(endDate) : undefined,
            })
            addedCount++
          }
        }
      }

      if (updatedCount > 0 && addedCount > 0) {
        toast.success(`Updated ${updatedCount} courses, added ${addedCount} new courses`)
      } else if (updatedCount > 0) {
        toast.success(`Updated ${updatedCount} courses (schedules only, assignments preserved)`)
      } else {
        toast.success(`Added ${addedCount} courses`)
      }
      onOpenChange(false)
      resetDialog()
    } catch (err) {
      toast.error('Failed to save courses')
      console.error('[ScheduleUpload] Save error:', err)
    }
  }, [selectedCourses, parsedCourses, semesterStart, semesterEnd, onOpenChange, existingCourses, getEffectiveLink, resetDialog])

  const toggleCourse = useCallback((index: number) => {
    setSelectedCourses((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  const updateCourseField = useCallback((index: number, field: keyof ParsedScheduleEntry, value: unknown) => {
    setParsedCourses((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }, [])

  // Get the image index for the hovered course
  const activeImageIndex = useMemo(() => {
    if (hoveredCourse === null) return null
    const course = parsedCourses[hoveredCourse]
    return course?.imageIndex ?? null
  }, [hoveredCourse, parsedCourses])

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
            <Upload className="h-5 w-5" />
            Import Course Schedule
          </DialogTitle>
          <DialogDescription>
            Upload your class schedule to automatically create courses with their meeting times.
          </DialogDescription>
        </DialogHeader>

        {hasProvider === false && (
          <Alert className="flex-shrink-0">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please configure an API key in <Link to="/settings" className="underline">Settings</Link> to enable AI-powered schedule parsing.
            </AlertDescription>
          </Alert>
        )}

        {hasProvider && step === 'upload' && (
          <div className="space-y-4 overflow-y-auto">
            <FileUpload key={uploadKey} onFilesSelected={handleFilesSelected} />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="schedule-semester-start">Semester Start (optional)</Label>
                <Input
                  id="schedule-semester-start"
                  type="date"
                  value={semesterStart}
                  onChange={(e) => setSemesterStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-semester-end">Semester End (optional)</Label>
                <Input
                  id="schedule-semester-end"
                  type="date"
                  value={semesterEnd}
                  onChange={(e) => setSemesterEnd(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleProcess} disabled={files.length === 0}>
                <Sparkles className="mr-2 h-4 w-4" />
                Extract Courses
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Processing schedule...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Extracting course information
            </p>
          </div>
        )}

        {step === 'review' && (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Diff Summary */}
            {scheduleDiff && (scheduleDiff.modified > 0 || scheduleDiff.removed > 0) ? (
              <div className="flex items-center gap-4 text-sm mb-4 flex-shrink-0 flex-wrap">
                <span className="text-muted-foreground">Changes:</span>
                {scheduleDiff.added > 0 && (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <Plus className="h-3.5 w-3.5" />
                    {scheduleDiff.added} new
                  </span>
                )}
                {scheduleDiff.modified > 0 && (
                  <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                    <RefreshCw className="h-3.5 w-3.5" />
                    {scheduleDiff.modified} updated
                  </span>
                )}
                {scheduleDiff.unchanged > 0 && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {scheduleDiff.unchanged} unchanged
                  </span>
                )}
                {scheduleDiff.removed > 0 && (
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                    <Minus className="h-3.5 w-3.5" />
                    {scheduleDiff.removed} not in upload
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4 flex-shrink-0">
                Found {parsedCourses.length} courses. Hover over a course to verify it in the source image.
              </p>
            )}

            {/* Split View: Images Left, Courses Right */}
            <div className="flex-1 min-h-0 grid grid-cols-[3fr_2fr] gap-6">
              {/* Source Images */}
              <div className="min-h-0 flex flex-col">
                <h3 className="text-sm font-medium text-muted-foreground mb-2 flex-shrink-0">
                  Source Images
                  {hoveredCourse !== null && (
                    <span className="ml-2 text-primary animate-pulse">← Verify here</span>
                  )}
                </h3>
                <div className={cn(
                  'flex-1 min-h-0 rounded-lg border-2 transition-all duration-200',
                  hoveredCourse !== null
                    ? 'ring-4 ring-primary/30 border-primary shadow-lg shadow-primary/20'
                    : 'border-border'
                )}>
                  <SourceImageViewer
                    images={sourceImages}
                    activeImageIndex={activeImageIndex}
                    className="h-full"
                  />
                </div>
              </div>

              {/* Extracted Courses / Edit Panel */}
              <div className="min-h-0 flex flex-col relative overflow-hidden">
                {/* Course List */}
                <div className={cn(
                  'absolute inset-0 flex flex-col transition-transform duration-200',
                  editingIndex !== null ? '-translate-x-full' : 'translate-x-0'
                )}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 flex-shrink-0">
                    Extracted Courses ({selectedCourses.size} selected)
                  </h3>
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-2">
                    {parsedCourses.map((course, index) => (
                      <div
                        key={index}
                        className={cn(
                          'flex items-start gap-3 p-3 border rounded-lg transition-all',
                          selectedCourses.has(index) ? 'bg-primary/10 border-primary' : 'hover:bg-muted',
                          hoveredCourse === index && 'ring-2 ring-primary shadow-md'
                        )}
                        onMouseEnter={() => setHoveredCourse(index)}
                        onMouseLeave={() => setHoveredCourse(null)}
                      >
                        <div
                          className={cn(
                            'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 cursor-pointer',
                            selectedCourses.has(index) ? 'border-primary bg-primary' : 'border-muted-foreground'
                          )}
                          onClick={() => toggleCourse(index)}
                        >
                          {selectedCourses.has(index) && (
                            <CheckCircle className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{course.code}: {course.name}</p>
                            {(() => {
                              const diffItem = getDiffForCourse(index)
                              if (diffItem?.status === 'modified') {
                                return (
                                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                    Changed
                                  </Badge>
                                )
                              } else if (diffItem?.status === 'unchanged') {
                                return (
                                  <Badge variant="secondary" className="text-xs">
                                    Unchanged
                                  </Badge>
                                )
                              } else if (getEffectiveLink(index)) {
                                return (
                                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                    Update
                                  </Badge>
                                )
                              } else {
                                return (
                                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
                                    New
                                  </Badge>
                                )
                              }
                            })()}
                          </div>
                          {course.instructor && (
                            <p className="text-sm text-muted-foreground">{course.instructor}</p>
                          )}
                          {/* Show what changed */}
                          {(() => {
                            const diffItem = getDiffForCourse(index)
                            if (diffItem?.status === 'modified' && diffItem.changes && diffItem.changes.length > 0) {
                              return (
                                <div className="mt-1 space-y-0.5">
                                  {diffItem.changes.map((change, changeIdx) => (
                                    <div key={changeIdx} className="flex items-center gap-1 text-xs">
                                      <span className="text-muted-foreground">{change.field}:</span>
                                      <span className="text-red-500 line-through">{change.oldValue}</span>
                                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-green-600 dark:text-green-400">{change.newValue}</span>
                                    </div>
                                  ))}
                                </div>
                              )
                            }
                            return null
                          })()}
                          {/* Link to existing course */}
                          {existingCourses && existingCourses.length > 0 && (
                            <div className="mt-2">
                              <Select
                                value={getEffectiveLink(index) || '__new__'}
                                onValueChange={(value) => {
                                  setManualCourseLinks(prev => {
                                    const next = new Map(prev)
                                    if (value === '__new__') {
                                      next.delete(index)
                                    } else {
                                      next.set(index, value)
                                    }
                                    return next
                                  })
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs w-full">
                                  <SelectValue placeholder="Link to existing course..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__new__">Create new course</SelectItem>
                                  {existingCourses.map(ec => (
                                    <SelectItem key={ec.id} value={ec.id}>
                                      {ec.code}: {ec.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          {/* Show all schedules if merged, otherwise single schedule */}
                          {course.schedules ? (
                            <div className="space-y-1 mt-1">
                              {course.schedules.map((sched, schedIdx) => (
                                <div key={schedIdx} className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Clock className="h-4 w-4 flex-shrink-0" />
                                  <span>
                                    {sched.days.map(d => DAYS_OF_WEEK.find(dw => dw.value === d)?.short).join('')}{' '}
                                    {sched.startTime}-{sched.endTime}
                                  </span>
                                  {sched.location && (
                                    <>
                                      <MapPin className="h-4 w-4 flex-shrink-0" />
                                      <span>{sched.location}</span>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <Clock className="h-4 w-4" />
                              {course.days.map(d => DAYS_OF_WEEK.find(dw => dw.value === d)?.short).join('')}{' '}
                              {course.startTime}-{course.endTime}
                              {course.location && (
                                <>
                                  <MapPin className="h-4 w-4 ml-2" />
                                  {course.location}
                                </>
                              )}
                            </div>
                          )}
                          {(course.classStartDate || course.classEndDate) && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <Calendar className="h-4 w-4 flex-shrink-0" />
                              <span>
                                {course.classStartDate && new Date(course.classStartDate).toLocaleDateString()}
                                {course.classStartDate && course.classEndDate && ' – '}
                                {course.classEndDate && new Date(course.classEndDate).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          <p className={cn('text-xs mt-1', getConfidenceColor(course.confidence))}>
                            Confidence: {getConfidenceLabel(course.confidence)}
                          </p>
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
                    ))}

                    {/* Show courses not in upload */}
                    {scheduleDiff && scheduleDiff.removed > 0 && (
                      <>
                        <div className="border-t my-3 pt-3">
                          <p className="text-xs text-muted-foreground mb-2">
                            Not in this upload (will keep existing):
                          </p>
                        </div>
                        {scheduleDiff.items
                          .filter(item => item.status === 'removed')
                          .map((item, idx) => (
                            <div
                              key={`removed-${idx}`}
                              className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30 opacity-60"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm">
                                    {item.existingCourse?.code}: {item.existingCourse?.name}
                                  </p>
                                  <Badge variant="outline" className="text-xs">
                                    Keeping
                                  </Badge>
                                </div>
                                {item.existingCourse?.instructor && (
                                  <p className="text-xs text-muted-foreground">
                                    {item.existingCourse.instructor}
                                  </p>
                                )}
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
                  {editingIndex !== null && parsedCourses[editingIndex] && (
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
                        <h3 className="text-sm font-medium">Edit Course</h3>
                      </div>
                      <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="edit-code">Course Code</Label>
                            <Input
                              id="edit-code"
                              value={parsedCourses[editingIndex].code}
                              onChange={(e) => updateCourseField(editingIndex, 'code', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-name">Course Name</Label>
                            <Input
                              id="edit-name"
                              value={parsedCourses[editingIndex].name}
                              onChange={(e) => updateCourseField(editingIndex, 'name', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-instructor">Instructor</Label>
                          <Input
                            id="edit-instructor"
                            value={parsedCourses[editingIndex].instructor || ''}
                            onChange={(e) => updateCourseField(editingIndex, 'instructor', e.target.value || undefined)}
                          />
                        </div>

                        {/* Schedule editing - show first/primary schedule */}
                        <div className="space-y-2">
                          <Label>Days</Label>
                          <div className="flex gap-1">
                            {DAYS_OF_WEEK.map((day) => {
                              const currentDays = parsedCourses[editingIndex].schedules?.[0]?.days || parsedCourses[editingIndex].days
                              const isSelected = currentDays.includes(day.value)
                              return (
                                <button
                                  key={day.value}
                                  type="button"
                                  className={cn(
                                    'w-9 h-9 rounded-full text-xs font-medium transition-all',
                                    isSelected
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-muted hover:bg-muted/80'
                                  )}
                                  onClick={() => {
                                    const newDays = isSelected
                                      ? currentDays.filter(d => d !== day.value)
                                      : [...currentDays, day.value]
                                    if (parsedCourses[editingIndex].schedules) {
                                      const newSchedules = [...parsedCourses[editingIndex].schedules!]
                                      newSchedules[0] = { ...newSchedules[0], days: newDays }
                                      updateCourseField(editingIndex, 'schedules', newSchedules)
                                    } else {
                                      updateCourseField(editingIndex, 'days', newDays)
                                    }
                                  }}
                                >
                                  {day.short}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="edit-start-time">Start Time</Label>
                            <Input
                              id="edit-start-time"
                              type="time"
                              value={parsedCourses[editingIndex].schedules?.[0]?.startTime || parsedCourses[editingIndex].startTime}
                              onChange={(e) => {
                                if (parsedCourses[editingIndex].schedules) {
                                  const newSchedules = [...parsedCourses[editingIndex].schedules!]
                                  newSchedules[0] = { ...newSchedules[0], startTime: e.target.value }
                                  updateCourseField(editingIndex, 'schedules', newSchedules)
                                } else {
                                  updateCourseField(editingIndex, 'startTime', e.target.value)
                                }
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-end-time">End Time</Label>
                            <Input
                              id="edit-end-time"
                              type="time"
                              value={parsedCourses[editingIndex].schedules?.[0]?.endTime || parsedCourses[editingIndex].endTime}
                              onChange={(e) => {
                                if (parsedCourses[editingIndex].schedules) {
                                  const newSchedules = [...parsedCourses[editingIndex].schedules!]
                                  newSchedules[0] = { ...newSchedules[0], endTime: e.target.value }
                                  updateCourseField(editingIndex, 'schedules', newSchedules)
                                } else {
                                  updateCourseField(editingIndex, 'endTime', e.target.value)
                                }
                              }}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="edit-location">Location</Label>
                          <Input
                            id="edit-location"
                            value={parsedCourses[editingIndex].schedules?.[0]?.location || parsedCourses[editingIndex].location || ''}
                            onChange={(e) => {
                              if (parsedCourses[editingIndex].schedules) {
                                const newSchedules = [...parsedCourses[editingIndex].schedules!]
                                newSchedules[0] = { ...newSchedules[0], location: e.target.value || undefined }
                                updateCourseField(editingIndex, 'schedules', newSchedules)
                              } else {
                                updateCourseField(editingIndex, 'location', e.target.value || undefined)
                              }
                            }}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="edit-class-start">Class Start Date</Label>
                            <Input
                              id="edit-class-start"
                              type="date"
                              value={parsedCourses[editingIndex].classStartDate || ''}
                              onChange={(e) => updateCourseField(editingIndex, 'classStartDate', e.target.value || undefined)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-class-end">Class End Date</Label>
                            <Input
                              id="edit-class-end"
                              type="date"
                              value={parsedCourses[editingIndex].classEndDate || ''}
                              onChange={(e) => updateCourseField(editingIndex, 'classEndDate', e.target.value || undefined)}
                            />
                          </div>
                        </div>

                        {/* Show additional schedules if merged */}
                        {parsedCourses[editingIndex].schedules && parsedCourses[editingIndex].schedules!.length > 1 && (
                          <div className="pt-4 border-t">
                            <p className="text-sm font-medium mb-2">Additional Meeting Times</p>
                            {parsedCourses[editingIndex].schedules!.slice(1).map((sched, idx) => (
                              <div key={idx} className="text-sm text-muted-foreground p-2 bg-muted rounded mb-2">
                                {sched.days.map(d => DAYS_OF_WEEK.find(dw => dw.value === d)?.short).join('')}{' '}
                                {sched.startTime}-{sched.endTime}
                                {sched.location && ` @ ${sched.location}`}
                              </div>
                            ))}
                          </div>
                        )}
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
              <Button onClick={handleSave} disabled={selectedCourses.size === 0}>
                Add {selectedCourses.size} Courses
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
