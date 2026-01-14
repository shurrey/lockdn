/**
 * Study Pattern Learning and Plan Adjustment Utilities
 *
 * This module analyzes historical study behavior to:
 * 1. Learn optimal study times and durations
 * 2. Detect and reschedule missed sessions
 * 3. Proactively adjust plans when assignments change
 */

import { differenceInDays, differenceInMinutes, addDays, startOfDay, format, isBefore, isAfter, setHours } from 'date-fns'
import type { StudySession, Assignment, Course, ProductivityHour, PlannedStudySession } from '@/types'

// ============================================================================
// Types
// ============================================================================

export interface StudyPattern {
  /** Best hours of the day for studying (0-23) */
  preferredHours: { hour: number; effectiveness: number }[]
  /** Best days of the week (0=Sunday, 6=Saturday) */
  preferredDays: { day: number; effectiveness: number }[]
  /** Average actual duration vs planned duration ratio */
  durationAccuracy: number
  /** Average completion rate */
  completionRate: number
  /** Most productive session length based on actual completions */
  optimalSessionDuration: number
  /** Course-specific patterns */
  coursePatterns: Record<string, CourseStudyPattern>
}

export interface CourseStudyPattern {
  courseId: string
  averageSessionDuration: number
  completionRate: number
  preferredHours: number[] // hours where this course is most studied
}

export interface MissedSession {
  session: PlannedStudySession
  missedBy: number // minutes past planned start
  assignmentDueIn: number // days until assignment is due
  urgency: 'critical' | 'high' | 'medium' | 'low'
}

export interface RescheduleRecommendation {
  missedSession: MissedSession
  suggestedSlots: SuggestedSlot[]
  reason: string
}

export interface SuggestedSlot {
  start: Date
  duration: number
  confidence: number // 0-1, how likely the student will actually study
  reason: string
}

export interface PlanAdjustment {
  type: 'reschedule_missed' | 'add_urgent' | 'rebalance' | 'remove_stale'
  sessionId?: string
  newSession?: Partial<PlannedStudySession>
  reason: string
  priority: number // 0-1
}

// ============================================================================
// Pattern Learning
// ============================================================================

/**
 * Analyze completed study sessions to learn patterns
 */
export function learnStudyPatterns(
  completedSessions: StudySession[],
  _courses: Course[] // kept for future course-specific pattern analysis
): StudyPattern {
  // Default pattern if no data
  if (completedSessions.length === 0) {
    return getDefaultPattern()
  }

  // Analyze hourly distribution
  const hourlyData = new Array(24).fill(0).map(() => ({ count: 0, totalMinutes: 0, completed: 0 }))
  const dailyData = new Array(7).fill(0).map(() => ({ count: 0, totalMinutes: 0, completed: 0 }))
  const courseData: Record<string, { sessions: number; totalMinutes: number; completed: number; hours: number[] }> = {}

  let totalPlannedDuration = 0
  let totalActualDuration = 0
  let completedCount = 0

  for (const session of completedSessions) {
    const startTime = session.actualStart ? new Date(session.actualStart) : new Date(session.plannedStart)
    const hour = startTime.getHours()
    const day = startTime.getDay()
    const actualDuration = session.actualDuration || session.plannedDuration

    // Update hourly stats
    hourlyData[hour].count++
    hourlyData[hour].totalMinutes += actualDuration
    if (session.completed) hourlyData[hour].completed++

    // Update daily stats
    dailyData[day].count++
    dailyData[day].totalMinutes += actualDuration
    if (session.completed) dailyData[day].completed++

    // Update course stats
    if (!courseData[session.courseId]) {
      courseData[session.courseId] = { sessions: 0, totalMinutes: 0, completed: 0, hours: [] }
    }
    courseData[session.courseId].sessions++
    courseData[session.courseId].totalMinutes += actualDuration
    courseData[session.courseId].hours.push(hour)
    if (session.completed) courseData[session.courseId].completed++

    // Track duration accuracy
    totalPlannedDuration += session.plannedDuration
    totalActualDuration += actualDuration
    if (session.completed) completedCount++
  }

  // Calculate preferred hours (sorted by effectiveness = completion rate * average time)
  const preferredHours = hourlyData
    .map((data, hour) => ({
      hour,
      effectiveness: data.count > 0
        ? (data.completed / data.count) * (data.totalMinutes / data.count) / 60
        : 0
    }))
    .filter(h => h.effectiveness > 0)
    .sort((a, b) => b.effectiveness - a.effectiveness)

  // Calculate preferred days
  const preferredDays = dailyData
    .map((data, day) => ({
      day,
      effectiveness: data.count > 0
        ? (data.completed / data.count) * (data.totalMinutes / data.count) / 60
        : 0
    }))
    .filter(d => d.effectiveness > 0)
    .sort((a, b) => b.effectiveness - a.effectiveness)

  // Calculate duration accuracy
  const durationAccuracy = totalPlannedDuration > 0
    ? totalActualDuration / totalPlannedDuration
    : 1

  // Calculate completion rate
  const completionRate = completedSessions.length > 0
    ? completedCount / completedSessions.length
    : 0

  // Find optimal session duration (mode of actual durations for completed sessions)
  const durationCounts: Record<number, number> = {}
  for (const session of completedSessions.filter(s => s.completed)) {
    const duration = Math.round((session.actualDuration || session.plannedDuration) / 10) * 10 // round to 10 min
    durationCounts[duration] = (durationCounts[duration] || 0) + 1
  }
  const optimalSessionDuration = Object.entries(durationCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0]
    ? parseInt(Object.entries(durationCounts).sort((a, b) => b[1] - a[1])[0][0])
    : 50 // default

  // Build course patterns
  const coursePatterns: Record<string, CourseStudyPattern> = {}
  for (const [courseId, data] of Object.entries(courseData)) {
    // Find most common hours for this course
    const hourCounts: Record<number, number> = {}
    for (const hour of data.hours) {
      hourCounts[hour] = (hourCounts[hour] || 0) + 1
    }
    const preferredCourseHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([h]) => parseInt(h))

    coursePatterns[courseId] = {
      courseId,
      averageSessionDuration: data.sessions > 0 ? data.totalMinutes / data.sessions : 50,
      completionRate: data.sessions > 0 ? data.completed / data.sessions : 0,
      preferredHours: preferredCourseHours,
    }
  }

  return {
    preferredHours,
    preferredDays,
    durationAccuracy,
    completionRate,
    optimalSessionDuration,
    coursePatterns,
  }
}

function getDefaultPattern(): StudyPattern {
  return {
    preferredHours: [
      { hour: 10, effectiveness: 1.0 },
      { hour: 14, effectiveness: 0.9 },
      { hour: 15, effectiveness: 0.85 },
      { hour: 9, effectiveness: 0.8 },
      { hour: 16, effectiveness: 0.75 },
    ],
    preferredDays: [
      { day: 2, effectiveness: 1.0 }, // Tuesday
      { day: 3, effectiveness: 0.95 }, // Wednesday
      { day: 1, effectiveness: 0.9 }, // Monday
      { day: 4, effectiveness: 0.85 }, // Thursday
      { day: 5, effectiveness: 0.7 }, // Friday
    ],
    durationAccuracy: 1.0,
    completionRate: 0.75,
    optimalSessionDuration: 50,
    coursePatterns: {},
  }
}

// ============================================================================
// Missed Session Detection
// ============================================================================

/**
 * Detect sessions that were planned but not started
 */
export function detectMissedSessions(
  plannedSessions: PlannedStudySession[],
  assignments: Assignment[],
  gracePeriodMinutes: number = 30
): MissedSession[] {
  const now = new Date()
  const missedSessions: MissedSession[] = []

  // Create assignment lookup
  const assignmentMap = new Map(assignments.map(a => [a.id, a]))

  for (const session of plannedSessions) {
    const plannedStart = new Date(session.plannedStart)
    const sessionEnd = new Date(plannedStart.getTime() + session.plannedDuration * 60000)

    // Session is missed if:
    // 1. The planned end time has passed (with grace period)
    // 2. OR the planned start + grace period has passed
    const missedBy = differenceInMinutes(now, plannedStart)
    const isMissed = missedBy > gracePeriodMinutes && isBefore(sessionEnd, now)

    if (!isMissed) continue

    // Calculate urgency based on assignment due date
    let urgency: MissedSession['urgency'] = 'low'
    let assignmentDueIn = 30 // default if no assignment

    if (session.assignmentId) {
      const assignment = assignmentMap.get(session.assignmentId)
      if (assignment) {
        assignmentDueIn = differenceInDays(new Date(assignment.dueDate), now)

        if (assignmentDueIn <= 1) {
          urgency = 'critical'
        } else if (assignmentDueIn <= 3) {
          urgency = 'high'
        } else if (assignmentDueIn <= 7) {
          urgency = 'medium'
        }
      }
    }

    missedSessions.push({
      session,
      missedBy,
      assignmentDueIn,
      urgency,
    })
  }

  // Sort by urgency (critical first)
  const urgencyOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  missedSessions.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])

  return missedSessions
}

/**
 * Generate rescheduling recommendations for missed sessions
 */
export function generateRescheduleRecommendations(
  missedSessions: MissedSession[],
  existingSessions: PlannedStudySession[],
  _courses: Course[], // kept for future location-aware scheduling
  patterns: StudyPattern,
  productivityHours: ProductivityHour[]
): RescheduleRecommendation[] {
  const recommendations: RescheduleRecommendation[] = []
  const now = new Date()

  for (const missed of missedSessions) {
    const suggestedSlots: SuggestedSlot[] = []

    // Get available slots for the next few days
    const daysToCheck = Math.min(missed.assignmentDueIn, 7)

    for (let dayOffset = 0; dayOffset < daysToCheck; dayOffset++) {
      const day = addDays(startOfDay(now), dayOffset)
      const dayOfWeek = day.getDay()

      // Get productivity hours for this day
      const dayProductivityHours = productivityHours.filter(h => h.dayOfWeek === dayOfWeek)

      // If no productivity hours defined, use learned patterns
      const hoursToCheck = dayProductivityHours.length > 0
        ? dayProductivityHours.map(h => h.startHour)
        : patterns.preferredHours.slice(0, 5).map(h => h.hour)

      for (const hour of hoursToCheck) {
        const slotStart = setHours(day, hour)

        // Skip if in the past
        if (isBefore(slotStart, now)) continue

        // Check if slot conflicts with existing sessions
        const hasConflict = existingSessions.some(s => {
          const existingStart = new Date(s.plannedStart)
          const existingEnd = new Date(existingStart.getTime() + s.plannedDuration * 60000)
          const newEnd = new Date(slotStart.getTime() + missed.session.plannedDuration * 60000)
          return (
            (slotStart >= existingStart && slotStart < existingEnd) ||
            (newEnd > existingStart && newEnd <= existingEnd)
          )
        })

        if (hasConflict) continue

        // Calculate confidence based on patterns
        const hourPattern = patterns.preferredHours.find(h => h.hour === hour)
        const dayPattern = patterns.preferredDays.find(d => d.day === dayOfWeek)

        const hourScore = hourPattern ? hourPattern.effectiveness : 0.5
        const dayScore = dayPattern ? dayPattern.effectiveness : 0.5
        const urgencyBoost = missed.urgency === 'critical' ? 0.2 : missed.urgency === 'high' ? 0.1 : 0

        const confidence = Math.min(1, (hourScore * 0.6 + dayScore * 0.4 + urgencyBoost) * patterns.completionRate)

        let reason = ''
        if (dayOffset === 0) {
          reason = 'Today'
        } else if (dayOffset === 1) {
          reason = 'Tomorrow'
        } else {
          reason = format(day, 'EEEE')
        }
        reason += ` at ${format(slotStart, 'h:mm a')}`

        if (hourPattern && hourPattern.effectiveness > 0.8) {
          reason += ' - your most productive time'
        }

        suggestedSlots.push({
          start: slotStart,
          duration: missed.session.plannedDuration,
          confidence,
          reason,
        })
      }
    }

    // Sort slots by confidence
    suggestedSlots.sort((a, b) => b.confidence - a.confidence)

    // Generate recommendation reason
    let reason = ''
    if (missed.urgency === 'critical') {
      reason = `Critical: "${missed.session.assignmentTitle}" is due very soon!`
    } else if (missed.urgency === 'high') {
      reason = `High priority: "${missed.session.assignmentTitle}" is due in ${missed.assignmentDueIn} days`
    } else {
      reason = `Missed study session for "${missed.session.assignmentTitle}"`
    }

    recommendations.push({
      missedSession: missed,
      suggestedSlots: suggestedSlots.slice(0, 5), // Top 5 slots
      reason,
    })
  }

  return recommendations
}

// ============================================================================
// Proactive Rebalancing
// ============================================================================

export interface RebalanceContext {
  plannedSessions: PlannedStudySession[]
  assignments: Assignment[]
  courses: Course[]
  completedSessions: StudySession[]
  patterns: StudyPattern
  productivityHours: ProductivityHour[]
}

export interface RebalanceResult {
  adjustments: PlanAdjustment[]
  summary: string
  urgentCount: number
}

/**
 * Analyze plan and generate rebalancing recommendations
 */
export function analyzeAndRebalance(context: RebalanceContext): RebalanceResult {
  const { plannedSessions, assignments, courses, patterns } = context
  // Note: productivityHours available in context for future scheduling improvements
  const adjustments: PlanAdjustment[] = []
  const now = new Date()
  let urgentCount = 0

  // 1. Check for assignments without planned sessions
  const plannedAssignmentIds = new Set(
    plannedSessions
      .filter(s => s.assignmentId)
      .map(s => s.assignmentId)
  )

  const unplannedAssignments = assignments.filter(a => {
    if (a.status === 'completed') return false
    if (plannedAssignmentIds.has(a.id)) return false
    const dueDate = new Date(a.dueDate)
    return isAfter(dueDate, now)
  })

  for (const assignment of unplannedAssignments) {
    const course = courses.find(c => c.id === assignment.courseId)
    if (!course) continue

    const daysUntilDue = differenceInDays(new Date(assignment.dueDate), now)
    let priority = 0.5

    if (daysUntilDue <= 1) {
      priority = 1.0
      urgentCount++
    } else if (daysUntilDue <= 3) {
      priority = 0.9
      urgentCount++
    } else if (daysUntilDue <= 7) {
      priority = 0.7
    }

    adjustments.push({
      type: 'add_urgent',
      newSession: {
        courseId: assignment.courseId,
        courseName: course.name,
        courseColor: course.color,
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        plannedDuration: patterns.optimalSessionDuration,
        activityType: `Study: ${assignment.type}`,
        priority,
        reason: daysUntilDue <= 1
          ? `Due tomorrow!`
          : `Due in ${daysUntilDue} days`,
      },
      reason: `No study sessions planned for "${assignment.title}" due in ${daysUntilDue} days`,
      priority,
    })
  }

  // 2. Check for over-scheduled assignments (too many sessions relative to time available)
  const sessionsByAssignment = new Map<string, PlannedStudySession[]>()
  for (const session of plannedSessions) {
    if (!session.assignmentId) continue
    const existing = sessionsByAssignment.get(session.assignmentId) || []
    existing.push(session)
    sessionsByAssignment.set(session.assignmentId, existing)
  }

  for (const [assignmentId, sessions] of sessionsByAssignment) {
    const assignment = assignments.find(a => a.id === assignmentId)
    if (!assignment) continue

    const daysUntilDue = differenceInDays(new Date(assignment.dueDate), now)
    const futureSessions = sessions.filter(s => isAfter(new Date(s.plannedStart), now))

    // If more than 3 sessions per day remaining, might be over-scheduled
    if (futureSessions.length > daysUntilDue * 3 && daysUntilDue > 0) {
      // Find low-priority sessions to potentially remove
      const lowPrioritySessions = futureSessions
        .filter(s => s.priority < 0.5)
        .sort((a, b) => a.priority - b.priority)

      for (const session of lowPrioritySessions.slice(0, futureSessions.length - daysUntilDue * 2)) {
        adjustments.push({
          type: 'remove_stale',
          sessionId: session.id,
          reason: `Reducing sessions for "${assignment.title}" - schedule may be too dense`,
          priority: 0.3,
        })
      }
    }
  }

  // 3. Check for stale sessions (past due date)
  for (const session of plannedSessions) {
    if (!session.assignmentId) continue

    const assignment = assignments.find(a => a.id === session.assignmentId)
    if (!assignment) {
      adjustments.push({
        type: 'remove_stale',
        sessionId: session.id,
        reason: 'Assignment no longer exists',
        priority: 0.8,
      })
      continue
    }

    const dueDate = new Date(assignment.dueDate)
    const sessionDate = new Date(session.plannedStart)

    // Session is after assignment due date
    if (isAfter(sessionDate, dueDate)) {
      adjustments.push({
        type: 'remove_stale',
        sessionId: session.id,
        reason: `Session scheduled after "${assignment.title}" is due`,
        priority: 0.9,
      })
    }
  }

  // Sort adjustments by priority
  adjustments.sort((a, b) => b.priority - a.priority)

  // Generate summary
  let summary = ''
  if (adjustments.length === 0) {
    summary = 'Your study plan is balanced and up to date.'
  } else {
    const addCount = adjustments.filter(a => a.type === 'add_urgent').length
    const rescheduleCount = adjustments.filter(a => a.type === 'reschedule_missed').length
    const removeCount = adjustments.filter(a => a.type === 'remove_stale').length

    const parts: string[] = []
    if (addCount > 0) parts.push(`${addCount} new session${addCount > 1 ? 's' : ''} needed`)
    if (rescheduleCount > 0) parts.push(`${rescheduleCount} to reschedule`)
    if (removeCount > 0) parts.push(`${removeCount} to clean up`)

    summary = parts.join(', ') + '.'
    if (urgentCount > 0) {
      summary = `${urgentCount} urgent: ` + summary
    }
  }

  return {
    adjustments,
    summary,
    urgentCount,
  }
}

// ============================================================================
// Apply Adjustments
// ============================================================================

/**
 * Apply a set of adjustments to the current plan
 * Returns the updated sessions array
 */
export function applyAdjustments(
  currentSessions: PlannedStudySession[],
  adjustments: PlanAdjustment[],
  selectedSlots?: Map<string, SuggestedSlot> // sessionId -> selected slot for reschedules
): PlannedStudySession[] {
  let updatedSessions = [...currentSessions]

  for (const adjustment of adjustments) {
    switch (adjustment.type) {
      case 'remove_stale':
        if (adjustment.sessionId) {
          updatedSessions = updatedSessions.filter(s => s.id !== adjustment.sessionId)
        }
        break

      case 'reschedule_missed':
        if (adjustment.sessionId && selectedSlots) {
          const slot = selectedSlots.get(adjustment.sessionId)
          if (slot) {
            updatedSessions = updatedSessions.map(s => {
              if (s.id === adjustment.sessionId) {
                return {
                  ...s,
                  plannedStart: slot.start,
                  plannedDuration: slot.duration,
                }
              }
              return s
            })
          }
        }
        break

      case 'add_urgent':
        // New sessions need to be scheduled - this would typically
        // trigger a regeneration of the plan with the new assignment included
        // For now, we just flag it
        break

      case 'rebalance':
        // Complex rebalancing would go here
        break
    }
  }

  // Sort by planned start time
  updatedSessions.sort((a, b) =>
    new Date(a.plannedStart).getTime() - new Date(b.plannedStart).getTime()
  )

  return updatedSessions
}

// ============================================================================
// Productivity Hour Suggestions
// ============================================================================

/**
 * Suggest productivity hours based on learned patterns
 */
export function suggestProductivityHours(
  patterns: StudyPattern
): ProductivityHour[] {
  const suggestions: ProductivityHour[] = []

  // Use top 3 preferred hours for each of top 5 days
  const topDays = patterns.preferredDays.slice(0, 5)
  const topHours = patterns.preferredHours.slice(0, 4)

  for (const day of topDays) {
    for (const hour of topHours) {
      suggestions.push({
        dayOfWeek: day.day,
        startHour: hour.hour,
        endHour: hour.hour + 2, // 2-hour blocks
        energyLevel: hour.effectiveness > 0.8
          ? 'high'
          : hour.effectiveness > 0.5
            ? 'medium'
            : 'low',
      })
    }
  }

  return suggestions
}
