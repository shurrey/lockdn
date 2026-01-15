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
  isEqualWeight: boolean        // true if using equal weighting (no weights defined)

  breakdown: {
    graded: GradeBreakdownItem[]        // has grade, included in calculation
    pastDueZero: GradeBreakdownItem[]   // past due, no grade, counted as 0
    pending: GradeBreakdownItem[]       // future, no grade, excluded
    noWeight: GradeBreakdownItem[]      // no weight defined, excluded (only when mixed)
  }
}

/**
 * Calculate weighted grade for a set of assignments
 *
 * Rules:
 * - If NO assignments have weights: use equal weighting (simple average)
 * - If assignments have weights: use weighted calculation
 * - Graded assignments: use actual grade
 * - Past due + not graded: count as 0%
 * - Future/pending without grades: exclude from calculation
 * - Mixed weights: assignments without weight are excluded
 */
export function calculateWeightedGrade(assignments: Assignment[]): GradeCalculationResult {
  const breakdown: GradeCalculationResult['breakdown'] = {
    graded: [],
    pastDueZero: [],
    pending: [],
    noWeight: [],
  }

  // Filter out archived assignments
  const activeAssignments = assignments.filter(a => !a.archivedAt)

  if (activeAssignments.length === 0) {
    return {
      weightedGrade: null,
      totalWeight: 0,
      maxPossibleWeight: 0,
      isEqualWeight: false,
      breakdown,
    }
  }

  // Check if ANY assignments have weights defined
  const assignmentsWithWeight = activeAssignments.filter(a => a.weight !== undefined)
  const useEqualWeight = assignmentsWithWeight.length === 0

  // Calculate equal weight per assignment if needed
  const equalWeight = useEqualWeight ? 100 / activeAssignments.length : 0

  let maxPossibleWeight = 0

  // Categorize each assignment
  for (const assignment of activeAssignments) {
    // Determine effective weight for this assignment
    const effectiveWeight = useEqualWeight ? equalWeight : assignment.weight

    // Track total possible weight
    if (effectiveWeight !== undefined) {
      maxPossibleWeight += effectiveWeight
    }

    // No weight defined AND we're using weighted mode - exclude from calculation
    if (!useEqualWeight && assignment.weight === undefined) {
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
      const contribution = (effectiveWeight! * assignment.grade!) / 100
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
      isEqualWeight: useEqualWeight,
      breakdown,
    }
  }

  // For equal weight mode, recalculate contributions based on included items only
  if (useEqualWeight) {
    const allCountedItems = [...breakdown.graded, ...breakdown.pastDueZero, ...breakdown.pending]
    const weightPerItem = allCountedItems.length > 0 ? 100 / allCountedItems.length : 0

    // Recalculate contributions with correct weight
    for (const item of breakdown.graded) {
      item.contribution = (weightPerItem * item.effectiveGrade!) / 100
    }
    for (const item of breakdown.pastDueZero) {
      item.contribution = 0
    }
  }

  const totalWeight = useEqualWeight
    ? (includedItems.length / (breakdown.graded.length + breakdown.pastDueZero.length + breakdown.pending.length)) * 100
    : includedItems.reduce((sum, item) => sum + (item.assignment.weight || 0), 0)

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
    isEqualWeight: useEqualWeight,
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
