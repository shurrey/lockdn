import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventClickArg, EventInput } from '@fullcalendar/core'
import { format, addMinutes, addDays, startOfDay, setHours, setMinutes, isBefore, isAfter, getDay } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2, Sparkles, Play, Square, Brain, Flame } from 'lucide-react'
import { useCourses, useAssignments, useStudySessions, useStudyPlan, usePreferences, useAnalytics, updateAssignment, saveStudyPlan, createStudySession, updateStudySession } from '@/db/hooks'
import { generateStudyPlan } from '@/lib/studyPlanner'
import type { Assignment, AssignmentStatus, StudySession, PlannedStudySession, ClassMeeting, Course, DayOfWeek } from '@/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// Helper to convert day name to day number (0 = Sunday)
const DAY_TO_NUMBER: Record<DayOfWeek, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

// Parse time string (HH:MM) and apply to a date
function parseTimeToDate(date: Date, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return setMinutes(setHours(date, hours), minutes)
}

export function CalendarPage() {
  const courses = useCourses()
  const analytics = useAnalytics()
  const assignments = useAssignments()
  const studySessions = useStudySessions()
  const studyPlan = useStudyPlan()
  const preferences = usePreferences()
  const calendarRef = useRef<FullCalendar>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null)
  const [selectedSession, setSelectedSession] = useState<StudySession | null>(null)
  const [selectedPlannedSession, setSelectedPlannedSession] = useState<PlannedStudySession | null>(null)
  const [filterCourse, setFilterCourse] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [showStudySessions, setShowStudySessions] = useState<boolean>(true)
  const [showPlannedSessions, setShowPlannedSessions] = useState<boolean>(true)
  const [showClassMeetings, setShowClassMeetings] = useState<boolean>(true)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [selectedClassMeeting, setSelectedClassMeeting] = useState<{
    course: Course
    meeting: ClassMeeting
    date: Date
  } | null>(null)
  const [activeSession, setActiveSession] = useState<{
    id: string
    startTime: Date
    plannedDuration: number
    courseName: string
    courseColor: string
    assignmentTitle?: string
    studyTopics?: string[]
  } | null>(null)

  // Detect mobile and set appropriate calendar view
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      // Change calendar view when crossing the breakpoint
      if (calendarRef.current) {
        const calendarApi = calendarRef.current.getApi()
        const currentView = calendarApi.view.type
        if (mobile && currentView === 'dayGridMonth') {
          calendarApi.changeView('timeGridDay')
        } else if (!mobile && currentView === 'timeGridDay') {
          calendarApi.changeView('dayGridMonth')
        }
      }
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Convert assignments to calendar events
  const assignmentEvents = useMemo<EventInput[]>(() => {
    if (!assignments || !courses) return []

    return assignments
      .filter((a) => {
        if (filterCourse !== 'all' && a.courseId !== filterCourse) return false
        if (filterType !== 'all' && a.type !== filterType) return false
        return true
      })
      .map((assignment) => {
        const course = courses.find((c) => c.id === assignment.courseId)
        return {
          id: assignment.id,
          title: assignment.title,
          start: assignment.dueDate,
          allDay: true,
          backgroundColor: course?.color || '#6b7280',
          borderColor: course?.color || '#6b7280',
          extendedProps: {
            type: 'assignment',
            assignment,
            course,
          },
        }
      })
  }, [assignments, courses, filterCourse, filterType])

  // Convert study sessions to calendar events
  const sessionEvents = useMemo<EventInput[]>(() => {
    if (!showStudySessions || !studySessions || !courses) return []

    return studySessions
      .filter((s) => {
        if (filterCourse !== 'all' && s.courseId !== filterCourse) return false
        return true
      })
      .map((session) => {
        const course = courses.find((c) => c.id === session.courseId)
        const startDate = new Date(session.plannedStart)
        const endDate = addMinutes(startDate, session.plannedDuration)
        return {
          id: `session-${session.id}`,
          title: `📚 Study: ${course?.code || 'Study'}`,
          start: startDate,
          end: endDate,
          allDay: false,
          backgroundColor: session.completed ? '#22c55e' : (course?.color || '#6b7280'),
          borderColor: session.completed ? '#16a34a' : (course?.color || '#6b7280'),
          classNames: session.completed ? ['opacity-60'] : [],
          extendedProps: {
            type: 'session',
            session,
            course,
          },
        }
      })
  }, [showStudySessions, studySessions, courses, filterCourse])

  // Convert planned study sessions to calendar events
  const plannedSessionEvents = useMemo<EventInput[]>(() => {
    if (!showPlannedSessions || !studyPlan?.sessions || !courses) return []

    // Create a set of started session keys (time + courseId) to avoid duplicates
    const startedSessionKeys = new Set(
      (studySessions || []).map(s =>
        `${new Date(s.plannedStart).getTime()}-${s.courseId}`
      )
    )

    return studyPlan.sessions
      .filter((s) => {
        if (filterCourse !== 'all' && s.courseId !== filterCourse) return false
        // Don't show planned sessions that have already been started (same time + course)
        const sessionKey = `${new Date(s.plannedStart).getTime()}-${s.courseId}`
        if (startedSessionKeys.has(sessionKey)) return false
        return true
      })
      .map((session) => {
        const startDate = new Date(session.plannedStart)
        const endDate = addMinutes(startDate, session.plannedDuration)
        return {
          id: `planned-${session.id}`,
          title: `📋 Planned: ${session.courseName}`,
          start: startDate,
          end: endDate,
          allDay: false,
          backgroundColor: session.courseColor || '#6b7280',
          borderColor: session.courseColor || '#6b7280',
          classNames: ['opacity-70', 'border-dashed'],
          extendedProps: {
            type: 'planned',
            plannedSession: session,
          },
        }
      })
  }, [showPlannedSessions, studyPlan, courses, filterCourse, studySessions])

  // Convert course schedules to recurring calendar events
  const classMeetingEvents = useMemo<EventInput[]>(() => {
    if (!showClassMeetings || !courses) return []

    const events: EventInput[] = []
    const today = startOfDay(new Date())
    // Show class meetings for 3 months (past month + 2 months ahead)
    const rangeStart = addDays(today, -30)
    const rangeEnd = addDays(today, 60)

    for (const course of courses) {
      if (filterCourse !== 'all' && course.id !== filterCourse) continue
      if (!course.schedule || course.schedule.length === 0) continue

      // Determine the actual date range for this course
      const courseStart = course.semesterStart ? new Date(course.semesterStart) : rangeStart
      const courseEnd = course.semesterEnd ? new Date(course.semesterEnd) : rangeEnd
      const effectiveStart = isBefore(courseStart, rangeStart) ? rangeStart : courseStart
      const effectiveEnd = isAfter(courseEnd, rangeEnd) ? rangeEnd : courseEnd

      // Generate events for each meeting pattern
      for (const meeting of course.schedule) {
        // Get the day numbers for this meeting
        const meetingDays = meeting.days.map(d => DAY_TO_NUMBER[d])

        // Iterate through the date range
        let currentDate = effectiveStart
        while (isBefore(currentDate, effectiveEnd) || currentDate.getTime() === effectiveEnd.getTime()) {
          const dayOfWeek = getDay(currentDate)

          if (meetingDays.includes(dayOfWeek)) {
            const startTime = parseTimeToDate(currentDate, meeting.startTime)
            const endTime = parseTimeToDate(currentDate, meeting.endTime)

            events.push({
              id: `class-${course.id}-${currentDate.toISOString()}-${meeting.startTime}`,
              title: `🎓 ${course.code}`,
              start: startTime,
              end: endTime,
              allDay: false,
              backgroundColor: `${course.color}40`, // Semi-transparent
              borderColor: course.color,
              textColor: course.color,
              extendedProps: {
                type: 'class',
                course,
                meeting,
                date: currentDate,
              },
            })
          }

          currentDate = addDays(currentDate, 1)
        }
      }
    }

    return events
  }, [showClassMeetings, courses, filterCourse])

  // Combine all events
  const events = useMemo<EventInput[]>(() => {
    return [...assignmentEvents, ...sessionEvents, ...plannedSessionEvents, ...classMeetingEvents]
  }, [assignmentEvents, sessionEvents, plannedSessionEvents, classMeetingEvents])

  const handleEventClick = useCallback((info: EventClickArg) => {
    const eventType = info.event.extendedProps.type
    if (eventType === 'assignment') {
      const assignment = info.event.extendedProps.assignment as Assignment
      setSelectedAssignment(assignment)
    } else if (eventType === 'class') {
      const course = info.event.extendedProps.course as Course
      const meeting = info.event.extendedProps.meeting as ClassMeeting
      const date = info.event.extendedProps.date as Date
      setSelectedClassMeeting({ course, meeting, date })
    } else if (eventType === 'session') {
      const session = info.event.extendedProps.session as StudySession
      setSelectedSession(session)
    } else if (eventType === 'planned') {
      const plannedSession = info.event.extendedProps.plannedSession as PlannedStudySession
      setSelectedPlannedSession(plannedSession)
    }
  }, [])

  const handleStatusChange = useCallback(
    async (status: AssignmentStatus) => {
      if (!selectedAssignment) return

      await updateAssignment(selectedAssignment.id, { status })
      setSelectedAssignment((prev) => (prev ? { ...prev, status } : null))
    },
    [selectedAssignment]
  )

  const handleGeneratePlan = useCallback(async () => {
    if (!assignments || !courses || !preferences) return

    setGeneratingPlan(true)
    try {
      const plan = generateStudyPlan(
        assignments,
        courses,
        studySessions || [],
        {
          productivityHours: preferences.productivityHours,
          breakPreferences: preferences.breakPreferences,
        }
      )

      if (plan.length === 0) {
        toast.warning('No study sessions could be generated. Check that you have pending assignments with future due dates.')
        return
      }

      await saveStudyPlan(plan)
      const firstSession = plan[0]
      const lastSession = plan[plan.length - 1]
      const startDate = format(firstSession.plannedStart, 'MMM d')
      const endDate = format(lastSession.plannedStart, 'MMM d')
      const uniqueAssignments = new Set(plan.map(s => s.assignmentTitle).filter(Boolean)).size

      if (startDate === endDate) {
        toast.success(`Study plan: ${plan.length} session${plan.length > 1 ? 's' : ''} on ${startDate} for ${uniqueAssignments} assignment${uniqueAssignments > 1 ? 's' : ''}`)
      } else {
        toast.success(`Study plan: ${plan.length} sessions from ${startDate} to ${endDate} for ${uniqueAssignments} assignment${uniqueAssignments > 1 ? 's' : ''}`)
      }
      setSelectedAssignment(null)
    } finally {
      setGeneratingPlan(false)
    }
  }, [assignments, courses, studySessions, preferences])

  const handleStartSession = useCallback(
    async (session: PlannedStudySession) => {
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
        courseColor: session.courseColor,
        assignmentTitle: session.assignmentTitle,
        studyTopics: session.studyTopics,
      })
      setSelectedPlannedSession(null)
      toast.success('Study session started!')
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

    toast.success(`Session completed! You studied for ${actualDuration} minutes.`)
    setActiveSession(null)
  }, [activeSession])

  const selectedCourse = useMemo(() => {
    if (!selectedAssignment || !courses) return null
    return courses.find((c) => c.id === selectedAssignment.courseId)
  }, [selectedAssignment, courses])

  const selectedSessionCourse = useMemo(() => {
    if (!selectedSession || !courses) return null
    return courses.find((c) => c.id === selectedSession.courseId)
  }, [selectedSession, courses])

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      {/* Header */}
      <div className="mb-4 md:mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-shrink-0">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Calendar</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              View your assignments and study sessions.
            </p>
          </div>
          {/* Type filter - visible on desktop */}
          <div className="hidden md:block">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="exam">Exams</SelectItem>
                <SelectItem value="quiz">Quizzes</SelectItem>
                <SelectItem value="homework">Homework</SelectItem>
                <SelectItem value="paper">Papers</SelectItem>
                <SelectItem value="project">Projects</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Filter toggles - scrollable row on mobile */}
        <div className="mt-3 flex items-center gap-3 md:gap-4 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Switch
              id="show-sessions"
              checked={showStudySessions}
              onCheckedChange={setShowStudySessions}
            />
            <Label htmlFor="show-sessions" className="text-xs md:text-sm whitespace-nowrap">
              Sessions
            </Label>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Switch
              id="show-planned"
              checked={showPlannedSessions}
              onCheckedChange={setShowPlannedSessions}
            />
            <Label htmlFor="show-planned" className="text-xs md:text-sm whitespace-nowrap">
              Planned
            </Label>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Switch
              id="show-classes"
              checked={showClassMeetings}
              onCheckedChange={setShowClassMeetings}
            />
            <Label htmlFor="show-classes" className="text-xs md:text-sm whitespace-nowrap">
              Classes
            </Label>
          </div>

          {/* Type filter - mobile only */}
          <div className="md:hidden flex-shrink-0">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="exam">Exams</SelectItem>
                <SelectItem value="quiz">Quizzes</SelectItem>
                <SelectItem value="homework">Homework</SelectItem>
                <SelectItem value="paper">Papers</SelectItem>
                <SelectItem value="project">Projects</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Course Legend - scrollable on mobile */}
      <div className="mb-3 md:mb-4 flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible md:flex-wrap">
        <span className="text-sm text-muted-foreground mr-2 flex-shrink-0">Courses:</span>
        <button
          onClick={() => setFilterCourse('all')}
          className={cn(
            'px-3 py-1 rounded-full text-sm font-medium transition-all flex-shrink-0',
            filterCourse === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          )}
        >
          All
        </button>
        {courses?.map((course) => {
          const streak = analytics?.courseStreaks?.[course.id]
          return (
            <button
              key={course.id}
              onClick={() => setFilterCourse(filterCourse === course.id ? 'all' : course.id)}
              className={cn(
                'px-3 py-1 rounded-full text-sm font-medium transition-all flex items-center gap-2 flex-shrink-0 whitespace-nowrap',
                filterCourse === course.id
                  ? 'ring-2 ring-offset-2'
                  : 'hover:ring-1 hover:ring-offset-1'
              )}
              style={{
                backgroundColor: filterCourse === course.id ? course.color : `${course.color}20`,
                color: filterCourse === course.id ? 'white' : course.color,
                borderColor: course.color,
              }}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: course.color }}
              />
              {course.code}
              {streak && streak.currentStreak > 0 && (
                <span className="flex items-center gap-0.5" title={`${streak.currentStreak} day streak`}>
                  <Flame className="h-3 w-3" />
                  <span className="text-xs">{streak.currentStreak}</span>
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Active Session Card */}
      {activeSession && (
        <Card className="mb-4 border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: activeSession.courseColor }}
                >
                  <Brain className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold">Session in Progress</h3>
                  <p className="text-sm text-muted-foreground">
                    {activeSession.courseName}
                    {activeSession.assignmentTitle && ` - ${activeSession.assignmentTitle}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Started at {format(activeSession.startTime, 'h:mm a')}
                  </p>
                </div>
              </div>
              <Button variant="destructive" onClick={handleEndSession}>
                <Square className="h-4 w-4 mr-2" />
                End Session
              </Button>
            </div>
            {activeSession.studyTopics && activeSession.studyTopics.length > 0 && (
              <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                <p className="text-xs font-medium text-muted-foreground mb-1">Focus on:</p>
                <p className="text-sm">{activeSession.studyTopics.join(' • ')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="flex-1">
        <CardContent className="p-4 h-full">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={isMobile ? 'timeGridDay' : 'dayGridMonth'}
            headerToolbar={
              isMobile
                ? {
                    left: 'prev,next',
                    center: 'title',
                    right: 'timeGridDay,timeGridWeek',
                  }
                : {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay',
                  }
            }
            events={events}
            eventClick={handleEventClick}
            height="100%"
            eventDisplay="block"
            dayMaxEvents={true}
            expandRows={true}
            titleFormat={isMobile ? { month: 'short', day: 'numeric' } : undefined}
          />
        </CardContent>
      </Card>

      {/* Assignment Details Dialog */}
      <Dialog
        open={!!selectedAssignment}
        onOpenChange={(open) => !open && setSelectedAssignment(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedAssignment?.title}</DialogTitle>
          </DialogHeader>

          {selectedAssignment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Course</Label>
                  <p className="font-medium">
                    {selectedCourse?.code} - {selectedCourse?.name}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p className="font-medium capitalize">{selectedAssignment.type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Due Date</Label>
                  <p className="font-medium">
                    {format(new Date(selectedAssignment.dueDate), 'MMMM d, yyyy')}
                  </p>
                </div>
                {selectedAssignment.weight && (
                  <div>
                    <Label className="text-muted-foreground">Weight</Label>
                    <p className="font-medium">{selectedAssignment.weight}%</p>
                  </div>
                )}
              </div>

              {selectedAssignment.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="text-sm">{selectedAssignment.description}</p>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground">Status</Label>
                <Select
                  value={selectedAssignment.status}
                  onValueChange={(value) => handleStatusChange(value as AssignmentStatus)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              onClick={handleGeneratePlan}
              disabled={generatingPlan || selectedAssignment?.status === 'completed'}
              className="w-full sm:w-auto"
            >
              {generatingPlan ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Generate Study Plan
            </Button>
            <Button variant="outline" onClick={() => setSelectedAssignment(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Study Session Details Dialog */}
      <Dialog
        open={!!selectedSession}
        onOpenChange={(open) => !open && setSelectedSession(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Study Session
              {selectedSession?.completed ? (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Completed
                </Badge>
              ) : activeSession?.id === selectedSession?.id ? (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                  In Progress
                </Badge>
              ) : null}
            </DialogTitle>
          </DialogHeader>

          {selectedSession && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Course</Label>
                  <p className="font-medium">
                    {selectedSessionCourse?.code} - {selectedSessionCourse?.name}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Activity</Label>
                  <p className="font-medium">{selectedSession.activityType}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Planned Time</Label>
                  <p className="font-medium">
                    {format(new Date(selectedSession.plannedStart), 'MMM d, h:mm a')}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Duration</Label>
                  <p className="font-medium">
                    {selectedSession.actualDuration || selectedSession.plannedDuration} min
                  </p>
                </div>
              </div>

              {selectedSession.actualStart && (
                <div>
                  <Label className="text-muted-foreground">Actual Start</Label>
                  <p className="text-sm">
                    {format(new Date(selectedSession.actualStart), 'MMM d, h:mm a')}
                  </p>
                </div>
              )}

              {selectedSession.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="text-sm">{selectedSession.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {activeSession?.id === selectedSession?.id && (
              <Button
                variant="destructive"
                onClick={() => {
                  handleEndSession()
                  setSelectedSession(null)
                }}
              >
                <Square className="h-4 w-4 mr-2" />
                End Session
              </Button>
            )}
            <Button variant="outline" onClick={() => setSelectedSession(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Planned Session Details Dialog */}
      <Dialog
        open={!!selectedPlannedSession}
        onOpenChange={(open) => !open && setSelectedPlannedSession(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Planned Study Session
              <Badge variant="outline" className="border-dashed">
                Planned
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {selectedPlannedSession && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Course</Label>
                  <p className="font-medium">{selectedPlannedSession.courseName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Activity</Label>
                  <p className="font-medium">{selectedPlannedSession.activityType}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Planned Time</Label>
                  <p className="font-medium">
                    {format(new Date(selectedPlannedSession.plannedStart), 'MMM d, h:mm a')}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Duration</Label>
                  <p className="font-medium">{selectedPlannedSession.plannedDuration} min</p>
                </div>
              </div>

              {selectedPlannedSession.assignmentTitle && (
                <div>
                  <Label className="text-muted-foreground">Assignment</Label>
                  <p className="text-sm">{selectedPlannedSession.assignmentTitle}</p>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground">Reason</Label>
                <p className="text-sm">{selectedPlannedSession.reason}</p>
              </div>

              {selectedPlannedSession.studyTopics && selectedPlannedSession.studyTopics.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Topics to Focus On</Label>
                  <ul className="mt-1 space-y-1">
                    {selectedPlannedSession.studyTopics.map((topic, idx) => (
                      <li key={idx} className="text-sm flex items-start gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>{topic}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {activeSession && (
                <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 p-3 rounded-lg">
                  A study session is already in progress. End it before starting a new one.
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPlannedSession(null)}>
              Close
            </Button>
            <Button
              onClick={() => selectedPlannedSession && handleStartSession(selectedPlannedSession)}
              disabled={!!activeSession}
            >
              <Play className="h-4 w-4 mr-2" />
              Start Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Class Meeting Details Dialog */}
      <Dialog
        open={!!selectedClassMeeting}
        onOpenChange={(open) => !open && setSelectedClassMeeting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: selectedClassMeeting?.course.color }}
              />
              {selectedClassMeeting?.course.code} - {selectedClassMeeting?.course.name}
            </DialogTitle>
          </DialogHeader>

          {selectedClassMeeting && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <p className="font-medium">
                    {format(selectedClassMeeting.date, 'EEEE, MMMM d, yyyy')}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Time</Label>
                  <p className="font-medium">
                    {selectedClassMeeting.meeting.startTime} - {selectedClassMeeting.meeting.endTime}
                  </p>
                </div>
              </div>

              {selectedClassMeeting.meeting.location && (
                <div>
                  <Label className="text-muted-foreground">Location</Label>
                  <p className="font-medium">{selectedClassMeeting.meeting.location}</p>
                </div>
              )}

              {selectedClassMeeting.course.instructor && (
                <div>
                  <Label className="text-muted-foreground">Instructor</Label>
                  <p className="font-medium">{selectedClassMeeting.course.instructor}</p>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground">Schedule</Label>
                <p className="text-sm">
                  {selectedClassMeeting.meeting.days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedClassMeeting(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
