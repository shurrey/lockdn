import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Shield,
  Database,
  Lock,
  Zap,
  ArrowRight,
  Brain,
  Calendar,
  FileText,
  Upload,
  Smartphone,
  Loader2,
  CheckCircle,
  AlertCircle,
  BookOpen,
  ExternalLink,
} from 'lucide-react'
import { importFromFile } from '@/lib/dataImport'
import { Logo } from '@/components/Logo'
import { DevicePairingDialog } from '@/components/sync/DevicePairingDialog'
import { useSyncStatus } from '@/lib/sync'

interface WelcomeStepProps {
  onNext: () => void
  onImportComplete?: () => void
}

export function WelcomeStep({ onNext, onImportComplete }: WelcomeStepProps) {
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [importMessage, setImportMessage] = useState('')
  const [showSyncDialog, setShowSyncDialog] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { isConnected, peerCount } = useSyncStatus()

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportStatus('loading')
    setImportMessage('')

    try {
      const result = await importFromFile(file)
      setImportStatus('success')
      setImportMessage(`Imported ${result.coursesCount} courses, ${result.assignmentsCount} assignments, ${result.notesCount} notes`)

      // Notify parent to complete onboarding after brief delay
      setTimeout(() => {
        onImportComplete?.()
      }, 1500)
    } catch (error) {
      setImportStatus('error')
      setImportMessage(error instanceof Error ? error.message : 'Import failed')
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <Logo size="xl" />
        </div>
        <div className="space-y-3">
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your private, AI-powered study companion that helps you stay on top of coursework
            while keeping your data exactly where it belongs: on your device.
          </p>
        </div>
      </div>

      {/* Features grid */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="p-3 rounded-full bg-blue-500/10">
                <Brain className="h-6 w-6 text-blue-500" />
              </div>
              <h3 className="font-semibold">AI-Powered Learning</h3>
              <p className="text-sm text-muted-foreground">
                Get personalized study guides, practice exams, and tutoring
                tailored to your courses.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="p-3 rounded-full bg-green-500/10">
                <Calendar className="h-6 w-6 text-green-500" />
              </div>
              <h3 className="font-semibold">Smart Scheduling</h3>
              <p className="text-sm text-muted-foreground">
                Automatically extract deadlines from syllabi and get optimized
                study plans.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="p-3 rounded-full bg-purple-500/10">
                <FileText className="h-6 w-6 text-purple-500" />
              </div>
              <h3 className="font-semibold">Note Organization</h3>
              <p className="text-sm text-muted-foreground">
                Capture, organize, and transform your notes into study
                materials with AI assistance.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Privacy section */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-primary/10 shrink-0">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Your Data Stays With You</h3>
              <p className="text-muted-foreground">
                Lockdn is <strong>local-first</strong>. All your courses, notes,
                and study materials are stored directly on your device.
                Nothing is sent to our servers.
              </p>
              <div className="grid sm:grid-cols-4 gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Local storage only</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Encrypted API keys</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Works offline</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">No account needed</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Primary CTA */}
      <div className="flex justify-center pt-4">
        <Button size="lg" onClick={onNext} className="px-8">
          Get Started
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* Alternative paths */}
      <div className="border-t pt-8">
        <p className="text-center text-sm text-muted-foreground mb-4">
          Already have data from another device?
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
          <Button
            variant="outline"
            onClick={handleImportClick}
            disabled={importStatus === 'loading' || importStatus === 'success'}
          >
            {importStatus === 'loading' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : importStatus === 'success' ? (
              <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
            ) : importStatus === 'error' ? (
              <AlertCircle className="h-4 w-4 mr-2 text-destructive" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Import Backup
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowSyncDialog(true)}
          >
            <Smartphone className="h-4 w-4 mr-2" />
            Sync from Device
          </Button>
        </div>
        {importMessage && (
          <p className={`text-center text-sm mt-2 ${importStatus === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
            {importMessage}
          </p>
        )}
        {isConnected && peerCount > 0 && (
          <p className="text-center text-sm mt-2 text-green-600">
            Connected! Your data will sync automatically.
          </p>
        )}
      </div>

      {/* Documentation link */}
      <div className="border-t pt-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Want to learn more about Lockdn features?
          </p>
          <a
            href="https://github.com/shurrey/lockdn/blob/main/docs/user/getting-started.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            Read the documentation
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Device Pairing Dialog */}
      <DevicePairingDialog
        open={showSyncDialog}
        onOpenChange={setShowSyncDialog}
        mode="scan"
      />
    </div>
  )
}
