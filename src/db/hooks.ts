import { useLiveQuery } from 'dexie-react-hooks'
import { db, generateId, now } from './index'
import type {
  Course,
  Assignment,
  Note,
  StudySession,
  Preferences,
  EncryptedApiKey,
  TutoringConversation,
  Analytics,
  AIProvider,
  ArchiveReason,
  ExamAttempt,
  DailySummary,
} from '@/types'

// ============ Course Hooks ============

export function useCourses() {
  return useLiveQuery(() =>
    db.courses
      .filter((c) => c.archivedAt === undefined)
      .sortBy('name')
  )
}

export function useCourse(id: string | undefined) {
  return useLiveQuery(() => (id ? db.courses.get(id) : undefined), [id])
}

export async function createCourse(
  data: Omit<Course, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateId()
  await db.courses.add({
    ...data,
    id,
    createdAt: now(),
    updatedAt: now(),
  })
  return id
}

export async function updateCourse(
  id: string,
  data: Partial<Omit<Course, 'id' | 'createdAt'>>
): Promise<void> {
  await db.courses.update(id, { ...data, updatedAt: now() })
}

export async function deleteCourse(id: string): Promise<void> {
  await db.transaction('rw', [db.courses, db.assignments, db.notes, db.studyMaterials, db.studySessions], async () => {
    await db.assignments.where('courseId').equals(id).delete()
    await db.notes.where('courseId').equals(id).delete()
    await db.studyMaterials.where('courseId').equals(id).delete()
    await db.studySessions.where('courseId').equals(id).delete()
    await db.courses.delete(id)
  })
}

// ============ Assignment Hooks ============

export function useAssignments(courseId?: string) {
  return useLiveQuery(() => {
    if (courseId) {
      return db.assignments
        .where('courseId')
        .equals(courseId)
        .and((a) => a.archivedAt === undefined)
        .sortBy('dueDate')
    }
    return db.assignments
      .filter((a) => a.archivedAt === undefined)
      .sortBy('dueDate')
  }, [courseId])
}

export function useUpcomingAssignments(limit = 5) {
  return useLiveQuery(async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return db.assignments
      .where('dueDate')
      .aboveOrEqual(today)
      .and((a) => a.status !== 'completed' && a.archivedAt === undefined)
      .sortBy('dueDate')
      .then((assignments) => assignments.slice(0, limit))
  }, [limit])
}

export async function createAssignment(
  data: Omit<Assignment, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateId()
  await db.assignments.add({
    ...data,
    id,
    createdAt: now(),
    updatedAt: now(),
  })
  return id
}

export async function updateAssignment(
  id: string,
  data: Partial<Omit<Assignment, 'id' | 'createdAt'>>
): Promise<void> {
  await db.assignments.update(id, { ...data, updatedAt: now() })
}

export async function deleteAssignment(id: string): Promise<void> {
  await db.assignments.delete(id)
}

// ============ Note Hooks ============

export function useNotes(courseId?: string) {
  return useLiveQuery(() => {
    if (courseId) {
      return db.notes
        .where('courseId')
        .equals(courseId)
        .and((n) => n.archivedAt === undefined)
        .sortBy('createdAt')
    }
    return db.notes
      .filter((n) => n.archivedAt === undefined)
      .reverse()
      .sortBy('createdAt')
  }, [courseId])
}

export async function createNote(
  data: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateId()
  await db.notes.add({
    ...data,
    id,
    createdAt: now(),
    updatedAt: now(),
  })

  // Retroactively link to existing study sessions for this course
  if (data.courseId) {
    // Use setTimeout to avoid circular dependency - linkNoteToSessions is defined later
    setTimeout(() => linkNoteToSessions(id, data.courseId!), 0)
  }

  return id
}

export async function updateNote(
  id: string,
  data: Partial<Omit<Note, 'id' | 'createdAt'>>
): Promise<void> {
  await db.notes.update(id, { ...data, updatedAt: now() })
}

export async function deleteNote(id: string): Promise<void> {
  await db.notes.delete(id)
}

// ============ Study Material Hooks ============

export function useStudyMaterials(courseId?: string) {
  return useLiveQuery(() => {
    if (courseId) {
      return db.studyMaterials
        .where('courseId')
        .equals(courseId)
        .and((m) => m.archivedAt === undefined)
        .sortBy('createdAt')
    }
    return db.studyMaterials
      .filter((m) => m.archivedAt === undefined)
      .sortBy('createdAt')
  }, [courseId])
}

// ============ Study Session Hooks ============

export function useStudySessions(courseId?: string) {
  return useLiveQuery(() => {
    if (courseId) {
      return db.studySessions
        .where('courseId')
        .equals(courseId)
        .and((s) => s.archivedAt === undefined)
        .sortBy('plannedStart')
    }
    return db.studySessions
      .filter((s) => s.archivedAt === undefined)
      .reverse()
      .sortBy('plannedStart')
  }, [courseId])
}

export function useTodayStudySessions() {
  return useLiveQuery(async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    return db.studySessions
      .where('plannedStart')
      .between(today, tomorrow)
      .and((s) => s.archivedAt === undefined)
      .toArray()
  })
}

export async function createStudySession(
  data: Omit<StudySession, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateId()
  await db.studySessions.add({
    ...data,
    id,
    createdAt: now(),
    updatedAt: now(),
  })
  return id
}

export async function updateStudySession(
  id: string,
  data: Partial<Omit<StudySession, 'id' | 'createdAt'>>
): Promise<void> {
  // Get the session before updating to check if we're marking it complete
  const session = await db.studySessions.get(id)

  await db.studySessions.update(id, { ...data, updatedAt: now() })

  // If marking as completed, update the daily summary and streaks
  if (data.completed && session && !session.completed) {
    const dateStr = new Date().toISOString().split('T')[0]
    const duration = data.actualDuration || session.actualDuration || session.plannedDuration

    // Update daily summary
    const existing = await db.dailySummaries.get(dateStr)
    if (existing) {
      const newCourseBreakdown = { ...existing.courseBreakdown }
      newCourseBreakdown[session.courseId] = (newCourseBreakdown[session.courseId] || 0) + duration

      await db.dailySummaries.update(dateStr, {
        totalStudyMinutes: existing.totalStudyMinutes + duration,
        sessionCount: existing.sessionCount + 1,
        courseBreakdown: newCourseBreakdown,
        updatedAt: now(),
      })
    } else {
      await db.dailySummaries.add({
        id: dateStr,
        date: dateStr,
        totalStudyMinutes: duration,
        sessionCount: 1,
        tasksCompleted: 0,
        courseBreakdown: { [session.courseId]: duration },
        createdAt: now(),
        updatedAt: now(),
      })
    }

    // Update streaks - get course name for streak records
    const course = await db.courses.get(session.courseId)
    const courseName = course?.name || 'Unknown Course'
    // Use setTimeout to avoid any potential issues with function ordering
    setTimeout(() => {
      recordStudyActivity(session.courseId, courseName, 'study_session')
    }, 0)
  }
}

/**
 * Backfill daily summaries from existing completed study sessions
 * Call this once to populate historical data
 */
export async function backfillDailySummaries(): Promise<number> {
  const completedSessions = await db.studySessions
    .filter((s) => s.completed && s.archivedAt === undefined)
    .toArray()

  if (completedSessions.length === 0) return 0

  // Group sessions by date
  const sessionsByDate = new Map<string, StudySession[]>()
  for (const session of completedSessions) {
    const dateStr = session.actualStart
      ? new Date(session.actualStart).toISOString().split('T')[0]
      : new Date(session.plannedStart).toISOString().split('T')[0]

    if (!sessionsByDate.has(dateStr)) {
      sessionsByDate.set(dateStr, [])
    }
    sessionsByDate.get(dateStr)!.push(session)
  }

  // Create or update daily summaries
  let updatedCount = 0
  for (const [dateStr, sessions] of sessionsByDate) {
    const totalMinutes = sessions.reduce(
      (sum, s) => sum + (s.actualDuration || s.plannedDuration),
      0
    )

    const courseBreakdown: Record<string, number> = {}
    for (const session of sessions) {
      const duration = session.actualDuration || session.plannedDuration
      courseBreakdown[session.courseId] = (courseBreakdown[session.courseId] || 0) + duration
    }

    const existing = await db.dailySummaries.get(dateStr)
    if (existing) {
      // Merge with existing data
      const mergedBreakdown = { ...existing.courseBreakdown }
      for (const [courseId, minutes] of Object.entries(courseBreakdown)) {
        mergedBreakdown[courseId] = minutes // Replace with accurate data
      }

      await db.dailySummaries.update(dateStr, {
        totalStudyMinutes: totalMinutes,
        sessionCount: sessions.length,
        courseBreakdown: mergedBreakdown,
        updatedAt: now(),
      })
    } else {
      await db.dailySummaries.add({
        id: dateStr,
        date: dateStr,
        totalStudyMinutes: totalMinutes,
        sessionCount: sessions.length,
        tasksCompleted: 0,
        courseBreakdown,
        createdAt: now(),
        updatedAt: now(),
      })
    }
    updatedCount++
  }

  return updatedCount
}

/**
 * Backfill streaks from existing completed study sessions
 * Call this once to populate historical streak data
 */
export async function backfillStreaks(): Promise<void> {
  const completedSessions = await db.studySessions
    .filter((s) => s.completed && s.archivedAt === undefined)
    .toArray()

  if (completedSessions.length === 0) return

  // Sort sessions by date
  completedSessions.sort((a, b) => {
    const dateA = a.actualStart || a.plannedStart
    const dateB = b.actualStart || b.plannedStart
    return new Date(dateA).getTime() - new Date(dateB).getTime()
  })

  // Get all courses for name lookup
  const allCourses = await db.courses.toArray()
  const courseMap = new Map(allCourses.map((c) => [c.id, c.name]))

  // Process sessions in chronological order to build streaks correctly
  for (const session of completedSessions) {
    const courseName = courseMap.get(session.courseId) || 'Unknown Course'
    await recordStudyActivity(session.courseId, courseName, 'study_session')
  }
}

/**
 * Record viewing a study guide (counts toward streak)
 */
export async function recordStudyGuideReview(
  materialId: string
): Promise<void> {
  const material = await db.studyMaterials.get(materialId)
  if (!material?.courseId) return

  const course = await db.courses.get(material.courseId)
  const courseName = course?.name || 'Unknown Course'
  await recordStudyActivity(material.courseId, courseName, 'study_guide_review')
}

// ============ Study Plan Hooks ============

export function useStudyPlan() {
  return useLiveQuery(() => db.studyPlan.get('active_study_plan'))
}

export async function saveStudyPlan(
  sessions: Array<{
    courseId: string
    courseName: string
    courseColor: string
    assignmentId?: string
    assignmentTitle?: string
    plannedStart: Date
    plannedDuration: number
    activityType: string
    priority: number
    reason: string
    studyTopics?: string[]
  }>
): Promise<void> {
  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + 7) // Plan valid for 7 days

  const sessionsWithIds = sessions.map((s) => ({
    ...s,
    id: generateId(),
  }))

  await db.studyPlan.put({
    id: 'active_study_plan',
    sessions: sessionsWithIds,
    generatedAt: now(),
    validUntil,
  })
}

export async function clearStudyPlan(): Promise<void> {
  await db.studyPlan.delete('active_study_plan')
}

export async function removeSessionFromPlan(sessionId: string): Promise<void> {
  const plan = await db.studyPlan.get('active_study_plan')
  if (!plan) return

  const updatedSessions = plan.sessions.filter((s) => s.id !== sessionId)

  if (updatedSessions.length === 0) {
    // If no sessions left, delete the plan entirely
    await db.studyPlan.delete('active_study_plan')
  } else {
    await db.studyPlan.update('active_study_plan', { sessions: updatedSessions })
  }
}

/**
 * Retroactively link a note to relevant planned study sessions.
 * Links to sessions for the same course where the assignment due date is after the note creation.
 */
export async function linkNoteToSessions(noteId: string, courseId: string): Promise<void> {
  const plan = await db.studyPlan.get('active_study_plan')
  if (!plan || plan.sessions.length === 0) return

  const note = await db.notes.get(noteId)
  if (!note) return

  let updated = false
  const updatedSessions = plan.sessions.map((session) => {
    // Only link to sessions from the same course
    if (session.courseId !== courseId) return session

    // Check if note is already linked
    if (session.noteIds?.includes(noteId)) return session

    // Add note to session
    updated = true
    return {
      ...session,
      noteIds: [...(session.noteIds || []), noteId],
    }
  })

  if (updated) {
    await db.studyPlan.update('active_study_plan', { sessions: updatedSessions })
  }
}

/**
 * Retroactively link a study material to relevant planned study sessions.
 * Links to sessions for the same course.
 */
export async function linkStudyMaterialToSessions(materialId: string, courseId: string): Promise<void> {
  const plan = await db.studyPlan.get('active_study_plan')
  if (!plan || plan.sessions.length === 0) return

  let updated = false
  const updatedSessions = plan.sessions.map((session) => {
    // Only link to sessions from the same course
    if (session.courseId !== courseId) return session

    // Check if material is already linked
    if (session.studyMaterialIds?.includes(materialId)) return session

    // Add material to session
    updated = true
    return {
      ...session,
      studyMaterialIds: [...(session.studyMaterialIds || []), materialId],
    }
  })

  if (updated) {
    await db.studyPlan.update('active_study_plan', { sessions: updatedSessions })
  }
}

// ============ Preferences Hooks ============

export function usePreferences() {
  return useLiveQuery(() => db.preferences.get('user_preferences'))
}

export async function updatePreferences(
  data: Partial<Omit<Preferences, 'id'>>
): Promise<void> {
  await db.preferences.update('user_preferences', { ...data, updatedAt: now() })
}

// ============ API Key Hooks ============

export function useApiKeys() {
  return useLiveQuery(() => db.encryptedApiKeys.toArray())
}

export function useApiKey(provider: AIProvider) {
  return useLiveQuery(
    () => db.encryptedApiKeys.where('provider').equals(provider).first(),
    [provider]
  )
}

export async function saveApiKey(key: EncryptedApiKey): Promise<void> {
  const existing = await db.encryptedApiKeys.where('provider').equals(key.provider).first()
  if (existing) {
    await db.encryptedApiKeys.update(existing.id, {
      ...key,
      updatedAt: now(),
    })
  } else {
    await db.encryptedApiKeys.add(key)
  }
}

export async function deleteApiKey(provider: AIProvider): Promise<void> {
  await db.encryptedApiKeys.where('provider').equals(provider).delete()
}

// ============ Tutoring Hooks ============

export function useTutoringConversations() {
  return useLiveQuery(() =>
    db.tutoringConversations
      .filter((t) => t.archivedAt === undefined)
      .reverse()
      .sortBy('updatedAt')
  )
}

export function useTutoringConversation(id: string | undefined) {
  return useLiveQuery(() => (id ? db.tutoringConversations.get(id) : undefined), [id])
}

export async function createTutoringConversation(
  data: Omit<TutoringConversation, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateId()
  await db.tutoringConversations.add({
    ...data,
    id,
    createdAt: now(),
    updatedAt: now(),
  })
  return id
}

export async function updateTutoringConversation(
  id: string,
  data: Partial<Omit<TutoringConversation, 'id' | 'createdAt'>>,
  options?: { recordActivity?: boolean }
): Promise<void> {
  await db.tutoringConversations.update(id, { ...data, updatedAt: now() })

  // Record streak activity if this is adding messages and has a course
  if (options?.recordActivity && data.messages) {
    const conversation = await db.tutoringConversations.get(id)
    if (conversation?.courseId) {
      const course = await db.courses.get(conversation.courseId)
      const courseName = course?.name || 'Unknown Course'
      recordStudyActivity(conversation.courseId, courseName, 'tutoring')
    }
  }
}

// ============ Analytics Hooks ============

export function useAnalytics() {
  return useLiveQuery(() => db.analytics.get('user_analytics'))
}

export async function updateAnalytics(
  data: Partial<Omit<Analytics, 'id'>>
): Promise<void> {
  await db.analytics.update('user_analytics', { ...data, updatedAt: now() })
}

/**
 * Record a study activity and update streaks
 * Called when: study session completes, practice exam taken, study guide reviewed, tutoring
 */
export async function recordStudyActivity(
  courseId: string,
  courseName: string,
  activityType: 'study_session' | 'practice_exam' | 'study_guide_review' | 'tutoring'
): Promise<void> {
  const analytics = await db.analytics.get('user_analytics')
  if (!analytics) return

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  // --- Update Global Streak ---
  let newGlobalStreak = analytics.currentStreak
  let newLongestStreak = analytics.longestStreak
  let newLongestStreakDate = analytics.longestStreakDate
  const streakRecords = [...(analytics.streakRecords || [])]

  if (analytics.lastStudyDate === today) {
    // Already studied today, no streak change
  } else if (analytics.lastStudyDate === yesterday) {
    // Consecutive day - extend streak
    newGlobalStreak = analytics.currentStreak + 1
  } else if (!analytics.lastStudyDate) {
    // First activity ever
    newGlobalStreak = 1
  } else {
    // Streak broken - record the old streak if notable (>= 3 days)
    if (analytics.currentStreak >= 3) {
      const streakStartDate = new Date()
      streakStartDate.setDate(streakStartDate.getDate() - analytics.currentStreak)
      streakRecords.push({
        id: generateId(),
        type: 'global',
        streakLength: analytics.currentStreak,
        startDate: streakStartDate.toISOString().split('T')[0],
        endDate: analytics.lastStudyDate!,
        achievedAt: now(),
      })
    }
    newGlobalStreak = 1
  }

  // Update longest streak if beaten
  if (newGlobalStreak > newLongestStreak) {
    newLongestStreak = newGlobalStreak
    newLongestStreakDate = today
  }

  // --- Update Course Streak ---
  const courseStreaks = { ...(analytics.courseStreaks || {}) }
  let courseStreak = courseStreaks[courseId] || {
    courseId,
    currentStreak: 0,
    longestStreak: 0,
  }

  let newCourseStreak = courseStreak.currentStreak
  let newCourseLongestStreak = courseStreak.longestStreak
  let newCourseLongestStreakDate = courseStreak.longestStreakDate

  if (courseStreak.lastActivityDate === today) {
    // Already active today for this course
  } else if (courseStreak.lastActivityDate === yesterday) {
    // Consecutive day for this course
    newCourseStreak = courseStreak.currentStreak + 1
  } else if (!courseStreak.lastActivityDate) {
    // First activity for this course
    newCourseStreak = 1
  } else {
    // Course streak broken - record if notable
    if (courseStreak.currentStreak >= 3) {
      const streakStartDate = new Date()
      streakStartDate.setDate(streakStartDate.getDate() - courseStreak.currentStreak)
      streakRecords.push({
        id: generateId(),
        type: 'course',
        courseId,
        courseName,
        streakLength: courseStreak.currentStreak,
        startDate: streakStartDate.toISOString().split('T')[0],
        endDate: courseStreak.lastActivityDate!,
        achievedAt: now(),
      })
    }
    newCourseStreak = 1
  }

  // Update course longest streak if beaten
  if (newCourseStreak > newCourseLongestStreak) {
    newCourseLongestStreak = newCourseStreak
    newCourseLongestStreakDate = today
  }

  courseStreaks[courseId] = {
    courseId,
    currentStreak: newCourseStreak,
    longestStreak: newCourseLongestStreak,
    lastActivityDate: today,
    longestStreakDate: newCourseLongestStreakDate,
  }

  // --- Update Best Course Streak Ever ---
  let bestCourseStreak = analytics.bestCourseStreak
  if (!bestCourseStreak || newCourseStreak > bestCourseStreak.streak) {
    bestCourseStreak = {
      courseId,
      courseName,
      streak: newCourseStreak,
      date: today,
    }
  }

  // --- Increment counters based on activity type ---
  const totalSessionsCompleted =
    activityType === 'study_session'
      ? analytics.totalSessionsCompleted + 1
      : analytics.totalSessionsCompleted

  // --- Save all updates ---
  await db.analytics.update('user_analytics', {
    currentStreak: newGlobalStreak,
    longestStreak: newLongestStreak,
    longestStreakDate: newLongestStreakDate,
    lastStudyDate: today,
    totalSessionsCompleted,
    courseStreaks,
    streakRecords: streakRecords.slice(-50), // Keep last 50 records
    bestCourseStreak,
    updatedAt: now(),
  })
}

/**
 * Get courses with streaks at risk (last activity was yesterday)
 */
export function useCoursesAtRisk() {
  return useLiveQuery(async () => {
    const analytics = await db.analytics.get('user_analytics')
    if (!analytics?.courseStreaks) return []

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const atRisk: Array<{ courseId: string; currentStreak: number }> = []

    for (const [courseId, streak] of Object.entries(analytics.courseStreaks)) {
      if (streak.lastActivityDate === yesterday && streak.currentStreak >= 2) {
        atRisk.push({ courseId, currentStreak: streak.currentStreak })
      }
    }

    return atRisk
  })
}

// ============ Analytics Query Hooks for Dashboard ============

/**
 * Get exam attempts, optionally filtered by exam ID
 */
export function useExamAttempts(examId?: string) {
  return useLiveQuery(() => {
    if (examId) {
      return db.examAttempts
        .where('examId')
        .equals(examId)
        .and((a) => a.archivedAt === undefined)
        .sortBy('completedAt')
    }
    return db.examAttempts
      .filter((a) => a.archivedAt === undefined)
      .sortBy('completedAt')
  }, [examId])
}

/**
 * Get daily summaries for the last N days
 */
export function useDailySummaries(days: number = 30) {
  return useLiveQuery(() => {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)
    const startDateStr = startDate.toISOString().split('T')[0]

    return db.dailySummaries
      .where('date')
      .aboveOrEqual(startDateStr)
      .sortBy('date')
  }, [days])
}

/**
 * Get completed study sessions for analytics
 */
export function useCompletedStudySessions(days?: number) {
  return useLiveQuery(() => {
    let query = db.studySessions
      .filter((s) => s.completed && s.archivedAt === undefined)

    if (days) {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      startDate.setHours(0, 0, 0, 0)
      query = query.and((s) => s.actualStart !== undefined && new Date(s.actualStart) >= startDate)
    }

    return query.toArray()
  }, [days])
}

/**
 * Create or update a daily summary
 */
export async function updateDailySummary(
  date: string,
  data: Partial<Omit<DailySummary, 'id' | 'date'>>
): Promise<void> {
  const existing = await db.dailySummaries.get(date)
  if (existing) {
    await db.dailySummaries.update(date, { ...data, updatedAt: now() })
  } else {
    await db.dailySummaries.add({
      id: date,
      date,
      totalStudyMinutes: 0,
      sessionCount: 0,
      tasksCompleted: 0,
      courseBreakdown: {},
      createdAt: now(),
      updatedAt: now(),
      ...data,
    })
  }
}

/**
 * Record an exam attempt
 */
export async function recordExamAttempt(
  data: Omit<ExamAttempt, 'id' | 'attemptNumber'>
): Promise<string> {
  const id = generateId()

  // Get the attempt number for this exam
  const previousAttempts = await db.examAttempts
    .where('examId')
    .equals(data.examId)
    .count()

  await db.examAttempts.add({
    ...data,
    id,
    attemptNumber: previousAttempts + 1,
  })

  // Update streaks - get course info from the study material
  const studyMaterial = await db.studyMaterials.get(data.examId)
  if (studyMaterial?.courseId) {
    const course = await db.courses.get(studyMaterial.courseId)
    const courseName = course?.name || 'Unknown Course'
    recordStudyActivity(studyMaterial.courseId, courseName, 'practice_exam')
  }

  return id
}

/**
 * Get study time breakdown by course for a date range
 */
export function useStudyTimeByCourse(days: number = 30) {
  return useLiveQuery(async () => {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)

    const sessions = await db.studySessions
      .filter((s) =>
        s.completed &&
        s.archivedAt === undefined &&
        s.actualStart !== undefined &&
        new Date(s.actualStart) >= startDate
      )
      .toArray()

    const courseMap = new Map<string, number>()
    for (const session of sessions) {
      const duration = session.actualDuration || session.plannedDuration
      const current = courseMap.get(session.courseId) || 0
      courseMap.set(session.courseId, current + duration)
    }

    return courseMap
  }, [days])
}

/**
 * Get productivity heatmap data (hours vs days of week)
 */
export function useProductivityHeatmap(days: number = 90) {
  return useLiveQuery(async () => {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)

    const sessions = await db.studySessions
      .filter((s) =>
        s.completed &&
        s.archivedAt === undefined &&
        s.actualStart !== undefined &&
        new Date(s.actualStart) >= startDate
      )
      .toArray()

    // Create a 7x24 grid (days x hours)
    const heatmap: number[][] = Array(7).fill(null).map(() => Array(24).fill(0))

    for (const session of sessions) {
      if (session.actualStart) {
        const start = new Date(session.actualStart)
        const dayOfWeek = start.getDay() // 0 = Sunday, 6 = Saturday
        const hour = start.getHours()
        const duration = session.actualDuration || session.plannedDuration
        heatmap[dayOfWeek][hour] += duration
      }
    }

    return heatmap
  }, [days])
}

// ============ Archive Functions ============

export interface ArchiveCourseOptions {
  keepNotesAndMaterials?: boolean // If true, move to Uncategorized instead of archiving
}

/**
 * Archive a course and optionally its related items
 * - Assignments are always archived with the course
 * - Study sessions are always archived with the course
 * - Notes and StudyMaterials can be kept (moved to Uncategorized) or archived
 * - Tutoring conversations are moved to Uncategorized (valuable context)
 */
export async function archiveCourse(
  id: string,
  options: ArchiveCourseOptions = {}
): Promise<void> {
  const { keepNotesAndMaterials = false } = options
  const archiveDate = now()
  const reason: ArchiveReason = 'course_archived'

  await db.transaction(
    'rw',
    [db.courses, db.assignments, db.notes, db.studyMaterials, db.studySessions, db.tutoringConversations],
    async () => {
      // Always archive assignments with the course
      await db.assignments
        .where('courseId')
        .equals(id)
        .modify({ archivedAt: archiveDate, archiveReason: reason })

      // Always archive study sessions with the course
      await db.studySessions
        .where('courseId')
        .equals(id)
        .modify({ archivedAt: archiveDate, archiveReason: reason })

      if (keepNotesAndMaterials) {
        // Move notes and materials to Uncategorized
        await db.notes.where('courseId').equals(id).modify({ courseId: undefined })
        await db.studyMaterials.where('courseId').equals(id).modify({ courseId: undefined })
      } else {
        // Archive notes and materials with the course
        await db.notes
          .where('courseId')
          .equals(id)
          .modify({ archivedAt: archiveDate, archiveReason: reason })
        await db.studyMaterials
          .where('courseId')
          .equals(id)
          .modify({ archivedAt: archiveDate, archiveReason: reason })
      }

      // Always move tutoring conversations to Uncategorized (valuable context)
      await db.tutoringConversations.where('courseId').equals(id).modify({ courseId: undefined })

      // Archive the course itself
      await db.courses.update(id, {
        archivedAt: archiveDate,
        archiveReason: 'user_archived',
        updatedAt: archiveDate,
      })
    }
  )
}

/**
 * Archive a note
 * - Study materials that reference this note will have the noteId removed from sourceNoteIds
 */
export async function archiveNote(id: string): Promise<void> {
  const archiveDate = now()

  await db.transaction('rw', [db.notes, db.studyMaterials], async () => {
    // Archive the note
    await db.notes.update(id, {
      archivedAt: archiveDate,
      archiveReason: 'user_archived',
      updatedAt: archiveDate,
    })

    // Remove this note from any studyMaterials' sourceNoteIds
    const materialsWithNote = await db.studyMaterials
      .filter((m) => m.sourceNoteIds?.includes(id) ?? false)
      .toArray()

    for (const material of materialsWithNote) {
      await db.studyMaterials.update(material.id, {
        sourceNoteIds: material.sourceNoteIds?.filter((noteId) => noteId !== id),
        updatedAt: archiveDate,
      })
    }
  })
}

/**
 * Archive an assignment
 * - Study plan sessions referencing this assignment will have assignmentId cleared
 */
export async function archiveAssignment(id: string): Promise<void> {
  const archiveDate = now()

  await db.transaction('rw', [db.assignments, db.studyPlan], async () => {
    // Archive the assignment
    await db.assignments.update(id, {
      archivedAt: archiveDate,
      archiveReason: 'user_archived',
      updatedAt: archiveDate,
    })

    // Clear assignmentId from study plan sessions
    const plan = await db.studyPlan.get('active_study_plan')
    if (plan) {
      const updatedSessions = plan.sessions.map((session) => {
        if (session.assignmentId === id) {
          return { ...session, assignmentId: undefined, assignmentTitle: undefined }
        }
        return session
      })
      await db.studyPlan.update('active_study_plan', { sessions: updatedSessions })
    }
  })
}

/**
 * Archive a study material
 * - Related exam attempts are also archived
 */
export async function archiveStudyMaterial(id: string): Promise<void> {
  const archiveDate = now()

  await db.transaction('rw', [db.studyMaterials, db.examAttempts], async () => {
    // Archive the study material
    await db.studyMaterials.update(id, {
      archivedAt: archiveDate,
      archiveReason: 'user_archived',
      updatedAt: archiveDate,
    })

    // Archive related exam attempts
    await db.examAttempts.where('examId').equals(id).modify({
      archivedAt: archiveDate,
      archiveReason: 'user_archived',
    })
  })
}

/**
 * Archive a study session
 */
export async function archiveStudySession(id: string): Promise<void> {
  await db.studySessions.update(id, {
    archivedAt: now(),
    archiveReason: 'user_archived',
    updatedAt: now(),
  })
}

/**
 * Archive a tutoring conversation
 */
export async function archiveTutoringConversation(id: string): Promise<void> {
  await db.tutoringConversations.update(id, {
    archivedAt: now(),
    archiveReason: 'user_archived',
    updatedAt: now(),
  })
}

// ============ Restore Functions ============

/**
 * Restore an archived item
 * Note: When restoring a course, related items are NOT automatically restored
 */
export async function restoreCourse(id: string): Promise<void> {
  await db.courses.update(id, {
    archivedAt: undefined,
    archiveReason: undefined,
    updatedAt: now(),
  })
}

export async function restoreNote(id: string): Promise<void> {
  await db.notes.update(id, {
    archivedAt: undefined,
    archiveReason: undefined,
    updatedAt: now(),
  })
}

export async function restoreAssignment(id: string): Promise<void> {
  await db.assignments.update(id, {
    archivedAt: undefined,
    archiveReason: undefined,
    updatedAt: now(),
  })
}

export async function restoreStudyMaterial(id: string): Promise<void> {
  await db.transaction('rw', [db.studyMaterials, db.examAttempts], async () => {
    await db.studyMaterials.update(id, {
      archivedAt: undefined,
      archiveReason: undefined,
      updatedAt: now(),
    })

    // Also restore related exam attempts
    await db.examAttempts.where('examId').equals(id).modify({
      archivedAt: undefined,
      archiveReason: undefined,
    })
  })
}

export async function restoreStudySession(id: string): Promise<void> {
  await db.studySessions.update(id, {
    archivedAt: undefined,
    archiveReason: undefined,
    updatedAt: now(),
  })
}

export async function restoreTutoringConversation(id: string): Promise<void> {
  await db.tutoringConversations.update(id, {
    archivedAt: undefined,
    archiveReason: undefined,
    updatedAt: now(),
  })
}

// ============ Permanent Delete Functions ============

/**
 * Permanently delete a course and all its archived related items
 */
export async function permanentlyDeleteCourse(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.courses, db.assignments, db.notes, db.studyMaterials, db.studySessions, db.tutoringConversations, db.examAttempts],
    async () => {
      // Get study material IDs to delete their exam attempts
      const materialIds = await db.studyMaterials
        .where('courseId')
        .equals(id)
        .primaryKeys()

      // Delete exam attempts for the course's study materials
      for (const materialId of materialIds) {
        await db.examAttempts.where('examId').equals(materialId).delete()
      }

      await db.assignments.where('courseId').equals(id).delete()
      await db.notes.where('courseId').equals(id).delete()
      await db.studyMaterials.where('courseId').equals(id).delete()
      await db.studySessions.where('courseId').equals(id).delete()
      // Don't delete tutoring conversations - they should have been moved to uncategorized
      await db.courses.delete(id)
    }
  )
}

export async function permanentlyDeleteNote(id: string): Promise<void> {
  await db.notes.delete(id)
}

export async function permanentlyDeleteAssignment(id: string): Promise<void> {
  await db.assignments.delete(id)
}

export async function permanentlyDeleteStudyMaterial(id: string): Promise<void> {
  await db.transaction('rw', [db.studyMaterials, db.examAttempts], async () => {
    await db.examAttempts.where('examId').equals(id).delete()
    await db.studyMaterials.delete(id)
  })
}

export async function permanentlyDeleteStudySession(id: string): Promise<void> {
  await db.studySessions.delete(id)
}

export async function permanentlyDeleteTutoringConversation(id: string): Promise<void> {
  await db.tutoringConversations.delete(id)
}

// ============ Semester Archive Functions ============

/**
 * Create a semester archive record
 */
export async function createSemesterArchive(
  semesterName: string,
  courseIds: string[],
  courseCodes: string[]
): Promise<string> {
  const id = generateId()
  await db.semesterArchives.add({
    id,
    semesterName,
    archivedAt: now(),
    courseIds,
    courseCodes,
  })
  return id
}

/**
 * Permanently delete all items from a semester archive
 */
export async function permanentlyDeleteSemesterArchive(archiveId: string): Promise<void> {
  const archive = await db.semesterArchives.get(archiveId)
  if (!archive) return

  await db.transaction(
    'rw',
    [db.courses, db.assignments, db.notes, db.studyMaterials, db.studySessions, db.examAttempts, db.semesterArchives],
    async () => {
      for (const courseId of archive.courseIds) {
        await permanentlyDeleteCourse(courseId)
      }

      // Mark the archive as permanently deleted
      await db.semesterArchives.update(archiveId, {
        permanentlyDeletedAt: now(),
      })
    }
  )
}

export function useSemesterArchives() {
  return useLiveQuery(() =>
    db.semesterArchives.orderBy('archivedAt').reverse().toArray()
  )
}

// ============ Archive Query Hooks ============

export interface ArchivedItem {
  type: 'course' | 'assignment' | 'note' | 'studyMaterial' | 'studySession' | 'tutoringConversation'
  id: string
  title: string
  archivedAt: Date
  archiveReason?: ArchiveReason
  courseId?: string
  courseName?: string
}

/**
 * Get all archived items across all types
 */
export function useArchivedItems() {
  return useLiveQuery(async () => {
    const items: ArchivedItem[] = []

    // Get all courses for name lookup
    const allCourses = await db.courses.toArray()
    const courseMap = new Map(allCourses.map((c) => [c.id, c.name]))

    // Archived courses
    const archivedCourses = await db.courses
      .filter((c) => c.archivedAt !== undefined)
      .toArray()
    for (const course of archivedCourses) {
      items.push({
        type: 'course',
        id: course.id,
        title: `${course.code}: ${course.name}`,
        archivedAt: course.archivedAt!,
        archiveReason: course.archiveReason,
      })
    }

    // Archived assignments
    const archivedAssignments = await db.assignments
      .filter((a) => a.archivedAt !== undefined)
      .toArray()
    for (const assignment of archivedAssignments) {
      items.push({
        type: 'assignment',
        id: assignment.id,
        title: assignment.title,
        archivedAt: assignment.archivedAt!,
        archiveReason: assignment.archiveReason,
        courseId: assignment.courseId,
        courseName: courseMap.get(assignment.courseId),
      })
    }

    // Archived notes
    const archivedNotes = await db.notes
      .filter((n) => n.archivedAt !== undefined)
      .toArray()
    for (const note of archivedNotes) {
      items.push({
        type: 'note',
        id: note.id,
        title: note.title,
        archivedAt: note.archivedAt!,
        archiveReason: note.archiveReason,
        courseId: note.courseId,
        courseName: note.courseId ? courseMap.get(note.courseId) : undefined,
      })
    }

    // Archived study materials
    const archivedMaterials = await db.studyMaterials
      .filter((m) => m.archivedAt !== undefined)
      .toArray()
    for (const material of archivedMaterials) {
      items.push({
        type: 'studyMaterial',
        id: material.id,
        title: material.title,
        archivedAt: material.archivedAt!,
        archiveReason: material.archiveReason,
        courseId: material.courseId,
        courseName: material.courseId ? courseMap.get(material.courseId) : undefined,
      })
    }

    // Archived study sessions
    const archivedSessions = await db.studySessions
      .filter((s) => s.archivedAt !== undefined)
      .toArray()
    for (const session of archivedSessions) {
      items.push({
        type: 'studySession',
        id: session.id,
        title: `${session.activityType} - ${new Date(session.plannedStart).toLocaleDateString()}`,
        archivedAt: session.archivedAt!,
        archiveReason: session.archiveReason,
        courseId: session.courseId,
        courseName: courseMap.get(session.courseId),
      })
    }

    // Archived tutoring conversations
    const archivedConversations = await db.tutoringConversations
      .filter((t) => t.archivedAt !== undefined)
      .toArray()
    for (const conversation of archivedConversations) {
      items.push({
        type: 'tutoringConversation',
        id: conversation.id,
        title: conversation.title,
        archivedAt: conversation.archivedAt!,
        archiveReason: conversation.archiveReason,
        courseId: conversation.courseId,
        courseName: conversation.courseId ? courseMap.get(conversation.courseId) : undefined,
      })
    }

    // Sort by archived date, newest first
    return items.sort((a, b) => b.archivedAt.getTime() - a.archivedAt.getTime())
  })
}

/**
 * Get uncategorized notes (courseId is undefined)
 */
export function useUncategorizedNotes() {
  return useLiveQuery(() =>
    db.notes
      .filter((n) => n.courseId === undefined && n.archivedAt === undefined)
      .sortBy('createdAt')
  )
}

/**
 * Get uncategorized study materials (courseId is undefined)
 */
export function useUncategorizedMaterials() {
  return useLiveQuery(() =>
    db.studyMaterials
      .filter((m) => m.courseId === undefined && m.archivedAt === undefined)
      .sortBy('createdAt')
  )
}

/**
 * Get uncategorized tutoring conversations (courseId is undefined)
 */
export function useUncategorizedConversations() {
  return useLiveQuery(() =>
    db.tutoringConversations
      .filter((t) => t.courseId === undefined && t.archivedAt === undefined)
      .sortBy('createdAt')
  )
}

/**
 * Reassign an item to a different course
 */
export async function reassignNoteToCourse(noteId: string, courseId: string | undefined): Promise<void> {
  await db.notes.update(noteId, { courseId, updatedAt: now() })
}

export async function reassignMaterialToCourse(materialId: string, courseId: string | undefined): Promise<void> {
  await db.studyMaterials.update(materialId, { courseId, updatedAt: now() })
}

export async function reassignConversationToCourse(conversationId: string, courseId: string | undefined): Promise<void> {
  await db.tutoringConversations.update(conversationId, { courseId, updatedAt: now() })
}

// ============ Study Pattern Learning Hooks ============

import {
  learnStudyPatterns,
  detectMissedSessions,
  generateRescheduleRecommendations,
  analyzeAndRebalance,
  applyAdjustments,
  type StudyPattern,
  type MissedSession,
  type RescheduleRecommendation,
  type RebalanceResult,
  type PlanAdjustment,
  type SuggestedSlot,
} from '@/lib/studyPatterns'

// Re-export types for convenience
export type {
  StudyPattern,
  MissedSession,
  RescheduleRecommendation,
  RebalanceResult,
  PlanAdjustment,
  SuggestedSlot,
}

/**
 * Hook to get learned study patterns based on historical sessions
 * Updates automatically when new sessions are completed
 */
export function useStudyPatterns(days: number = 90) {
  const completedSessions = useCompletedStudySessions(days)
  const courses = useCourses()

  return useLiveQuery(() => {
    if (!completedSessions || !courses) return null
    return learnStudyPatterns(completedSessions, courses)
  }, [completedSessions, courses])
}

/**
 * Hook to detect missed sessions in the current study plan
 * A session is considered missed if its planned time has passed
 */
export function useMissedSessions(gracePeriodMinutes: number = 30) {
  const plan = useStudyPlan()
  const assignments = useAssignments()

  return useLiveQuery(() => {
    if (!plan?.sessions || !assignments) return []
    return detectMissedSessions(plan.sessions, assignments, gracePeriodMinutes)
  }, [plan, assignments, gracePeriodMinutes])
}

/**
 * Hook to get rescheduling recommendations for missed sessions
 */
export function useRescheduleRecommendations() {
  const plan = useStudyPlan()
  const assignments = useAssignments()
  const courses = useCourses()
  const patterns = useStudyPatterns()
  const preferences = usePreferences()

  return useLiveQuery(() => {
    if (!plan?.sessions || !assignments || !courses || !patterns || !preferences) {
      return []
    }

    const missedSessions = detectMissedSessions(plan.sessions, assignments, 30)
    if (missedSessions.length === 0) return []

    return generateRescheduleRecommendations(
      missedSessions,
      plan.sessions,
      courses,
      patterns,
      preferences.productivityHours || []
    )
  }, [plan, assignments, courses, patterns, preferences])
}

/**
 * Hook to get plan rebalancing recommendations
 */
export function usePlanRebalance() {
  const plan = useStudyPlan()
  const assignments = useAssignments()
  const courses = useCourses()
  const completedSessions = useCompletedStudySessions(90)
  const patterns = useStudyPatterns()
  const preferences = usePreferences()

  return useLiveQuery((): RebalanceResult | null => {
    if (!assignments || !courses || !patterns || !preferences) {
      return null
    }

    return analyzeAndRebalance({
      plannedSessions: plan?.sessions || [],
      assignments,
      courses,
      completedSessions: completedSessions || [],
      patterns,
      productivityHours: preferences.productivityHours || [],
    })
  }, [plan, assignments, courses, completedSessions, patterns, preferences])
}

/**
 * Apply plan adjustments (remove stale, reschedule missed, etc.)
 */
export async function applyPlanAdjustments(
  adjustments: PlanAdjustment[],
  selectedSlots?: Map<string, SuggestedSlot>
): Promise<void> {
  const plan = await db.studyPlan.get('active_study_plan')
  if (!plan) return

  const updatedSessions = applyAdjustments(plan.sessions, adjustments, selectedSlots)

  await db.studyPlan.update('active_study_plan', {
    sessions: updatedSessions,
  })
}

/**
 * Reschedule a single missed session to a new time slot
 */
export async function rescheduleSession(
  sessionId: string,
  newStart: Date,
  newDuration?: number
): Promise<void> {
  const plan = await db.studyPlan.get('active_study_plan')
  if (!plan) return

  const updatedSessions = plan.sessions.map((s) => {
    if (s.id === sessionId) {
      return {
        ...s,
        plannedStart: newStart,
        plannedDuration: newDuration || s.plannedDuration,
      }
    }
    return s
  })

  // Re-sort by start time
  updatedSessions.sort((a, b) =>
    new Date(a.plannedStart).getTime() - new Date(b.plannedStart).getTime()
  )

  await db.studyPlan.update('active_study_plan', {
    sessions: updatedSessions,
  })
}

// ============ Tutor Behavioral Profile Hooks ============

import {
  buildBehavioralProfile,
  getProactiveHelpSuggestions,
  type TutorBehavioralProfile as TutorPatternProfile,
} from '@/lib/tutorPatterns'
import type { TutorBehavioralProfile } from '@/types'

/**
 * Hook to get the tutor behavioral profile
 */
export function useTutorBehavioralProfile() {
  return useLiveQuery(() =>
    db.tutorBehavioralProfile.get('tutor_behavioral_profile')
  )
}

/**
 * Analyze all tutoring conversations and update the behavioral profile
 * Should be called periodically or after new conversations
 */
export async function analyzeTutoringHistory(): Promise<TutorBehavioralProfile | null> {
  // Get all tutoring conversations
  const conversations = await db.tutoringConversations
    .filter(c => c.archivedAt === undefined && c.messages.length > 0)
    .toArray()

  if (conversations.length === 0) {
    return null
  }

  // Get courses and assignments for context
  const courses = await db.courses.filter(c => c.archivedAt === undefined).toArray()
  const assignments = await db.assignments.filter(a => a.archivedAt === undefined).toArray()

  // Get existing profile for incremental updates
  const existingProfile = await db.tutorBehavioralProfile.get('tutor_behavioral_profile')

  // Build the behavioral profile using the pattern learning utilities
  const patternProfile = buildBehavioralProfile(
    conversations,
    courses,
    assignments,
    existingProfile ? {
      learningStyle: existingProfile.learningStyle,
      comprehension: new Map(existingProfile.comprehension),
      struggles: new Map(existingProfile.struggles),
      proactive: {
        optimalHours: new Map(existingProfile.proactive.optimalHours),
        activeDays: new Map(existingProfile.proactive.activeDays),
        deadlinePatterns: existingProfile.proactive.deadlinePatterns,
        coursePatterns: new Map(),
      },
    } : undefined
  )

  // Convert Maps to arrays for storage (IndexedDB can't serialize Maps)
  const storableProfile: TutorBehavioralProfile = {
    id: 'tutor_behavioral_profile',
    comprehension: [...patternProfile.comprehension.entries()],
    learningStyle: patternProfile.learningStyle,
    struggles: [...patternProfile.struggles.entries()].map(([id, pattern]) => [id, {
      courseId: pattern.courseId,
      courseName: pattern.courseName,
      strugglingTopics: pattern.strugglingTopics,
      overallStruggleScore: pattern.overallStruggleScore,
      sessionCount: pattern.sessionCount,
      avgConfusionRate: pattern.avgConfusionRate,
      totalTutoringMinutes: pattern.totalTutoringMinutes,
      lastInteraction: pattern.lastInteraction,
    }]),
    proactive: {
      optimalHours: [...patternProfile.proactive.optimalHours.entries()],
      activeDays: [...patternProfile.proactive.activeDays.entries()],
      deadlinePatterns: patternProfile.proactive.deadlinePatterns,
    },
    lastAnalyzed: patternProfile.lastAnalyzed,
    totalConversationsAnalyzed: patternProfile.totalConversationsAnalyzed,
  }

  // Save to database
  await db.tutorBehavioralProfile.put(storableProfile)

  return storableProfile
}

/**
 * Convert stored profile back to pattern profile format (with Maps)
 */
export function toPatternProfile(stored: TutorBehavioralProfile): TutorPatternProfile {
  return {
    id: 'tutor_behavioral_profile',
    comprehension: new Map(stored.comprehension),
    learningStyle: stored.learningStyle,
    struggles: new Map(stored.struggles),
    proactive: {
      optimalHours: new Map(stored.proactive.optimalHours),
      activeDays: new Map(stored.proactive.activeDays),
      deadlinePatterns: stored.proactive.deadlinePatterns,
      coursePatterns: new Map(),
    },
    lastAnalyzed: stored.lastAnalyzed,
    totalConversationsAnalyzed: stored.totalConversationsAnalyzed,
  }
}

/**
 * Get proactive help suggestions based on current context
 */
export async function getProactiveTutorSuggestions(): Promise<{
  shouldOffer: boolean
  reason: string
  coursesToFocus: string[]
} | null> {
  const profile = await db.tutorBehavioralProfile.get('tutor_behavioral_profile')
  if (!profile) return null

  const assignments = await db.assignments
    .filter(a => a.archivedAt === undefined && a.status !== 'completed')
    .toArray()

  // Filter to upcoming assignments (within 14 days)
  const now = new Date()
  const upcomingAssignments = assignments.filter(a => {
    const dueDate = new Date(a.dueDate)
    const daysUntil = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return daysUntil >= 0 && daysUntil <= 14
  })

  return getProactiveHelpSuggestions(
    toPatternProfile(profile),
    now,
    upcomingAssignments
  )
}
