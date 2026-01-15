import Dexie, { type EntityTable } from 'dexie'
import type {
  Course,
  Assignment,
  Note,
  StudyMaterial,
  StudySession,
  StudyPlan,
  Preferences,
  EncryptedApiKey,
  TutoringConversation,
  DailySummary,
  Analytics,
  ExamAttempt,
  SemesterArchive,
  TutorBehavioralProfile,
} from '@/types'

// Database schema
class StudentToolsDatabase extends Dexie {
  courses!: EntityTable<Course, 'id'>
  assignments!: EntityTable<Assignment, 'id'>
  notes!: EntityTable<Note, 'id'>
  studyMaterials!: EntityTable<StudyMaterial, 'id'>
  studySessions!: EntityTable<StudySession, 'id'>
  studyPlan!: EntityTable<StudyPlan, 'id'>
  preferences!: EntityTable<Preferences, 'id'>
  encryptedApiKeys!: EntityTable<EncryptedApiKey, 'id'>
  tutoringConversations!: EntityTable<TutoringConversation, 'id'>
  dailySummaries!: EntityTable<DailySummary, 'id'>
  analytics!: EntityTable<Analytics, 'id'>
  examAttempts!: EntityTable<ExamAttempt, 'id'>
  semesterArchives!: EntityTable<SemesterArchive, 'id'>
  tutorBehavioralProfile!: EntityTable<TutorBehavioralProfile, 'id'>

  constructor() {
    super('StudentToolsDB')

    this.version(1).stores({
      courses: 'id, name, code, createdAt, updatedAt',
      assignments: 'id, courseId, title, type, dueDate, status, createdAt, updatedAt',
      notes: 'id, courseId, title, createdAt, updatedAt, *topics',
      studyMaterials: 'id, courseId, type, title, createdAt, updatedAt',
      studySessions: 'id, courseId, plannedStart, actualStart, completed, createdAt',
      preferences: 'id',
      encryptedApiKeys: 'id, provider, createdAt',
      tutoringConversations: 'id, courseId, createdAt, updatedAt',
      dailySummaries: 'id, date',
      analytics: 'id',
    })

    this.version(2).stores({
      courses: 'id, name, code, createdAt, updatedAt',
      assignments: 'id, courseId, title, type, dueDate, status, createdAt, updatedAt',
      notes: 'id, courseId, title, createdAt, updatedAt, *topics',
      studyMaterials: 'id, courseId, type, title, createdAt, updatedAt',
      studySessions: 'id, courseId, plannedStart, actualStart, completed, createdAt',
      preferences: 'id',
      encryptedApiKeys: 'id, provider, createdAt',
      tutoringConversations: 'id, courseId, createdAt, updatedAt',
      dailySummaries: 'id, date',
      analytics: 'id',
      examAttempts: 'id, examId, attemptNumber, completedAt',
    })

    this.version(3).stores({
      courses: 'id, name, code, createdAt, updatedAt',
      assignments: 'id, courseId, title, type, dueDate, status, createdAt, updatedAt',
      notes: 'id, courseId, title, createdAt, updatedAt, *topics',
      studyMaterials: 'id, courseId, type, title, createdAt, updatedAt',
      studySessions: 'id, courseId, plannedStart, actualStart, completed, createdAt',
      studyPlan: 'id, generatedAt',
      preferences: 'id',
      encryptedApiKeys: 'id, provider, createdAt',
      tutoringConversations: 'id, courseId, createdAt, updatedAt',
      dailySummaries: 'id, date',
      analytics: 'id',
      examAttempts: 'id, examId, attemptNumber, completedAt',
    })

    // Version 4: Add archive support
    // - Add archivedAt index to all entity tables for filtering
    // - Add semesterArchives table for tracking cleanup history
    this.version(4).stores({
      courses: 'id, name, code, archivedAt, createdAt, updatedAt',
      assignments: 'id, courseId, archivedAt, title, type, dueDate, status, createdAt, updatedAt',
      notes: 'id, courseId, archivedAt, title, createdAt, updatedAt, *topics',
      studyMaterials: 'id, courseId, archivedAt, type, title, createdAt, updatedAt',
      studySessions: 'id, courseId, archivedAt, plannedStart, actualStart, completed, createdAt',
      studyPlan: 'id, generatedAt',
      preferences: 'id',
      encryptedApiKeys: 'id, provider, createdAt',
      tutoringConversations: 'id, courseId, archivedAt, createdAt, updatedAt',
      dailySummaries: 'id, date',
      analytics: 'id',
      examAttempts: 'id, examId, archivedAt, attemptNumber, completedAt',
      semesterArchives: 'id, semesterName, archivedAt, permanentlyDeletedAt',
    })

    // Version 5: Add tutor behavioral profile for personalized learning
    this.version(5).stores({
      courses: 'id, name, code, archivedAt, createdAt, updatedAt',
      assignments: 'id, courseId, archivedAt, title, type, dueDate, status, createdAt, updatedAt',
      notes: 'id, courseId, archivedAt, title, createdAt, updatedAt, *topics',
      studyMaterials: 'id, courseId, archivedAt, type, title, createdAt, updatedAt',
      studySessions: 'id, courseId, archivedAt, plannedStart, actualStart, completed, createdAt',
      studyPlan: 'id, generatedAt',
      preferences: 'id',
      encryptedApiKeys: 'id, provider, createdAt',
      tutoringConversations: 'id, courseId, archivedAt, createdAt, updatedAt',
      dailySummaries: 'id, date',
      analytics: 'id',
      examAttempts: 'id, examId, archivedAt, attemptNumber, completedAt',
      semesterArchives: 'id, semesterName, archivedAt, permanentlyDeletedAt',
      tutorBehavioralProfile: 'id',
    })

    // Version 6: Add assignment completion tracking and grade fields
    this.version(6).stores({
      courses: 'id, name, code, archivedAt, createdAt, updatedAt',
      assignments: 'id, courseId, archivedAt, title, type, dueDate, status, completedAt, grade, createdAt, updatedAt',
      notes: 'id, courseId, archivedAt, title, createdAt, updatedAt, *topics',
      studyMaterials: 'id, courseId, archivedAt, type, title, createdAt, updatedAt',
      studySessions: 'id, courseId, archivedAt, plannedStart, actualStart, completed, createdAt',
      studyPlan: 'id, generatedAt',
      preferences: 'id',
      encryptedApiKeys: 'id, provider, createdAt',
      tutoringConversations: 'id, courseId, archivedAt, createdAt, updatedAt',
      dailySummaries: 'id, date',
      analytics: 'id',
      examAttempts: 'id, examId, archivedAt, attemptNumber, completedAt',
      semesterArchives: 'id, semesterName, archivedAt, permanentlyDeletedAt',
      tutorBehavioralProfile: 'id',
    })
  }
}

// Create and export the database instance
export const db = new StudentToolsDatabase()

// Helper function to generate unique IDs
export function generateId(): string {
  return crypto.randomUUID()
}

// Helper function to get current timestamp
export function now(): Date {
  return new Date()
}

// Initialize default preferences if they don't exist
export async function initializeDefaults(): Promise<void> {
  const existingPrefs = await db.preferences.get('user_preferences')
  if (!existingPrefs) {
    await db.preferences.put({
      id: 'user_preferences',
      onboardingCompleted: false,
      productivityHours: [],
      breakPreferences: {
        shortBreakDuration: 5,
        longBreakDuration: 15,
        sessionsBeforeLongBreak: 4,
      },
      aiProvider: 'anthropic',
      personaSettings: {
        name: 'Study Buddy',
        tone: 'balanced',
        proactiveCheckIns: true,
      },
      theme: 'system',
      updatedAt: now(),
    })
  } else if (existingPrefs.onboardingCompleted === undefined) {
    // Migration: Existing users have implicitly completed onboarding
    await db.preferences.update('user_preferences', {
      onboardingCompleted: true,
      updatedAt: now(),
    })
  }

  const existingAnalytics = await db.analytics.get('user_analytics')
  if (!existingAnalytics) {
    await db.analytics.put({
      id: 'user_analytics',
      currentStreak: 0,
      longestStreak: 0,
      totalStudyMinutes: 0,
      totalSessionsCompleted: 0,
      totalTasksCompleted: 0,
      milestones: [],
      courseStreaks: {},
      streakRecords: [],
      coursePerformance: {},
      updatedAt: now(),
    })
  } else {
    // Migration: add new fields if missing
    const updates: Record<string, unknown> = {}
    if (!existingAnalytics.courseStreaks) updates.courseStreaks = {}
    if (!existingAnalytics.streakRecords) updates.streakRecords = []
    if (!existingAnalytics.coursePerformance) updates.coursePerformance = {}
    if (Object.keys(updates).length > 0) {
      await db.analytics.update('user_analytics', { ...updates, updatedAt: now() })
    }
  }
}
