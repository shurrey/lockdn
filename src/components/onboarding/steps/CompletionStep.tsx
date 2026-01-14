import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  CheckCircle2,
  Rocket,
  BookOpen,
  Calendar,
  Brain,
  FileText,
  BarChart3,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CompletionStepProps {
  onComplete: () => void
  hasApiKey: boolean
  hasCourse: boolean
}

export function CompletionStep({ onComplete, hasApiKey, hasCourse }: CompletionStepProps) {
  const setupItems = [
    {
      label: 'AI Provider',
      completed: hasApiKey,
      tip: hasApiKey
        ? 'Configured'
        : 'Visit Settings to enable AI features',
    },
    {
      label: 'First Course',
      completed: hasCourse,
      tip: hasCourse
        ? 'Created'
        : 'Visit Courses to add your courses',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="inline-flex p-4 rounded-full bg-green-500/10 mb-2">
          <Rocket className="h-12 w-12 text-green-500" />
        </div>
        <h1 className="text-3xl font-bold">You're All Set!</h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Your study assistant is ready. Here's what you can do next.
        </p>
      </div>

      {/* Setup status */}
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">Setup Status</h3>
          <div className="space-y-3">
            {setupItems.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center',
                      item.completed ? 'bg-green-500' : 'bg-muted'
                    )}
                  >
                    {item.completed ? (
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                    )}
                  </div>
                  <span className={cn(!item.completed && 'text-muted-foreground')}>
                    {item.label}
                  </span>
                </div>
                <span
                  className={cn(
                    'text-sm',
                    item.completed ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                  )}
                >
                  {item.tip}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Feature highlights */}
      <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
        <FeatureCard
          icon={Calendar}
          title="Dashboard"
          description="See upcoming deadlines and get personalized suggestions for what to work on."
        />
        <FeatureCard
          icon={BookOpen}
          title="Courses"
          description="Upload syllabi to automatically extract assignments and due dates."
        />
        <FeatureCard
          icon={Brain}
          title="AI Tutor"
          description="Get help understanding concepts with an AI tutor that adapts to your learning style."
        />
        <FeatureCard
          icon={FileText}
          title="Notes & Materials"
          description="Capture notes and generate study guides and practice exams from them."
        />
        <FeatureCard
          icon={Calendar}
          title="Study Planner"
          description="Get AI-optimized study schedules based on your deadlines and energy patterns."
        />
        <FeatureCard
          icon={BarChart3}
          title="Analytics"
          description="Track your study streaks, time spent, and progress across courses."
        />
      </div>

      {/* CTA */}
      <div className="flex justify-center pt-4">
        <Button size="lg" onClick={onComplete} className="px-8">
          Go to Dashboard
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Calendar
  title: string
  description: string
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-medium text-sm">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
