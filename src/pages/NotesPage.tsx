import { useState, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
  Upload,
  Sparkles,
  BookOpen,
  ClipboardList,
  Loader2,
  X,
  Eye,
  ChevronLeft,
  ChevronRight,
  Archive,
  HelpCircle,
} from 'lucide-react'
import { HelpPanel } from '@/components/HelpPanel'
import {
  useCourses,
  useNotes,
  createNote,
  updateNote,
  archiveNote,
  linkStudyMaterialToSessions,
} from '@/db/hooks'
import { db, generateId } from '@/db'
import type { Note, NoteImage, Course } from '@/types'
import {
  processNoteImages,
  generateStudyGuide,
  generatePracticeExam,
} from '@/lib/notesProcessor'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { isHeicFile, convertHeicToJpeg } from '@/lib/imageConverter'
import { toast } from 'sonner'
import { Mascot } from '@/components/Mascot'

export function NotesPage() {
  const courses = useCourses()
  const notes = useNotes()

  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [showImagePreview, setShowImagePreview] = useState<string | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [filterCourse, setFilterCourse] = useState<string>('all')

  // Selection state - always enabled
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set())

  // Upload state
  const [uploadImages, setUploadImages] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)

  // Post-upload edit state
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCourse, setEditCourse] = useState('')

  // Processing state
  const [processing, setProcessing] = useState<string | null>(null)
  const [generating, setGenerating] = useState<'guide' | 'exam' | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  // Filter notes by course
  const filteredNotes = useMemo(() => {
    if (!notes) return []
    if (filterCourse === 'all') return notes
    return notes.filter((n) => n.courseId === filterCourse)
  }, [notes, filterCourse])

  // Get selected notes in order
  const selectedNotes = useMemo(() => {
    return filteredNotes.filter((n) => selectedNoteIds.has(n.id))
  }, [filteredNotes, selectedNoteIds])

  // Current preview note
  const currentPreviewNote = useMemo(() => {
    if (selectedNotes.length === 0) return null
    return selectedNotes[Math.min(previewIndex, selectedNotes.length - 1)]
  }, [selectedNotes, previewIndex])

  // Check if all filtered notes from same course (for generation)
  const canGenerate = useMemo(() => {
    if (selectedNotes.length === 0) return false
    const processedNotes = selectedNotes.filter((n) => n.extractedText || n.aiSummary)
    if (processedNotes.length === 0) return false
    // All selected notes must be from the same course
    const courseIds = new Set(processedNotes.map((n) => n.courseId))
    return courseIds.size === 1
  }, [selectedNotes])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    // Accept image files by MIME type OR HEIC/HEIF by extension
    const imageFiles = files.filter((f) => {
      if (f.type.startsWith('image/')) return true
      const ext = f.name.toLowerCase().split('.').pop()
      return ext === 'heic' || ext === 'heif'
    })

    if (imageFiles.length === 0) return

    // Check if any need HEIC conversion
    const hasHeic = imageFiles.some(isHeicFile)
    let conversionToastId: string | number | undefined
    if (hasHeic) {
      conversionToastId = toast.loading('Converting HEIC images...', {
        description: 'This may take a few seconds',
      })
    }

    // Convert HEIC files to JPEG
    const convertedFiles: File[] = []
    for (const file of imageFiles) {
      if (isHeicFile(file)) {
        try {
          const converted = await convertHeicToJpeg(file)
          convertedFiles.push(converted)
        } catch (_error) {
          toast.error(`Failed to convert ${file.name}`)
        }
      } else {
        convertedFiles.push(file)
      }
    }

    if (conversionToastId) {
      toast.dismiss(conversionToastId)
    }
    if (hasHeic && convertedFiles.length > 0) {
      toast.success('HEIC images converted')
    }

    setUploadImages((prev) => [...prev, ...convertedFiles])
  }, [])

  const handleRemoveImage = useCallback((index: number) => {
    setUploadImages((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleUpload = useCallback(async () => {
    if (uploadImages.length === 0) {
      toast.error('Please add at least one image')
      return
    }

    if (!courses || courses.length === 0) {
      toast.error('Please create at least one course first')
      return
    }

    setUploading(true)
    try {
      // Convert images to data URLs
      const images: NoteImage[] = await Promise.all(
        uploadImages.map(async (file) => {
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(file)
          })

          return {
            id: generateId(),
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            dataUrl,
          }
        })
      )

      // Create note with temporary title (will be updated after processing)
      // Default to first course, will be updated after AI processing
      const noteId = await createNote({
        courseId: courses[0].id,
        title: 'Processing...',
        images,
        topics: [],
      })

      toast.success('Notes uploaded! Processing with AI...')
      setShowUploadDialog(false)
      setUploadImages([])

      // Auto-process with AI after upload
      setProcessing(noteId)
      try {
        const result = await processNoteImages(images)

        // Find the best matching course
        let matchedCourseId: string = courses[0].id // Default to first course

        // First, try to match by detected course code
        if (result.detectedCourseCode && courses) {
          const normalizedCode = result.detectedCourseCode.toLowerCase().replace(/\s+/g, '')
          const matchedCourse = courses.find((c) => {
            const courseCode = c.code.toLowerCase().replace(/\s+/g, '')
            return courseCode === normalizedCode || courseCode.includes(normalizedCode) || normalizedCode.includes(courseCode)
          })
          if (matchedCourse) {
            matchedCourseId = matchedCourse.id
          }
        }

        // If no code match, try to match by topics/content keywords
        if (matchedCourseId === courses[0].id && result.topics.length > 0) {
          const contentLower = (result.extractedText + ' ' + result.topics.join(' ')).toLowerCase()
          for (const course of courses) {
            const courseName = course.name.toLowerCase()
            const courseCode = course.code.toLowerCase()
            // Check if course name or code words appear in the content
            const courseWords = courseName.split(/\s+/).filter(w => w.length > 3)
            const matchCount = courseWords.filter(word => contentLower.includes(word)).length
            if (matchCount > 0 || contentLower.includes(courseCode)) {
              matchedCourseId = course.id
              break
            }
          }
        }

        const finalTitle = result.suggestedTitle

        await updateNote(noteId, {
          title: finalTitle,
          courseId: matchedCourseId,
          extractedText: result.extractedText,
          aiSummary: result.aiSummary,
          topics: result.topics,
          images: images.map((img) => ({
            ...img,
            processedAt: new Date(),
          })),
        })

        // Get the updated note and show edit dialog
        const updatedNote = await db.notes.get(noteId)
        if (updatedNote) {
          setEditingNote(updatedNote)
          setEditTitle(updatedNote.title)
          setEditCourse(updatedNote.courseId || courses[0].id)
        }

        toast.success('Notes processed! Review and confirm details.')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to process notes')
        console.error(error)
      } finally {
        setProcessing(null)
      }
    } catch (error) {
      toast.error('Failed to upload notes')
      console.error(error)
    } finally {
      setUploading(false)
    }
  }, [uploadImages, courses])

  const handleProcessNote = useCallback(
    async (note: Note) => {
      if (note.images.length === 0) {
        toast.error('No images to process')
        return
      }

      setProcessing(note.id)
      try {
        const course = courses?.find((c) => c.id === note.courseId)
        const result = await processNoteImages(
          note.images,
          course ? { name: course.name, code: course.code } : undefined
        )

        await updateNote(note.id, {
          extractedText: result.extractedText,
          aiSummary: result.aiSummary,
          topics: result.topics,
        })

        // Update images with processed timestamp
        const updatedImages = note.images.map((img) => ({
          ...img,
          processedAt: new Date(),
        }))
        await updateNote(note.id, { images: updatedImages })

        toast.success('Notes processed successfully')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to process notes')
        console.error(error)
      } finally {
        setProcessing(null)
      }
    },
    [courses]
  )

  const handleGenerateStudyGuide = useCallback(
    async (notesToUse: Note[]) => {
      if (notesToUse.length === 0) {
        toast.error('No notes selected')
        return
      }

      // Filter to only processed notes
      const processedNotes = notesToUse.filter((n) => n.extractedText || n.aiSummary)
      if (processedNotes.length === 0) {
        toast.error('Selected notes must be processed first')
        return
      }

      setGenerating('guide')
      try {
        const course = courses?.find((c) => c.id === processedNotes[0].courseId)
        const guide = await generateStudyGuide(
          processedNotes,
          course ? { name: course.name, code: course.code } : undefined
        )

        // Save as study material
        const materialId = generateId()
        const courseId = processedNotes[0].courseId
        await db.studyMaterials.add({
          id: materialId,
          courseId,
          type: 'guide',
          title: guide.title,
          content: guide.content,
          sourceNoteIds: processedNotes.map((n) => n.id),
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        // Retroactively link to existing study sessions
        if (courseId) {
          linkStudyMaterialToSessions(materialId, courseId)
        }

        toast.success('Study guide generated! View it in Study Materials.')
        setSelectedNoteIds(new Set())
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to generate study guide')
        console.error(error)
      } finally {
        setGenerating(null)
      }
    },
    [courses]
  )

  const handleGeneratePracticeExam = useCallback(
    async (notesToUse: Note[]) => {
      if (notesToUse.length === 0) {
        toast.error('No notes selected')
        return
      }

      // Filter to only processed notes
      const processedNotes = notesToUse.filter((n) => n.extractedText || n.aiSummary)
      if (processedNotes.length === 0) {
        toast.error('Selected notes must be processed first')
        return
      }

      setGenerating('exam')
      try {
        const course = courses?.find((c) => c.id === processedNotes[0].courseId)
        const exam = await generatePracticeExam(processedNotes, {
          questionCount: 10,
          courseContext: course ? { name: course.name, code: course.code } : undefined,
        })

        // Save as study material
        const examMaterialId = generateId()
        const examCourseId = processedNotes[0].courseId
        await db.studyMaterials.add({
          id: examMaterialId,
          courseId: examCourseId,
          type: 'practice_exam',
          title: exam.title,
          content: '',
          questions: exam.questions,
          sourceNoteIds: processedNotes.map((n) => n.id),
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        // Retroactively link to existing study sessions
        if (examCourseId) {
          linkStudyMaterialToSessions(examMaterialId, examCourseId)
        }

        toast.success('Practice exam generated! View it in Study Materials.')
        setSelectedNoteIds(new Set())
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to generate practice exam')
        console.error(error)
      } finally {
        setGenerating(null)
      }
    },
    [courses]
  )

  const handleArchiveNote = useCallback(async (noteId: string) => {
    if (!confirm('Archive this note? You can restore it later from the Archive page.')) return
    await archiveNote(noteId)
    setSelectedNoteIds((prev) => {
      const next = new Set(prev)
      next.delete(noteId)
      return next
    })
    toast.success('Note archived')
  }, [])

  const handleSaveNoteDetails = useCallback(async () => {
    if (!editingNote) return

    await updateNote(editingNote.id, {
      title: editTitle.trim() || editingNote.title,
      courseId: editCourse,
    })

    toast.success('Note details saved!')
    setEditingNote(null)
  }, [editingNote, editTitle, editCourse])

  const toggleNoteSelection = useCallback((noteId: string) => {
    setSelectedNoteIds((prev) => {
      const next = new Set(prev)
      if (next.has(noteId)) {
        next.delete(noteId)
      } else {
        next.add(noteId)
      }
      return next
    })
  }, [])

  const handleOpenPreview = useCallback((startIndex: number = 0) => {
    setPreviewIndex(startIndex)
    setShowPreviewDialog(true)
  }, [])

  const handlePreviewNote = useCallback((note: Note, e: React.MouseEvent) => {
    e.stopPropagation()
    // If this note is already selected, open preview at its index
    const noteIndex = selectedNotes.findIndex((n) => n.id === note.id)
    if (noteIndex >= 0) {
      setPreviewIndex(noteIndex)
    } else {
      // Add to selection and open preview
      setSelectedNoteIds((prev) => new Set([...prev, note.id]))
      setPreviewIndex(selectedNotes.length) // Will be the new last item
    }
    setShowPreviewDialog(true)
  }, [selectedNotes])

  const selectAllNotes = useCallback(() => {
    setSelectedNoteIds(new Set(filteredNotes.map((n) => n.id)))
  }, [filteredNotes])

  const deselectAllNotes = useCallback(() => {
    setSelectedNoteIds(new Set())
  }, [])

  const getCourseById = useCallback(
    (courseId: string | undefined): Course | undefined => {
      if (!courseId) return undefined
      return courses?.find((c) => c.id === courseId)
    },
    [courses]
  )

  const navigatePreview = useCallback((direction: 'prev' | 'next') => {
    setPreviewIndex((prev) => {
      if (direction === 'prev') {
        return prev > 0 ? prev - 1 : selectedNotes.length - 1
      } else {
        return prev < selectedNotes.length - 1 ? prev + 1 : 0
      }
    })
  }, [selectedNotes.length])

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Notes</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Click notes to select them, then generate study materials.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setShowHelp(true)}>
            <HelpCircle className="h-5 w-5" />
          </Button>
          <Select value={filterCourse} onValueChange={setFilterCourse}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All Courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses?.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="flex-1 sm:flex-none" onClick={() => setShowUploadDialog(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Notes
          </Button>
        </div>
      </div>

      {/* Selection & Generation Actions */}
      {filteredNotes.length > 0 && (
        <div className="mb-4 bg-muted/50 rounded-lg p-3 space-y-3">
          {/* Top row: Selection info and selection controls */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium mr-auto">
              {selectedNoteIds.size} of {filteredNotes.length} selected
            </span>
            <Button variant="ghost" size="sm" onClick={selectAllNotes}>
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={deselectAllNotes} disabled={selectedNoteIds.size === 0}>
              Clear
            </Button>
            {selectedNoteIds.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenPreview(0)}
              >
                <Eye className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Preview ({selectedNoteIds.size})</span>
                <span className="sm:hidden">({selectedNoteIds.size})</span>
              </Button>
            )}
          </div>

          {/* Bottom row: Generate buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => handleGenerateStudyGuide(selectedNotes)}
              disabled={!canGenerate || generating !== null}
              className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700"
              style={{ color: 'white' }}
            >
              {generating === 'guide' ? (
                <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
              ) : (
                <BookOpen className="h-4 w-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">Generate Study Guide</span>
              <span className="sm:hidden">Study Guide</span>
            </Button>
            <Button
              size="sm"
              onClick={() => handleGeneratePracticeExam(selectedNotes)}
              disabled={!canGenerate || generating !== null}
              className="flex-1 sm:flex-none bg-purple-600 hover:bg-purple-700"
              style={{ color: 'white' }}
            >
              {generating === 'exam' ? (
                <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
              ) : (
                <ClipboardList className="h-4 w-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">Generate Practice Exam</span>
              <span className="sm:hidden">Practice Exam</span>
            </Button>
          </div>
        </div>
      )}

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mascot size="lg" />
            <h3 className="text-lg font-medium mb-2 mt-4">No notes yet</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Upload photos or scans of your notes to get started.
              <br />
              AI will automatically extract and summarize the content.
            </p>
            <Button onClick={() => setShowUploadDialog(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Notes
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredNotes.map((note) => {
            const course = getCourseById(note.courseId)
            const isProcessed = !!note.extractedText || !!note.aiSummary
            const isProcessing = processing === note.id
            const isSelected = selectedNoteIds.has(note.id)

            return (
              <Card
                key={note.id}
                className={cn(
                  'overflow-hidden cursor-pointer transition-all',
                  isSelected
                    ? 'ring-2 ring-primary ring-offset-2 shadow-md'
                    : 'hover:shadow-md hover:ring-1 hover:ring-primary/30'
                )}
                onClick={() => toggleNoteSelection(note.id)}
              >
                {/* Preview Image */}
                <div className="aspect-video bg-muted relative">
                  {note.images[0] && (
                    <img
                      src={note.images[0].dataUrl}
                      alt={note.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                  {note.images.length > 1 && (
                    <Badge className="absolute bottom-2 right-2 bg-black/70">
                      +{note.images.length - 1} more
                    </Badge>
                  )}
                  {isProcessing && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="flex items-center gap-2 text-white">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm">Processing...</span>
                      </div>
                    </div>
                  )}
                  {/* Selection indicator */}
                  <div className={cn(
                    'absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                    isSelected
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-white/80 border-gray-300 dark:bg-gray-800/80 dark:border-gray-600'
                  )}>
                    {isSelected && <span className="text-xs font-bold">✓</span>}
                  </div>
                  {/* Action buttons */}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8 bg-white/90 hover:bg-white text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:!text-white [&_svg]:dark:!text-white"
                      onClick={(e) => handlePreviewNote(note, e)}
                      title="Preview"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8 bg-white/90 hover:bg-orange-100 text-gray-700 hover:text-orange-600 dark:bg-gray-700 dark:hover:bg-orange-900/50 dark:!text-white dark:hover:!text-orange-300 [&_svg]:dark:!text-white [&_svg]:dark:hover:!text-orange-300"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleArchiveNote(note.id)
                      }}
                      title="Archive"
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <CardContent className="p-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <h3 className="font-medium truncate">{note.title}</h3>

                    {/* Course and Status badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {course ? (
                        <Badge
                          variant="outline"
                          style={{ borderColor: course.color, color: course.color }}
                        >
                          {course.code}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Uncategorized
                        </Badge>
                      )}
                      {isProcessed ? (
                        <Badge variant="secondary" className="text-xs">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Processed
                        </Badge>
                      ) : !isProcessing && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Pending
                        </Badge>
                      )}
                    </div>

                    {/* Summary - 2 lines max */}
                    {note.aiSummary && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {note.aiSummary}
                      </p>
                    )}

                    {/* Topics - show top 3-4 as tags */}
                    {note.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {note.topics.slice(0, 4).map((topic, i) => (
                          <span
                            key={i}
                            className="inline-block px-1.5 py-0.5 text-[10px] bg-muted rounded text-muted-foreground"
                          >
                            {topic}
                          </span>
                        ))}
                        {note.topics.length > 4 && (
                          <span className="inline-block px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            +{note.topics.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Notes</DialogTitle>
            <DialogDescription>
              Upload photos or scans of your notes. AI will automatically extract content, generate a title, and match to your courses.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Images</Label>
              <div
                className={cn(
                  'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-accent/50 transition-colors',
                  uploadImages.length > 0 && 'border-primary'
                )}
                onClick={() => document.getElementById('image-upload')?.click()}
              >
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*,.heic,.heif"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Click to select images (including iPhone HEIC)
                </p>
              </div>

              {uploadImages.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {uploadImages.map((file, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full aspect-square object-cover rounded"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveImage(index)
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploading || uploadImages.length === 0}>
              {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Upload & Process
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Note Details Dialog (shown after processing) */}
      <Dialog open={!!editingNote} onOpenChange={(open) => !open && setEditingNote(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Note Details</DialogTitle>
            <DialogDescription>
              AI has processed your notes. Review and adjust the title and course if needed.
            </DialogDescription>
          </DialogHeader>

          {editingNote && (
            <div className="space-y-4">
              {/* Preview thumbnail */}
              {editingNote.images[0] && (
                <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                  <img
                    src={editingNote.images[0].dataUrl}
                    alt="Note preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* AI Summary preview */}
              {editingNote.aiSummary && (
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">{editingNote.aiSummary}</p>
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-course">Course</Label>
                  <Select value={editCourse} onValueChange={setEditCourse}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {courses?.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.code} - {course.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={handleSaveNoteDetails}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note Preview Dialog - Full Width with Navigation */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 top-[5vh] sm:top-[50%] translate-y-0 sm:-translate-y-1/2" showCloseButton={false}>
          {currentPreviewNote && (
            <>
              {/* Header */}
              <div className="p-3 sm:p-4 border-b flex-shrink-0 space-y-2 sm:space-y-3">
                {/* Top row: Title and close button */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-base sm:text-xl leading-snug break-words">
                      {currentPreviewNote.title}
                    </DialogTitle>
                    {selectedNotes.length > 1 && (
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {previewIndex + 1} of {selectedNotes.length}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0 -mt-1"
                    onClick={() => setShowPreviewDialog(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                {/* Bottom row: Action buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleProcessNote(currentPreviewNote)}
                    disabled={processing === currentPreviewNote.id}
                  >
                    {processing === currentPreviewNote.id ? (
                      <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 sm:mr-2" />
                    )}
                    <span className="hidden sm:inline">
                      {currentPreviewNote.extractedText ? 'Reprocess' : 'Process'}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                    onClick={() => {
                      handleArchiveNote(currentPreviewNote.id)
                      if (selectedNotes.length <= 1) {
                        setShowPreviewDialog(false)
                      }
                    }}
                  >
                    <Archive className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Archive</span>
                  </Button>
                </div>
              </div>

              {/* Content with Navigation */}
              <div className="flex-1 overflow-hidden flex relative">
                {/* Previous Arrow */}
                {selectedNotes.length > 1 && (
                  <button
                    className="absolute left-0 top-0 bottom-0 w-16 flex items-center justify-center bg-gradient-to-r from-black/20 to-transparent hover:from-black/40 transition-all z-10"
                    onClick={() => navigatePreview('prev')}
                  >
                    <ChevronLeft className="h-10 w-10 text-white drop-shadow-lg" />
                  </button>
                )}

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Image Gallery */}
                    <div className="space-y-4">
                      <h3 className="font-medium text-muted-foreground">Images</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {currentPreviewNote.images.map((img, index) => (
                          <div
                            key={img.id}
                            className="aspect-square bg-muted rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setShowImagePreview(img.dataUrl)}
                          >
                            <img
                              src={img.dataUrl}
                              alt={`Page ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Note Details */}
                    <div className="space-y-4">
                      {/* Meta Info */}
                      <div className="flex items-center gap-2">
                        {getCourseById(currentPreviewNote.courseId) && (
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: getCourseById(currentPreviewNote.courseId)?.color,
                              color: getCourseById(currentPreviewNote.courseId)?.color,
                            }}
                          >
                            {getCourseById(currentPreviewNote.courseId)?.code}
                          </Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(currentPreviewNote.createdAt), 'MMM d, yyyy')}
                        </span>
                        {(currentPreviewNote.extractedText || currentPreviewNote.aiSummary) && (
                          <Badge variant="secondary" className="text-xs">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Processed
                          </Badge>
                        )}
                      </div>

                      {/* Topics */}
                      {currentPreviewNote.topics.length > 0 && (
                        <div>
                          <h3 className="font-medium text-muted-foreground mb-2">Topics</h3>
                          <div className="flex flex-wrap gap-1">
                            {currentPreviewNote.topics.map((topic, i) => (
                              <Badge key={i} variant="secondary">
                                {topic}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI Summary */}
                      {currentPreviewNote.aiSummary && (
                        <div>
                          <h3 className="font-medium text-muted-foreground mb-2">AI Summary</h3>
                          <p className="text-sm bg-muted p-3 rounded-lg">{currentPreviewNote.aiSummary}</p>
                        </div>
                      )}

                      {/* Extracted Text */}
                      {currentPreviewNote.extractedText && (
                        <div>
                          <h3 className="font-medium text-muted-foreground mb-2">Extracted Text</h3>
                          <div className="text-sm p-4 bg-muted rounded-lg max-h-64 overflow-y-auto whitespace-pre-wrap">
                            {currentPreviewNote.extractedText}
                          </div>
                        </div>
                      )}

                      {/* Not processed message */}
                      {!currentPreviewNote.extractedText && !currentPreviewNote.aiSummary && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>This note hasn't been processed yet.</p>
                          <p className="text-sm">Click "Process" to extract text with AI.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Next Arrow */}
                {selectedNotes.length > 1 && (
                  <button
                    className="absolute right-0 top-0 bottom-0 w-16 flex items-center justify-center bg-gradient-to-l from-black/20 to-transparent hover:from-black/40 transition-all z-10"
                    onClick={() => navigatePreview('next')}
                  >
                    <ChevronRight className="h-10 w-10 text-white drop-shadow-lg" />
                  </button>
                )}
              </div>

              {/* Footer with note thumbnails for quick navigation */}
              {selectedNotes.length > 1 && (
                <div className="border-t p-3 flex-shrink-0">
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {selectedNotes.map((note, index) => (
                      <button
                        key={note.id}
                        onClick={() => setPreviewIndex(index)}
                        className={cn(
                          'flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all',
                          index === previewIndex
                            ? 'border-primary ring-2 ring-primary/50'
                            : 'border-transparent hover:border-gray-300'
                        )}
                      >
                        {note.images[0] && (
                          <img
                            src={note.images[0].dataUrl}
                            alt={note.title}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Full Image Preview Dialog */}
      <Dialog open={!!showImagePreview} onOpenChange={() => setShowImagePreview(null)}>
        <DialogContent className="max-w-5xl p-0 bg-black">
          {showImagePreview && (
            <img
              src={showImagePreview}
              alt="Note preview"
              className="w-full h-auto max-h-[90vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Loading Overlay */}
      {generating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>
                {generating === 'guide' ? 'Generating study guide...' : 'Generating practice exam...'}
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* Help Panel */}
      <HelpPanel
        docPath="user/features/notes"
        open={showHelp}
        onOpenChange={setShowHelp}
        title="Notes Help"
      />
    </div>
  )
}
