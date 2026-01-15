import { differenceInDays, differenceInHours, startOfDay } from 'date-fns'
import type {
  Assignment,
  Course,
  StudySession,
  StudyMaterial,
  Note,
  Analytics,
  PlannedStudySession,
} from '@/types'

// Types for attention items
export type AttentionType =
  | 'urgent_deadline'
  | 'approaching_deadline'
  | 'streak_at_risk'
  | 'neglected_course'
  | 'overdue_assignment'
  | 'study_session_soon'
  | 'unrevisited_material'
  | 'exam_prep'
  | 'high_weight_assignment'
  | 'setup_api_key'
  | 'setup_syllabus'
  | 'setup_courses'
  | 'declining_grades'
  | 'low_course_grade'
  | 'late_submission_pattern'

export interface AttentionItem {
  id: string
  type: AttentionType
  priority: number // 0-1, higher = more urgent
  title: string
  description: string
  actionLabel: string
  actionLink: string
  course?: Course
  assignment?: Assignment
  session?: PlannedStudySession
  material?: StudyMaterial
  icon: 'alert' | 'clock' | 'flame' | 'book' | 'brain' | 'calendar' | 'target'
  color: 'red' | 'orange' | 'yellow' | 'blue' | 'green' | 'purple'
  metadata?: Record<string, unknown>
}

interface PrioritizationInput {
  assignments: Assignment[]
  courses: Course[]
  studySessions: StudySession[]
  plannedSessions: PlannedStudySession[]
  studyMaterials: StudyMaterial[]
  notes: Note[]
  analytics: Analytics | undefined
  // Setup state
  hasApiKey?: boolean
}

/**
 * Generate a prioritized list of items that need the user's attention.
 * This is the core "smart prioritization" algorithm for the dashboard.
 */
export function getAttentionItems(
  input: PrioritizationInput,
  limit = 10
): AttentionItem[] {
  const now = new Date()
  const items: AttentionItem[] = []

  const {
    assignments,
    courses,
    plannedSessions,
    studyMaterials,
    analytics,
  } = input

  const courseMap = new Map(courses.map(c => [c.id, c]))

  // 1. URGENT: Overdue assignments (highest priority)
  const overdueAssignments = assignments.filter(a => {
    if (a.status === 'completed') return false
    const dueDate = new Date(a.dueDate)
    return dueDate < now
  })

  for (const assignment of overdueAssignments) {
    const course = courseMap.get(assignment.courseId)
    const daysOverdue = Math.abs(differenceInDays(new Date(assignment.dueDate), now))

    items.push({
      id: `overdue-${assignment.id}`,
      type: 'overdue_assignment',
      priority: 1.0, // Maximum priority
      title: `${assignment.title} is overdue`,
      description: `This ${assignment.type} was due ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} ago`,
      actionLabel: 'View Assignment',
      actionLink: '/calendar',
      course,
      assignment,
      icon: 'alert',
      color: 'red',
      metadata: { daysOverdue },
    })
  }

  // 2. URGENT: Assignments due within 24 hours
  const urgentAssignments = assignments.filter(a => {
    if (a.status === 'completed') return false
    const dueDate = new Date(a.dueDate)
    const hoursUntilDue = differenceInHours(dueDate, now)
    return hoursUntilDue > 0 && hoursUntilDue <= 24
  })

  for (const assignment of urgentAssignments) {
    const course = courseMap.get(assignment.courseId)
    const hoursLeft = differenceInHours(new Date(assignment.dueDate), now)

    items.push({
      id: `urgent-${assignment.id}`,
      type: 'urgent_deadline',
      priority: 0.95,
      title: `${assignment.title} due in ${hoursLeft}h`,
      description: `${assignment.type} for ${course?.code || 'Unknown'} is due very soon`,
      actionLabel: 'Focus Now',
      actionLink: '/study',
      course,
      assignment,
      icon: 'alert',
      color: 'red',
      metadata: { hoursLeft },
    })
  }

  // 3. HIGH: Assignments due within 3 days with high weight (≥15%)
  const highWeightSoon = assignments.filter(a => {
    if (a.status === 'completed') return false
    const dueDate = new Date(a.dueDate)
    const daysUntilDue = differenceInDays(dueDate, now)
    const weight = a.weight || 0
    return daysUntilDue > 0 && daysUntilDue <= 3 && weight >= 15
  })

  for (const assignment of highWeightSoon) {
    const course = courseMap.get(assignment.courseId)
    const daysLeft = differenceInDays(new Date(assignment.dueDate), now)

    // Skip if already added as urgent
    if (items.some(i => i.assignment?.id === assignment.id)) continue

    items.push({
      id: `highweight-${assignment.id}`,
      type: 'high_weight_assignment',
      priority: 0.85 + (assignment.weight || 0) / 1000,
      title: `${assignment.title} worth ${assignment.weight}%`,
      description: `High-stakes ${assignment.type} due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
      actionLabel: 'Prepare',
      actionLink: '/study',
      course,
      assignment,
      icon: 'target',
      color: 'orange',
      metadata: { daysLeft, weight: assignment.weight },
    })
  }

  // 4. HIGH: Approaching deadlines (3-7 days)
  const approachingAssignments = assignments.filter(a => {
    if (a.status === 'completed') return false
    const dueDate = new Date(a.dueDate)
    const daysUntilDue = differenceInDays(dueDate, now)
    return daysUntilDue > 1 && daysUntilDue <= 7
  })

  for (const assignment of approachingAssignments) {
    const course = courseMap.get(assignment.courseId)
    const daysLeft = differenceInDays(new Date(assignment.dueDate), now)

    // Skip if already added
    if (items.some(i => i.assignment?.id === assignment.id)) continue

    // Priority decreases as deadline gets further away
    const basePriority = 0.7 - (daysLeft - 1) * 0.05

    items.push({
      id: `approaching-${assignment.id}`,
      type: 'approaching_deadline',
      priority: Math.max(0.4, basePriority),
      title: `${assignment.title}`,
      description: `${assignment.type} due in ${daysLeft} days`,
      actionLabel: 'Plan Study',
      actionLink: '/study',
      course,
      assignment,
      icon: 'clock',
      color: daysLeft <= 3 ? 'orange' : 'yellow',
      metadata: { daysLeft },
    })
  }

  // 5. MEDIUM: Streaks at risk (last activity was yesterday)
  if (analytics?.courseStreaks) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    for (const [courseId, streak] of Object.entries(analytics.courseStreaks)) {
      if (streak.lastActivityDate === yesterday && streak.currentStreak >= 2) {
        const course = courseMap.get(courseId)
        if (!course) continue

        items.push({
          id: `streak-${courseId}`,
          type: 'streak_at_risk',
          priority: 0.6 + Math.min(streak.currentStreak * 0.02, 0.2), // Higher streak = higher priority
          title: `${streak.currentStreak}-day streak at risk!`,
          description: `${course.code} - Study today to keep your streak alive`,
          actionLabel: 'Study Now',
          actionLink: '/study',
          course,
          icon: 'flame',
          color: 'orange',
          metadata: { currentStreak: streak.currentStreak },
        })
      }
    }
  }

  // 6. MEDIUM: Course performance issues (declining grades, low averages, late patterns)
  if (analytics?.coursePerformance) {
    for (const [courseId, performance] of Object.entries(analytics.coursePerformance)) {
      const course = courseMap.get(courseId)
      if (!course) continue

      // Low course grade (average below 70%)
      if (performance.averageGrade < 70 && performance.assignmentCount >= 2) {
        items.push({
          id: `lowgrade-${courseId}`,
          type: 'low_course_grade',
          priority: 0.75,
          title: `${course.code} needs attention`,
          description: `Your average is ${Math.round(performance.averageGrade)}% - let's work on improving it`,
          actionLabel: 'Get Help',
          actionLink: '/tutor',
          course,
          icon: 'alert',
          color: 'orange',
          metadata: {
            average: performance.averageGrade,
            courseName: course.name,
          },
        })
      }

      // Declining grades
      if (performance.trend === 'declining' && performance.assignmentCount >= 3) {
        // Skip if already added as low grade
        if (!items.some(i => i.id === `lowgrade-${courseId}`)) {
          items.push({
            id: `declining-${courseId}`,
            type: 'declining_grades',
            priority: 0.7,
            title: `${course.code} grades declining`,
            description: `Recent grades are trending down - time to regroup`,
            actionLabel: 'Review Materials',
            actionLink: '/materials',
            course,
            icon: 'alert',
            color: 'yellow',
            metadata: {
              average: performance.averageGrade,
              trend: performance.trend,
              courseName: course.name,
            },
          })
        }
      }

      // Late submission pattern (more than 30% late)
      if (performance.completedCount >= 3 && performance.lateCount / performance.completedCount > 0.3) {
        items.push({
          id: `latepattern-${courseId}`,
          type: 'late_submission_pattern',
          priority: 0.5,
          title: `Submissions often late in ${course.code}`,
          description: `${performance.lateCount} of ${performance.completedCount} submissions were late`,
          actionLabel: 'Plan Ahead',
          actionLink: '/study',
          course,
          icon: 'clock',
          color: 'yellow',
          metadata: {
            lateCount: performance.lateCount,
            completedCount: performance.completedCount,
            onTimeRate: performance.onTimeRate,
          },
        })
      }
    }
  }

  // 7. MEDIUM-LOW: Study sessions scheduled for today
  const todayStart = startOfDay(now)
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  const todaySessions = plannedSessions.filter(s => {
    const sessionStart = new Date(s.plannedStart)
    return sessionStart >= now && sessionStart < todayEnd
  })

  for (const session of todaySessions) {
    const course = courseMap.get(session.courseId)
    const minutesUntil = Math.round((new Date(session.plannedStart).getTime() - now.getTime()) / 60000)

    items.push({
      id: `session-${session.id}`,
      type: 'study_session_soon',
      priority: minutesUntil < 60 ? 0.75 : 0.55,
      title: session.assignmentTitle || session.activityType,
      description: minutesUntil < 60
        ? `Starting in ${minutesUntil} minutes`
        : `Scheduled for today`,
      actionLabel: 'Start Session',
      actionLink: '/study',
      course,
      session,
      icon: 'calendar',
      color: minutesUntil < 60 ? 'blue' : 'green',
      metadata: { minutesUntil },
    })
  }

  // 8. MEDIUM: Exam prep - practice exams for upcoming tests
  const upcomingExams = assignments.filter(a => {
    if (a.status === 'completed') return false
    if (a.type !== 'exam' && a.type !== 'quiz') return false
    const daysUntilDue = differenceInDays(new Date(a.dueDate), now)
    return daysUntilDue > 0 && daysUntilDue <= 14
  })

  for (const exam of upcomingExams) {
    const course = courseMap.get(exam.courseId)
    if (!course) continue

    // Check if there's a practice exam for this course
    const practiceExam = studyMaterials.find(
      m => m.type === 'practice_exam' && m.courseId === exam.courseId
    )

    if (practiceExam) {
      const daysLeft = differenceInDays(new Date(exam.dueDate), now)

      // Skip if this exam is already in the list
      if (items.some(i => i.assignment?.id === exam.id)) continue

      items.push({
        id: `examprep-${exam.id}`,
        type: 'exam_prep',
        priority: 0.5 + (1 / daysLeft) * 0.2,
        title: `Practice for ${exam.title}`,
        description: `${exam.type} in ${daysLeft} days - practice exam available`,
        actionLabel: 'Take Practice Exam',
        actionLink: '/materials',
        course,
        assignment: exam,
        material: practiceExam,
        icon: 'brain',
        color: 'purple',
        metadata: { daysLeft, practiceExamId: practiceExam.id },
      })
    }
  }

  // 9. LOW: Neglected courses (no activity in 7+ days)
  const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

  for (const course of courses) {
    const streak = analytics?.courseStreaks?.[course.id]
    const lastActivity = streak?.lastActivityDate

    // Course is neglected if last activity was more than 7 days ago
    if (!lastActivity || lastActivity < lastWeek) {
      // Check if course has upcoming assignments
      const hasUpcoming = assignments.some(a =>
        a.courseId === course.id &&
        a.status !== 'completed' &&
        differenceInDays(new Date(a.dueDate), now) <= 30
      )

      if (hasUpcoming) {
        items.push({
          id: `neglected-${course.id}`,
          type: 'neglected_course',
          priority: 0.35,
          title: `${course.code} needs attention`,
          description: `No study activity in over a week`,
          actionLabel: 'Study',
          actionLink: '/study',
          course,
          icon: 'book',
          color: 'yellow',
          metadata: { lastActivity },
        })
      }
    }
  }

  // 10. LOW: Study materials that haven't been reviewed
  const unrevisitedMaterials = studyMaterials.filter(m => {
    // Study guides created more than 3 days ago that might need review
    const daysSinceCreated = differenceInDays(now, new Date(m.createdAt))
    return m.type === 'guide' && daysSinceCreated >= 3
  })

  for (const material of unrevisitedMaterials.slice(0, 3)) {
    const course = material.courseId ? courseMap.get(material.courseId) : undefined

    items.push({
      id: `material-${material.id}`,
      type: 'unrevisited_material',
      priority: 0.25,
      title: `Review: ${material.title}`,
      description: `Study guide created - revisit to reinforce learning`,
      actionLabel: 'Review',
      actionLink: '/materials',
      course,
      material,
      icon: 'book',
      color: 'green',
    })
  }

  // 11. SETUP: Missing API key (needed for AI features)
  if (input.hasApiKey === false) {
    items.push({
      id: 'setup-api-key',
      type: 'setup_api_key',
      priority: 0.45, // Medium-high priority for setup
      title: 'Configure AI features',
      description: 'Add an API key to enable the AI tutor, schedule parsing, and study guides',
      actionLabel: 'Configure',
      actionLink: '/settings',
      icon: 'brain',
      color: 'blue',
    })
  }

  // 12. SETUP: No courses added yet
  if (courses.length === 0) {
    items.push({
      id: 'setup-courses',
      type: 'setup_courses',
      priority: 0.5, // Higher than API key since it's fundamental
      title: 'Add your courses',
      description: 'Import your class schedule or add courses manually to get started',
      actionLabel: 'Add Courses',
      actionLink: '/courses',
      icon: 'book',
      color: 'blue',
    })
  }

  // 13. SETUP: Courses exist but missing syllabi
  if (courses.length > 0) {
    const coursesWithoutSyllabus = courses.filter(c => !c.syllabusData)

    if (coursesWithoutSyllabus.length > 0) {
      const courseNames = coursesWithoutSyllabus.slice(0, 3).map(c => c.code).join(', ')
      const moreCount = coursesWithoutSyllabus.length > 3 ? ` +${coursesWithoutSyllabus.length - 3} more` : ''

      items.push({
        id: 'setup-syllabus',
        type: 'setup_syllabus',
        priority: 0.4, // Slightly lower than API key
        title: 'Upload course syllabi',
        description: `Upload syllabi for ${courseNames}${moreCount} to auto-extract assignments and due dates`,
        actionLabel: 'Upload Syllabi',
        actionLink: '/courses',
        icon: 'calendar',
        color: 'blue',
        metadata: {
          coursesWithoutSyllabus: coursesWithoutSyllabus.length,
          courseIds: coursesWithoutSyllabus.map(c => c.id),
        },
      })
    }
  }

  // Sort by priority (highest first) and limit
  items.sort((a, b) => b.priority - a.priority)

  return items.slice(0, limit)
}

/**
 * Get a friendly greeting based on time of day and context
 */
export function getContextualGreeting(
  analytics: Analytics | undefined,
  attentionItems: AttentionItem[]
): string {
  const hour = new Date().getHours()
  const hasUrgent = attentionItems.some(i =>
    i.type === 'urgent_deadline' || i.type === 'overdue_assignment'
  )
  const streakAtRisk = attentionItems.some(i => i.type === 'streak_at_risk')
  const currentStreak = analytics?.currentStreak || 0

  // Check if items are only setup items
  const setupTypes: AttentionType[] = ['setup_api_key', 'setup_syllabus', 'setup_courses']
  const onlySetupItems = attentionItems.length > 0 &&
    attentionItems.every(i => setupTypes.includes(i.type))
  const hasSetupItems = attentionItems.some(i => setupTypes.includes(i.type))

  let greeting = ''

  // Time-based greeting
  if (hour < 12) {
    greeting = 'Good morning!'
  } else if (hour < 17) {
    greeting = 'Good afternoon!'
  } else {
    greeting = 'Good evening!'
  }

  // Add context
  if (hasUrgent) {
    return `${greeting} You have urgent items that need attention.`
  }

  if (streakAtRisk && currentStreak >= 3) {
    return `${greeting} Don't let your ${currentStreak}-day streak slip away!`
  }

  if (currentStreak >= 7) {
    return `${greeting} Amazing ${currentStreak}-day streak - keep it up!`
  }

  if (attentionItems.length === 0) {
    return `${greeting} You're all caught up - great work!`
  }

  // If only setup items, give a welcoming message
  if (onlySetupItems) {
    return `${greeting} Let's finish setting things up.`
  }

  // If there are setup items mixed with other things
  if (hasSetupItems) {
    return `${greeting} Here's what needs your attention.`
  }

  return `${greeting} Here's what needs your attention.`
}

/**
 * Get summary statistics for the attention items
 */
export function getAttentionSummary(items: AttentionItem[]): {
  urgent: number
  approaching: number
  streaksAtRisk: number
  totalItems: number
} {
  return {
    urgent: items.filter(i =>
      i.type === 'urgent_deadline' || i.type === 'overdue_assignment'
    ).length,
    approaching: items.filter(i => i.type === 'approaching_deadline').length,
    streaksAtRisk: items.filter(i => i.type === 'streak_at_risk').length,
    totalItems: items.length,
  }
}
