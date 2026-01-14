import { useState, useCallback, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { format, isToday, isTomorrow, addMinutes, addDays } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Play,
  Square,
  Clock,
  Calendar,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Brain,
  Target,
  Loader2,
  Trash2,
  FileText,
  BookOpen,
} from 'lucide-react'
import {
  useCourses,
  useAssignments,
  useStudySessions,
  usePreferences,
  useStudyPlan,
  useNotes,
  useStudyMaterials,
  useMissedSessions,
  usePlanRebalance,
  useRescheduleRecommendations,
  createStudySession,
  updateStudySession,
  saveStudyPlan,
  clearStudyPlan,
  removeSessionFromPlan,
  rescheduleSession,
  applyPlanAdjustments,
  type RescheduleRecommendation,
} from '@/db/hooks'
import {
  generateStudyPlan,
  getStudyRecommendations,
  getSessionsNeeded,
  checkPlanAdjustment,
  type PlannedSession,
} from '@/lib/studyPlanner'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Mascot } from '@/components/Mascot'

export function StudyPage() {
  const courses = useCourses()
  const assignments = useAssignments()
  const studySessions = useStudySessions()
  const preferences = usePreferences()
  const savedPlan = useStudyPlan()
  const notes = useNotes()
  const studyMaterials = useStudyMaterials()

  // New hooks for pattern learning and adjustments
  const missedSessions = useMissedSessions()
  const rebalanceResult = usePlanRebalance()
  const rescheduleRecommendations = useRescheduleRecommendations()

  const [plannedSessions, setPlannedSessions] = useState<PlannedSession[]>([])
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false)
  const [selectedReschedule, setSelectedReschedule] = useState<RescheduleRecommendation | null>(null)
  const [applyingAdjustments, setApplyingAdjustments] = useState(false)

  // Load saved plan on mount
  useEffect(() => {
    if (savedPlan?.sessions && savedPlan.sessions.length > 0) {
      // Convert stored sessions back to PlannedSession format
      const sessions = savedPlan.sessions.map((s) => ({
        ...s,
        plannedStart: new Date(s.plannedStart),
      }))
      setPlannedSessions(sessions)
    }
  }, [savedPlan])
  const [activeSession, setActiveSession] = useState<{
    id: string
    startTime: Date
    plannedDuration: number
    courseName: string
    assignmentTitle?: string
  } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [selectedSession, setSelectedSession] = useState<PlannedSession | null>(null)

  // Generate plan dialog state
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [planCourseFilter, setPlanCourseFilter] = useState<string>('all')
  const [planAssignmentFilter, setPlanAssignmentFilter] = useState<string>('all')
  const [planStartDate, setPlanStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [planEndDate, setPlanEndDate] = useState<string>(format(addDays(new Date(), 14), 'yyyy-MM-dd'))

  // Filtered assignments based on course selection (for dialog)
  const filteredAssignmentsForDialog = useMemo(() => {
    if (!assignments) return []
    if (planCourseFilter === 'all') return assignments
    return assignments.filter(a => a.courseId === planCourseFilter)
  }, [assignments, planCourseFilter])

  // Get study recommendations
  const recommendations = useMemo(() => {
    if (!assignments || !courses) return []
    return getStudyRecommendations(assignments, courses, 5)
  }, [assignments, courses])

  // Check if plan needs adjustment
  const planStatus = useMemo(() => {
    if (!assignments) return { needsAdjustment: false, reason: '' }
    return checkPlanAdjustment(plannedSessions, assignments)
  }, [plannedSessions, assignments])

  // Create lookup maps for notes and materials
  const notesMap = useMemo(() => {
    if (!notes) return new Map()
    return new Map(notes.map(n => [n.id, n]))
  }, [notes])

  const materialsMap = useMemo(() => {
    if (!studyMaterials) return new Map()
    return new Map(studyMaterials.map(m => [m.id, m]))
  }, [studyMaterials])

  // Group sessions by day
  const sessionsByDay = useMemo(() => {
    const grouped: Record<string, PlannedSession[]> = {}
    for (const session of plannedSessions) {
      const dateKey = format(session.plannedStart, 'yyyy-MM-dd')
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(session)
    }
    // Sort sessions within each day by start time
    for (const dateKey of Object.keys(grouped)) {
      grouped[dateKey].sort((a, b) =>
        new Date(a.plannedStart).getTime() - new Date(b.plannedStart).getTime()
      )
    }
    return grouped
  }, [plannedSessions])

  const openGenerateDialog = useCallback(() => {
    // Reset filters to defaults when opening
    setPlanCourseFilter('all')
    setPlanAssignmentFilter('all')
    setPlanStartDate(format(new Date(), 'yyyy-MM-dd'))
    setPlanEndDate(format(addDays(new Date(), 14), 'yyyy-MM-dd'))
    setShowGenerateDialog(true)
  }, [])

  const handleClearPlan = useCallback(async () => {
    if (!confirm('Clear all planned study sessions? This cannot be undone.')) return
    await clearStudyPlan()
    setPlannedSessions([])
    toast.success('Study plan cleared')
  }, [])

  const handleDeleteSession = useCallback(async (sessionId: string, sessionTitle?: string) => {
    await removeSessionFromPlan(sessionId)
    setPlannedSessions(prev => prev.filter(s => s.id !== sessionId))
    toast.success(sessionTitle ? `Removed: ${sessionTitle}` : 'Session removed')
  }, [])

  // Handle rescheduling a missed session
  const handleReschedule = useCallback(async (sessionId: string, newStart: Date, duration: number) => {
    try {
      await rescheduleSession(sessionId, newStart, duration)
      setShowRescheduleDialog(false)
      setSelectedReschedule(null)
      toast.success('Session rescheduled')
    } catch {
      toast.error('Failed to reschedule session')
    }
  }, [])

  // Apply all cleanup adjustments (remove stale sessions)
  const handleApplyCleanup = useCallback(async () => {
    if (!rebalanceResult) return

    const cleanupAdjustments = rebalanceResult.adjustments.filter(
      a => a.type === 'remove_stale'
    )

    if (cleanupAdjustments.length === 0) {
      toast.info('No cleanup needed')
      return
    }

    setApplyingAdjustments(true)
    try {
      await applyPlanAdjustments(cleanupAdjustments)
      toast.success(`Cleaned up ${cleanupAdjustments.length} stale session${cleanupAdjustments.length > 1 ? 's' : ''}`)
    } catch {
      toast.error('Failed to apply cleanup')
    } finally {
      setApplyingAdjustments(false)
    }
  }, [rebalanceResult])

  const handleGeneratePlan = useCallback(async () => {
    if (!assignments || assignments.length === 0) {
      toast.warning('No assignments found. Add assignments first to generate a study plan.')
      return
    }

    if (!courses || courses.length === 0) {
      toast.warning('No courses found. Create a course first.')
      return
    }

    // Apply filters
    let filteredAssignments = assignments.filter(a => a.status !== 'completed')

    // Filter by course
    if (planCourseFilter !== 'all') {
      filteredAssignments = filteredAssignments.filter(a => a.courseId === planCourseFilter)
    }

    // Filter by specific assignment
    if (planAssignmentFilter !== 'all') {
      filteredAssignments = filteredAssignments.filter(a => a.id === planAssignmentFilter)
    }

    // Date range controls when to schedule sessions, not which assignments to include
    // Include assignments due after the start date (no point studying for past-due assignments)
    const startDate = new Date(planStartDate)
    const endDate = new Date(planEndDate)
    endDate.setHours(23, 59, 59, 999)

    filteredAssignments = filteredAssignments.filter(a => {
      const dueDate = new Date(a.dueDate)
      // Include if due date is after start date (still relevant to study for)
      return dueDate >= startDate
    })

    if (filteredAssignments.length === 0) {
      toast.warning('No upcoming assignments found. All assignments may be past due or completed.')
      return
    }

    setGenerating(true)
    setShowGenerateDialog(false)

    try {
      // Use preferences if available, otherwise use sensible defaults
      // Default productivity hours: weekdays 9am-12pm and 2pm-6pm
      const defaultProductivityHours = [1, 2, 3, 4, 5].flatMap(day => [
        { dayOfWeek: day, startHour: 9, endHour: 12, energyLevel: 'high' as const },
        { dayOfWeek: day, startHour: 14, endHour: 18, energyLevel: 'medium' as const },
      ])

      const studyPrefs = preferences ? {
        productivityHours: preferences.productivityHours,
        breakPreferences: preferences.breakPreferences,
      } : {
        productivityHours: defaultProductivityHours,
        breakPreferences: { shortBreakDuration: 5, longBreakDuration: 15, sessionsBeforeLongBreak: 4 },
      }

      // Filter courses to only those with matching assignments
      const relevantCourseIds = new Set(filteredAssignments.map(a => a.courseId))
      const relevantCourses = courses.filter(c => relevantCourseIds.has(c.id))

      // Pass existing planned sessions for incremental planning
      const newSessions = generateStudyPlan(
        filteredAssignments,
        relevantCourses,
        studySessions || [],
        {
          ...studyPrefs,
          planningHorizonDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
        },
        plannedSessions, // existing planned sessions
        notes || [],
        studyMaterials || []
      )

      if (newSessions.length === 0 && plannedSessions.length === 0) {
        toast.warning('No study sessions could be generated. Check that your assignments have future due dates within your productivity hours.')
        return
      }

      if (newSessions.length === 0) {
        toast.info('All assignments already have sufficient study sessions planned.')
        return
      }

      // Merge new sessions with existing ones
      const mergedPlan = [...plannedSessions, ...newSessions]
        .sort((a, b) => new Date(a.plannedStart).getTime() - new Date(b.plannedStart).getTime())

      setPlannedSessions(mergedPlan)
      // Persist the merged plan to the database
      await saveStudyPlan(mergedPlan)
      const firstSession = mergedPlan[0]
      const lastSession = mergedPlan[mergedPlan.length - 1]
      const planStartStr = format(firstSession.plannedStart, 'MMM d')
      const planEndStr = format(lastSession.plannedStart, 'MMM d')
      const uniqueAssignments = new Set(mergedPlan.map(s => s.assignmentTitle).filter(Boolean)).size

      if (planStartStr === planEndStr) {
        toast.success(`Added ${newSessions.length} session${newSessions.length > 1 ? 's' : ''} (${mergedPlan.length} total) on ${planStartStr} for ${uniqueAssignments} assignment${uniqueAssignments > 1 ? 's' : ''}`)
      } else {
        toast.success(`Added ${newSessions.length} sessions (${mergedPlan.length} total) from ${planStartStr} to ${planEndStr} for ${uniqueAssignments} assignment${uniqueAssignments > 1 ? 's' : ''}`)
      }
    } finally {
      setGenerating(false)
    }
  }, [assignments, courses, studySessions, preferences, planCourseFilter, planAssignmentFilter, planStartDate, planEndDate, plannedSessions, notes, studyMaterials])

  const handleStartSession = useCallback(
    async (session: PlannedSession) => {
      const sessionId = await createStudySession({
        courseId: session.courseId,
        plannedStart: session.plannedStart,
        plannedDuration: session.plannedDuration,
        actualStart: new Date(),
        activityType: session.activityType,
        completed: false,
      })

      setActiveSession({
        id: sessionId,
        startTime: new Date(),
        plannedDuration: session.plannedDuration,
        courseName: session.courseName,
        assignmentTitle: session.assignmentTitle,
      })
      setShowConfirmDialog(false)
    },
    []
  )

  const handleEndSession = useCallback(async () => {
    if (!activeSession) return

    const actualDuration = Math.round(
      (new Date().getTime() - activeSession.startTime.getTime()) / 60000
    )

    await updateStudySession(activeSession.id, {
      actualDuration,
      completed: true,
    })

    setActiveSession(null)
  }, [activeSession])

  const handleQuickStart = useCallback(
    async (courseId: string, courseName: string, assignmentTitle?: string) => {
      const sessionId = await createStudySession({
        courseId,
        plannedStart: new Date(),
        plannedDuration: 50,
        actualStart: new Date(),
        activityType: 'Quick study session',
        completed: false,
      })

      setActiveSession({
        id: sessionId,
        startTime: new Date(),
        plannedDuration: 50,
        courseName,
        assignmentTitle,
      })
    },
    []
  )

  const formatSessionTime = (date: Date, duration: number) => {
    const end = addMinutes(date, duration)
    return `${format(date, 'h:mm a')} - ${format(end, 'h:mm a')}`
  }

  const getDateLabel = (dateKey: string) => {
    const date = new Date(dateKey)
    if (isToday(date)) return 'Today'
    if (isTomorrow(date)) return 'Tomorrow'
    return format(date, 'EEEE, MMMM d')
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Study Planner</h1>
          <p className="text-muted-foreground">
            Plan your study sessions and track your progress.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {plannedSessions.length > 0 && (
            <Button variant="outline" onClick={handleClearPlan}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Plan ({plannedSessions.length})
            </Button>
          )}
          <Button onClick={openGenerateDialog} disabled={generating}>
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Generate Study Plan
          </Button>
        </div>
      </div>

      {/* Active Session Card */}
      {activeSession && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Session in Progress</h3>
                  <p className="text-sm text-muted-foreground">
                    {activeSession.courseName}
                    {activeSession.assignmentTitle && ` - ${activeSession.assignmentTitle}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Started at {format(activeSession.startTime, 'h:mm a')}
                  </p>
                </div>
              </div>
              <Button variant="destructive" size="lg" onClick={handleEndSession}>
                <Square className="h-4 w-4 mr-2" />
                End Session
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan Adjustment Warning */}
      {planStatus.needsAdjustment && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{planStatus.reason}</span>
            <Button variant="outline" size="sm" onClick={handleGeneratePlan}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate Plan
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Missed Sessions Alert */}
      {missedSessions && missedSessions.length > 0 && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Clock className="h-5 w-5" />
              Missed Study Sessions
              <Badge variant="outline" className="ml-auto border-amber-500 text-amber-700 dark:text-amber-400">
                {missedSessions.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {missedSessions.slice(0, 3).map((missed) => {
              const recommendation = rescheduleRecommendations?.find(
                r => r.missedSession.session.id === missed.session.id
              )
              return (
                <div
                  key={missed.session.id}
                  className={cn(
                    "flex items-center justify-between gap-3 p-3 rounded-lg border",
                    missed.urgency === 'critical' && "border-red-300 bg-red-50 dark:bg-red-950/30",
                    missed.urgency === 'high' && "border-orange-300 bg-orange-50 dark:bg-orange-950/30",
                    missed.urgency === 'medium' && "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20",
                    missed.urgency === 'low' && "border-amber-100 bg-white dark:bg-background"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: missed.session.courseColor }}
                      />
                      <span className="font-medium text-sm truncate">
                        {missed.session.assignmentTitle || missed.session.courseName}
                      </span>
                      <Badge
                        variant={missed.urgency === 'critical' ? 'destructive' : 'outline'}
                        className="text-xs"
                      >
                        {missed.urgency === 'critical' ? 'Due soon!' : `${missed.assignmentDueIn}d left`}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Planned for {format(new Date(missed.session.plannedStart), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {recommendation && recommendation.suggestedSlots.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedReschedule(recommendation)
                          setShowRescheduleDialog(true)
                        }}
                      >
                        <Calendar className="h-4 w-4 mr-1" />
                        Reschedule
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteSession(missed.session.id!, missed.session.assignmentTitle)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
            {missedSessions.length > 3 && (
              <p className="text-sm text-muted-foreground text-center">
                +{missedSessions.length - 3} more missed session{missedSessions.length - 3 > 1 ? 's' : ''}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plan Rebalancing Suggestions */}
      {rebalanceResult && rebalanceResult.adjustments.length > 0 && !planStatus.needsAdjustment && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <RefreshCw className="h-5 w-5" />
              Plan Insights
            </CardTitle>
            <CardDescription>
              {rebalanceResult.summary}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Show unplanned urgent assignments */}
            {rebalanceResult.adjustments
              .filter(a => a.type === 'add_urgent')
              .slice(0, 3)
              .map((adjustment, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-950/20"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">
                        New
                      </Badge>
                      <span className="font-medium text-sm truncate">
                        {adjustment.newSession?.assignmentTitle}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {adjustment.reason}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openGenerateDialog}
                  >
                    <Sparkles className="h-4 w-4 mr-1" />
                    Add to Plan
                  </Button>
                </div>
              ))}

            {/* Cleanup button for stale sessions */}
            {rebalanceResult.adjustments.filter(a => a.type === 'remove_stale').length > 0 && (
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="text-sm text-muted-foreground">
                  {rebalanceResult.adjustments.filter(a => a.type === 'remove_stale').length} session{rebalanceResult.adjustments.filter(a => a.type === 'remove_stale').length > 1 ? 's' : ''} can be cleaned up
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleApplyCleanup}
                  disabled={applyingAdjustments}
                >
                  {applyingAdjustments ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Clean Up
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Study Recommendations */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Recommended Focus
            </CardTitle>
            <CardDescription>
              What to study based on upcoming deadlines
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No upcoming assignments. Add some to get recommendations.
              </p>
            ) : (
              recommendations.map((rec) => (
                <div
                  key={rec.assignment.id}
                  className="p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: rec.course.color }}
                        />
                        <span className="text-sm font-medium truncate">
                          {rec.assignment.title}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {rec.course.code} - {rec.reason}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ~{getSessionsNeeded(rec.assignment)} sessions needed
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!!activeSession}
                      onClick={() =>
                        handleQuickStart(
                          rec.course.id,
                          rec.course.name,
                          rec.assignment.title
                        )
                      }
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Planned Sessions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Study Schedule
            </CardTitle>
            <CardDescription>
              {plannedSessions.length === 0
                ? 'Generate a study plan to see your schedule'
                : `${plannedSessions.length} sessions planned`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {plannedSessions.length === 0 ? (
              <div className="text-center py-8">
                <Mascot size="lg" />
                <p className="text-muted-foreground mt-4">
                  No study sessions planned yet.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click "Generate Study Plan" to create a schedule based on your
                  assignments and preferences.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(sessionsByDay)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([dateKey, sessions]) => (
                    <div key={dateKey}>
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">
                        {getDateLabel(dateKey)}
                      </h4>
                      <div className="space-y-2">
                        {sessions.map((session, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                          >
                            <div
                              className="w-1 h-full min-h-10 rounded-full flex-shrink-0"
                              style={{ backgroundColor: session.courseColor }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">
                                  {session.courseName}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {session.plannedDuration} min
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {formatSessionTime(
                                  session.plannedStart,
                                  session.plannedDuration
                                )}
                                {session.assignmentTitle &&
                                  ` - ${session.assignmentTitle}`}
                              </p>
                              {session.studyTopics && session.studyTopics.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Focus: {session.studyTopics.slice(0, 2).join(', ')}
                                  {session.studyTopics.length > 2 && ` +${session.studyTopics.length - 2} more`}
                                </p>
                              )}
                              {/* Linked Resources */}
                              {((session.noteIds && session.noteIds.length > 0) ||
                                (session.studyMaterialIds && session.studyMaterialIds.length > 0)) && (
                                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                  {session.noteIds?.slice(0, 3).map(noteId => {
                                    const note = notesMap.get(noteId)
                                    if (!note) return null
                                    return (
                                      <Link
                                        key={noteId}
                                        to="/notes"
                                        onClick={(e) => e.stopPropagation()}
                                        className="no-underline"
                                      >
                                        <Badge
                                          variant="outline"
                                          className="text-xs gap-1 py-0.5 px-1.5 bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                                        >
                                          <FileText className="h-3 w-3" />
                                          <span className="truncate max-w-[80px]">{note.title}</span>
                                        </Badge>
                                      </Link>
                                    )
                                  })}
                                  {session.noteIds && session.noteIds.length > 3 && (
                                    <Link to="/notes" onClick={(e) => e.stopPropagation()} className="no-underline">
                                      <Badge variant="outline" className="text-xs py-0.5 px-1.5 cursor-pointer hover:bg-accent transition-colors">
                                        +{session.noteIds.length - 3} notes
                                      </Badge>
                                    </Link>
                                  )}
                                  {session.studyMaterialIds?.slice(0, 2).map(materialId => {
                                    const material = materialsMap.get(materialId)
                                    if (!material) return null
                                    return (
                                      <Link
                                        key={materialId}
                                        to="/study-materials"
                                        onClick={(e) => e.stopPropagation()}
                                        className="no-underline"
                                      >
                                        <Badge
                                          variant="outline"
                                          className="text-xs gap-1 py-0.5 px-1.5 bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-300 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors"
                                        >
                                          <BookOpen className="h-3 w-3" />
                                          <span className="truncate max-w-[80px]">
                                            {material.type === 'guide' ? 'Guide' : 'Practice'}
                                          </span>
                                        </Badge>
                                      </Link>
                                    )
                                  })}
                                  {session.studyMaterialIds && session.studyMaterialIds.length > 2 && (
                                    <Link to="/study-materials" onClick={(e) => e.stopPropagation()} className="no-underline">
                                      <Badge variant="outline" className="text-xs py-0.5 px-1.5 cursor-pointer hover:bg-accent transition-colors">
                                        +{session.studyMaterialIds.length - 2} materials
                                      </Badge>
                                    </Link>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  session.priority > 0.7
                                    ? 'destructive'
                                    : session.priority > 0.5
                                      ? 'default'
                                      : 'secondary'
                                }
                                className="text-xs"
                              >
                                {session.priority > 0.7
                                  ? 'High'
                                  : session.priority > 0.5
                                    ? 'Medium'
                                    : 'Low'}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={!!activeSession}
                                onClick={() => {
                                  setSelectedSession(session)
                                  setShowConfirmDialog(true)
                                }}
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                              {session.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteSession(session.id!, session.assignmentTitle || session.courseName)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sessions */}
      {studySessions && studySessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Recent Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {studySessions
                .filter((s) => s.completed)
                .slice(0, 5)
                .map((session) => {
                  const course = courses?.find((c) => c.id === session.courseId)
                  return (
                    <div
                      key={session.id}
                      className="flex items-center gap-3 p-3 border rounded-lg"
                    >
                      <div
                        className="w-1 h-10 rounded-full"
                        style={{ backgroundColor: course?.color || '#6b7280' }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {course?.name || 'Unknown Course'}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {session.actualDuration || session.plannedDuration} min
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(
                            new Date(session.actualStart || session.plannedStart),
                            'MMM d, h:mm a'
                          )}
                        </p>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate Plan Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Study Plan</DialogTitle>
            <DialogDescription>
              Configure which assignments to include in your study plan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Course Filter */}
            <div className="space-y-2">
              <Label>Course</Label>
              <Select value={planCourseFilter} onValueChange={(v) => {
                setPlanCourseFilter(v)
                setPlanAssignmentFilter('all') // Reset assignment when course changes
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {courses?.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.code} - {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assignment Filter */}
            <div className="space-y-2">
              <Label>Assignment</Label>
              <Select value={planAssignmentFilter} onValueChange={setPlanAssignmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an assignment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignments</SelectItem>
                  {filteredAssignmentsForDialog
                    .filter(a => a.status !== 'completed')
                    .map((assignment) => (
                      <SelectItem key={assignment.id} value={assignment.id}>
                        {assignment.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={planStartDate}
                  onChange={(e) => setPlanStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={planEndDate}
                  onChange={(e) => setPlanEndDate(e.target.value)}
                />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Study sessions will be scheduled within this date range for all upcoming assignments.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleGeneratePlan} disabled={generating}>
              {generating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start Session Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Study Session</DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedSession.courseColor }}
                />
                <div>
                  <p className="font-medium">{selectedSession.courseName}</p>
                  {selectedSession.assignmentTitle && (
                    <p className="text-sm text-muted-foreground">
                      {selectedSession.assignmentTitle}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Planned Duration</p>
                  <p className="font-medium">{selectedSession.plannedDuration} minutes</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Activity</p>
                  <p className="font-medium">{selectedSession.activityType}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedSession.reason}
              </p>
              {selectedSession.studyTopics && selectedSession.studyTopics.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm font-medium mb-2">Topics to Focus On</p>
                  <ul className="space-y-1">
                    {selectedSession.studyTopics.map((topic, idx) => (
                      <li key={idx} className="text-sm flex items-start gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>{topic}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedSession && handleStartSession(selectedSession)}
            >
              <Play className="h-4 w-4 mr-2" />
              Start Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Session Dialog */}
      <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule Study Session</DialogTitle>
            <DialogDescription>
              Choose a new time slot for your missed study session.
            </DialogDescription>
          </DialogHeader>
          {selectedReschedule && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: selectedReschedule.missedSession.session.courseColor }}
                />
                <div>
                  <p className="font-medium text-sm">
                    {selectedReschedule.missedSession.session.assignmentTitle ||
                      selectedReschedule.missedSession.session.courseName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedReschedule.missedSession.session.plannedDuration} minutes
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Suggested times:</p>
                {selectedReschedule.suggestedSlots.slice(0, 5).map((slot, idx) => (
                  <button
                    key={idx}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors",
                      "hover:bg-accent hover:border-primary/50",
                      idx === 0 && "border-primary/50 bg-primary/5"
                    )}
                    onClick={() => handleReschedule(
                      selectedReschedule.missedSession.session.id!,
                      slot.start,
                      slot.duration
                    )}
                  >
                    <div>
                      <p className="font-medium text-sm">{slot.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(slot.start, 'MMM d, h:mm a')} - {format(addMinutes(slot.start, slot.duration), 'h:mm a')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {idx === 0 && (
                        <Badge variant="outline" className="text-xs">
                          Best match
                        </Badge>
                      )}
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          slot.confidence > 0.7 && "bg-green-500",
                          slot.confidence > 0.4 && slot.confidence <= 0.7 && "bg-amber-500",
                          slot.confidence <= 0.4 && "bg-red-500"
                        )}
                        title={`${Math.round(slot.confidence * 100)}% match`}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRescheduleDialog(false)
              setSelectedReschedule(null)
            }}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
