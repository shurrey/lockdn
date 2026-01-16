import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Calendar,
  BookOpen,
  MessageSquare,
  FileText,
  Settings,
  Plus,
  Flame,
  Brain,
  Upload,
  CheckCircle2,
  ArrowRight,
  Check,
  HelpCircle,
} from 'lucide-react'
import { HelpPanel } from '@/components/HelpPanel'
import { MarkCompleteDialog } from '@/components/assignments'
import type { Assignment } from '@/types'
import {
  useCourses,
  useAssignments,
  useUpcomingAssignments,
  useTodayStudySessions,
  useAnalytics,
  useApiKeys,
  useStudySessions,
  useStudyMaterials,
  useNotes,
  useStudyPlan,
} from '@/db/hooks'
import { getStudyRecommendations } from '@/lib/studyPlanner'
import { getAttentionItems, getContextualGreeting } from '@/lib/attentionPrioritizer'
import { ScheduleUploadDialog } from '@/components/schedule'
import { AttentionCard } from '@/components/dashboard/AttentionCard'

export function DashboardPage() {
  const courses = useCourses()
  const assignments = useAssignments()
  const upcomingAssignments = useUpcomingAssignments(5)
  const todaySessions = useTodayStudySessions()
  const analytics = useAnalytics()
  const apiKeys = useApiKeys()
  const studySessions = useStudySessions()
  const studyMaterials = useStudyMaterials()
  const notes = useNotes()
  const studyPlan = useStudyPlan()

  const [showScheduleUpload, setShowScheduleUpload] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const hasApiKey = apiKeys && apiKeys.length > 0
  const hasCourses = courses && courses.length > 0
  const isFirstTimeUser = !hasCourses

  // Get study recommendations based on assignment priorities
  const recommendations = useMemo(() => {
    if (!assignments || !courses) return []
    return getStudyRecommendations(assignments, courses, 3)
  }, [assignments, courses])

  // Compute attention items using smart prioritization
  const { attentionItems, greeting } = useMemo(() => {
    if (!courses || !assignments) {
      return { attentionItems: [], greeting: 'Welcome!' }
    }

    const items = getAttentionItems({
      assignments: assignments || [],
      courses: courses || [],
      studySessions: studySessions || [],
      plannedSessions: studyPlan?.sessions || [],
      studyMaterials: studyMaterials || [],
      notes: notes || [],
      analytics,
      hasApiKey: !!hasApiKey,
    }, 5)

    const greetingText = getContextualGreeting(analytics, items)

    return { attentionItems: items, greeting: greetingText }
  }, [assignments, courses, studySessions, studyPlan, studyMaterials, notes, analytics, hasApiKey])

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {isFirstTimeUser
              ? "Let's get you set up for success!"
              : "Welcome back! Here's what needs your attention."}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setShowHelp(true)}>
          <HelpCircle className="h-5 w-5" />
        </Button>
      </div>

      {/* First Time User Experience */}
      {isFirstTimeUser && (
        <Card className="mb-6 border-primary bg-gradient-to-r from-primary/10 to-primary/5">
          <CardHeader>
            <CardTitle className="text-xl">Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Complete these steps to set up your study companion:
            </p>

            <div className="space-y-3">
              {/* Step 1: API Key */}
              <div className={`flex items-center gap-4 p-4 rounded-lg border ${hasApiKey ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900' : 'bg-background'}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${hasApiKey ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                  {hasApiKey ? <CheckCircle2 className="h-5 w-5" /> : '1'}
                </div>
                <div className="flex-1">
                  <p className="font-medium">Configure AI Provider</p>
                  <p className="text-sm text-muted-foreground">
                    Add your API key to enable AI-powered features like schedule parsing and tutoring.
                  </p>
                </div>
                {!hasApiKey && (
                  <Button asChild>
                    <Link to="/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      Configure
                    </Link>
                  </Button>
                )}
              </div>

              {/* Step 2: Import Schedule */}
              <div className={`flex items-center gap-4 p-4 rounded-lg border ${hasCourses ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900' : 'bg-background'}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${hasCourses ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                  {hasCourses ? <CheckCircle2 className="h-5 w-5" /> : '2'}
                </div>
                <div className="flex-1">
                  <p className="font-medium">Add Your Courses</p>
                  <p className="text-sm text-muted-foreground">
                    Import your class schedule or add courses manually.
                  </p>
                </div>
                {!hasCourses && (
                  <div className="flex gap-2">
                    <Button variant="outline" asChild>
                      <Link to="/courses">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Manually
                      </Link>
                    </Button>
                    <Button onClick={() => setShowScheduleUpload(true)} disabled={!hasApiKey}>
                      <Upload className="mr-2 h-4 w-4" />
                      Import Schedule
                    </Button>
                  </div>
                )}
              </div>

              {/* Step 3: Upload Syllabus */}
              <div className="flex items-center gap-4 p-4 rounded-lg border bg-background opacity-60">
                <div className="h-8 w-8 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
                  3
                </div>
                <div className="flex-1">
                  <p className="font-medium">Upload Syllabi</p>
                  <p className="text-sm text-muted-foreground">
                    After adding courses, upload syllabi to automatically extract assignments and deadlines.
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Setup Banner (for returning users without API key) */}
      {!isFirstTimeUser && !hasApiKey && (
        <Card className="mb-6 border-primary/50 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium">Get started with AI features</p>
              <p className="text-sm text-muted-foreground">
                Configure your API key to enable the AI tutor and smart
                features.
              </p>
            </div>
            <Button asChild>
              <Link to="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Configure API Key
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Smart "What Needs Attention" Card */}
      {!isFirstTimeUser && (
        <AttentionCard
          items={attentionItems}
          greeting={greeting}
          className="mb-6"
        />
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Upcoming Deadlines Widget */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">
              Upcoming Deadlines
            </CardTitle>
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {upcomingAssignments && upcomingAssignments.length > 0 ? (
              <ul className="space-y-2">
                {upcomingAssignments.map((assignment) => (
                  <li
                    key={assignment.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-green-500"
                      onClick={() => {
                        setSelectedAssignment(assignment)
                        setShowCompleteDialog(true)
                      }}
                      title="Mark complete"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <span className="truncate flex-1">{assignment.title}</span>
                    <span className="text-muted-foreground flex-shrink-0">
                      {new Date(assignment.dueDate).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No upcoming deadlines. Add a course to get started!
              </p>
            )}
            <Button variant="ghost" size="sm" className="mt-3 w-full" asChild>
              <Link to="/calendar">View Calendar</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Today's Study Plan Widget */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">
              Today's Study Plan
            </CardTitle>
            <Brain className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {todaySessions && todaySessions.length > 0 ? (
              <ul className="space-y-2">
                {todaySessions.map((session) => {
                  const course = courses?.find((c) => c.id === session.courseId)
                  return (
                    <li
                      key={session.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: course?.color || '#6b7280' }}
                      />
                      <span className="flex-1 truncate">{session.activityType}</span>
                      <span className="text-muted-foreground">
                        {session.plannedDuration} min
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : recommendations.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-2">
                  Recommended focus areas:
                </p>
                {recommendations.map((rec) => (
                  <div
                    key={rec.assignment.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: rec.course.color }}
                    />
                    <span className="flex-1 truncate">{rec.assignment.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {rec.reason}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No study sessions planned. Add courses to get recommendations!
              </p>
            )}
            <Button variant="ghost" size="sm" className="mt-3 w-full" asChild>
              <Link to="/study">Plan Study Session</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Quick Actions Widget */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">Quick Actions</CardTitle>
            <Plus className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setShowScheduleUpload(true)}
              disabled={!hasApiKey}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Schedule
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/courses">
                <BookOpen className="mr-2 h-4 w-4" />
                Add Course
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/notes">
                <FileText className="mr-2 h-4 w-4" />
                Upload Notes
              </Link>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              asChild
              disabled={!hasApiKey}
            >
              <Link to="/tutor">
                <MessageSquare className="mr-2 h-4 w-4" />
                Ask Tutor
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Courses Widget */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">Your Courses</CardTitle>
            <BookOpen className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {courses && courses.length > 0 ? (
              <ul className="space-y-2">
                {courses.slice(0, 5).map((course) => {
                  const streak = analytics?.courseStreaks?.[course.id]
                  return (
                    <li key={course.id} className="flex items-center gap-2 text-sm">
                      <div
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: course.color }}
                      />
                      <span className="flex-1 truncate">
                        {course.code} - {course.name}
                      </span>
                      {streak && streak.currentStreak > 0 && (
                        <div className="flex items-center gap-0.5 text-orange-500" title={`${streak.currentStreak} day streak`}>
                          <Flame className="h-3 w-3" />
                          <span className="text-xs">{streak.currentStreak}</span>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No courses yet. Import your schedule to get started!
              </p>
            )}
            <Button variant="ghost" size="sm" className="mt-3 w-full" asChild>
              <Link to="/courses">Manage Courses</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Study Streak Widget */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">Study Streak</CardTitle>
            <Flame className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">
                {analytics?.currentStreak ?? 0}
              </span>
              <span className="text-muted-foreground">days</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {analytics?.currentStreak
                ? `Keep it up! Your longest streak is ${analytics.longestStreak} days.`
                : 'Start studying to build your streak!'}
            </p>
          </CardContent>
        </Card>

        {/* AI Tutor Widget */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">AI Tutor</CardTitle>
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {hasApiKey ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Your AI study buddy is ready to help!
                </p>
                <Button className="mt-3 w-full" asChild>
                  <Link to="/tutor">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Start Chat
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Configure your API key in settings to enable the tutor.
                </p>
                <Button variant="outline" className="mt-3 w-full" asChild>
                  <Link to="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Configure
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Schedule Upload Dialog */}
      <ScheduleUploadDialog
        open={showScheduleUpload}
        onOpenChange={setShowScheduleUpload}
      />

      {/* Mark Complete Dialog */}
      <MarkCompleteDialog
        assignment={selectedAssignment}
        open={showCompleteDialog}
        onOpenChange={setShowCompleteDialog}
      />

      {/* Help Panel */}
      <HelpPanel
        docPath="user/features/dashboard"
        open={showHelp}
        onOpenChange={setShowHelp}
        title="Dashboard Help"
      />
    </div>
  )
}
