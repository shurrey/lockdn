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
} from 'lucide-react'

interface WelcomeStepProps {
  onNext: () => void
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Welcome to Student Course Tools
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Your personal AI-powered study assistant that keeps your data private
          and helps you stay on top of your coursework.
        </p>
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
                This app is <strong>local-first</strong>. All your courses, notes,
                and study materials are stored directly on your device using IndexedDB.
                Nothing is sent to our servers.
              </p>
              <div className="grid sm:grid-cols-3 gap-4 pt-2">
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
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="flex justify-center pt-4">
        <Button size="lg" onClick={onNext} className="px-8">
          Get Started
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
