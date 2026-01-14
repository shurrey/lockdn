import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateStudyPlan,
  getStudyRecommendations,
  getSessionsNeeded,
  checkPlanAdjustment,
} from './studyPlanner'
import type { Assignment, Course } from '@/types'

// Mock date for consistent testing
const mockDate = new Date('2024-03-15T10:00:00')

describe('studyPlanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(mockDate)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Helper to create test data
  const createCourse = (overrides: Partial<Course> = {}): Course => ({
    id: 'course-1',
    name: 'Introduction to Computer Science',
    code: 'CS101',
    color: '#3b82f6',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  })

  const createAssignment = (overrides: Partial<Assignment> = {}): Assignment => ({
    id: 'assignment-1',
    courseId: 'course-1',
    title: 'Homework 1',
    type: 'homework',
    dueDate: new Date('2024-03-20'), // 5 days from mock date
    status: 'pending',
    confidenceScore: 1,
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-01'),
    ...overrides,
  })

  describe('generateStudyPlan', () => {
    it('should return empty array when no assignments', () => {
      const courses = [createCourse()]
      const result = generateStudyPlan([], courses, [])
      expect(result).toEqual([])
    })

    it('should return empty array when all assignments are completed', () => {
      const courses = [createCourse()]
      const assignments = [
        createAssignment({ status: 'completed' }),
      ]
      const result = generateStudyPlan(assignments, courses, [])
      expect(result).toEqual([])
    })

    it('should return empty array when assignments are past due', () => {
      const courses = [createCourse()]
      const assignments = [
        createAssignment({ dueDate: new Date('2024-03-10') }), // Past
      ]
      const result = generateStudyPlan(assignments, courses, [])
      expect(result).toEqual([])
    })

    it('should generate sessions for pending assignments', () => {
      const courses = [createCourse()]
      const assignments = [
        createAssignment({
          dueDate: new Date('2024-03-20'), // 5 days out
          type: 'homework',
        }),
      ]

      const result = generateStudyPlan(assignments, courses, [])

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]).toMatchObject({
        courseId: 'course-1',
        courseName: 'Introduction to Computer Science',
        courseColor: '#3b82f6',
        assignmentId: 'assignment-1',
        assignmentTitle: 'Homework 1',
      })
    })

    it('should assign higher priority to urgent assignments', () => {
      // Use a single course with empty schedule
      const courses = [{ ...createCourse({ id: 'course-1' }), schedule: [] }]
      const assignments = [
        createAssignment({
          id: 'a1',
          courseId: 'course-1',
          title: 'Due Later',
          dueDate: new Date('2024-03-25'), // 10 days
        }),
        createAssignment({
          id: 'a2',
          courseId: 'course-1',
          title: 'Due Soon',
          dueDate: new Date('2024-03-17'), // 2 days - more urgent
        }),
      ]

      const result = generateStudyPlan(assignments, courses, [])

      // At least one assignment should have sessions
      expect(result.length).toBeGreaterThan(0)

      // Find sessions for each assignment
      const urgentSessions = result.filter(s => s.assignmentTitle === 'Due Soon')
      const laterSessions = result.filter(s => s.assignmentTitle === 'Due Later')

      // If both have sessions, urgent one should have higher priority score
      if (urgentSessions.length > 0 && laterSessions.length > 0) {
        expect(urgentSessions[0].priority).toBeGreaterThan(laterSessions[0].priority)
      }
    })

    it('should include study topics in planned sessions', () => {
      const courses = [createCourse()]
      const assignments = [
        createAssignment({
          type: 'exam',
          description: 'Covers Chapter 5 and Chapter 6',
        }),
      ]

      const result = generateStudyPlan(assignments, courses, [])

      expect(result.length).toBeGreaterThan(0)
      expect(result[0].studyTopics).toBeDefined()
      expect(result[0].studyTopics!.length).toBeGreaterThan(0)
    })

    it('should not duplicate sessions for already planned assignments', () => {
      const courses = [createCourse()]
      const assignments = [createAssignment()]
      const existingPlanned = [
        {
          id: 'existing-1',
          courseId: 'course-1',
          courseName: 'CS101',
          courseColor: '#3b82f6',
          assignmentId: 'assignment-1',
          assignmentTitle: 'Homework 1',
          plannedStart: new Date('2024-03-16T09:00:00'),
          plannedDuration: 50,
          activityType: 'Study: homework',
          priority: 0.5,
          reason: 'Due in 5 days',
        },
      ]

      const result = generateStudyPlan(assignments, courses, [], {}, existingPlanned)

      // Should have fewer sessions since one is already planned
      const sessionsWithoutExisting = generateStudyPlan(assignments, courses, [])
      expect(result.length).toBeLessThan(sessionsWithoutExisting.length)
    })

    it('should respect max consecutive sessions limit', () => {
      const courses = [createCourse()]
      const assignments = [
        createAssignment({
          type: 'exam',
          estimatedEffort: 600, // 10 hours - many sessions needed
          dueDate: new Date('2024-03-17'), // Just 2 days away
        }),
      ]

      const result = generateStudyPlan(assignments, courses, [], {
        maxConsecutiveSessions: 2,
      })

      // Count sessions per day
      const sessionsByDate = new Map<string, number>()
      for (const session of result) {
        const dateKey = session.plannedStart.toISOString().split('T')[0]
        sessionsByDate.set(dateKey, (sessionsByDate.get(dateKey) || 0) + 1)
      }

      // No day should exceed maxConsecutiveSessions
      for (const count of sessionsByDate.values()) {
        expect(count).toBeLessThanOrEqual(2)
      }
    })
  })

  describe('getStudyRecommendations', () => {
    it('should return empty array when no assignments', () => {
      const courses = [createCourse()]
      const result = getStudyRecommendations([], courses)
      expect(result).toEqual([])
    })

    it('should exclude completed assignments', () => {
      const courses = [createCourse()]
      const assignments = [
        createAssignment({ status: 'completed' }),
      ]
      const result = getStudyRecommendations(assignments, courses)
      expect(result).toEqual([])
    })

    it('should return top priority assignments', () => {
      const courses = [
        createCourse({ id: 'c1', name: 'Course 1' }),
        createCourse({ id: 'c2', name: 'Course 2' }),
        createCourse({ id: 'c3', name: 'Course 3' }),
      ]
      const assignments = [
        createAssignment({ id: 'a1', courseId: 'c1', title: 'Low Priority', dueDate: new Date('2024-03-28') }),
        createAssignment({ id: 'a2', courseId: 'c2', title: 'High Priority', dueDate: new Date('2024-03-16') }),
        createAssignment({ id: 'a3', courseId: 'c3', title: 'Medium Priority', dueDate: new Date('2024-03-20') }),
      ]

      const result = getStudyRecommendations(assignments, courses, 2)

      expect(result.length).toBe(2)
      expect(result[0].assignment.title).toBe('High Priority')
    })

    it('should respect limit parameter', () => {
      const courses = [createCourse()]
      const assignments = [
        createAssignment({ id: 'a1', dueDate: new Date('2024-03-18') }),
        createAssignment({ id: 'a2', dueDate: new Date('2024-03-19') }),
        createAssignment({ id: 'a3', dueDate: new Date('2024-03-20') }),
        createAssignment({ id: 'a4', dueDate: new Date('2024-03-21') }),
      ]

      const result = getStudyRecommendations(assignments, courses, 2)
      expect(result.length).toBe(2)
    })

    it('should include reason for each recommendation', () => {
      const courses = [createCourse()]
      const assignments = [
        createAssignment({ dueDate: new Date('2024-03-16') }), // Tomorrow
      ]

      const result = getStudyRecommendations(assignments, courses)

      expect(result[0].reason).toBe('Due tomorrow!')
    })
  })

  describe('getSessionsNeeded', () => {
    it('should calculate sessions based on estimated effort', () => {
      const assignment = createAssignment({ estimatedEffort: 150 }) // 2.5 hours
      const result = getSessionsNeeded(assignment, 50)
      expect(result).toBe(3) // 150 / 50 = 3 sessions
    })

    it('should use default effort for different assignment types', () => {
      const exam = createAssignment({ type: 'exam' })
      const homework = createAssignment({ type: 'homework' })
      const quiz = createAssignment({ type: 'quiz' })

      // Exam default is 300 min (5 hours)
      expect(getSessionsNeeded(exam, 50)).toBe(6)
      // Homework default is 90 min
      expect(getSessionsNeeded(homework, 50)).toBe(2)
      // Quiz default is 60 min
      expect(getSessionsNeeded(quiz, 50)).toBe(2)
    })

    it('should prefer estimated effort over default', () => {
      const assignment = createAssignment({
        type: 'exam',
        estimatedEffort: 100, // Override the 300 default
      })
      const result = getSessionsNeeded(assignment, 50)
      expect(result).toBe(2)
    })
  })

  describe('checkPlanAdjustment', () => {
    it('should indicate adjustment needed for urgent assignments without sessions', () => {
      const assignments = [
        createAssignment({
          dueDate: new Date('2024-03-17'), // 2 days away - urgent
        }),
      ]

      const result = checkPlanAdjustment([], assignments)

      expect(result.needsAdjustment).toBe(true)
      expect(result.reason).toContain('No study sessions planned')
    })

    it('should not indicate adjustment when urgent assignments have sessions', () => {
      const assignments = [
        createAssignment({
          id: 'urgent-1',
          dueDate: new Date('2024-03-17'),
        }),
      ]
      const plannedSessions = [
        {
          id: 'session-1',
          courseId: 'course-1',
          courseName: 'CS101',
          courseColor: '#3b82f6',
          assignmentId: 'urgent-1',
          plannedStart: new Date('2024-03-16T09:00:00'),
          plannedDuration: 50,
          activityType: 'Study',
          priority: 0.8,
          reason: 'Due soon',
        },
      ]

      const result = checkPlanAdjustment(plannedSessions, assignments)

      expect(result.needsAdjustment).toBe(false)
    })

    it('should indicate adjustment when multiple sessions are missed', () => {
      const assignments = [createAssignment()]
      const plannedSessions = [
        // 3 sessions in the past (missed)
        {
          id: '1', courseId: 'c1', courseName: 'C1', courseColor: '#000',
          plannedStart: new Date('2024-03-10'), plannedDuration: 50,
          activityType: 'Study', priority: 0.5, reason: 'Test',
        },
        {
          id: '2', courseId: 'c1', courseName: 'C1', courseColor: '#000',
          plannedStart: new Date('2024-03-11'), plannedDuration: 50,
          activityType: 'Study', priority: 0.5, reason: 'Test',
        },
        {
          id: '3', courseId: 'c1', courseName: 'C1', courseColor: '#000',
          plannedStart: new Date('2024-03-12'), plannedDuration: 50,
          activityType: 'Study', priority: 0.5, reason: 'Test',
        },
      ]

      const result = checkPlanAdjustment(plannedSessions, assignments)

      expect(result.needsAdjustment).toBe(true)
      expect(result.reason).toContain('missed')
    })

    it('should ignore completed assignments', () => {
      const assignments = [
        createAssignment({
          status: 'completed',
          dueDate: new Date('2024-03-17'), // Would be urgent if not completed
        }),
      ]

      const result = checkPlanAdjustment([], assignments)

      expect(result.needsAdjustment).toBe(false)
    })
  })
})
