import { describe, it, expect } from 'vitest'
import {
  computeScheduleDiff,
  computeAssignmentDiff,
  getDiffStatusColor,
  getDiffStatusBgColor,
  getDiffStatusLabel,
} from './diffUtils'
import type { Course, Assignment } from '@/types'
import type { ParsedScheduleEntry, ParsedAssignment } from './syllabusParser'

describe('diffUtils', () => {
  describe('computeScheduleDiff', () => {
    const createParsedEntry = (overrides: Partial<ParsedScheduleEntry> = {}): ParsedScheduleEntry => ({
      code: 'CS101',
      name: 'Intro to Computer Science',
      days: ['monday', 'wednesday', 'friday'],
      startTime: '09:00',
      endTime: '10:00',
      confidence: 1,
      ...overrides,
    })

    const createCourse = (overrides: Partial<Course> = {}): Course => ({
      id: 'course-1',
      code: 'CS101',
      name: 'Intro to Computer Science',
      color: '#3b82f6',
      schedule: [
        {
          days: ['monday', 'wednesday', 'friday'],
          startTime: '09:00',
          endTime: '10:00',
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    })

    it('should identify added courses', () => {
      const newEntries = [createParsedEntry()]
      const existingCourses: Course[] = []

      const result = computeScheduleDiff(newEntries, existingCourses)

      expect(result.added).toBe(1)
      expect(result.modified).toBe(0)
      expect(result.removed).toBe(0)
      expect(result.items[0].status).toBe('added')
    })

    it('should identify unchanged courses', () => {
      const newEntries = [createParsedEntry()]
      const existingCourses = [createCourse()]

      const result = computeScheduleDiff(newEntries, existingCourses)

      expect(result.unchanged).toBe(1)
      expect(result.added).toBe(0)
      expect(result.modified).toBe(0)
      expect(result.removed).toBe(0)
    })

    it('should identify removed courses', () => {
      const newEntries: ParsedScheduleEntry[] = []
      const existingCourses = [createCourse()]

      const result = computeScheduleDiff(newEntries, existingCourses)

      expect(result.removed).toBe(1)
      expect(result.items[0].status).toBe('removed')
    })

    it('should identify modified courses by name', () => {
      const newEntries = [createParsedEntry({ name: 'Computer Science 101' })]
      const existingCourses = [createCourse({ name: 'Intro to Computer Science' })]

      const result = computeScheduleDiff(newEntries, existingCourses)

      expect(result.modified).toBe(1)
      expect(result.items[0].status).toBe('modified')
      expect(result.items[0].changes).toBeDefined()
      expect(result.items[0].changes![0].field).toBe('Name')
    })

    it('should identify modified courses by instructor', () => {
      const newEntries = [createParsedEntry({ instructor: 'Dr. Smith' })]
      const existingCourses = [createCourse({ instructor: 'Dr. Jones' })]

      const result = computeScheduleDiff(newEntries, existingCourses)

      expect(result.modified).toBe(1)
      const instructorChange = result.items[0].changes?.find(c => c.field === 'Instructor')
      expect(instructorChange).toBeDefined()
      expect(instructorChange!.oldValue).toBe('Dr. Jones')
      expect(instructorChange!.newValue).toBe('Dr. Smith')
    })

    it('should match courses case-insensitively', () => {
      const newEntries = [createParsedEntry({ code: 'cs101' })]
      const existingCourses = [createCourse({ code: 'CS101' })]

      const result = computeScheduleDiff(newEntries, existingCourses)

      expect(result.unchanged).toBe(1)
      expect(result.added).toBe(0)
    })

    it('should sort results by status', () => {
      const newEntries = [
        createParsedEntry({ code: 'CS101' }),
        createParsedEntry({ code: 'CS201', name: 'New Course' }),
      ]
      const existingCourses = [
        createCourse({ id: '1', code: 'CS101' }),
        createCourse({ id: '2', code: 'CS301', name: 'Removed Course' }),
      ]

      const result = computeScheduleDiff(newEntries, existingCourses)

      // Should be: added first, then unchanged, then removed
      expect(result.items[0].status).toBe('added')
      expect(result.items[1].status).toBe('unchanged')
      expect(result.items[2].status).toBe('removed')
    })
  })

  describe('computeAssignmentDiff', () => {
    const createParsedAssignment = (overrides: Partial<ParsedAssignment> = {}): ParsedAssignment => ({
      title: 'Homework 1',
      type: 'homework',
      dueDate: '2024-03-20',
      confidence: 1,
      ...overrides,
    })

    const createAssignment = (overrides: Partial<Assignment> = {}): Assignment => ({
      id: 'assign-1',
      courseId: 'course-1',
      title: 'Homework 1',
      type: 'homework',
      dueDate: new Date('2024-03-20'),
      status: 'pending',
      confidenceScore: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    })

    it('should identify added assignments', () => {
      const newAssignments = [createParsedAssignment()]
      const existingAssignments: Assignment[] = []

      const result = computeAssignmentDiff(newAssignments, existingAssignments)

      expect(result.added).toBe(1)
      expect(result.items[0].status).toBe('added')
    })

    it('should identify unchanged assignments', () => {
      const newAssignments = [createParsedAssignment()]
      const existingAssignments = [createAssignment()]

      const result = computeAssignmentDiff(newAssignments, existingAssignments)

      expect(result.unchanged).toBe(1)
      expect(result.items[0].matchConfidence).toBeGreaterThanOrEqual(0.5)
    })

    it('should identify removed assignments', () => {
      const newAssignments: ParsedAssignment[] = []
      const existingAssignments = [createAssignment()]

      const result = computeAssignmentDiff(newAssignments, existingAssignments)

      expect(result.removed).toBe(1)
      expect(result.items[0].status).toBe('removed')
    })

    it('should identify modified assignments', () => {
      const newAssignments = [createParsedAssignment({ dueDate: '2024-03-25' })]
      const existingAssignments = [createAssignment({ dueDate: new Date('2024-03-20') })]

      const result = computeAssignmentDiff(newAssignments, existingAssignments)

      expect(result.modified).toBe(1)
      expect(result.items[0].changes).toBeDefined()
      expect(result.items[0].changes!.some(c => c.field === 'Due Date')).toBe(true)
    })

    it('should match similar assignments by title', () => {
      const newAssignments = [createParsedAssignment({ title: 'Homework Assignment 1' })]
      const existingAssignments = [createAssignment({ title: 'Homework 1' })]

      const result = computeAssignmentDiff(newAssignments, existingAssignments)

      // Should find a match due to word overlap (Homework, 1)
      expect(result.added).toBe(0)
      expect(result.modified + result.unchanged).toBe(1)
    })

    it('should not match completely different assignments', () => {
      const newAssignments = [createParsedAssignment({ title: 'Final Exam', type: 'exam' })]
      const existingAssignments = [createAssignment({ title: 'Homework 1', type: 'homework' })]

      const result = computeAssignmentDiff(newAssignments, existingAssignments)

      expect(result.added).toBe(1)
      expect(result.removed).toBe(1)
    })
  })

  describe('getDiffStatusColor', () => {
    it('should return correct colors for each status', () => {
      expect(getDiffStatusColor('added')).toContain('green')
      expect(getDiffStatusColor('modified')).toContain('blue')
      expect(getDiffStatusColor('removed')).toContain('red')
      expect(getDiffStatusColor('unchanged')).toContain('muted')
    })
  })

  describe('getDiffStatusBgColor', () => {
    it('should return correct background colors for each status', () => {
      expect(getDiffStatusBgColor('added')).toContain('green')
      expect(getDiffStatusBgColor('modified')).toContain('blue')
      expect(getDiffStatusBgColor('removed')).toContain('red')
      expect(getDiffStatusBgColor('unchanged')).toContain('muted')
    })
  })

  describe('getDiffStatusLabel', () => {
    it('should return correct labels for each status', () => {
      expect(getDiffStatusLabel('added')).toBe('New')
      expect(getDiffStatusLabel('modified')).toBe('Changed')
      expect(getDiffStatusLabel('removed')).toBe('Removed')
      expect(getDiffStatusLabel('unchanged')).toBe('Unchanged')
    })
  })
})
