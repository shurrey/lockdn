import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  ArrowRight,
  ArrowLeft,
  FileText,
  Check,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { SyllabusUploader } from '@/components/syllabus/SyllabusUploader'
import { useCourses, updateCourse, createAssignment } from '@/db/hooks'
import type { SyllabusParseResult } from '@/lib/syllabusParser'
import { cn } from '@/lib/utils'

interface SyllabusUploadStepProps {
  onNext: () => void
  onBack: () => void
  hasApiKey: boolean
}

type Mode = 'choice' | 'select-course' | 'upload'

export function SyllabusUploadStep({
  onNext,
  onBack,
  hasApiKey,
}: SyllabusUploadStepProps) {
  const courses = useCourses()
  const [mode, setMode] = useState<Mode>('choice')
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadedCourses, setUploadedCourses] = useState<Set<string>>(new Set())

  const selectedCourse = courses?.find(c => c.id === selectedCourseId)

  const handleSyllabusComplete = useCallback(
    async (result: SyllabusParseResult) => {
      if (!selectedCourseId) return

      setIsProcessing(true)
      try {
        // Update the course with syllabus data
        await updateCourse(selectedCourseId, {
          syllabusData: {
            rawText: result.rawResponse,
            extractedAt: new Date(),
            sourceFileName: 'syllabus',
            sourceFileType: 'application/pdf',
          },
          instructor: result.course.instructor || undefined,
        })

        // Create assignments from syllabus
        for (const assignment of result.assignments) {
          await createAssignment({
            courseId: selectedCourseId,
            title: assignment.title,
            type: assignment.type,
            dueDate: new Date(assignment.dueDate),
            weight: assignment.weight,
            description: assignment.description,
            confidenceScore: assignment.confidence,
            status: 'pending',
          })
        }

        // Mark this course as having syllabus uploaded
        setUploadedCourses(prev => new Set([...prev, selectedCourseId]))
        setMode('choice')
        setSelectedCourseId(null)
      } finally {
        setIsProcessing(false)
      }
    },
    [selectedCourseId]
  )

  const coursesWithoutSyllabus = courses?.filter(c => !c.syllabusData && !uploadedCourses.has(c.id)) || []
  const allCoursesHaveSyllabus = coursesWithoutSyllabus.length === 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Upload Course Syllabi</h2>
        <p className="text-muted-foreground">
          Upload syllabi for your courses to automatically extract assignments, exams, and due dates.
        </p>
      </div>

      {/* Success state */}
      {uploadedCourses.size > 0 && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900">
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            {uploadedCourses.size} syllab{uploadedCourses.size !== 1 ? 'i' : 'us'} uploaded successfully!
          </AlertDescription>
        </Alert>
      )}

      {mode === 'choice' && (
        <div className="space-y-4">
          {/* Show courses that need syllabi */}
          {!allCoursesHaveSyllabus && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Courses Without Syllabi
                </CardTitle>
                <CardDescription>
                  Select a course to upload its syllabus
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {coursesWithoutSyllabus.map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => {
                      setSelectedCourseId(course.id)
                      setMode('upload')
                    }}
                    disabled={!hasApiKey}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all',
                      hasApiKey
                        ? 'hover:border-primary hover:bg-primary/5 cursor-pointer'
                        : 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div
                      className="h-4 w-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: course.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{course.code}</p>
                      <p className="text-sm text-muted-foreground truncate">{course.name}</p>
                    </div>
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}

                {!hasApiKey && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                    API key required for AI-powered syllabus parsing
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* All done state */}
          {allCoursesHaveSyllabus && courses && courses.length > 0 && (
            <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/50">
                    <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">
                      All courses have syllabi!
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      You can upload more syllabi later from the Courses page.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* No courses state */}
          {(!courses || courses.length === 0) && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">
                  No courses added yet. You can upload syllabi after adding courses.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {mode === 'upload' && selectedCourse && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
            <div
              className="h-4 w-4 rounded-full"
              style={{ backgroundColor: selectedCourse.color }}
            />
            <span className="font-medium">{selectedCourse.code}: {selectedCourse.name}</span>
          </div>

          {isProcessing ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-lg font-medium">Processing syllabus...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Extracting assignments and due dates
                </p>
              </CardContent>
            </Card>
          ) : (
            <SyllabusUploader
              onComplete={handleSyllabusComplete}
              onCancel={() => {
                setMode('choice')
                setSelectedCourseId(null)
              }}
            />
          )}
        </div>
      )}

      {/* Navigation */}
      {mode === 'choice' && (
        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={onNext}>
            {uploadedCourses.size > 0 || allCoursesHaveSyllabus ? 'Continue' : 'Skip for Now'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
