import { useState, useCallback } from 'react'
import { FileUpload, type UploadedFile } from './FileUpload'
import { SyllabusReview } from './SyllabusReview'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, Sparkles } from 'lucide-react'
import { extractFromFiles } from '@/lib/fileExtractor'
import {
  parseSyllabus,
  validateAssignments,
  type SyllabusParseResult,
} from '@/lib/syllabusParser'
import { hasConfiguredProvider } from '@/lib/ai'
import { Link } from 'react-router-dom'
import type { Assignment } from '@/types'

interface SyllabusUploaderProps {
  onComplete: (result: SyllabusParseResult) => void
  onCancel?: () => void
  existingAssignments?: Assignment[] // For showing diff when re-uploading
}

type Step = 'upload' | 'processing' | 'review' | 'error'

export function SyllabusUploader({ onComplete, onCancel, existingAssignments }: SyllabusUploaderProps) {
  const [step, setStep] = useState<Step>('upload')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [parseResult, setParseResult] = useState<SyllabusParseResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasProvider, setHasProvider] = useState<boolean | null>(null)

  // Check if provider is configured on mount
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
      // Extract content from files
      const { combinedText, allImages } = await extractFromFiles(
        files.map((f) => f.file)
      )

      // Parse with AI
      const result = await parseSyllabus(combinedText, allImages)

      // Validate assignments
      result.assignments = validateAssignments(result.assignments)

      setParseResult(result)
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process syllabus')
      setStep('error')
    }
  }, [files])

  const handleReviewComplete = useCallback(
    (result: SyllabusParseResult) => {
      onComplete(result)
    },
    [onComplete]
  )

  const handleRetry = useCallback(() => {
    setStep('upload')
    setError(null)
    setParseResult(null)
  }, [])

  // Show API key warning if no provider configured
  if (hasProvider === false) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Configuration Required</CardTitle>
          <CardDescription>
            To parse syllabi automatically, you need to configure an AI provider.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please configure an API key in Settings to enable AI-powered syllabus
              parsing.
            </AlertDescription>
          </Alert>
          <div className="mt-4 flex gap-2">
            <Button asChild>
              <Link to="/settings">Configure API Key</Link>
            </Button>
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Loading state while checking provider
  if (hasProvider === null) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Upload Syllabus
            </CardTitle>
            <CardDescription>
              Upload your course syllabus and we'll automatically extract assignments,
              exams, and deadlines using AI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FileUpload onFilesSelected={handleFilesSelected} />

            {files.length > 0 && (
              <div className="flex justify-end gap-2">
                {onCancel && (
                  <Button variant="outline" onClick={onCancel}>
                    Cancel
                  </Button>
                )}
                <Button onClick={handleProcess}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Extract with AI
                </Button>
              </div>
            )}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Accuracy isn't guaranteed. You'll have a chance to review and correct
                all extracted items before they're added to your calendar.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {step === 'processing' && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Processing syllabus...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Extracting course information and assignments
            </p>
          </CardContent>
        </Card>
      )}

      {step === 'review' && parseResult && (
        <SyllabusReview
          result={parseResult}
          onComplete={handleReviewComplete}
          onBack={handleRetry}
          existingAssignments={existingAssignments}
        />
      )}

      {step === 'error' && (
        <Card>
          <CardContent className="py-8">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="mt-4 flex gap-2">
              <Button onClick={handleRetry}>Try Again</Button>
              {onCancel && (
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
