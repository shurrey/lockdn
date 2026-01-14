import { addDays, differenceInDays, startOfDay, setHours, setMinutes, isBefore, isAfter, format } from 'date-fns'
import type { Assignment, ProductivityHour, BreakPreferences, StudySession, Course, DayOfWeek, Note, StudyMaterial } from '@/types'

export interface StudyPlanConfig {
  productivityHours: ProductivityHour[]
  breakPreferences: BreakPreferences
  defaultSessionDuration: number // minutes
  minSessionDuration: number // minutes
  planningHorizonDays: number // how far ahead to plan
  courseBuffer: number // minutes buffer before/after class
  maxConsecutiveSessions: number // max sessions in a row for same assignment
}

export interface PlannedSession {
  id?: string // assigned when saved to database
  courseId: string
  courseName: string
  courseColor: string
  assignmentId?: string
  assignmentTitle?: string
  plannedStart: Date
  plannedDuration: number // minutes
  activityType: string
  priority: number // 0-1, higher = more urgent
  reason: string
  studyTopics?: string[] // topics to focus on, extracted from syllabus/assignment
  noteIds?: string[] // linked notes relevant to this session
  studyMaterialIds?: string[] // linked study guides/practice exams
}

interface AssignmentPriority {
  assignment: Assignment
  course: Course
  priority: number
  urgencyScore: number
  weightScore: number
  effortRemaining: number // estimated minutes needed
  sessionsNeeded: number
  reason: string
}

interface TimeSlot {
  start: Date
  end: Date
  energyLevel: 'high' | 'medium' | 'low'
}

const DEFAULT_CONFIG: StudyPlanConfig = {
  productivityHours: [],
  breakPreferences: {
    shortBreakDuration: 5,
    longBreakDuration: 15,
    sessionsBeforeLongBreak: 4,
  },
  defaultSessionDuration: 50, // Pomodoro-style
  minSessionDuration: 25,
  planningHorizonDays: 14, // 2 weeks rolling window
  courseBuffer: 30, // 30 min buffer before/after class
  maxConsecutiveSessions: 2, // max 2 sessions in a row for same topic
}

const DAY_MAP: Record<DayOfWeek, number> = {
  'sunday': 0,
  'monday': 1,
  'tuesday': 2,
  'wednesday': 3,
  'thursday': 4,
  'friday': 5,
  'saturday': 6,
}

/**
 * Extract study topics from assignment description and syllabus data
 */
function extractStudyTopics(
  assignment: Assignment,
  course: Course
): string[] {
  const topics: string[] = []

  // Extract topics from assignment description
  if (assignment.description) {
    const descTopics = extractTopicsFromText(assignment.description)
    topics.push(...descTopics)
  }

  // Extract relevant topics from syllabus if available
  if (course.syllabusData?.rawText) {
    const syllabusTopics = extractRelevantSyllabusTopics(
      course.syllabusData.rawText,
      assignment
    )
    topics.push(...syllabusTopics)
  }

  // Add generic activity-based suggestions if no specific topics found
  if (topics.length === 0) {
    topics.push(...getDefaultStudyActivities(assignment.type))
  }

  // Remove duplicates and limit to 5 topics
  return [...new Set(topics)].slice(0, 5)
}

/**
 * Extract topics/key concepts from text
 */
function extractTopicsFromText(text: string): string[] {
  const topics: string[] = []

  // Look for chapter references
  const chapterMatch = text.match(/chapter\s*(\d+(?:\s*[-,&]\s*\d+)*)/gi)
  if (chapterMatch) {
    topics.push(...chapterMatch.map(c => c.trim()))
  }

  // Look for topic keywords after common phrases
  const topicPatterns = [
    /(?:covers?|about|on|regarding|focus(?:ing)?\s+on)\s+([^,.]+)/gi,
    /(?:topics?|concepts?|sections?):\s*([^.]+)/gi,
    /(?:read|review|study)\s+([^,.]+)/gi,
  ]

  for (const pattern of topicPatterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const topic = match[1].trim()
      if (topic.length > 3 && topic.length < 100) {
        topics.push(topic)
      }
    }
  }

  return topics
}

/**
 * Find relevant sections from syllabus based on assignment
 */
function extractRelevantSyllabusTopics(
  syllabusText: string,
  assignment: Assignment
): string[] {
  const topics: string[] = []
  const assignmentTitle = assignment.title.toLowerCase()
  const assignmentType = assignment.type.toLowerCase()

  // Split syllabus into lines and look for relevant content
  const lines = syllabusText.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase()

    // Check if this line mentions the assignment or its type
    if (
      line.includes(assignmentTitle) ||
      (assignmentType === 'exam' && (line.includes('exam') || line.includes('test'))) ||
      (assignmentType === 'quiz' && line.includes('quiz')) ||
      (assignmentType === 'paper' && (line.includes('paper') || line.includes('essay'))) ||
      (assignmentType === 'project' && line.includes('project'))
    ) {
      // Look at surrounding lines for topic context
      const contextStart = Math.max(0, i - 2)
      const contextEnd = Math.min(lines.length, i + 3)

      for (let j = contextStart; j < contextEnd; j++) {
        const contextLine = lines[j].trim()
        // Look for bullet points, numbered items, or topic-like content
        if (
          contextLine.match(/^[-•*]\s+/) ||
          contextLine.match(/^\d+[.)]\s+/) ||
          contextLine.match(/^(Unit|Module|Topic|Chapter)\s+\d/i)
        ) {
          const cleanedTopic = contextLine
            .replace(/^[-•*\d.)]+\s*/, '')
            .trim()
          if (cleanedTopic.length > 3 && cleanedTopic.length < 100) {
            topics.push(cleanedTopic)
          }
        }
      }
    }
  }

  return topics
}

/**
 * Get default study activities based on assignment type
 */
function getDefaultStudyActivities(type: string): string[] {
  switch (type) {
    case 'exam':
      return [
        'Review lecture notes',
        'Practice problems',
        'Review key concepts',
      ]
    case 'paper':
      return [
        'Research and outline',
        'Draft main arguments',
        'Review citations',
      ]
    case 'project':
      return [
        'Review requirements',
        'Plan implementation',
        'Test and refine',
      ]
    case 'homework':
      return [
        'Review related material',
        'Work through problems',
      ]
    case 'quiz':
      return [
        'Review recent material',
        'Practice key concepts',
      ]
    default:
      return ['Review course material']
  }
}

/**
 * Calculate priority score for an assignment
 * Higher score = higher priority
 */
function calculateAssignmentPriority(
  assignment: Assignment,
  course: Course,
  now: Date
): AssignmentPriority {
  const daysUntilDue = differenceInDays(new Date(assignment.dueDate), now)

  // Urgency score: exponentially increases as deadline approaches
  // 0 days = 1.0, 7 days = 0.5, 14 days = 0.25
  const urgencyScore = Math.max(0, Math.min(1, 1 / (1 + daysUntilDue * 0.14)))

  // Weight score: higher weight = higher priority
  const weightScore = (assignment.weight || 10) / 100

  // Effort remaining: use estimated effort or default based on type
  const defaultEffort = getDefaultEffort(assignment.type)
  const effortRemaining = assignment.estimatedEffort || defaultEffort

  // Combined priority (weighted average)
  const priority = urgencyScore * 0.6 + weightScore * 0.4

  // Generate reason
  let reason = ''
  if (daysUntilDue <= 1) {
    reason = 'Due tomorrow!'
  } else if (daysUntilDue <= 3) {
    reason = `Due in ${daysUntilDue} days`
  } else if (assignment.weight && assignment.weight >= 20) {
    reason = `Worth ${assignment.weight}% of grade`
  } else {
    reason = `Due in ${daysUntilDue} days`
  }

  // Calculate sessions needed based on effort
  const sessionsNeeded = Math.ceil(effortRemaining / 50) // 50 min default session

  return {
    assignment,
    course,
    priority,
    urgencyScore,
    weightScore,
    effortRemaining,
    sessionsNeeded,
    reason,
  }
}

/**
 * Get default effort estimate based on assignment type
 */
function getDefaultEffort(type: string): number {
  switch (type) {
    case 'exam':
      return 300 // 5 hours of study
    case 'paper':
      return 240 // 4 hours
    case 'project':
      return 360 // 6 hours
    case 'homework':
      return 90 // 1.5 hours
    case 'quiz':
      return 60 // 1 hour
    default:
      return 60
  }
}

/**
 * Get blocked time ranges for a given date from course schedules
 */
function getBlockedTimes(
  date: Date,
  courses: Course[],
  bufferMinutes: number
): { start: Date; end: Date }[] {
  const dayOfWeek = date.getDay()
  const dayName = Object.entries(DAY_MAP).find(([_, num]) => num === dayOfWeek)?.[0] as DayOfWeek | undefined

  if (!dayName) return []

  const blocked: { start: Date; end: Date }[] = []

  for (const course of courses) {
    if (!course.schedule) continue

    for (const meeting of course.schedule) {
      if (!meeting.days.includes(dayName)) continue

      // Parse meeting times
      const [startHour, startMin] = meeting.startTime.split(':').map(Number)
      const [endHour, endMin] = meeting.endTime.split(':').map(Number)

      const meetingStart = setMinutes(setHours(startOfDay(date), startHour), startMin)
      const meetingEnd = setMinutes(setHours(startOfDay(date), endHour), endMin)

      // Add buffer before and after
      const blockedStart = new Date(meetingStart.getTime() - bufferMinutes * 60000)
      const blockedEnd = new Date(meetingEnd.getTime() + bufferMinutes * 60000)

      blocked.push({ start: blockedStart, end: blockedEnd })
    }
  }

  // Sort by start time and merge overlapping blocks
  blocked.sort((a, b) => a.start.getTime() - b.start.getTime())

  const merged: { start: Date; end: Date }[] = []
  for (const block of blocked) {
    if (merged.length === 0) {
      merged.push(block)
    } else {
      const last = merged[merged.length - 1]
      if (block.start.getTime() <= last.end.getTime()) {
        // Overlapping, extend the end
        last.end = new Date(Math.max(last.end.getTime(), block.end.getTime()))
      } else {
        merged.push(block)
      }
    }
  }

  return merged
}

/**
 * Get available time slots for a given date based on productivity hours,
 * excluding course meeting times and existing sessions
 */
function getAvailableSlots(
  date: Date,
  productivityHours: ProductivityHour[],
  courses: Course[],
  existingSessions: StudySession[],
  plannedSessions: PlannedSession[],
  bufferMinutes: number
): TimeSlot[] {
  const dayOfWeek = date.getDay()
  const daySlots = productivityHours.filter((h) => h.dayOfWeek === dayOfWeek)

  // If no productivity hours defined, use default hours (9 AM - 9 PM)
  let baseSlots: TimeSlot[]
  if (daySlots.length === 0) {
    baseSlots = [
      {
        start: setHours(startOfDay(date), 9),
        end: setHours(startOfDay(date), 21),
        energyLevel: 'medium' as const,
      },
    ]
  } else {
    baseSlots = daySlots.map((slot) => ({
      start: setHours(startOfDay(date), slot.startHour),
      end: setHours(startOfDay(date), slot.endHour),
      energyLevel: slot.energyLevel,
    }))
  }

  // Get blocked times from course schedules
  const blockedTimes = getBlockedTimes(date, courses, bufferMinutes)

  // Get times blocked by existing sessions
  const existingBlocked = existingSessions.map((session) => {
    const start = new Date(session.plannedStart)
    const end = new Date(start.getTime() + session.plannedDuration * 60000)
    return { start, end }
  })

  // Get times blocked by already planned sessions
  const plannedBlocked = plannedSessions.map((session) => {
    const start = new Date(session.plannedStart)
    const end = new Date(start.getTime() + session.plannedDuration * 60000)
    return { start, end }
  })

  const allBlocked = [...blockedTimes, ...existingBlocked, ...plannedBlocked]
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  // Subtract blocked times from base slots
  const availableSlots: TimeSlot[] = []

  for (const slot of baseSlots) {
    let currentStart = slot.start

    for (const blocked of allBlocked) {
      // Skip if blocked is entirely before or after this slot
      if (blocked.end.getTime() <= slot.start.getTime()) continue
      if (blocked.start.getTime() >= slot.end.getTime()) continue

      // If there's available time before the blocked period
      if (blocked.start.getTime() > currentStart.getTime()) {
        availableSlots.push({
          start: currentStart,
          end: new Date(Math.min(blocked.start.getTime(), slot.end.getTime())),
          energyLevel: slot.energyLevel,
        })
      }

      // Move current start past the blocked period
      currentStart = new Date(Math.max(currentStart.getTime(), blocked.end.getTime()))
    }

    // Add remaining time after all blocked periods
    if (currentStart.getTime() < slot.end.getTime()) {
      availableSlots.push({
        start: currentStart,
        end: slot.end,
        energyLevel: slot.energyLevel,
      })
    }
  }

  return availableSlots
}

/**
 * Generate a study plan based on assignments and preferences
 * Supports incremental planning - won't duplicate existing planned sessions
 */
export function generateStudyPlan(
  assignments: Assignment[],
  courses: Course[],
  existingSessions: StudySession[],
  config: Partial<StudyPlanConfig> = {},
  existingPlannedSessions: PlannedSession[] = [],
  notes: Note[] = [],
  studyMaterials: StudyMaterial[] = []
): PlannedSession[] {
  const fullConfig = { ...DEFAULT_CONFIG, ...config }
  const now = new Date()
  const planEnd = addDays(now, fullConfig.planningHorizonDays)

  // Create a map of courses for easy lookup
  const courseMap = new Map(courses.map((c) => [c.id, c]))

  // Count existing planned sessions per assignment to support incremental planning
  const existingSessionsPerAssignment = new Map<string, number>()
  for (const session of existingPlannedSessions) {
    if (session.assignmentId) {
      const count = existingSessionsPerAssignment.get(session.assignmentId) || 0
      existingSessionsPerAssignment.set(session.assignmentId, count + 1)
    }
  }

  // Filter to pending/in-progress assignments with due dates within planning horizon
  const relevantAssignments = assignments.filter((a) => {
    if (a.status === 'completed') return false
    const dueDate = new Date(a.dueDate)
    // Include assignments due within the planning horizon
    return isBefore(dueDate, planEnd) && isAfter(dueDate, now)
  })

  // Calculate priorities for all assignments
  const priorities: AssignmentPriority[] = relevantAssignments
    .map((assignment) => {
      const course = courseMap.get(assignment.courseId)
      if (!course) return null
      const priority = calculateAssignmentPriority(assignment, course, now)

      // Subtract already-planned sessions for incremental planning
      const existingCount = existingSessionsPerAssignment.get(assignment.id) || 0
      if (existingCount > 0) {
        priority.sessionsNeeded = Math.max(0, priority.sessionsNeeded - existingCount)
        priority.effortRemaining = Math.max(0, priority.effortRemaining - existingCount * fullConfig.defaultSessionDuration)
      }

      return priority
    })
    .filter((p): p is AssignmentPriority => p !== null && p.sessionsNeeded > 0)
    .sort((a, b) => b.priority - a.priority)

  // Pre-compute notes and study materials by course for efficient linking
  const notesByCourse = new Map<string, Note[]>()
  for (const note of notes) {
    if (note.courseId) {
      const courseNotes = notesByCourse.get(note.courseId) || []
      courseNotes.push(note)
      notesByCourse.set(note.courseId, courseNotes)
    }
  }

  const materialsByCourse = new Map<string, StudyMaterial[]>()
  for (const material of studyMaterials) {
    if (material.courseId) {
      const courseMaterials = materialsByCourse.get(material.courseId) || []
      courseMaterials.push(material)
      materialsByCourse.set(material.courseId, courseMaterials)
    }
  }

  const plannedSessions: PlannedSession[] = []

  // For each assignment, distribute sessions across days leading up to due date
  for (const p of priorities) {
    const dueDate = new Date(p.assignment.dueDate)
    const daysUntilDue = Math.max(1, differenceInDays(dueDate, now))
    const sessionsNeeded = p.sessionsNeeded

    // Distribute sessions across available days, weighted toward the due date
    // More sessions closer to due date
    const sessionsPerDay = new Map<string, number>()

    // Calculate how many sessions to schedule each day
    // Use a weighted distribution - more sessions toward the end
    let totalWeight = 0
    const dayWeights: { date: Date; weight: number }[] = []

    for (let i = 0; i < daysUntilDue && i < fullConfig.planningHorizonDays; i++) {
      const day = addDays(startOfDay(now), i)
      // Weight increases as we approach the due date
      // Days closer to due date get higher weights
      const daysFromDue = daysUntilDue - i
      const weight = Math.max(1, 10 - daysFromDue) // Higher weight closer to due date
      totalWeight += weight
      dayWeights.push({ date: day, weight })
    }

    // Assign sessions to days based on weights
    let remainingSessions = sessionsNeeded
    for (const { date, weight } of dayWeights) {
      if (remainingSessions <= 0) break
      const dateKey = format(date, 'yyyy-MM-dd')

      // Calculate sessions for this day based on weight
      let sessionsForDay = Math.round((weight / totalWeight) * sessionsNeeded)

      // Limit consecutive sessions for same topic
      sessionsForDay = Math.min(sessionsForDay, fullConfig.maxConsecutiveSessions)

      // Don't exceed remaining sessions
      sessionsForDay = Math.min(sessionsForDay, remainingSessions)

      if (sessionsForDay > 0) {
        sessionsPerDay.set(dateKey, sessionsForDay)
        remainingSessions -= sessionsForDay
      }
    }

    // If we still have sessions to schedule, spread them out
    while (remainingSessions > 0) {
      for (const { date } of dayWeights) {
        if (remainingSessions <= 0) break
        const dateKey = format(date, 'yyyy-MM-dd')
        const current = sessionsPerDay.get(dateKey) || 0
        if (current < fullConfig.maxConsecutiveSessions) {
          sessionsPerDay.set(dateKey, current + 1)
          remainingSessions--
        }
      }
      // Prevent infinite loop if we can't fit all sessions
      if (remainingSessions > 0 && dayWeights.every(({ date }) => {
        const dateKey = format(date, 'yyyy-MM-dd')
        return (sessionsPerDay.get(dateKey) || 0) >= fullConfig.maxConsecutiveSessions
      })) {
        break
      }
    }

    // Now schedule the sessions for this assignment
    for (const [dateKey, sessionCount] of sessionsPerDay) {
      const date = new Date(dateKey)

      for (let s = 0; s < sessionCount; s++) {
        // Find available slot for this session
        const slots = getAvailableSlots(
          date,
          fullConfig.productivityHours,
          courses,
          existingSessions,
          plannedSessions,
          fullConfig.courseBuffer
        )

        // Sort slots by energy level (high first for high priority assignments)
        slots.sort((a, b) => {
          const energyOrder = { high: 0, medium: 1, low: 2 }
          return energyOrder[a.energyLevel] - energyOrder[b.energyLevel]
        })

        // Find a slot with enough time
        for (const slot of slots) {
          let slotStart = slot.start
          const slotEnd = slot.end

          // Skip if slot is in the past
          if (isBefore(slotEnd, now)) continue
          if (isBefore(slotStart, now)) slotStart = now

          const slotDuration = (slotEnd.getTime() - slotStart.getTime()) / 60000

          if (slotDuration >= fullConfig.minSessionDuration) {
            const sessionDuration = Math.min(fullConfig.defaultSessionDuration, slotDuration)

            // Extract study topics
            const studyTopics = extractStudyTopics(p.assignment, p.course)

            // Link relevant notes (from same course, created before assignment due date)
            const courseNotes = notesByCourse.get(p.course.id) || []
            const relevantNoteIds = courseNotes
              .filter(note => {
                const noteCreated = new Date(note.createdAt)
                // Include notes created before the due date
                return isBefore(noteCreated, dueDate)
              })
              .map(note => note.id)

            // Link relevant study materials (from same course)
            const courseMaterials = materialsByCourse.get(p.course.id) || []
            const relevantMaterialIds = courseMaterials
              .filter(material => {
                const materialCreated = new Date(material.createdAt)
                // Include materials created before the due date
                return isBefore(materialCreated, dueDate)
              })
              .map(material => material.id)

            plannedSessions.push({
              courseId: p.course.id,
              courseName: p.course.name,
              courseColor: p.course.color,
              assignmentId: p.assignment.id,
              assignmentTitle: p.assignment.title,
              plannedStart: new Date(slotStart),
              plannedDuration: sessionDuration,
              activityType: `Study: ${p.assignment.type}`,
              priority: p.priority,
              reason: p.reason,
              studyTopics,
              noteIds: relevantNoteIds.length > 0 ? relevantNoteIds : undefined,
              studyMaterialIds: relevantMaterialIds.length > 0 ? relevantMaterialIds : undefined,
            })

            break // Move to next session
          }
        }
      }
    }
  }

  // Sort sessions by start time
  plannedSessions.sort((a, b) => a.plannedStart.getTime() - b.plannedStart.getTime())

  return plannedSessions
}

/**
 * Get study recommendations for the dashboard
 */
export function getStudyRecommendations(
  assignments: Assignment[],
  courses: Course[],
  limit = 3
): { assignment: Assignment; course: Course; priority: number; reason: string }[] {
  const now = new Date()
  const courseMap = new Map(courses.map((c) => [c.id, c]))

  const priorities = assignments
    .filter((a) => a.status !== 'completed')
    .map((assignment) => {
      const course = courseMap.get(assignment.courseId)
      if (!course) return null
      return calculateAssignmentPriority(assignment, course, now)
    })
    .filter((p): p is AssignmentPriority => p !== null)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit)

  return priorities.map((p) => ({
    assignment: p.assignment,
    course: p.course,
    priority: p.priority,
    reason: p.reason,
  }))
}

/**
 * Calculate how many study sessions are needed before an assignment is due
 */
export function getSessionsNeeded(
  assignment: Assignment,
  sessionDuration = 50
): number {
  const effort = assignment.estimatedEffort || getDefaultEffort(assignment.type)
  return Math.ceil(effort / sessionDuration)
}

/**
 * Check if study plan needs adjustment
 */
export function checkPlanAdjustment(
  plannedSessions: PlannedSession[],
  assignments: Assignment[]
): { needsAdjustment: boolean; reason: string } {
  const now = new Date()

  // Check for new high-priority assignments
  const urgentAssignments = assignments.filter((a) => {
    if (a.status === 'completed') return false
    const daysUntilDue = differenceInDays(new Date(a.dueDate), now)
    return daysUntilDue <= 3
  })

  // Check if urgent assignments have sessions planned
  for (const assignment of urgentAssignments) {
    const hasSession = plannedSessions.some(
      (s) => s.assignmentId === assignment.id
    )
    if (!hasSession) {
      return {
        needsAdjustment: true,
        reason: `No study sessions planned for "${assignment.title}" which is due soon`,
      }
    }
  }

  // Check for missed sessions (in the past and not started)
  const missedSessions = plannedSessions.filter((s) => {
    return isBefore(s.plannedStart, now)
  })

  if (missedSessions.length > 2) {
    return {
      needsAdjustment: true,
      reason: 'Multiple planned sessions were missed. Consider rescheduling.',
    }
  }

  return { needsAdjustment: false, reason: '' }
}
