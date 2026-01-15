// Assignment types
export type AssignmentType = 'exam' | 'paper' | 'homework' | 'project' | 'quiz' | 'other'
export type AssignmentStatus = 'pending' | 'in_progress' | 'completed'
export type GradeType = 'percentage' | 'letter' | 'points' | 'pass_fail'

// Study material types
export type StudyMaterialType = 'guide' | 'practice_exam'
export type QuestionType = 'multiple_choice' | 'fill_in_blank' | 'matching' | 'free_form'
export type BloomLevel = 'knowledge' | 'comprehension' | 'application' | 'analysis' | 'synthesis' | 'evaluation'

// AI Provider types
export type AIProvider = 'anthropic' | 'openai' | 'google' | 'ollama'

// Tutoring mode types
export type TutoringMode = 'learning' | 'homework'

// Archive reason types
export type ArchiveReason = 'user_archived' | 'course_archived' | 'semester_cleanup'

// Base entity with timestamps
export interface BaseEntity {
  id: string
  createdAt: Date
  updatedAt: Date
  archivedAt?: Date          // When item was archived (undefined = not archived)
  archiveReason?: ArchiveReason  // Why it was archived
}

// Days of the week for class schedule
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

// Class meeting time
export interface ClassMeeting {
  days: DayOfWeek[]
  startTime: string // HH:MM format (24hr)
  endTime: string   // HH:MM format (24hr)
  location?: string
}

// Course entity
export interface Course extends BaseEntity {
  name: string
  code: string
  color: string
  description?: string
  instructor?: string
  schedule?: ClassMeeting[]  // Can have multiple meeting patterns (e.g., lecture + lab)
  semesterStart?: Date       // First day of semester/class
  semesterEnd?: Date         // Last day of semester/class
  syllabusData?: SyllabusData
}

// Syllabus data extracted from uploaded files
export interface SyllabusData {
  rawText?: string
  extractedAt: Date
  sourceFileName: string
  sourceFileType: string
}

// Assignment entity
export interface Assignment extends BaseEntity {
  courseId: string
  title: string
  type: AssignmentType
  dueDate: Date
  weight?: number // percentage weight in final grade
  description?: string
  confidenceScore: number // 0-1, from AI parsing
  status: AssignmentStatus
  estimatedEffort?: number // in minutes
  notes?: string
  // Completion tracking
  completedAt?: Date           // When marked complete
  wasLate?: boolean            // Explicitly track if submitted late
  // Grade tracking (percentage for now, extensible later)
  grade?: number               // 0-100 percentage (undefined = not graded yet)
  gradeType?: GradeType        // For future extensibility
}

// Note entity
export interface Note extends BaseEntity {
  courseId?: string  // Optional - null/undefined means "Uncategorized"
  title: string
  images: NoteImage[]
  extractedText?: string
  aiSummary?: string
  topics: string[]
}

// Note image with optional processed data
export interface NoteImage {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  dataUrl: string // base64 encoded image
  ocrText?: string
  processedAt?: Date
}

// Study material entity
export interface StudyMaterial extends BaseEntity {
  courseId?: string  // Optional - null/undefined means "Uncategorized"
  type: StudyMaterialType
  title: string
  content: string // markdown content
  sourceNoteIds?: string[] // notes used to generate this material
  questions?: PracticeQuestion[] // for practice exams
}

// Practice question
export interface PracticeQuestion {
  id: string
  type: QuestionType
  bloomLevel: BloomLevel
  question: string
  options?: string[] // for multiple choice
  correctAnswer: string | string[] // string for most, string[] for matching
  explanation?: string
  userAnswer?: string | string[]
  isCorrect?: boolean
}

// Study session entity
export interface StudySession extends BaseEntity {
  courseId: string
  plannedStart: Date
  plannedDuration: number // in minutes
  actualStart?: Date
  actualDuration?: number // in minutes
  activityType: string
  notes?: string
  completed: boolean
}

// Planned session in a study plan
export interface PlannedStudySession {
  id: string
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

// Study plan entity (singleton - one active plan at a time)
export interface StudyPlan {
  id: 'active_study_plan' // singleton
  sessions: PlannedStudySession[]
  generatedAt: Date
  validUntil: Date // plan should be regenerated after this date
}

// Preferences entity (singleton)
export interface Preferences {
  id: 'user_preferences' // singleton
  onboardingCompleted: boolean
  onboardingStep?: number // tracks current step for resuming
  productivityHours: ProductivityHour[]
  breakPreferences: BreakPreferences
  aiProvider: AIProvider
  aiModel?: string
  personaSettings: PersonaSettings
  theme: 'light' | 'dark' | 'system'
  updatedAt: Date
}

// Productivity hour configuration
export interface ProductivityHour {
  dayOfWeek: number // 0-6, Sunday = 0
  startHour: number // 0-23
  endHour: number // 0-23
  energyLevel: 'high' | 'medium' | 'low'
}

// Break preferences
export interface BreakPreferences {
  shortBreakDuration: number // in minutes
  longBreakDuration: number // in minutes
  sessionsBeforeLongBreak: number
}

// AI persona settings
export interface PersonaSettings {
  name: string
  tone: 'formal' | 'casual' | 'balanced'
  proactiveCheckIns: boolean
}

// Encrypted API key storage
export interface EncryptedApiKey {
  id: string
  provider: AIProvider
  encryptedKey: string // encrypted with Web Crypto API
  iv: string // initialization vector for decryption
  salt: string // salt used for key derivation
  createdAt: Date
  updatedAt: Date
}

// Tutoring history entity
export interface TutoringConversation extends BaseEntity {
  courseId?: string
  title: string
  messages: TutoringMessage[]
  detectedMode: TutoringMode
}

// Image attached to a tutoring message
export interface TutoringMessageImage {
  id: string
  dataUrl: string // base64 encoded image
  mimeType: string
  fileName?: string
}

// Tutoring message
export interface TutoringMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  tokens?: number // token count for cost tracking
  images?: TutoringMessageImage[] // attached images (e.g., homework screenshots)
}

// Analytics - Daily summary
export interface DailySummary extends BaseEntity {
  date: string // YYYY-MM-DD format
  totalStudyMinutes: number
  sessionCount: number
  tasksCompleted: number
  courseBreakdown: Record<string, number> // courseId -> minutes
}

// Per-course streak tracking
export interface CourseStreak {
  courseId: string
  currentStreak: number
  longestStreak: number
  lastActivityDate?: string // YYYY-MM-DD
  longestStreakDate?: string // When longest streak was achieved
}

// Historical streak record
export interface StreakRecord {
  id: string
  type: 'global' | 'course'
  courseId?: string
  courseName?: string
  streakLength: number
  startDate: string
  endDate: string
  achievedAt: Date
}

// Course grade performance tracking
export interface CoursePerformance {
  courseId: string
  assignmentCount: number      // Total graded assignments
  averageGrade: number         // Running average (0-100)
  trend: 'improving' | 'stable' | 'declining' | 'unknown'
  lastGradeDate?: string       // YYYY-MM-DD
  onTimeRate: number           // Percentage of on-time completions
  completedCount: number       // Total completed assignments
  lateCount: number            // Assignments marked late
}

// Analytics - Streaks and milestones
export interface Analytics {
  id: 'user_analytics' // singleton
  currentStreak: number
  longestStreak: number
  longestStreakDate?: string // When longest streak was achieved
  lastStudyDate?: string // YYYY-MM-DD
  totalStudyMinutes: number
  totalSessionsCompleted: number
  totalTasksCompleted: number
  milestones: Milestone[]
  courseStreaks: Record<string, CourseStreak> // courseId -> streak data
  streakRecords: StreakRecord[] // Historical notable streaks
  bestCourseStreak?: { courseId: string; courseName: string; streak: number; date: string }
  coursePerformance: Record<string, CoursePerformance> // courseId -> grade performance
  updatedAt: Date
}

// Milestone achievement
export interface Milestone {
  id: string
  type: string
  achievedAt: Date
  description: string
}

// Grading result for a single question
export interface QuestionGradeResult {
  isCorrect: boolean
  score: number // 0-10 scale
  feedback?: string
  spellingNote?: string
  partialCredit?: boolean
}

// Exam attempt for tracking practice test performance
export interface ExamAttempt {
  id: string
  examId: string // StudyMaterial id
  attemptNumber: number
  answers: Record<string, string | string[]> // questionId -> answer
  gradeResults?: Record<string, QuestionGradeResult> // questionId -> grade result
  score: number // total score points (out of totalQuestions * 10)
  totalQuestions: number
  percentage: number
  completedAt: Date
  archivedAt?: Date          // When item was archived (undefined = not archived)
  archiveReason?: ArchiveReason  // Why it was archived
}

// Semester archive record for tracking cleanup history
export interface SemesterArchive {
  id: string
  semesterName: string        // e.g., "Fall 2026"
  archivedAt: Date           // When the semester was archived
  courseIds: string[]        // Courses included in this archive
  courseCodes: string[]      // Course codes for display after deletion
  permanentlyDeletedAt?: Date // When items were permanently deleted
}

// Tutor behavioral profile - singleton (id: 'tutor_behavioral_profile')
export interface TutorBehavioralProfile {
  id: 'tutor_behavioral_profile'
  /** Comprehension tracking per topic */
  comprehension: [string, TopicComprehension][] // Map entries as array for serialization
  /** Learning style preferences */
  learningStyle: LearningStyleProfile
  /** Struggle patterns per course */
  struggles: [string, CourseStrugglePattern][] // Map entries as array for serialization
  /** Proactive assistance context */
  proactive: ProactiveAssistanceContext
  lastAnalyzed: Date
  totalConversationsAnalyzed: number
}

// Comprehension level type
export type ComprehensionLevel = 'struggling' | 'developing' | 'proficient' | 'mastered'

// Topic comprehension tracking
export interface TopicComprehension {
  topic: string
  courseId?: string
  level: ComprehensionLevel
  confidence: number // 0-1
  lastAssessed: Date
  interactionCount: number
  confusionRate: number // 0-1
  masteryProgression: ComprehensionLevel[] // history of levels
}

// Learning style preferences
export interface LearningStyleProfile {
  examplesOverTheory: number // -1 to 1
  stepByStepOverOverview: number // -1 to 1
  visualPreference: number // 0 to 1
  analogyPreference: number // 0 to 1
  formalOverCasual: number // -1 to 1
  preferredResponseLength: 'concise' | 'moderate' | 'detailed'
  lastUpdated: Date
  interactionCount: number
}

// Course struggle patterns
export interface CourseStrugglePattern {
  courseId: string
  courseName: string
  strugglingTopics: { topic: string; frequency: number; confusionRate: number; lastMentioned: Date }[]
  overallStruggleScore: number
  sessionCount: number
  avgConfusionRate: number
  totalTutoringMinutes: number
  lastInteraction: Date
}

// Proactive assistance context
export interface ProactiveAssistanceContext {
  optimalHours: [number, number][] // hour -> effectiveness as array
  activeDays: [number, number][] // day -> effectiveness as array
  deadlinePatterns: { daysBeforeDeadline: number; helpRequestLikelihood: number }[]
}
