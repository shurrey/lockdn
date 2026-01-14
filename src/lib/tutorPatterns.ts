/**
 * Tutor Behavioral Pattern Learning
 *
 * This module analyzes tutoring interactions to learn:
 * 1. Comprehension tracking - How well students understand topics
 * 2. Learning style adaptation - Preferred explanation styles
 * 3. Struggle detection - Courses/topics needing extra help
 * 4. Proactive assistance - Optimal times to offer help
 */

import type { TutoringConversation, Assignment, Course, ComprehensionLevel, TopicComprehension } from '@/types'

// ============================================================================
// Types
// ============================================================================

/** Indicators of student confusion in their messages */
export interface ConfusionIndicators {
  hasQuestionWords: boolean // "what", "why", "how", "huh", "?"
  hasConfusionPhrases: boolean // "I don't understand", "confused", "lost"
  hasRepeatRequest: boolean // "can you explain again", "say that again"
  hasContradiction: boolean // "but you said", "that doesn't match"
  followUpCount: number // rapid follow-up questions
  messageLength: 'short' | 'medium' | 'long' // very short often = confusion
}

// Re-export types from @/types for backwards compatibility
export type { ComprehensionLevel, TopicComprehension }

/** Learning style preferences */
export interface LearningStyleProfile {
  /** Prefers concrete examples over abstract theory */
  examplesOverTheory: number // -1 to 1, negative = theory, positive = examples
  /** Prefers step-by-step breakdowns over high-level overviews */
  stepByStepOverOverview: number // -1 to 1
  /** Prefers visual aids (diagrams, charts) mentioned */
  visualPreference: number // 0 to 1
  /** Prefers analogies and real-world connections */
  analogyPreference: number // 0 to 1
  /** Prefers formal/academic language vs casual */
  formalOverCasual: number // -1 to 1
  /** Average preferred response length */
  preferredResponseLength: 'concise' | 'moderate' | 'detailed'
  /** Detected from message patterns */
  lastUpdated: Date
  interactionCount: number
}

/** Course/topic struggle patterns */
export interface StrugglePattern {
  courseId: string
  courseName: string
  /** Topics that appear frequently in confused messages */
  strugglingTopics: TopicStruggle[]
  /** Overall struggle score for this course (0-1, higher = more struggle) */
  overallStruggleScore: number
  /** Number of tutoring sessions for this course */
  sessionCount: number
  /** Average confusion rate across sessions */
  avgConfusionRate: number
  /** Time spent in tutoring for this course */
  totalTutoringMinutes: number
  lastInteraction: Date
}

export interface TopicStruggle {
  topic: string
  frequency: number // how often this topic comes up
  confusionRate: number // how often confusion indicators appear
  lastMentioned: Date
}

/** Proactive assistance context */
export interface ProactiveContext {
  /** Best times of day to offer help (hour -> effectiveness) */
  optimalHours: Map<number, number>
  /** Days with most tutoring activity */
  activeDays: Map<number, number> // 0=Sunday
  /** Deadline proximity patterns */
  deadlinePatterns: {
    daysBeforeDeadline: number
    helpRequestLikelihood: number
  }[]
  /** Course-specific patterns */
  coursePatterns: Map<string, {
    avgSessionsBeforeAssignment: number
    preferredHelpTiming: 'early' | 'middle' | 'lastMinute'
  }>
}

/** Combined tutor behavioral profile */
export interface TutorBehavioralProfile {
  id: 'tutor_behavioral_profile' // singleton
  comprehension: Map<string, TopicComprehension> // topic -> comprehension
  learningStyle: LearningStyleProfile
  struggles: Map<string, StrugglePattern> // courseId -> pattern
  proactive: ProactiveContext
  lastAnalyzed: Date
  totalConversationsAnalyzed: number
}

// ============================================================================
// Confusion Detection
// ============================================================================

const CONFUSION_PHRASES = [
  "don't understand",
  "dont understand",
  "confused",
  "i'm lost",
  "im lost",
  "what do you mean",
  "huh",
  "wait what",
  "that doesn't make sense",
  "doesn't make sense",
  "not sure what",
  "still don't get",
  "still dont get",
  "can you clarify",
  "what does that mean",
  "i don't follow",
  "i dont follow",
]

const REPEAT_REQUEST_PHRASES = [
  "explain again",
  "say that again",
  "one more time",
  "repeat that",
  "go over that again",
  "can you rephrase",
  "in other words",
  "simpler terms",
  "dumb it down",
  "eli5",
  "explain like",
]

const CONTRADICTION_PHRASES = [
  "but you said",
  "earlier you said",
  "that contradicts",
  "doesn't match",
  "you mentioned",
  "thought you said",
]

/**
 * Analyze a message for confusion indicators
 */
export function detectConfusion(message: string): ConfusionIndicators {
  const lower = message.toLowerCase()
  const words = lower.split(/\s+/)

  return {
    hasQuestionWords: /\b(what|why|how|when|where|which|huh)\b|\?/.test(lower),
    hasConfusionPhrases: CONFUSION_PHRASES.some(phrase => lower.includes(phrase)),
    hasRepeatRequest: REPEAT_REQUEST_PHRASES.some(phrase => lower.includes(phrase)),
    hasContradiction: CONTRADICTION_PHRASES.some(phrase => lower.includes(phrase)),
    followUpCount: 0, // set by caller based on context
    messageLength: words.length < 10 ? 'short' : words.length < 50 ? 'medium' : 'long',
  }
}

/**
 * Calculate confusion score from indicators (0-1)
 */
export function calculateConfusionScore(indicators: ConfusionIndicators): number {
  let score = 0

  if (indicators.hasConfusionPhrases) score += 0.4
  if (indicators.hasRepeatRequest) score += 0.3
  if (indicators.hasContradiction) score += 0.2
  if (indicators.hasQuestionWords && indicators.messageLength === 'short') score += 0.1
  if (indicators.followUpCount > 2) score += 0.2

  return Math.min(1, score)
}

// ============================================================================
// Learning Style Detection
// ============================================================================

const EXAMPLE_REQUEST_PATTERNS = [
  /\b(example|for instance|such as|like what|show me)\b/i,
  /\bcan you (give|show|provide).*(example|instance)\b/i,
]

const THEORY_REQUEST_PATTERNS = [
  /\b(why does|how does|what causes|principle|concept|theory)\b/i,
  /\bexplain (why|how|the)\b/i,
]

const STEP_BY_STEP_PATTERNS = [
  /\b(step by step|walk me through|break it down|one at a time)\b/i,
  /\bfirst.*(then|next|after)\b/i,
]

const OVERVIEW_PATTERNS = [
  /\b(overview|summary|big picture|in general|broadly)\b/i,
  /\bgist of\b/i,
]

const VISUAL_PATTERNS = [
  /\b(diagram|chart|graph|visual|picture|draw|illustrate)\b/i,
  /\bshow me\b/i,
]

const ANALOGY_PATTERNS = [
  /\b(analogy|like|similar to|compared to|metaphor)\b/i,
  /\breal.*(world|life)\b/i,
]

/**
 * Analyze message for learning style preferences
 */
export function detectLearningStyleSignals(message: string): {
  wantsExamples: boolean
  wantsTheory: boolean
  wantsStepByStep: boolean
  wantsOverview: boolean
  wantsVisual: boolean
  wantsAnalogy: boolean
} {
  return {
    wantsExamples: EXAMPLE_REQUEST_PATTERNS.some(p => p.test(message)),
    wantsTheory: THEORY_REQUEST_PATTERNS.some(p => p.test(message)),
    wantsStepByStep: STEP_BY_STEP_PATTERNS.some(p => p.test(message)),
    wantsOverview: OVERVIEW_PATTERNS.some(p => p.test(message)),
    wantsVisual: VISUAL_PATTERNS.some(p => p.test(message)),
    wantsAnalogy: ANALOGY_PATTERNS.some(p => p.test(message)),
  }
}

/**
 * Update learning style profile based on conversation
 */
export function updateLearningStyleProfile(
  current: LearningStyleProfile,
  conversation: TutoringConversation
): LearningStyleProfile {
  const userMessages = conversation.messages.filter(m => m.role === 'user')
  if (userMessages.length === 0) return current

  let examplesSignals = 0
  let theorySignals = 0
  let stepByStepSignals = 0
  let overviewSignals = 0
  let visualSignals = 0
  let analogySignals = 0
  let totalLength = 0

  for (const msg of userMessages) {
    const signals = detectLearningStyleSignals(msg.content)
    if (signals.wantsExamples) examplesSignals++
    if (signals.wantsTheory) theorySignals++
    if (signals.wantsStepByStep) stepByStepSignals++
    if (signals.wantsOverview) overviewSignals++
    if (signals.wantsVisual) visualSignals++
    if (signals.wantsAnalogy) analogySignals++
    totalLength += msg.content.length
  }

  const count = userMessages.length
  const avgLength = totalLength / count

  // Weighted update (blend with existing profile)
  const weight = Math.min(0.3, count / 10) // cap influence of single conversation
  const oldWeight = 1 - weight

  const newExamplesOverTheory = examplesSignals > theorySignals ? 1 :
    theorySignals > examplesSignals ? -1 : 0
  const newStepByStepOverOverview = stepByStepSignals > overviewSignals ? 1 :
    overviewSignals > stepByStepSignals ? -1 : 0

  return {
    examplesOverTheory: current.examplesOverTheory * oldWeight + newExamplesOverTheory * weight,
    stepByStepOverOverview: current.stepByStepOverOverview * oldWeight + newStepByStepOverOverview * weight,
    visualPreference: current.visualPreference * oldWeight + (visualSignals / count) * weight,
    analogyPreference: current.analogyPreference * oldWeight + (analogySignals / count) * weight,
    formalOverCasual: current.formalOverCasual, // TODO: detect formality preference
    preferredResponseLength: avgLength > 200 ? 'detailed' : avgLength > 50 ? 'moderate' : 'concise',
    lastUpdated: new Date(),
    interactionCount: current.interactionCount + count,
  }
}

// ============================================================================
// Topic Extraction
// ============================================================================

const TOPIC_PATTERNS = [
  /\b(?:about|regarding|concerning|on|learn(?:ing)?)\s+([a-zA-Z\s]{3,30})/gi,
  /\b(?:help\s+(?:me\s+)?(?:with|understand))\s+([a-zA-Z\s]{3,30})/gi,
  /\bwhat\s+(?:is|are)\s+([a-zA-Z\s]{3,30})/gi,
  /\bhow\s+(?:do|does|to)\s+([a-zA-Z\s]{3,30})/gi,
]

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'it', 'its',
  'my', 'your', 'his', 'her', 'their', 'our', 'me', 'you', 'him',
  'i', 'we', 'they', 'be', 'been', 'being', 'am', 'is', 'are', 'was', 'were',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'can', 'may', 'might', 'must', 'shall', 'need', 'want', 'like', 'just',
  'some', 'any', 'all', 'more', 'most', 'other', 'such', 'no', 'not',
  'only', 'same', 'so', 'than', 'too', 'very', 'also', 'back', 'well',
])

/**
 * Extract likely topics from a message
 */
export function extractTopics(message: string): string[] {
  const topics: string[] = []

  // Pattern-based extraction
  for (const pattern of TOPIC_PATTERNS) {
    let match
    while ((match = pattern.exec(message)) !== null) {
      const topic = match[1]?.trim().toLowerCase()
      if (topic && topic.length > 2 && !STOP_WORDS.has(topic)) {
        topics.push(topic)
      }
    }
  }

  // N-gram extraction for technical terms (2-3 word phrases)
  const words = message.toLowerCase().split(/\s+/).filter(w =>
    w.length > 2 && !STOP_WORDS.has(w) && /^[a-z]+$/.test(w)
  )

  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`
    if (bigram.length > 5 && bigram.length < 30) {
      topics.push(bigram)
    }
  }

  // Deduplicate
  return [...new Set(topics)]
}

// ============================================================================
// Struggle Detection
// ============================================================================

/**
 * Analyze conversations to detect struggle patterns per course
 */
export function analyzeStrugglePatterns(
  conversations: TutoringConversation[],
  courses: Course[]
): Map<string, StrugglePattern> {
  const struggles = new Map<string, StrugglePattern>()
  const courseMap = new Map(courses.map(c => [c.id, c]))

  // Group conversations by course
  const convoByCourse = new Map<string, TutoringConversation[]>()
  for (const convo of conversations) {
    if (!convo.courseId) continue
    const existing = convoByCourse.get(convo.courseId) || []
    existing.push(convo)
    convoByCourse.set(convo.courseId, existing)
  }

  // Analyze each course
  for (const [courseId, convos] of convoByCourse) {
    const course = courseMap.get(courseId)
    if (!course) continue

    const topicMap = new Map<string, { count: number; confusedCount: number; lastSeen: Date }>()
    let totalConfusion = 0
    let totalMessages = 0
    let totalMinutes = 0

    for (const convo of convos) {
      const userMessages = convo.messages.filter(m => m.role === 'user')

      // Estimate duration from timestamps
      if (convo.messages.length >= 2) {
        const first = new Date(convo.messages[0].timestamp)
        const last = new Date(convo.messages[convo.messages.length - 1].timestamp)
        totalMinutes += (last.getTime() - first.getTime()) / 60000
      }

      let prevConfused = false
      for (const msg of userMessages) {
        totalMessages++
        const indicators = detectConfusion(msg.content)
        indicators.followUpCount = prevConfused ? 1 : 0
        const confusionScore = calculateConfusionScore(indicators)
        const isConfused = confusionScore > 0.3

        if (isConfused) totalConfusion++
        prevConfused = isConfused

        // Extract and track topics
        const topics = extractTopics(msg.content)
        for (const topic of topics) {
          const existing = topicMap.get(topic) || { count: 0, confusedCount: 0, lastSeen: new Date(0) }
          existing.count++
          if (isConfused) existing.confusedCount++
          existing.lastSeen = new Date(msg.timestamp)
          topicMap.set(topic, existing)
        }
      }
    }

    // Build struggle topics (filter to significant ones)
    const strugglingTopics: TopicStruggle[] = []
    for (const [topic, data] of topicMap) {
      if (data.count >= 2) { // Only topics mentioned at least twice
        strugglingTopics.push({
          topic,
          frequency: data.count,
          confusionRate: data.count > 0 ? data.confusedCount / data.count : 0,
          lastMentioned: data.lastSeen,
        })
      }
    }

    // Sort by confusion rate * frequency
    strugglingTopics.sort((a, b) =>
      (b.confusionRate * b.frequency) - (a.confusionRate * a.frequency)
    )

    struggles.set(courseId, {
      courseId,
      courseName: course.name,
      strugglingTopics: strugglingTopics.slice(0, 10), // Top 10
      overallStruggleScore: totalMessages > 0 ? totalConfusion / totalMessages : 0,
      sessionCount: convos.length,
      avgConfusionRate: totalMessages > 0 ? totalConfusion / totalMessages : 0,
      totalTutoringMinutes: totalMinutes,
      lastInteraction: convos.length > 0
        ? new Date(Math.max(...convos.map(c => new Date(c.updatedAt).getTime())))
        : new Date(0),
    })
  }

  return struggles
}

// ============================================================================
// Proactive Assistance
// ============================================================================

/**
 * Analyze when students typically seek tutoring help
 */
export function analyzeProactivePatterns(
  conversations: TutoringConversation[],
  assignments: Assignment[]
): ProactiveContext {
  const hourCounts = new Map<number, number>()
  const dayCounts = new Map<number, number>()
  const deadlineProximity: number[] = []

  // Build assignment due date lookup
  const assignmentDueDates = new Map(
    assignments.map(a => [a.courseId, new Date(a.dueDate)])
  )

  for (const convo of conversations) {
    if (convo.messages.length === 0) continue

    const firstMsg = convo.messages[0]
    const msgTime = new Date(firstMsg.timestamp)
    const hour = msgTime.getHours()
    const day = msgTime.getDay()

    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1)
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1)

    // Check deadline proximity
    if (convo.courseId) {
      const dueDate = assignmentDueDates.get(convo.courseId)
      if (dueDate) {
        const daysUntilDue = Math.floor((dueDate.getTime() - msgTime.getTime()) / (1000 * 60 * 60 * 24))
        if (daysUntilDue >= 0 && daysUntilDue <= 14) {
          deadlineProximity.push(daysUntilDue)
        }
      }
    }
  }

  // Normalize hours to effectiveness scores
  const maxHourCount = Math.max(...hourCounts.values(), 1)
  const optimalHours = new Map<number, number>()
  for (const [hour, count] of hourCounts) {
    optimalHours.set(hour, count / maxHourCount)
  }

  // Normalize days
  const maxDayCount = Math.max(...dayCounts.values(), 1)
  const activeDays = new Map<number, number>()
  for (const [day, count] of dayCounts) {
    activeDays.set(day, count / maxDayCount)
  }

  // Analyze deadline patterns
  const deadlinePatterns: { daysBeforeDeadline: number; helpRequestLikelihood: number }[] = []
  const proximityCounts = new Map<number, number>()
  for (const days of deadlineProximity) {
    proximityCounts.set(days, (proximityCounts.get(days) || 0) + 1)
  }

  const totalProximity = deadlineProximity.length || 1
  for (let days = 0; days <= 14; days++) {
    deadlinePatterns.push({
      daysBeforeDeadline: days,
      helpRequestLikelihood: (proximityCounts.get(days) || 0) / totalProximity,
    })
  }

  return {
    optimalHours,
    activeDays,
    deadlinePatterns,
    coursePatterns: new Map(), // TODO: implement per-course patterns
  }
}

// ============================================================================
// Comprehension Assessment
// ============================================================================

/**
 * Assess comprehension level based on conversation patterns
 */
export function assessComprehension(
  conversation: TutoringConversation
): { level: ComprehensionLevel; confidence: number; topics: string[] } {
  const userMessages = conversation.messages.filter(m => m.role === 'user')
  if (userMessages.length === 0) {
    return { level: 'developing', confidence: 0, topics: [] }
  }

  let totalConfusion = 0
  let confusionTrend: number[] = [] // track if confusion decreases over conversation
  const allTopics: string[] = []

  for (let i = 0; i < userMessages.length; i++) {
    const msg = userMessages[i]
    const indicators = detectConfusion(msg.content)

    // Check for follow-up confusion
    if (i > 0) {
      const prevIndicators = detectConfusion(userMessages[i - 1].content)
      if (calculateConfusionScore(prevIndicators) > 0.3) {
        indicators.followUpCount = 1
      }
    }

    const score = calculateConfusionScore(indicators)
    totalConfusion += score
    confusionTrend.push(score)

    allTopics.push(...extractTopics(msg.content))
  }

  const avgConfusion = totalConfusion / userMessages.length

  // Check if confusion decreased over conversation (learning happened)
  let learningOccurred = false
  if (confusionTrend.length >= 3) {
    const firstHalf = confusionTrend.slice(0, Math.floor(confusionTrend.length / 2))
    const secondHalf = confusionTrend.slice(Math.floor(confusionTrend.length / 2))
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
    learningOccurred = secondAvg < firstAvg * 0.7 // 30% improvement
  }

  // Determine level
  let level: ComprehensionLevel
  if (avgConfusion > 0.6) {
    level = 'struggling'
  } else if (avgConfusion > 0.3) {
    level = learningOccurred ? 'developing' : 'struggling'
  } else if (avgConfusion > 0.1) {
    level = learningOccurred ? 'proficient' : 'developing'
  } else {
    level = learningOccurred ? 'mastered' : 'proficient'
  }

  // Confidence based on message count
  const confidence = Math.min(1, userMessages.length / 5)

  return {
    level,
    confidence,
    topics: [...new Set(allTopics)].slice(0, 5),
  }
}

// ============================================================================
// Profile Building
// ============================================================================

/**
 * Build or update the complete behavioral profile
 */
export function buildBehavioralProfile(
  conversations: TutoringConversation[],
  courses: Course[],
  assignments: Assignment[],
  existingProfile?: Partial<TutorBehavioralProfile>
): TutorBehavioralProfile {
  // Initialize default learning style if not exists
  const defaultLearningStyle: LearningStyleProfile = {
    examplesOverTheory: 0,
    stepByStepOverOverview: 0,
    visualPreference: 0.5,
    analogyPreference: 0.5,
    formalOverCasual: 0,
    preferredResponseLength: 'moderate',
    lastUpdated: new Date(),
    interactionCount: 0,
  }

  // Start with existing or default
  let learningStyle = existingProfile?.learningStyle || defaultLearningStyle
  const comprehension = new Map(existingProfile?.comprehension || [])

  // Update learning style from each conversation
  for (const convo of conversations) {
    learningStyle = updateLearningStyleProfile(learningStyle, convo)

    // Update comprehension for topics in this conversation
    const assessment = assessComprehension(convo)
    for (const topic of assessment.topics) {
      const key = convo.courseId ? `${convo.courseId}:${topic}` : topic
      const existing = comprehension.get(key)

      if (existing) {
        // Update existing comprehension
        comprehension.set(key, {
          ...existing,
          level: assessment.level,
          confidence: Math.max(existing.confidence, assessment.confidence),
          lastAssessed: new Date(),
          interactionCount: existing.interactionCount + 1,
          confusionRate: (existing.confusionRate + (assessment.level === 'struggling' ? 1 : 0)) / 2,
          masteryProgression: [...existing.masteryProgression.slice(-4), assessment.level],
        })
      } else {
        // New topic
        comprehension.set(key, {
          topic,
          courseId: convo.courseId,
          level: assessment.level,
          confidence: assessment.confidence,
          lastAssessed: new Date(),
          interactionCount: 1,
          confusionRate: assessment.level === 'struggling' ? 1 : 0,
          masteryProgression: [assessment.level],
        })
      }
    }
  }

  // Build struggle patterns
  const struggles = analyzeStrugglePatterns(conversations, courses)

  // Build proactive patterns
  const proactive = analyzeProactivePatterns(conversations, assignments)

  return {
    id: 'tutor_behavioral_profile',
    comprehension,
    learningStyle,
    struggles,
    proactive,
    lastAnalyzed: new Date(),
    totalConversationsAnalyzed: conversations.length,
  }
}

// ============================================================================
// Profile Usage - Generate Tutor Instructions
// ============================================================================

/**
 * Generate tutor instructions based on learned behavioral profile
 */
export function generateTutorInstructions(profile: TutorBehavioralProfile, courseId?: string): string {
  const instructions: string[] = []

  // Learning style instructions
  const style = profile.learningStyle
  if (style.interactionCount > 0) {
    instructions.push('## Personalized Teaching Approach')

    if (style.examplesOverTheory > 0.3) {
      instructions.push('- This student learns best with concrete EXAMPLES. Lead with examples before theory.')
    } else if (style.examplesOverTheory < -0.3) {
      instructions.push('- This student prefers understanding the THEORY first. Explain concepts before examples.')
    }

    if (style.stepByStepOverOverview > 0.3) {
      instructions.push('- Break down explanations STEP BY STEP. Number your steps clearly.')
    } else if (style.stepByStepOverOverview < -0.3) {
      instructions.push('- Start with the BIG PICTURE overview before diving into details.')
    }

    if (style.visualPreference > 0.6) {
      instructions.push('- This student responds well to VISUAL descriptions. Describe diagrams, use spatial language.')
    }

    if (style.analogyPreference > 0.6) {
      instructions.push('- Use ANALOGIES and real-world connections to explain concepts.')
    }

    if (style.preferredResponseLength === 'concise') {
      instructions.push('- Keep responses CONCISE and to the point.')
    } else if (style.preferredResponseLength === 'detailed') {
      instructions.push('- Provide DETAILED explanations with thorough coverage.')
    }
  }

  // Course-specific struggle information
  if (courseId && profile.struggles.has(courseId)) {
    const struggle = profile.struggles.get(courseId)!
    if (struggle.strugglingTopics.length > 0) {
      instructions.push('\n## Topics Needing Extra Care')
      instructions.push('The student has shown difficulty with these topics. Explain them more carefully:')
      for (const topic of struggle.strugglingTopics.slice(0, 5)) {
        if (topic.confusionRate > 0.3) {
          instructions.push(`- "${topic.topic}" (frequently causes confusion)`)
        }
      }
    }

    if (struggle.overallStruggleScore > 0.4) {
      instructions.push('\n**Note:** This student finds this course challenging. Be extra patient and check for understanding frequently.')
    }
  }

  // Comprehension-based instructions
  const courseComprehension = [...profile.comprehension.values()]
    .filter(c => !courseId || c.courseId === courseId)
    .filter(c => c.level === 'struggling')

  if (courseComprehension.length > 0) {
    instructions.push('\n## Struggling Topics')
    instructions.push('Check comprehension carefully when discussing:')
    for (const comp of courseComprehension.slice(0, 5)) {
      instructions.push(`- ${comp.topic}`)
    }
  }

  return instructions.join('\n')
}

/**
 * Get proactive help suggestions based on profile
 */
export function getProactiveHelpSuggestions(
  profile: TutorBehavioralProfile,
  currentTime: Date,
  upcomingAssignments: Assignment[]
): { shouldOffer: boolean; reason: string; coursesToFocus: string[] } {
  const hour = currentTime.getHours()
  const day = currentTime.getDay()

  // Check if current time is optimal
  const hourEffectiveness = profile.proactive.optimalHours.get(hour) || 0
  const dayEffectiveness = profile.proactive.activeDays.get(day) || 0

  const isOptimalTime = hourEffectiveness > 0.5 && dayEffectiveness > 0.5

  // Check deadline proximity
  const coursesToFocus: string[] = []
  for (const assignment of upcomingAssignments) {
    const dueDate = new Date(assignment.dueDate)
    const daysUntil = Math.floor((dueDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24))

    // Find likelihood of help request at this proximity
    const pattern = profile.proactive.deadlinePatterns.find(p => p.daysBeforeDeadline === daysUntil)
    if (pattern && pattern.helpRequestLikelihood > 0.3) {
      coursesToFocus.push(assignment.courseId)
    }
  }

  // Check struggles
  const highStruggleCourses = [...profile.struggles.values()]
    .filter(s => s.overallStruggleScore > 0.4)
    .map(s => s.courseId)

  const urgentCourses = [...new Set([...coursesToFocus, ...highStruggleCourses])]

  let shouldOffer = false
  let reason = ''

  if (isOptimalTime && urgentCourses.length > 0) {
    shouldOffer = true
    reason = 'Good study time with upcoming deadlines'
  } else if (urgentCourses.length >= 2) {
    shouldOffer = true
    reason = 'Multiple courses need attention'
  } else if (isOptimalTime && profile.learningStyle.interactionCount > 5) {
    shouldOffer = true
    reason = 'Optimal study time based on your patterns'
  }

  return { shouldOffer, reason, coursesToFocus: urgentCourses }
}
