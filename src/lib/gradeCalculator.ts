import type { Assignment } from '@/types'
import { isPast } from 'date-fns'

export interface GradeBreakdownItem {
  assignment: Assignment
  effectiveGrade: number | null  // actual grade, 0 for past due, null if excluded
  contribution: number | null    // points contributed to weighted grade
}

export interface GradeCalculationResult {
  weightedGrade: number | null  // null if no gradeable assignments
  totalWeight: number           // sum of weights for included assignments
  maxPossibleWeight: number     // sum of all assignment weights

  breakdown: {
    graded: GradeBreakdownItem[]        // has grade, included in calculation
    pastDueZero: GradeBreakdownItem[]   // past due, no grade, counted as 0
    pending: GradeBreakdownItem[]       // future, no grade, excluded
    noWeight: GradeBreakdownItem[]      // no weight defined, excluded
  }
}

/**
 * Calculate weighted grade for a set of assignments
 *
 * Rules:
 * - Graded assignments: use actual grade
 * - Past due + not graded: count as 0%
 * - Future/pending without grades: exclude from calculation
 * - Assignments without weight defined: exclude, track separately
 */
export function calculateWeightedGrade(assignments: Assignment[]): GradeCalculationResult {
  const now = new Date()

  const breakdown: GradeCalculationResult['breakdown'] = {
    graded: [],
    pastDueZero: [],
    pending: [],
    noWeight: [],
  }

  let maxPossibleWeight = 0

  // Categorize each assignment
  for (const assignment of assignments) {
    // Skip archived assignments
    if (assignment.archivedAt) continue

    // Track total possible weight
    if (assignment.weight !== undefined) {
      maxPossibleWeight += assignment.weight
    }

    // No weight defined - exclude from calculation
    if (assignment.weight === undefined) {
      breakdown.noWeight.push({
        assignment,
        effectiveGrade: null,
        contribution: null,
      })
      continue
    }

    const hasGrade = assignment.grade !== undefined
    const dueDate = new Date(assignment.dueDate)
    const isOverdue = isPast(dueDate)

    if (hasGrade) {
      // Has a grade - include with actual grade
      const contribution = (assignment.weight * assignment.grade!) / 100
      breakdown.graded.push({
        assignment,
        effectiveGrade: assignment.grade!,
        contribution,
      })
    } else if (isOverdue) {
      // Past due without grade - count as 0
      breakdown.pastDueZero.push({
        assignment,
        effectiveGrade: 0,
        contribution: 0,
      })
    } else {
      // Future/pending - exclude from calculation
      breakdown.pending.push({
        assignment,
        effectiveGrade: null,
        contribution: null,
      })
    }
  }

  // Calculate weighted grade from graded + pastDueZero items
  const includedItems = [...breakdown.graded, ...breakdown.pastDueZero]

  if (includedItems.length === 0) {
    return {
      weightedGrade: null,
      totalWeight: 0,
      maxPossibleWeight,
      breakdown,
    }
  }

  const totalWeight = includedItems.reduce(
    (sum, item) => sum + (item.assignment.weight || 0),
    0
  )

  const totalContribution = includedItems.reduce(
    (sum, item) => sum + (item.contribution || 0),
    0
  )

  // Weighted grade = total contribution / total weight * 100
  const weightedGrade = totalWeight > 0
    ? (totalContribution / totalWeight) * 100
    : null

  return {
    weightedGrade,
    totalWeight,
    maxPossibleWeight,
    breakdown,
  }
}

/**
 * Get letter grade from percentage
 */
export function getLetterGrade(grade: number): string {
  if (grade >= 97) return 'A+'
  if (grade >= 93) return 'A'
  if (grade >= 90) return 'A-'
  if (grade >= 87) return 'B+'
  if (grade >= 83) return 'B'
  if (grade >= 80) return 'B-'
  if (grade >= 77) return 'C+'
  if (grade >= 73) return 'C'
  if (grade >= 70) return 'C-'
  if (grade >= 67) return 'D+'
  if (grade >= 63) return 'D'
  if (grade >= 60) return 'D-'
  return 'F'
}

/**
 * Get color class for grade display
 */
export function getGradeColor(grade: number): string {
  if (grade >= 90) return 'text-green-500'
  if (grade >= 80) return 'text-blue-500'
  if (grade >= 70) return 'text-yellow-500'
  if (grade >= 60) return 'text-orange-500'
  return 'text-red-500'
}

/**
 * Get background color class for grade segments
 */
export function getGradeBgColor(grade: number): string {
  if (grade >= 90) return 'bg-green-500'
  if (grade >= 80) return 'bg-blue-500'
  if (grade >= 70) return 'bg-yellow-500'
  if (grade >= 60) return 'bg-orange-500'
  return 'bg-red-500'
}
