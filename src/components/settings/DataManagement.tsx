import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Download, Upload, Trash2, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { db } from '@/db'
import { format } from 'date-fns'

interface ExportData {
  version: number
  exportedAt: string
  courses: unknown[]
  assignments: unknown[]
  notes: unknown[]
  studyMaterials: unknown[]
  studySessions: unknown[]
  studyPlan: unknown[]
  preferences: unknown[]
  tutoringConversations: unknown[]
  dailySummaries: unknown[]
  analytics: unknown[]
  examAttempts: unknown[]
  semesterArchives: unknown[]
  tutorBehavioralProfile: unknown[]
}

type OperationStatus = 'idle' | 'loading' | 'success' | 'error'

// Date fields that need to be converted from strings back to Date objects
const dateFields = [
  'createdAt', 'updatedAt', 'archivedAt', 'dueDate', 'extractedAt',
  'plannedStart', 'actualStart', 'generatedAt', 'validUntil',
  'timestamp', 'completedAt', 'achievedAt', 'lastAssessed',
  'lastUpdated', 'lastMentioned', 'lastInteraction', 'lastAnalyzed',
  'processedAt', 'permanentlyDeletedAt', 'semesterStart', 'semesterEnd'
]

// Recursively convert date strings to Date objects
function reviveDates<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) {
    return obj.map(item => reviveDates(item)) as T
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (dateFields.includes(key) && typeof value === 'string') {
        // Convert ISO date string to Date object
        result[key] = new Date(value)
      } else if (typeof value === 'object') {
        result[key] = reviveDates(value)
      } else {
        result[key] = value
      }
    }
    return result as T
  }
  return obj
}

export function DataManagement() {
  const [exportStatus, setExportStatus] = useState<OperationStatus>('idle')
  const [importStatus, setImportStatus] = useState<OperationStatus>('idle')
  const [clearStatus, setClearStatus] = useState<OperationStatus>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    setExportStatus('loading')
    setStatusMessage('')

    try {
      // Collect all data from tables (excluding encrypted API keys for security)
      const data: ExportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        courses: await db.courses.toArray(),
        assignments: await db.assignments.toArray(),
        notes: await db.notes.toArray(),
        studyMaterials: await db.studyMaterials.toArray(),
        studySessions: await db.studySessions.toArray(),
        studyPlan: await db.studyPlan.toArray(),
        preferences: await db.preferences.toArray(),
        tutoringConversations: await db.tutoringConversations.toArray(),
        dailySummaries: await db.dailySummaries.toArray(),
        analytics: await db.analytics.toArray(),
        examAttempts: await db.examAttempts.toArray(),
        semesterArchives: await db.semesterArchives.toArray(),
        tutorBehavioralProfile: await db.tutorBehavioralProfile.toArray(),
      }

      // Create and download file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `study-buddy-backup-${format(new Date(), 'yyyy-MM-dd')}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setExportStatus('success')
      setStatusMessage('Data exported successfully!')
      setTimeout(() => setExportStatus('idle'), 3000)
    } catch (error) {
      setExportStatus('error')
      setStatusMessage(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportStatus('loading')
    setStatusMessage('')

    try {
      const text = await file.text()
      const rawData = JSON.parse(text) as ExportData

      // Validate structure
      if (!rawData.version || !rawData.exportedAt) {
        throw new Error('Invalid backup file format')
      }

      // Convert date strings back to Date objects
      const data = reviveDates(rawData)

      // Import data into each table
      await db.transaction('rw', [
        db.courses,
        db.assignments,
        db.notes,
        db.studyMaterials,
        db.studySessions,
        db.studyPlan,
        db.preferences,
        db.tutoringConversations,
        db.dailySummaries,
        db.analytics,
        db.examAttempts,
        db.semesterArchives,
        db.tutorBehavioralProfile,
      ], async () => {
        // Clear existing data first
        await Promise.all([
          db.courses.clear(),
          db.assignments.clear(),
          db.notes.clear(),
          db.studyMaterials.clear(),
          db.studySessions.clear(),
          db.studyPlan.clear(),
          db.preferences.clear(),
          db.tutoringConversations.clear(),
          db.dailySummaries.clear(),
          db.analytics.clear(),
          db.examAttempts.clear(),
          db.semesterArchives.clear(),
          db.tutorBehavioralProfile.clear(),
        ])

        // Import new data
        if (data.courses?.length) await db.courses.bulkAdd(data.courses as never[])
        if (data.assignments?.length) await db.assignments.bulkAdd(data.assignments as never[])
        if (data.notes?.length) await db.notes.bulkAdd(data.notes as never[])
        if (data.studyMaterials?.length) await db.studyMaterials.bulkAdd(data.studyMaterials as never[])
        if (data.studySessions?.length) await db.studySessions.bulkAdd(data.studySessions as never[])
        if (data.studyPlan?.length) await db.studyPlan.bulkAdd(data.studyPlan as never[])
        if (data.preferences?.length) await db.preferences.bulkAdd(data.preferences as never[])
        if (data.tutoringConversations?.length) await db.tutoringConversations.bulkAdd(data.tutoringConversations as never[])
        if (data.dailySummaries?.length) await db.dailySummaries.bulkAdd(data.dailySummaries as never[])
        if (data.analytics?.length) await db.analytics.bulkAdd(data.analytics as never[])
        if (data.examAttempts?.length) await db.examAttempts.bulkAdd(data.examAttempts as never[])
        if (data.semesterArchives?.length) await db.semesterArchives.bulkAdd(data.semesterArchives as never[])
        if (data.tutorBehavioralProfile?.length) await db.tutorBehavioralProfile.bulkAdd(data.tutorBehavioralProfile as never[])
      })

      setImportStatus('success')
      setStatusMessage('Data imported successfully! Refreshing page...')

      // Refresh page to show imported data
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error) {
      setImportStatus('error')
      setStatusMessage(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClearData = async () => {
    setClearStatus('loading')
    setStatusMessage('')

    try {
      await db.transaction('rw', [
        db.courses,
        db.assignments,
        db.notes,
        db.studyMaterials,
        db.studySessions,
        db.studyPlan,
        db.preferences,
        db.encryptedApiKeys,
        db.tutoringConversations,
        db.dailySummaries,
        db.analytics,
        db.examAttempts,
        db.semesterArchives,
        db.tutorBehavioralProfile,
      ], async () => {
        await Promise.all([
          db.courses.clear(),
          db.assignments.clear(),
          db.notes.clear(),
          db.studyMaterials.clear(),
          db.studySessions.clear(),
          db.studyPlan.clear(),
          db.preferences.clear(),
          db.encryptedApiKeys.clear(),
          db.tutoringConversations.clear(),
          db.dailySummaries.clear(),
          db.analytics.clear(),
          db.examAttempts.clear(),
          db.semesterArchives.clear(),
          db.tutorBehavioralProfile.clear(),
        ])
      })

      setClearStatus('success')
      setStatusMessage('All data cleared! Refreshing page...')

      // Refresh page to reinitialize
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error) {
      setClearStatus('error')
      setStatusMessage(`Clear failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const getStatusIcon = (status: OperationStatus) => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-4 w-4 animate-spin" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Export Data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Export Data</CardTitle>
          <CardDescription>
            Download all your data as a JSON file. This includes courses, assignments, notes, study materials, and analytics. API keys are not included for security.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button onClick={handleExport} disabled={exportStatus === 'loading'}>
              {exportStatus === 'loading' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export Data
            </Button>
            {exportStatus !== 'idle' && (
              <div className="flex items-center gap-2 text-sm">
                {getStatusIcon(exportStatus)}
                <span className={exportStatus === 'error' ? 'text-destructive' : ''}>{statusMessage}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Import Data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Import Data</CardTitle>
          <CardDescription>
            Restore data from a backup file. This will replace all existing data with the imported data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
          <div className="flex items-center gap-4">
            <Button onClick={handleImportClick} disabled={importStatus === 'loading'} variant="outline">
              {importStatus === 'loading' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Import Data
            </Button>
            {importStatus !== 'idle' && (
              <div className="flex items-center gap-2 text-sm">
                {getStatusIcon(importStatus)}
                <span className={importStatus === 'error' ? 'text-destructive' : ''}>{statusMessage}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Clear Data */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-lg text-destructive">Clear All Data</CardTitle>
          <CardDescription>
            Permanently delete all data including courses, notes, study materials, conversations, and API keys. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={clearStatus === 'loading'}>
                  {clearStatus === 'loading' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Clear All Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all your data including:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>All courses and syllabi</li>
                      <li>All assignments</li>
                      <li>All notes and study materials</li>
                      <li>All tutor conversations</li>
                      <li>All analytics and streaks</li>
                      <li>All API keys</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearData}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, delete everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {clearStatus !== 'idle' && clearStatus !== 'loading' && (
              <div className="flex items-center gap-2 text-sm">
                {getStatusIcon(clearStatus)}
                <span className={clearStatus === 'error' ? 'text-destructive' : ''}>{statusMessage}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
