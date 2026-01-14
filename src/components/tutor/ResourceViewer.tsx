import { useState, useEffect } from 'react'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  X,
  FileText,
  BookOpen,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { db } from '@/db'
import type { Note, StudyMaterial } from '@/types'
import type { ResourceLink, ResourceType } from './MessageRenderer'
import { cn } from '@/lib/utils'

interface ResourceViewerProps {
  resource: ResourceLink | null
  onClose: () => void
  compact?: boolean
  className?: string
}

function ResourceIcon({ type }: { type: ResourceType }) {
  switch (type) {
    case 'note':
      return <FileText className="h-5 w-5" />
    case 'guide':
      return <BookOpen className="h-5 w-5" />
    case 'exam':
      return <ClipboardCheck className="h-5 w-5" />
  }
}

function getResourceLabel(type: ResourceType): string {
  switch (type) {
    case 'note':
      return 'Note'
    case 'guide':
      return 'Study Guide'
    case 'exam':
      return 'Practice Exam'
  }
}

// Compact note viewer - only image carousel, fills the space
function CompactNoteViewer({ note }: { note: Note }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const hasMultipleImages = note.images.length > 1

  const goToPrevious = () => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : note.images.length - 1))
  }

  const goToNext = () => {
    setCurrentImageIndex((prev) => (prev < note.images.length - 1 ? prev + 1 : 0))
  }

  if (note.images.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No images in this note</p>
      </div>
    )
  }

  return (
    <div className="relative h-full flex items-center justify-center bg-muted/30">
      <img
        src={note.images[currentImageIndex].dataUrl}
        alt={`Page ${currentImageIndex + 1} of ${note.title}`}
        className="max-w-full max-h-full object-contain"
      />

      {/* Image navigation */}
      {hasMultipleImages && (
        <>
          <Button
            variant="secondary"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full shadow-lg"
            onClick={goToPrevious}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full shadow-lg"
            onClick={goToNext}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-background/90 rounded-full text-sm font-medium shadow-lg">
            {currentImageIndex + 1} / {note.images.length}
          </div>
        </>
      )}
    </div>
  )
}

// Full note viewer with all details
function NoteViewer({ note }: { note: Note }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const hasMultipleImages = note.images.length > 1

  const goToPrevious = () => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : note.images.length - 1))
  }

  const goToNext = () => {
    setCurrentImageIndex((prev) => (prev < note.images.length - 1 ? prev + 1 : 0))
  }

  return (
    <div className="space-y-4">
      {/* Topics */}
      {note.topics.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {note.topics.map((topic) => (
            <Badge key={topic} variant="secondary" className="text-xs">
              {topic}
            </Badge>
          ))}
        </div>
      )}

      {/* AI Summary */}
      {note.aiSummary && (
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-sm font-medium mb-1">Summary</p>
          <p className="text-sm text-muted-foreground">{note.aiSummary}</p>
        </div>
      )}

      {/* Images */}
      {note.images.length > 0 && (
        <div className="relative">
          <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
            <img
              src={note.images[currentImageIndex].dataUrl}
              alt={`Page ${currentImageIndex + 1} of ${note.title}`}
              className="w-full h-full object-contain"
            />
          </div>

          {/* Image navigation */}
          {hasMultipleImages && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
                onClick={goToPrevious}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
                onClick={goToNext}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-background/80 rounded text-xs">
                {currentImageIndex + 1} / {note.images.length}
              </div>
            </>
          )}
        </div>
      )}

      {/* Extracted text */}
      {note.extractedText && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Extracted Text</p>
          <div className="p-3 bg-muted rounded-lg max-h-[200px] overflow-y-auto">
            <p className="text-sm whitespace-pre-wrap">{note.extractedText}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// Study guide viewer with markdown content
function GuideViewer({ guide }: { guide: StudyMaterial }) {
  return (
    <div className="space-y-4">
      {/* Source notes */}
      {guide.sourceNoteIds && guide.sourceNoteIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Generated from {guide.sourceNoteIds.length} note(s)
        </p>
      )}

      {/* Content */}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <div className="whitespace-pre-wrap">{guide.content}</div>
      </div>
    </div>
  )
}

// Practice exam viewer
function ExamViewer({ exam }: { exam: StudyMaterial }) {
  return (
    <div className="space-y-4">
      {/* Question count */}
      {exam.questions && (
        <p className="text-sm text-muted-foreground">
          {exam.questions.length} question(s)
        </p>
      )}

      {/* Questions preview */}
      {exam.questions && exam.questions.length > 0 && (
        <div className="space-y-4">
          {exam.questions.slice(0, 5).map((q, index) => (
            <div key={q.id} className="p-3 bg-muted rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {index + 1}.
                </span>
                <div className="flex-1">
                  <p className="text-sm">{q.question}</p>
                  {q.options && (
                    <ul className="mt-2 space-y-1">
                      {q.options.map((opt, optIndex) => (
                        <li
                          key={optIndex}
                          className="text-sm text-muted-foreground pl-4"
                        >
                          {String.fromCharCode(65 + optIndex)}. {opt}
                        </li>
                      ))}
                    </ul>
                  )}
                  <Badge variant="outline" className="mt-2 text-xs">
                    {q.bloomLevel}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
          {exam.questions.length > 5 && (
            <p className="text-sm text-muted-foreground text-center">
              + {exam.questions.length - 5} more questions
            </p>
          )}
        </div>
      )}

      {/* Content preview if no questions */}
      {(!exam.questions || exam.questions.length === 0) && exam.content && (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <div className="whitespace-pre-wrap">{exam.content}</div>
        </div>
      )}
    </div>
  )
}

export function ResourceViewer({ resource, onClose, compact = false, className }: ResourceViewerProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Note | StudyMaterial | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch resource data when resource changes
  useEffect(() => {
    if (!resource) {
      setData(null)
      return
    }

    setLoading(true)
    setError(null)

    const fetchData = async () => {
      try {
        if (resource.type === 'note') {
          const note = await db.notes.get(resource.id)
          if (!note) throw new Error('Note not found')
          setData(note)
        } else {
          // Both guide and exam are StudyMaterial
          const material = await db.studyMaterials.get(resource.id)
          if (!material) throw new Error('Material not found')
          setData(material)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load resource')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [resource])

  if (!resource) return null

  // Compact mode for notes - just the image viewer filling the space
  if (compact && resource.type === 'note') {
    return (
      <div className={cn('flex flex-col h-full', className)}>
        {/* Minimal header with just title and close */}
        <div className="flex-shrink-0 flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium truncate">{resource.title}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Image viewer takes remaining space */}
        <div className="flex-1 min-h-0">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={onClose}>
                Close
              </Button>
            </div>
          )}

          {!loading && !error && data && (
            <CompactNoteViewer note={data as Note} />
          )}
        </div>
      </div>
    )
  }

  // Full mode with all details
  return (
    <div className={cn('flex flex-col h-full', className)}>
      <CardHeader className="flex-shrink-0 py-3 px-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <ResourceIcon type={resource.type} />
            <div className="min-w-0">
              <Badge variant="secondary" className="text-xs mb-1">
                {getResourceLabel(resource.type)}
              </Badge>
              <CardTitle className="text-sm font-medium truncate">
                {resource.title}
              </CardTitle>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full p-4">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={onClose}>
                Close
              </Button>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {resource.type === 'note' && <NoteViewer note={data as Note} />}
              {resource.type === 'guide' && <GuideViewer guide={data as StudyMaterial} />}
              {resource.type === 'exam' && <ExamViewer exam={data as StudyMaterial} />}
            </>
          )}
        </ScrollArea>
      </CardContent>
    </div>
  )
}
