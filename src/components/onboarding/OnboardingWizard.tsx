import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Key,
  Clock,
  CheckCircle2,
  Sparkles,
  Calendar,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { updatePreferences, useApiKeys, useCourses } from '@/db/hooks'
import { WelcomeStep } from './steps/WelcomeStep'
import { ApiKeyStep } from './steps/ApiKeyStep'
import { ScheduleUploadStep } from './steps/ScheduleUploadStep'
import { SyllabusUploadStep } from './steps/SyllabusUploadStep'
import { PreferencesStep } from './steps/PreferencesStep'
import { CompletionStep } from './steps/CompletionStep'
import { Logo } from '@/components/Logo'

// Dynamic steps - syllabus step is conditional
const BASE_STEPS = [
  { id: 'welcome', title: 'Welcome', icon: Sparkles },
  { id: 'api-key', title: 'AI Setup', icon: Key },
  { id: 'schedule', title: 'Schedule', icon: Calendar },
  { id: 'syllabus', title: 'Syllabi', icon: FileText },
  { id: 'preferences', title: 'Preferences', icon: Clock },
  { id: 'complete', title: 'Ready', icon: CheckCircle2 },
] as const

type StepId = typeof BASE_STEPS[number]['id']

export function OnboardingWizard() {
  const apiKeys = useApiKeys()
  const courses = useCourses()
  const [currentStep, setCurrentStep] = useState<StepId>('welcome')
  const [scheduleUploaded, setScheduleUploaded] = useState(false)

  // Determine visible steps based on whether schedule was uploaded
  const visibleSteps = BASE_STEPS.filter(step => {
    // Syllabus step only shows if schedule was uploaded (they have courses)
    if (step.id === 'syllabus' && !scheduleUploaded) return false
    return true
  })

  const currentStepIndex = visibleSteps.findIndex(s => s.id === currentStep)
  const progress = ((currentStepIndex) / (visibleSteps.length - 1)) * 100

  const saveProgress = useCallback(async (stepIndex: number) => {
    await updatePreferences({ onboardingStep: stepIndex })
  }, [])

  const goToStep = useCallback(async (stepId: StepId) => {
    const index = visibleSteps.findIndex(s => s.id === stepId)
    if (index >= 0) {
      await saveProgress(index)
      setCurrentStep(stepId)
    }
  }, [visibleSteps, saveProgress])

  const handleNext = useCallback(async () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < visibleSteps.length) {
      await saveProgress(nextIndex)
      setCurrentStep(visibleSteps[nextIndex].id)
    }
  }, [currentStepIndex, visibleSteps, saveProgress])

  const handleBack = useCallback(async () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      await saveProgress(prevIndex)
      setCurrentStep(visibleSteps[prevIndex].id)
    }
  }, [currentStepIndex, visibleSteps, saveProgress])

  const handleSkipToEnd = useCallback(async () => {
    // Skip to completion
    await goToStep('complete')
  }, [goToStep])

  const handleScheduleSkip = useCallback(async () => {
    // If schedule is skipped, go directly to preferences (skip syllabus)
    setScheduleUploaded(false)
    await goToStep('preferences')
  }, [goToStep])

  const handleScheduleUploaded = useCallback(() => {
    setScheduleUploaded(true)
  }, [])

  const handleComplete = useCallback(async () => {
    await updatePreferences({ onboardingCompleted: true, onboardingStep: undefined })
    // Force reload to show the main app
    window.location.reload()
  }, [])

  const hasApiKey = apiKeys && apiKeys.length > 0
  const hasCourse = courses && courses.length > 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col">
      {/* Header with progress */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <Logo size="md" />
            {currentStep !== 'welcome' && currentStep !== 'complete' && (
              <Button variant="ghost" size="sm" onClick={handleSkipToEnd}>
                Skip Setup
              </Button>
            )}
          </div>

          {/* Step indicators */}
          <div className="flex items-center justify-between mb-2">
            {visibleSteps.map((step, index) => {
              const Icon = step.icon
              const isActive = step.id === currentStep
              const isComplete = index < currentStepIndex

              return (
                <div
                  key={step.id}
                  className={cn(
                    'flex items-center gap-2',
                    index < visibleSteps.length - 1 && 'flex-1'
                  )}
                >
                  <div
                    className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors',
                      isActive && 'border-primary bg-primary text-primary-foreground',
                      isComplete && 'border-primary bg-primary/10 text-primary',
                      !isActive && !isComplete && 'border-muted-foreground/30 text-muted-foreground/50'
                    )}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-sm font-medium hidden sm:block',
                      isActive && 'text-foreground',
                      !isActive && 'text-muted-foreground'
                    )}
                  >
                    {step.title}
                  </span>
                  {index < visibleSteps.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 mx-2',
                        isComplete ? 'bg-primary' : 'bg-muted'
                      )}
                    />
                  )}
                </div>
              )
            })}
          </div>
          <Progress value={progress} className="h-1" />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 container max-w-6xl mx-auto px-4 py-8">
        {currentStep === 'welcome' && (
          <WelcomeStep onNext={handleNext} onImportComplete={handleComplete} />
        )}

        {currentStep === 'api-key' && (
          <ApiKeyStep
            onNext={handleNext}
            onBack={handleBack}
            hasApiKey={!!hasApiKey}
          />
        )}

        {currentStep === 'schedule' && (
          <ScheduleUploadStep
            onNext={handleNext}
            onBack={handleBack}
            onScheduleUploaded={handleScheduleUploaded}
            onSkip={handleScheduleSkip}
            hasApiKey={!!hasApiKey}
          />
        )}

        {currentStep === 'syllabus' && (
          <SyllabusUploadStep
            onNext={handleNext}
            onBack={handleBack}
            hasApiKey={!!hasApiKey}
          />
        )}

        {currentStep === 'preferences' && (
          <PreferencesStep
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {currentStep === 'complete' && (
          <CompletionStep
            onComplete={handleComplete}
            hasApiKey={!!hasApiKey}
            hasCourse={hasCourse || scheduleUploaded}
          />
        )}
      </div>
    </div>
  )
}
