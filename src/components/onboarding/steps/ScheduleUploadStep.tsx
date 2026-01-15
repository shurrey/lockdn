import { useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowRight,
  ArrowLeft,
  Upload,
  AlertCircle,
  Loader2,
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  Edit,
  ChevronLeft,
} from 'lucide-react'
import { FileUpload, type UploadedFile } from '@/components/syllabus/FileUpload'
import { SourceImageViewer, filesToSourceImages, type SourceImage } from '@/components/ui/source-image-viewer'
import { createCourse, useCourses } from '@/db/hooks'
import { parseCourseSchedule, type ParsedScheduleEntry } from '@/lib/syllabusParser'
import { extractFromFiles } from '@/lib/fileExtractor'
import { getNextAvailableColor } from '@/lib/courseColors'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { DayOfWeek } from '@/types'

interface ScheduleUploadStepProps {
  onNext: () => void
  onBack: () => void
  onScheduleUploaded: () => void
  onSkip: () => void
  hasApiKey: boolean
}

const DAYS_OF_WEEK: { short: string; value: DayOfWeek }[] = [
  { short: 'M', value: 'monday' },
  { short: 'T', value: 'tuesday' },
  { short: 'W', value: 'wednesday' },
  { short: 'Th', value: 'thursday' },
  { short: 'F', value: 'friday' },
  { short: 'Sa', value: 'saturday' },
  { short: 'Su', value: 'sunday' },
]

type Step = 'choice' | 'upload' | 'processing' | 'review' | 'saving'

export function ScheduleUploadStep({
  onNext,
  onBack,
  onScheduleUploaded,
  onSkip,
  hasApiKey,
}: ScheduleUploadStepProps) {
  const existingCourses = useCourses()
  const [step, setStep] = useState<Step>('choice')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [sourceImages, setSourceImages] = useState<SourceImage[]>([])
  const [parsedCourses, setParsedCourses] = useState<ParsedScheduleEntry[]>([])
  const [selectedCourses, setSelectedCourses] = useState<Set<number>>(new Set())
  const [hoveredCourse, setHoveredCourse] = useState<number | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [semesterStart, setSemesterStart] = useState('')
  const [semesterEnd, setSemesterEnd] = useState('')
  const [error, setError] = useState<string | null>(null)

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

  const handleSave = useCallback(async () => {
    setStep('saving')
    try {
      const usedColors = existingCourses?.map(c => c.color) || []

      for (const index of selectedCourses) {
        const course = parsedCourses[index]
        if (course) {
          const schedule = course.schedules || [{
            days: course.days,
            startTime: course.startTime,
            endTime: course.endTime,
            location: course.location,
          }]

          const startDate = course.classStartDate || semesterStart
          const endDate = course.classEndDate || semesterEnd

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
        }
      }

      toast.success(`Added ${selectedCourses.size} courses`)
      onScheduleUploaded()
      onNext()
    } catch (_err) {
      toast.error('Failed to save courses')
      setStep('review')
    }
  }, [selectedCourses, parsedCourses, semesterStart, semesterEnd, existingCourses, onScheduleUploaded, onNext])

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
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Import Your Course Schedule</h2>
        <p className="text-muted-foreground">
          {hasApiKey
            ? 'Upload a screenshot of your class schedule and we\'ll automatically extract your courses and meeting times.'
            : 'Configure an API key first to enable AI-powered schedule parsing.'}
        </p>
      </div>

      {step === 'choice' && (
        <div className="space-y-4">
          {/* Upload schedule option */}
          <Card
            className={cn(
              'cursor-pointer transition-all hover:border-primary/50',
              !hasApiKey && 'opacity-60 cursor-not-allowed'
            )}
            onClick={() => hasApiKey && setStep('upload')}
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Upload Class Schedule</h3>
                  <p className="text-sm text-muted-foreground">
                    Take a screenshot of your schedule from your school's portal and upload it.
                    AI will extract course names, codes, meeting times, and locations.
                  </p>
                  {!hasApiKey && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                      Requires API key (configure in previous step)
                    </p>
                  )}
                </div>
                {hasApiKey && <ArrowRight className="h-5 w-5 text-muted-foreground" />}
              </div>
            </CardContent>
          </Card>

          {/* Skip option */}
          <Card className="cursor-pointer transition-all hover:border-primary/50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-muted">
                  <Calendar className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Skip for Now</h3>
                  <p className="text-sm text-muted-foreground">
                    You can add courses manually later from the Courses page, or import
                    your schedule at any time.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Schedule
            </CardTitle>
            <CardDescription>
              Upload a screenshot or PDF of your class schedule from your school's portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FileUpload onFilesSelected={handleFilesSelected} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="semester-start">Semester Start (optional)</Label>
                <Input
                  id="semester-start"
                  type="date"
                  value={semesterStart}
                  onChange={(e) => setSemesterStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="semester-end">Semester End (optional)</Label>
                <Input
                  id="semester-end"
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

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('choice')}>
                Back
              </Button>
              <Button onClick={handleProcess} disabled={files.length === 0}>
                <Sparkles className="mr-2 h-4 w-4" />
                Extract Courses
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'processing' && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Processing schedule...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Extracting course information
            </p>
          </CardContent>
        </Card>
      )}

      {step === 'review' && (
        <div className="flex flex-col h-[70vh] min-h-[400px]">
          <p className="text-sm text-muted-foreground mb-4 flex-shrink-0">
            Found {parsedCourses.length} courses. Hover over a course to verify it in the source image.
          </p>

          {/* Split view: Source image + Course list */}
          <div className="grid grid-cols-[3fr_2fr] gap-6 flex-1 min-h-0">
            {/* Source Image Viewer */}
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

            {/* Course List / Edit Panel */}
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
                      selectedCourses.has(index)
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted',
                      hoveredCourse === index && 'ring-2 ring-primary shadow-md'
                    )}
                    onMouseEnter={() => setHoveredCourse(index)}
                    onMouseLeave={() => setHoveredCourse(null)}
                  >
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 cursor-pointer',
                        selectedCourses.has(index)
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground'
                      )}
                      onClick={() => toggleCourse(index)}
                    >
                      {selectedCourses.has(index) && (
                        <CheckCircle className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{course.code}: {course.name}</p>
                      {course.instructor && (
                        <p className="text-xs text-muted-foreground">{course.instructor}</p>
                      )}
                      {course.schedules ? (
                        <div className="space-y-0.5 mt-1">
                          {course.schedules.map((sched, schedIdx) => (
                            <div key={schedIdx} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3 flex-shrink-0" />
                              <span>
                                {sched.days.map(d => DAYS_OF_WEEK.find(dw => dw.value === d)?.short).join('')}{' '}
                                {sched.startTime}-{sched.endTime}
                              </span>
                              {sched.location && (
                                <>
                                  <MapPin className="h-3 w-3 flex-shrink-0 ml-1" />
                                  <span className="truncate">{sched.location}</span>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" />
                          {course.days.map(d => DAYS_OF_WEEK.find(dw => dw.value === d)?.short).join('')}{' '}
                          {course.startTime}-{course.endTime}
                          {course.location && (
                            <>
                              <MapPin className="h-3 w-3 ml-1" />
                              <span className="truncate">{course.location}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingIndex(index)
                      }}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                      {/* Additional schedules notice */}
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

          <div className="flex justify-between pt-4 flex-shrink-0">
            <Button variant="outline" onClick={() => {
              setStep('upload')
              setEditingIndex(null)
            }}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleSave} disabled={selectedCourses.size === 0}>
              Add {selectedCourses.size} Courses
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 'saving' && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Saving courses...</p>
          </CardContent>
        </Card>
      )}

      {/* Navigation for choice step */}
      {step === 'choice' && (
        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={onSkip}>
            Skip for Now
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
