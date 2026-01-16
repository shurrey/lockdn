import { db } from '@/db'

export interface ExportData {
  version: number
  exportedAt: string
  courses: unknown[]
  assignments: unknown[]
  notes: unknown[]
  studyMaterials: unknown[]
  studySessions: unknown[]
  studyPlan: unknown[]
  preferences: unknown[]
  tutoringConversations: unknown[]
  dailySummaries: unknown[]
  analytics: unknown[]
  examAttempts: unknown[]
  semesterArchives: unknown[]
  tutorBehavioralProfile: unknown[]
}

// Date fields that need to be converted from strings back to Date objects
const dateFields = [
  'createdAt', 'updatedAt', 'archivedAt', 'dueDate', 'extractedAt',
  'plannedStart', 'actualStart', 'generatedAt', 'validUntil',
  'timestamp', 'completedAt', 'achievedAt', 'lastAssessed',
  'lastUpdated', 'lastMentioned', 'lastInteraction', 'lastAnalyzed',
  'processedAt', 'permanentlyDeletedAt', 'semesterStart', 'semesterEnd'
]

// Recursively convert date strings to Date objects
function reviveDates<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) {
    return obj.map(item => reviveDates(item)) as T
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (dateFields.includes(key) && typeof value === 'string') {
        // Convert ISO date string to Date object
        result[key] = new Date(value)
      } else if (typeof value === 'object') {
        result[key] = reviveDates(value)
      } else {
        result[key] = value
      }
    }
    return result as T
  }
  return obj
}

/**
 * Validate and parse a backup file
 */
export function parseBackupFile(text: string): ExportData {
  const rawData = JSON.parse(text) as ExportData

  // Validate structure
  if (!rawData.version || !rawData.exportedAt) {
    throw new Error('Invalid backup file format')
  }

  // Convert date strings back to Date objects
  return reviveDates(rawData)
}

export type ImportMode = 'replace' | 'merge'

/**
 * Import data from a parsed backup into the database
 * @param data - The parsed backup data
 * @param mode - 'replace' clears all existing data first, 'merge' adds/updates without clearing
 * Returns info about what was imported
 */
export async function importBackupData(
  data: ExportData,
  mode: ImportMode = 'replace'
): Promise<{
  coursesCount: number
  assignmentsCount: number
  notesCount: number
}> {
  await db.transaction('rw', [
    db.courses,
    db.assignments,
    db.notes,
    db.studyMaterials,
    db.studySessions,
    db.studyPlan,
    db.preferences,
    db.tutoringConversations,
    db.dailySummaries,
    db.analytics,
    db.examAttempts,
    db.semesterArchives,
    db.tutorBehavioralProfile,
  ], async () => {
    if (mode === 'replace') {
      // Clear existing data first
      await Promise.all([
        db.courses.clear(),
        db.assignments.clear(),
        db.notes.clear(),
        db.studyMaterials.clear(),
        db.studySessions.clear(),
        db.studyPlan.clear(),
        db.preferences.clear(),
        db.tutoringConversations.clear(),
        db.dailySummaries.clear(),
        db.analytics.clear(),
        db.examAttempts.clear(),
        db.semesterArchives.clear(),
        db.tutorBehavioralProfile.clear(),
      ])

      // Import new data
      if (data.courses?.length) await db.courses.bulkAdd(data.courses as never[])
      if (data.assignments?.length) await db.assignments.bulkAdd(data.assignments as never[])
      if (data.notes?.length) await db.notes.bulkAdd(data.notes as never[])
      if (data.studyMaterials?.length) await db.studyMaterials.bulkAdd(data.studyMaterials as never[])
      if (data.studySessions?.length) await db.studySessions.bulkAdd(data.studySessions as never[])
      if (data.studyPlan?.length) await db.studyPlan.bulkAdd(data.studyPlan as never[])
      if (data.preferences?.length) await db.preferences.bulkAdd(data.preferences as never[])
      if (data.tutoringConversations?.length) await db.tutoringConversations.bulkAdd(data.tutoringConversations as never[])
      if (data.dailySummaries?.length) await db.dailySummaries.bulkAdd(data.dailySummaries as never[])
      if (data.analytics?.length) await db.analytics.bulkAdd(data.analytics as never[])
      if (data.examAttempts?.length) await db.examAttempts.bulkAdd(data.examAttempts as never[])
      if (data.semesterArchives?.length) await db.semesterArchives.bulkAdd(data.semesterArchives as never[])
      if (data.tutorBehavioralProfile?.length) await db.tutorBehavioralProfile.bulkAdd(data.tutorBehavioralProfile as never[])
    } else {
      // Merge mode: use bulkPut to upsert (update existing or insert new)
      if (data.courses?.length) await db.courses.bulkPut(data.courses as never[])
      if (data.assignments?.length) await db.assignments.bulkPut(data.assignments as never[])
      if (data.notes?.length) await db.notes.bulkPut(data.notes as never[])
      if (data.studyMaterials?.length) await db.studyMaterials.bulkPut(data.studyMaterials as never[])
      if (data.studySessions?.length) await db.studySessions.bulkPut(data.studySessions as never[])
      if (data.studyPlan?.length) await db.studyPlan.bulkPut(data.studyPlan as never[])
      if (data.preferences?.length) await db.preferences.bulkPut(data.preferences as never[])
      if (data.tutoringConversations?.length) await db.tutoringConversations.bulkPut(data.tutoringConversations as never[])
      if (data.dailySummaries?.length) await db.dailySummaries.bulkPut(data.dailySummaries as never[])
      if (data.analytics?.length) await db.analytics.bulkPut(data.analytics as never[])
      if (data.examAttempts?.length) await db.examAttempts.bulkPut(data.examAttempts as never[])
      if (data.semesterArchives?.length) await db.semesterArchives.bulkPut(data.semesterArchives as never[])
      if (data.tutorBehavioralProfile?.length) await db.tutorBehavioralProfile.bulkPut(data.tutorBehavioralProfile as never[])
    }
  })

  return {
    coursesCount: data.courses?.length || 0,
    assignmentsCount: data.assignments?.length || 0,
    notesCount: data.notes?.length || 0,
  }
}

/**
 * Handle a file import - reads file, parses, and imports
 * @param file - The backup file to import
 * @param mode - 'replace' clears all existing data first, 'merge' adds/updates without clearing
 */
export async function importFromFile(
  file: File,
  mode: ImportMode = 'replace'
): Promise<{
  coursesCount: number
  assignmentsCount: number
  notesCount: number
}> {
  const text = await file.text()
  const data = parseBackupFile(text)
  return importBackupData(data, mode)
}
