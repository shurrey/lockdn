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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Download, Upload, Trash2, Loader2, CheckCircle, AlertCircle, ReplaceAll, Merge } from 'lucide-react'
import { db } from '@/db'
import { format } from 'date-fns'
import { importFromFile, type ExportData, type ImportMode } from '@/lib/dataImport'

type OperationStatus = 'idle' | 'loading' | 'success' | 'error'

export function DataManagement() {
  const [exportStatus, setExportStatus] = useState<OperationStatus>('idle')
  const [importStatus, setImportStatus] = useState<OperationStatus>('idle')
  const [clearStatus, setClearStatus] = useState<OperationStatus>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Store the file and show the import mode dialog
    setPendingFile(file)
    setShowImportDialog(true)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleImportWithMode = async (mode: ImportMode) => {
    if (!pendingFile) return

    setShowImportDialog(false)
    setImportStatus('loading')
    setStatusMessage('')

    try {
      const result = await importFromFile(pendingFile, mode)

      setImportStatus('success')
      const modeText = mode === 'replace' ? 'replaced' : 'merged'
      setStatusMessage(`Data ${modeText} successfully! (${result.coursesCount} courses, ${result.assignmentsCount} assignments) Refreshing page...`)

      // Refresh page to show imported data
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error) {
      setImportStatus('error')
      setStatusMessage(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    setPendingFile(null)
  }

  const handleCancelImport = () => {
    setShowImportDialog(false)
    setPendingFile(null)
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
            Restore data from a backup file. You can choose to merge with or replace your existing data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileSelect}
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

      {/* Import Mode Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How would you like to import?</DialogTitle>
            <DialogDescription>
              Choose how to handle the imported data relative to your existing data.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Button
              variant="outline"
              className="h-auto p-4 justify-start"
              onClick={() => handleImportWithMode('merge')}
            >
              <div className="flex gap-4 items-start">
                <Merge className="h-5 w-5 mt-0.5 text-blue-500" />
                <div className="text-left">
                  <div className="font-medium">Merge with existing data</div>
                  <div className="text-sm text-muted-foreground">
                    Add new items and update existing ones. Your current data stays intact.
                  </div>
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto p-4 justify-start"
              onClick={() => handleImportWithMode('replace')}
            >
              <div className="flex gap-4 items-start">
                <ReplaceAll className="h-5 w-5 mt-0.5 text-orange-500" />
                <div className="text-left">
                  <div className="font-medium">Replace all data</div>
                  <div className="text-sm text-muted-foreground">
                    Delete all existing data and replace it with the imported file.
                  </div>
                </div>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={handleCancelImport}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
