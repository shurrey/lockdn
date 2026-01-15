import { getConfiguredProvider, type AIMessage, type AIMessageContent } from '@/lib/ai'
import type { Course, Assignment, TutoringMessage, TutoringMessageImage, TutoringMode, Note, StudyMaterial, ExamAttempt } from '@/types'
import { differenceInDays } from 'date-fns'
import {
  generateTutorInstructions,
  type TutorBehavioralProfile,
} from '@/lib/tutorPatterns'

export interface TutorContext {
  courses: Course[]
  upcomingAssignments: Assignment[]
  notes: Note[]
  studyMaterials?: StudyMaterial[]
  examAttempts?: ExamAttempt[]
  currentCourse?: Course
  mode: TutoringMode
  behavioralProfile?: TutorBehavioralProfile
}

export interface TutorResponse {
  content: string
  detectedMode: TutoringMode
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

/**
 * Detect intent from user message
 * Returns 'homework' if the message appears to be seeking direct answers
 */
function detectIntent(message: string, context: TutorContext): TutoringMode {
  // If explicitly set, respect that
  if (context.mode === 'homework') return 'homework'

  const homeworkIndicators = [
    /what('s| is) the answer/i,
    /solve (this|the|my)/i,
    /do (this|the|my) (problem|homework|assignment)/i,
    /give me the (answer|solution)/i,
    /just tell me/i,
    /what should i (write|say|put)/i,
    /write (this|the|my) (essay|paper|response)/i,
    /complete (this|the|my)/i,
    /finish (this|the|my)/i,
  ]

  for (const pattern of homeworkIndicators) {
    if (pattern.test(message)) {
      return 'homework'
    }
  }

  // Check for proximity to deadlines (if asking about a specific course near deadline)
  if (context.currentCourse) {
    const courseAssignments = context.upcomingAssignments.filter(
      (a) => a.courseId === context.currentCourse?.id
    )
    const hasUrgentDeadline = courseAssignments.some((a) => {
      const daysUntil = differenceInDays(new Date(a.dueDate), new Date())
      return daysUntil <= 2
    })

    if (hasUrgentDeadline) {
      // More likely to be homework help if deadline is imminent
      const urgentPatterns = [
        /help (me )?(with|on)/i,
        /how do i/i,
        /can you (help|explain)/i,
      ]
      for (const pattern of urgentPatterns) {
        if (pattern.test(message)) {
          return 'homework'
        }
      }
    }
  }

  return 'learning'
}

/**
 * Build the system prompt for the tutor
 */
function buildSystemPrompt(context: TutorContext, detectedMode: TutoringMode): string {
  const now = new Date()

  // Build context about courses and deadlines
  let courseContext = ''
  if (context.courses.length > 0) {
    courseContext = `\n\nThe student is enrolled in these courses:\n${context.courses
      .map((c) => `- ${c.code}: ${c.name}${c.instructor ? ` (Instructor: ${c.instructor})` : ''}`)
      .join('\n')}`
  }

  let deadlineContext = ''
  if (context.upcomingAssignments.length > 0) {
    const upcoming = context.upcomingAssignments.slice(0, 5).map((a) => {
      const course = context.courses.find((c) => c.id === a.courseId)
      const daysUntil = differenceInDays(new Date(a.dueDate), now)
      return `- ${a.title} (${course?.code || 'Unknown'}) - ${daysUntil <= 0 ? 'OVERDUE' : `due in ${daysUntil} days`}`
    })
    deadlineContext = `\n\nUpcoming deadlines:\n${upcoming.join('\n')}`
  }

  let currentCourseContext = ''
  if (context.currentCourse) {
    currentCourseContext = `\n\nThe student is currently asking about: ${context.currentCourse.code} - ${context.currentCourse.name}`

    // Add syllabus info for current course
    if (context.currentCourse.syllabusData?.rawText) {
      const syllabusText = context.currentCourse.syllabusData.rawText
      // Limit syllabus to ~2000 chars to avoid overwhelming the context
      const truncatedSyllabus = syllabusText.length > 2000
        ? syllabusText.substring(0, 2000) + '...[truncated]'
        : syllabusText
      currentCourseContext += `\n\nSyllabus content for ${context.currentCourse.code}:\n${truncatedSyllabus}`
    }
  }

  // Add notes context for current course (with IDs for linking)
  let notesContext = ''
  if (context.notes.length > 0) {
    const relevantNotes = context.currentCourse
      ? context.notes.filter(n => n.courseId === context.currentCourse?.id)
      : context.notes.slice(0, 5)

    if (relevantNotes.length > 0) {
      const notesSummary = relevantNotes.map(n => {
        // Include ID for linking: [[note:ID:Title]]
        let noteInfo = `- [[note:${n.id}:${n.title}]]`
        if (n.topics.length > 0) {
          noteInfo += ` (Topics: ${n.topics.join(', ')})`
        }
        if (n.aiSummary) {
          noteInfo += `\n  Summary: ${n.aiSummary.substring(0, 200)}${n.aiSummary.length > 200 ? '...' : ''}`
        } else if (n.extractedText) {
          noteInfo += `\n  Content: ${n.extractedText.substring(0, 200)}${n.extractedText.length > 200 ? '...' : ''}`
        }
        return noteInfo
      }).join('\n')
      notesContext = `\n\nStudent's notes${context.currentCourse ? ` for ${context.currentCourse.code}` : ''}:\n${notesSummary}`
    }
  }

  // Add study materials context (guides and practice exams)
  let studyMaterialsContext = ''
  if (context.studyMaterials && context.studyMaterials.length > 0) {
    const relevantMaterials = context.currentCourse
      ? context.studyMaterials.filter(m => m.courseId === context.currentCourse?.id)
      : context.studyMaterials.slice(0, 5)

    if (relevantMaterials.length > 0) {
      const guides = relevantMaterials.filter(m => m.type === 'guide')
      const exams = relevantMaterials.filter(m => m.type === 'practice_exam')

      let materialsInfo = ''

      // Study guides (with IDs for linking)
      if (guides.length > 0) {
        materialsInfo += '\n\nAvailable study guides:\n'
        for (const guide of guides.slice(0, 3)) {
          // Include ID for linking: [[guide:ID:Title]]
          materialsInfo += `- [[guide:${guide.id}:${guide.title}]]\n`
          if (guide.content) {
            const preview = guide.content.substring(0, 500)
            materialsInfo += `  Preview: ${preview}${guide.content.length > 500 ? '...' : ''}\n`
          }
        }
      }

      // Practice exams with attempt history (with IDs for linking)
      if (exams.length > 0) {
        materialsInfo += '\n\nPractice exams:\n'
        for (const exam of exams.slice(0, 3)) {
          const attempts = context.examAttempts?.filter(a => a.examId === exam.id) || []
          // Include ID for linking: [[exam:ID:Title]]
          materialsInfo += `- [[exam:${exam.id}:${exam.title}]]`
          if (attempts.length > 0) {
            const latestAttempt = attempts.sort((a, b) =>
              new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
            )[0]
            const bestAttempt = attempts.sort((a, b) => b.percentage - a.percentage)[0]
            materialsInfo += ` - ${attempts.length} attempt(s), latest: ${latestAttempt.percentage}%, best: ${bestAttempt.percentage}%`

            // Show questions with attempt results
            if (exam.questions && exam.questions.length > 0) {
              materialsInfo += '\n  Questions:'
              for (const q of exam.questions.slice(0, 10)) {
                const userAnswer = latestAttempt.answers[q.id]
                const isCorrect = Array.isArray(q.correctAnswer)
                  ? JSON.stringify(userAnswer) === JSON.stringify(q.correctAnswer)
                  : userAnswer === q.correctAnswer
                const status = isCorrect ? '✓' : '✗'
                materialsInfo += `\n    ${status} ${q.question.substring(0, 80)}${q.question.length > 80 ? '...' : ''}`
                if (!isCorrect) {
                  materialsInfo += ` (Correct: ${Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer})`
                }
                if (q.explanation) {
                  materialsInfo += `\n      Explanation: ${q.explanation.substring(0, 100)}${q.explanation.length > 100 ? '...' : ''}`
                }
              }
              if (exam.questions.length > 10) {
                materialsInfo += `\n    ... and ${exam.questions.length - 10} more questions`
              }
            }
          } else {
            materialsInfo += ' - not attempted yet'
            // Still show questions for unatttempted exams so tutor can discuss them
            if (exam.questions && exam.questions.length > 0) {
              materialsInfo += `\n  ${exam.questions.length} questions available:`
              for (const q of exam.questions.slice(0, 5)) {
                materialsInfo += `\n    - ${q.question.substring(0, 80)}${q.question.length > 80 ? '...' : ''}`
              }
              if (exam.questions.length > 5) {
                materialsInfo += `\n    ... and ${exam.questions.length - 5} more questions`
              }
            }
          }
          materialsInfo += '\n'
        }
      }

      studyMaterialsContext = materialsInfo
    }
  }

  // Add behavioral profile instructions (personalized teaching approach)
  let behavioralInstructions = ''
  if (context.behavioralProfile) {
    behavioralInstructions = '\n\n' + generateTutorInstructions(
      context.behavioralProfile,
      context.currentCourse?.id
    )
  }

  // Academic integrity guidance based on mode
  const integrityGuidance =
    detectedMode === 'homework'
      ? `
IMPORTANT: The student appears to be seeking help with graded work. Follow these guidelines:
1. NEVER provide direct answers, complete solutions, or write content for them
2. Acknowledge their question warmly without judgment
3. Guide them through the problem-solving process with questions
4. Help them understand concepts, not just get answers
5. Suggest breaking the problem into smaller steps
6. If they push for answers, gently explain why learning the process matters more

Example redirect: "I can see you're working on [topic]. Instead of giving you the answer directly, let me help you work through this. What's your understanding of [relevant concept] so far?"
`
      : `
The student is in learning mode, seeking to understand concepts. You can be more direct with explanations while still encouraging active learning.
`

  return `You are a wise, supportive academic tutor - like the best TA a student could have. Your name is Study Buddy.

PERSONA:
- Warm but professional tone
- Encouraging without being condescending
- Patient and understanding
- Reference the student's actual courses, syllabus content, notes, and study materials when relevant
- Proactively check in on their progress when appropriate
- Use syllabus information to give accurate, course-specific guidance
- Reference practice exam performance to identify areas needing review

RESOURCE LINKING (IMPORTANT):
When you mention a student's note, study guide, or practice exam, you MUST use the exact link format provided below. This creates a clickable link for the student to view the resource.

Format: [[type:id:title]]
- For notes: [[note:id:title]]
- For study guides: [[guide:id:title]]
- For practice exams: [[exam:id:title]]

Example: "I see you have notes on this topic. Check out your [[note:abc123:Chapter 5 - Evolution]] for the section on Lamarck's theories."

ALWAYS use the exact ID and title from the resource list provided below. Never make up IDs. If you reference a resource, use the link format so the student can click to view it.

${behavioralInstructions}
${integrityGuidance}
${courseContext}
${deadlineContext}
${currentCourseContext}
${notesContext}
${studyMaterialsContext}

Today's date: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

Remember: Your goal is to help the student LEARN and develop skills, not just complete assignments. Guide them to discover answers themselves whenever possible. You have access to their syllabus, notes, study guides, and practice exam results - use this information to provide personalized guidance.`
}

/**
 * Convert a tutoring message to AI message format, handling images
 */
function toAIMessage(msg: TutoringMessage): AIMessage {
  // If no images, just return simple text content
  if (!msg.images || msg.images.length === 0) {
    return {
      role: msg.role,
      content: msg.content,
    }
  }

  // Build content array with text and images
  const content: AIMessageContent[] = []

  // Add text first if present
  if (msg.content) {
    content.push({ type: 'text', text: msg.content })
  }

  // Add images
  for (const img of msg.images) {
    // Extract base64 data from dataUrl (remove "data:image/png;base64," prefix)
    const base64Data = img.dataUrl.split(',')[1] || img.dataUrl
    content.push({
      type: 'image',
      image: {
        data: base64Data,
        mediaType: img.mimeType,
      },
    })
  }

  return {
    role: msg.role,
    content,
  }
}

/**
 * Send a message to the tutor and get a response
 */
export async function sendTutorMessage(
  message: string,
  history: TutoringMessage[],
  context: TutorContext,
  images?: TutoringMessageImage[]
): Promise<TutorResponse> {
  const provider = await getConfiguredProvider()

  if (!provider) {
    throw new Error('No AI provider configured. Please add an API key in Settings.')
  }

  // Check if we have images but provider doesn't support vision
  if (images && images.length > 0 && !provider.supportsVision()) {
    throw new Error('Your AI provider does not support image analysis. Please use Anthropic, OpenAI, or Google.')
  }

  // Detect intent
  const detectedMode = detectIntent(message, context)

  // Build system prompt with context
  const systemPrompt = buildSystemPrompt(context, detectedMode)

  // Convert history to AI messages (including any images in history)
  const messages: AIMessage[] = history.map(toAIMessage)

  // Add the new message with optional images
  const newMessage: TutoringMessage = {
    id: '',
    role: 'user',
    content: message,
    timestamp: new Date(),
    images,
  }
  messages.push(toAIMessage(newMessage))

  const response = await provider.complete({
    messages,
    systemPrompt,
    temperature: 0.7,
    maxTokens: 2048,
  })

  return {
    content: response.content,
    detectedMode,
    usage: response.usage,
  }
}

/**
 * Generate a greeting based on context
 */
export function generateGreeting(context: TutorContext): string {
  const hour = new Date().getHours()
  const timeGreeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  if (context.upcomingAssignments.length === 0 && context.courses.length === 0) {
    return `${timeGreeting}! I'm your Study Buddy. Upload a syllabus to get started, and I'll help you stay on top of your coursework.`
  }

  // Check if we have syllabus data
  const coursesWithSyllabus = context.courses.filter(c => c.syllabusData?.rawText)
  const hasNotes = context.notes.length > 0

  if (context.upcomingAssignments.length > 0) {
    const urgent = context.upcomingAssignments.filter((a) => {
      const daysUntil = differenceInDays(new Date(a.dueDate), new Date())
      return daysUntil <= 3 && daysUntil >= 0
    })

    if (urgent.length > 0) {
      const assignment = urgent[0]
      const course = context.courses.find((c) => c.id === assignment.courseId)
      const daysUntil = differenceInDays(new Date(assignment.dueDate), new Date())

      if (daysUntil === 0) {
        return `${timeGreeting}! Heads up - "${assignment.title}" for ${course?.code || 'your course'} is due today. Would you like help preparing?`
      } else if (daysUntil === 1) {
        return `${timeGreeting}! You have "${assignment.title}" due tomorrow for ${course?.code || 'your course'}. Ready to review some concepts?`
      } else {
        return `${timeGreeting}! "${assignment.title}" for ${course?.code || 'your course'} is coming up in ${daysUntil} days. How can I help you prepare?`
      }
    }
  }

  // Default greeting with context about available materials
  let greeting = `${timeGreeting}! I'm here to help with your studies.`

  if (coursesWithSyllabus.length > 0 || hasNotes) {
    const materials = []
    if (coursesWithSyllabus.length > 0) materials.push('your syllabi')
    if (hasNotes) materials.push('your notes')
    greeting += ` I have access to ${materials.join(' and ')}, so feel free to ask specific questions about your courses.`
  }

  greeting += ' What would you like to work on today?'
  return greeting
}
