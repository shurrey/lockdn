/**
 * Diff utilities for comparing uploaded data against existing data
 * Used when re-uploading schedules or syllabi to show what changed
 */

import type { Course, Assignment, ClassMeeting, DayOfWeek } from '@/types'
import type { ParsedScheduleEntry, ParsedAssignment } from './syllabusParser'

// ============================================================================
// Types
// ============================================================================

export type DiffStatus = 'added' | 'modified' | 'removed' | 'unchanged'

export interface ScheduleDiffItem {
  status: DiffStatus
  newCourse?: ParsedScheduleEntry
  existingCourse?: Course
  changes?: ScheduleChangeDetail[]
}

export interface ScheduleChangeDetail {
  field: string
  oldValue: string
  newValue: string
}

export interface AssignmentDiffItem {
  status: DiffStatus
  newAssignment?: ParsedAssignment
  existingAssignment?: Assignment
  changes?: AssignmentChangeDetail[]
  matchConfidence?: number // 0-1, how confident we are this is the same assignment
}

export interface AssignmentChangeDetail {
  field: string
  oldValue: string
  newValue: string
}

export interface ScheduleDiffSummary {
  added: number
  modified: number
  removed: number
  unchanged: number
  items: ScheduleDiffItem[]
}

export interface AssignmentDiffSummary {
  added: number
  modified: number
  removed: number
  unchanged: number
  items: AssignmentDiffItem[]
}

// ============================================================================
// Schedule Diff
// ============================================================================

/**
 * Compare new parsed schedule entries against existing courses
 */
export function computeScheduleDiff(
  newEntries: ParsedScheduleEntry[],
  existingCourses: Course[]
): ScheduleDiffSummary {
  const items: ScheduleDiffItem[] = []
  const matchedExistingIds = new Set<string>()

  // Normalize code for matching
  const normalizeCode = (code: string) => code.toLowerCase().replace(/\s+/g, '').trim()

  // Build lookup for existing courses
  const existingByCode = new Map<string, Course>()
  for (const course of existingCourses) {
    existingByCode.set(normalizeCode(course.code), course)
  }

  // Process new entries
  for (const newEntry of newEntries) {
    const normalizedCode = normalizeCode(newEntry.code)
    const existing = existingByCode.get(normalizedCode)

    if (existing) {
      matchedExistingIds.add(existing.id)
      const changes = computeCourseChanges(newEntry, existing)

      if (changes.length > 0) {
        items.push({
          status: 'modified',
          newCourse: newEntry,
          existingCourse: existing,
          changes,
        })
      } else {
        items.push({
          status: 'unchanged',
          newCourse: newEntry,
          existingCourse: existing,
        })
      }
    } else {
      items.push({
        status: 'added',
        newCourse: newEntry,
      })
    }
  }

  // Find removed courses (existing courses not in new upload)
  for (const existing of existingCourses) {
    if (!matchedExistingIds.has(existing.id)) {
      items.push({
        status: 'removed',
        existingCourse: existing,
      })
    }
  }

  // Sort: added first, then modified, then unchanged, then removed
  const statusOrder: Record<DiffStatus, number> = {
    added: 0,
    modified: 1,
    unchanged: 2,
    removed: 3,
  }
  items.sort((a, b) => statusOrder[a.status] - statusOrder[b.status])

  return {
    added: items.filter(i => i.status === 'added').length,
    modified: items.filter(i => i.status === 'modified').length,
    removed: items.filter(i => i.status === 'removed').length,
    unchanged: items.filter(i => i.status === 'unchanged').length,
    items,
  }
}

function computeCourseChanges(
  newEntry: ParsedScheduleEntry,
  existing: Course
): ScheduleChangeDetail[] {
  const changes: ScheduleChangeDetail[] = []

  // Name change
  if (newEntry.name !== existing.name) {
    changes.push({
      field: 'Name',
      oldValue: existing.name,
      newValue: newEntry.name,
    })
  }

  // Instructor change
  if ((newEntry.instructor || '') !== (existing.instructor || '')) {
    changes.push({
      field: 'Instructor',
      oldValue: existing.instructor || '(none)',
      newValue: newEntry.instructor || '(none)',
    })
  }

  // Schedule change
  const newScheduleStr = formatScheduleEntry(newEntry)
  const existingScheduleStr = formatExistingSchedule(existing.schedule)
  if (newScheduleStr !== existingScheduleStr) {
    changes.push({
      field: 'Schedule',
      oldValue: existingScheduleStr || '(none)',
      newValue: newScheduleStr || '(none)',
    })
  }

  return changes
}

function formatScheduleEntry(entry: ParsedScheduleEntry): string {
  if (entry.schedules && entry.schedules.length > 0) {
    return entry.schedules.map(s =>
      `${formatDays(s.days)} ${s.startTime}-${s.endTime}${s.location ? ` @ ${s.location}` : ''}`
    ).join('; ')
  }
  return `${formatDays(entry.days)} ${entry.startTime}-${entry.endTime}${entry.location ? ` @ ${entry.location}` : ''}`
}

function formatExistingSchedule(schedule?: ClassMeeting[]): string {
  if (!schedule || schedule.length === 0) return ''
  return schedule.map(s =>
    `${formatDays(s.days)} ${s.startTime}-${s.endTime}${s.location ? ` @ ${s.location}` : ''}`
  ).join('; ')
}

function formatDays(days: DayOfWeek[]): string {
  const dayMap: Record<DayOfWeek, string> = {
    monday: 'M',
    tuesday: 'T',
    wednesday: 'W',
    thursday: 'Th',
    friday: 'F',
    saturday: 'Sa',
    sunday: 'Su',
  }
  return days.map(d => dayMap[d]).join('')
}

// ============================================================================
// Assignment/Syllabus Diff
// ============================================================================

/**
 * Compare new parsed assignments against existing assignments for a course
 */
export function computeAssignmentDiff(
  newAssignments: ParsedAssignment[],
  existingAssignments: Assignment[]
): AssignmentDiffSummary {
  const items: AssignmentDiffItem[] = []
  const matchedExistingIds = new Set<string>()

  // For each new assignment, try to find a matching existing one
  for (const newAssignment of newAssignments) {
    const match = findBestAssignmentMatch(newAssignment, existingAssignments, matchedExistingIds)

    if (match) {
      matchedExistingIds.add(match.assignment.id)
      const changes = computeAssignmentChanges(newAssignment, match.assignment)

      if (changes.length > 0) {
        items.push({
          status: 'modified',
          newAssignment,
          existingAssignment: match.assignment,
          changes,
          matchConfidence: match.confidence,
        })
      } else {
        items.push({
          status: 'unchanged',
          newAssignment,
          existingAssignment: match.assignment,
          matchConfidence: match.confidence,
        })
      }
    } else {
      items.push({
        status: 'added',
        newAssignment,
      })
    }
  }

  // Find removed assignments (existing assignments not in new upload)
  for (const existing of existingAssignments) {
    if (!matchedExistingIds.has(existing.id)) {
      items.push({
        status: 'removed',
        existingAssignment: existing,
      })
    }
  }

  // Sort: added first, then modified, then unchanged, then removed
  const statusOrder: Record<DiffStatus, number> = {
    added: 0,
    modified: 1,
    unchanged: 2,
    removed: 3,
  }
  items.sort((a, b) => statusOrder[a.status] - statusOrder[b.status])

  return {
    added: items.filter(i => i.status === 'added').length,
    modified: items.filter(i => i.status === 'modified').length,
    removed: items.filter(i => i.status === 'removed').length,
    unchanged: items.filter(i => i.status === 'unchanged').length,
    items,
  }
}

interface AssignmentMatch {
  assignment: Assignment
  confidence: number
}

function findBestAssignmentMatch(
  newAssignment: ParsedAssignment,
  existingAssignments: Assignment[],
  alreadyMatched: Set<string>
): AssignmentMatch | null {
  let bestMatch: AssignmentMatch | null = null

  for (const existing of existingAssignments) {
    if (alreadyMatched.has(existing.id)) continue

    const confidence = computeAssignmentSimilarity(newAssignment, existing)

    // Require at least 0.5 confidence to consider a match
    if (confidence >= 0.5 && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = { assignment: existing, confidence }
    }
  }

  return bestMatch
}

function computeAssignmentSimilarity(
  newAssignment: ParsedAssignment,
  existing: Assignment
): number {
  let score = 0
  let weights = 0

  // Title similarity (high weight)
  const titleSimilarity = computeStringSimilarity(
    newAssignment.title.toLowerCase(),
    existing.title.toLowerCase()
  )
  score += titleSimilarity * 0.5
  weights += 0.5

  // Type match (medium weight)
  if (newAssignment.type === existing.type) {
    score += 0.25
  }
  weights += 0.25

  // Date proximity (medium weight)
  const newDate = new Date(newAssignment.dueDate)
  const existingDate = new Date(existing.dueDate)
  const daysDiff = Math.abs((newDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24))

  if (daysDiff === 0) {
    score += 0.25
  } else if (daysDiff <= 7) {
    score += 0.25 * (1 - daysDiff / 7)
  }
  weights += 0.25

  return score / weights
}

function computeStringSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length === 0 || b.length === 0) return 0

  // Simple word overlap similarity
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2))
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2))

  if (wordsA.size === 0 || wordsB.size === 0) {
    // Fallback to substring check
    if (a.includes(b) || b.includes(a)) return 0.8
    return 0
  }

  let overlap = 0
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++
  }

  return overlap / Math.max(wordsA.size, wordsB.size)
}

function computeAssignmentChanges(
  newAssignment: ParsedAssignment,
  existing: Assignment
): AssignmentChangeDetail[] {
  const changes: AssignmentChangeDetail[] = []

  // Title change
  if (newAssignment.title !== existing.title) {
    changes.push({
      field: 'Title',
      oldValue: existing.title,
      newValue: newAssignment.title,
    })
  }

  // Type change
  if (newAssignment.type !== existing.type) {
    changes.push({
      field: 'Type',
      oldValue: existing.type,
      newValue: newAssignment.type,
    })
  }

  // Due date change
  const newDateStr = newAssignment.dueDate
  const existingDateStr = new Date(existing.dueDate).toISOString().split('T')[0]
  if (newDateStr !== existingDateStr) {
    changes.push({
      field: 'Due Date',
      oldValue: new Date(existing.dueDate).toLocaleDateString(),
      newValue: new Date(newAssignment.dueDate).toLocaleDateString(),
    })
  }

  // Weight change
  const newWeight = newAssignment.weight
  const existingWeight = existing.weight
  if (newWeight !== existingWeight) {
    changes.push({
      field: 'Weight',
      oldValue: existingWeight ? `${existingWeight}%` : '(none)',
      newValue: newWeight ? `${newWeight}%` : '(none)',
    })
  }

  return changes
}

// ============================================================================
// Formatting helpers
// ============================================================================

export function getDiffStatusColor(status: DiffStatus): string {
  switch (status) {
    case 'added':
      return 'text-green-600 dark:text-green-400'
    case 'modified':
      return 'text-blue-600 dark:text-blue-400'
    case 'removed':
      return 'text-red-600 dark:text-red-400'
    case 'unchanged':
      return 'text-muted-foreground'
  }
}

export function getDiffStatusBgColor(status: DiffStatus): string {
  switch (status) {
    case 'added':
      return 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900'
    case 'modified':
      return 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900'
    case 'removed':
      return 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900'
    case 'unchanged':
      return 'bg-muted/30 border-border'
  }
}

export function getDiffStatusLabel(status: DiffStatus): string {
  switch (status) {
    case 'added':
      return 'New'
    case 'modified':
      return 'Changed'
    case 'removed':
      return 'Removed'
    case 'unchanged':
      return 'Unchanged'
  }
}
