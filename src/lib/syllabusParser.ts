import { getConfiguredProvider } from '@/lib/ai'
import type { AIMessageContent } from '@/lib/ai/types'
import type { AssignmentType, DayOfWeek, ClassMeeting } from '@/types'
import { format } from 'date-fns'

export interface ParsedCourse {
  name: string
  code: string
  instructor?: string
  description?: string
  confidence: number
}

export interface ParsedAssignment {
  title: string
  type: AssignmentType
  dueDate: string // ISO date string
  weight?: number
  description?: string
  confidence: number
  boundingBox?: BoundingBox // Location in source image
}

export interface SyllabusParseResult {
  course: ParsedCourse
  assignments: ParsedAssignment[]
  rawResponse: string
}

// Context for parsing syllabus when course already exists
export interface CourseContext {
  name: string
  code: string
  semesterStart?: Date
  semesterEnd?: Date
  schedule?: ClassMeeting[]
}

// Bounding box for highlighting extracted data in images
export interface BoundingBox {
  imageIndex: number // Which image (0-indexed) this box refers to
  x: number // X coordinate (0-1000 normalized)
  y: number // Y coordinate (0-1000 normalized)
  width: number // Width (0-1000 normalized)
  height: number // Height (0-1000 normalized)
}

// Single meeting time for a course
export interface ParsedMeetingTime {
  days: DayOfWeek[]
  startTime: string
  endTime: string
  location?: string
}

// Parsed course schedule entry (can have multiple meeting times)
export interface ParsedScheduleEntry {
  name: string
  code: string
  instructor?: string
  days: DayOfWeek[]
  startTime: string
  endTime: string
  location?: string
  confidence: number
  imageIndex?: number // Which image this course appears in (0-indexed)
  classStartDate?: string // When the class begins (ISO date YYYY-MM-DD)
  classEndDate?: string // When the class ends (ISO date YYYY-MM-DD)
  // For merged courses with multiple meeting times
  schedules?: ParsedMeetingTime[]
}

const SYLLABUS_PARSE_PROMPT = `You are an expert at extracting structured information from academic syllabi.
Analyze the provided syllabus content and extract:

1. Course Information:
   - Course name
   - Course code (e.g., "CS101", "MATH 201")
   - Instructor name (if mentioned)
   - Course description (brief summary)

2. Assignments/Deadlines:
   For each assignment, exam, project, or graded item, extract:
   - Title/name of the assignment
   - Type: one of "exam", "paper", "homework", "project", "quiz", "other"
   - Due date (in ISO format YYYY-MM-DD). If only a relative date is given (e.g., "Week 5"), estimate based on a typical semester starting in late August or January.
   - Weight/percentage of grade (if mentioned)
   - Brief description
   - Bounding box: The region in the image where this assignment info appears (if from image)
     - imageIndex: which image (0-indexed)
     - x, y: top-left corner position (0-1000 scale, where 1000 = full width/height)
     - width, height: size of the region (0-1000 scale)

IMPORTANT - Multiple Images:
- If multiple images are provided, treat them as parts of the SAME document
- Images are numbered starting from 0 (first image = 0, second image = 1, etc.)
- Include bounding boxes only when parsing from images

Be aggressive in extraction - it's better to extract something that might be wrong than to miss an assignment.

Respond with valid JSON in this exact format:
{
  "course": {
    "name": "Course Name",
    "code": "CODE101",
    "instructor": "Professor Name or null",
    "description": "Brief description",
    "confidence": 0.95
  },
  "assignments": [
    {
      "title": "Assignment Title",
      "type": "homework",
      "dueDate": "2025-09-15",
      "weight": 10,
      "description": "Brief description",
      "confidence": 0.85,
      "boundingBox": {
        "imageIndex": 0,
        "x": 50,
        "y": 200,
        "width": 900,
        "height": 60
      }
    }
  ]
}

The confidence score (0.0 to 1.0) indicates how certain you are about the extracted information:
- 0.9-1.0: Very confident (explicitly stated in syllabus)
- 0.7-0.9: Confident (clearly implied)
- 0.5-0.7: Moderate (some inference required)
- Below 0.5: Low confidence (significant guessing)

If dates are ambiguous, use the current academic year. Today's date for reference: ${new Date().toISOString().split('T')[0]}`

/**
 * Parse a syllabus using AI to extract course info and assignments
 */
export async function parseSyllabus(
  text: string,
  images: Array<{ data: string; mediaType: string }> = []
): Promise<SyllabusParseResult> {
  const provider = await getConfiguredProvider()

  if (!provider) {
    throw new Error('No AI provider configured. Please add an API key in Settings.')
  }

  // Build message content
  const content: AIMessageContent[] = []

  // Add any images first (for vision models)
  if (images.length > 0 && provider.supportsVision()) {
    for (const image of images) {
      content.push({
        type: 'image',
        image: {
          data: image.data,
          mediaType: image.mediaType,
        },
      })
    }
    content.push({
      type: 'text',
      text: 'Please analyze this syllabus image and extract the course information and assignments.',
    })
  }

  // Add extracted text
  if (text) {
    content.push({
      type: 'text',
      text: text
        ? `Here is the syllabus content:\n\n${text}`
        : 'Please analyze the syllabus image(s) provided above.',
    })
  }

  // If no content, throw error
  if (content.length === 0) {
    throw new Error('No content to parse. Please provide text or images.')
  }

  const response = await provider.complete({
    messages: [
      {
        role: 'user',
        content: content.length === 1 && content[0].type === 'text'
          ? content[0].text!
          : content,
      },
    ],
    systemPrompt: SYLLABUS_PARSE_PROMPT,
    temperature: 0.1, // Low temperature for more consistent extraction
    maxTokens: 4096,
  })

  // Parse the JSON response
  const jsonMatch = response.content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response as JSON')
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return {
      course: parsed.course,
      assignments: parsed.assignments || [],
      rawResponse: response.content,
    }
  } catch {
    throw new Error('Failed to parse AI response: Invalid JSON')
  }
}

/**
 * Validate and clean parsed assignments
 */
export function validateAssignments(
  assignments: ParsedAssignment[]
): ParsedAssignment[] {
  return assignments
    .filter((a) => a.title && a.dueDate)
    .map((a) => ({
      ...a,
      // Ensure valid type
      type: isValidAssignmentType(a.type) ? a.type : 'other',
      // Ensure valid confidence
      confidence: Math.max(0, Math.min(1, a.confidence || 0.5)),
      // Ensure valid weight
      weight: a.weight ? Math.max(0, Math.min(100, a.weight)) : undefined,
    }))
}

function isValidAssignmentType(type: string): type is AssignmentType {
  return ['exam', 'paper', 'homework', 'project', 'quiz', 'other'].includes(type)
}

/**
 * Get a color for confidence score display
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'text-green-600'
  if (confidence >= 0.7) return 'text-yellow-600'
  if (confidence >= 0.5) return 'text-orange-500'
  return 'text-red-500'
}

/**
 * Get a label for confidence score
 */
export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.9) return 'High'
  if (confidence >= 0.7) return 'Good'
  if (confidence >= 0.5) return 'Medium'
  return 'Low'
}

// Prompt for parsing syllabus with course context (assignments only)
function getSyllabusWithContextPrompt(context: CourseContext): string {
  const semesterInfo = context.semesterStart
    ? `The semester starts on ${format(context.semesterStart, 'MMMM d, yyyy')}.`
    : ''

  return `You are an expert at extracting assignment information from academic syllabi.
The course is: ${context.code} - ${context.name}
${semesterInfo}

Extract ALL assignments, exams, quizzes, projects, papers, and other graded items.

IMPORTANT: For dates given as "Week X" format:
- Week 1 starts on the semester start date
- Calculate the actual date by adding (X-1) weeks to the semester start
${context.semesterStart ? `- For this syllabus, Week 1 = ${format(context.semesterStart, 'MMMM d, yyyy')}` : ''}

For each item extract:
- Title/name
- Type: one of "exam", "paper", "homework", "project", "quiz", "other"
- Due date in ISO format (YYYY-MM-DD)
- Weight/percentage if mentioned
- Brief description
- Bounding box: The region in the image where this assignment info appears (if from image)
  - imageIndex: which image (0-indexed)
  - x, y: top-left corner position (0-1000 scale, where 1000 = full width/height)
  - width, height: size of the region (0-1000 scale)

IMPORTANT - Multiple Images:
- If multiple images are provided, treat them as parts of the SAME document
- Images are numbered starting from 0 (first image = 0, second image = 1, etc.)

Respond with valid JSON:
{
  "assignments": [
    {
      "title": "Assignment Title",
      "type": "homework",
      "dueDate": "2025-09-15",
      "weight": 10,
      "description": "Brief description",
      "confidence": 0.85,
      "boundingBox": {
        "imageIndex": 0,
        "x": 50,
        "y": 200,
        "width": 900,
        "height": 60
      }
    }
  ]
}

Today's date: ${new Date().toISOString().split('T')[0]}`
}

/**
 * Parse a syllabus for an existing course (extract assignments only)
 */
export async function parseSyllabusForCourse(
  text: string,
  images: Array<{ data: string; mediaType: string }>,
  context: CourseContext
): Promise<ParsedAssignment[]> {
  const provider = await getConfiguredProvider()

  if (!provider) {
    throw new Error('No AI provider configured. Please add an API key in Settings.')
  }

  const content: AIMessageContent[] = []

  if (images.length > 0 && provider.supportsVision()) {
    for (const image of images) {
      content.push({
        type: 'image',
        image: {
          data: image.data,
          mediaType: image.mediaType,
        },
      })
    }
    content.push({
      type: 'text',
      text: 'Please analyze this syllabus image and extract the assignments.',
    })
  }

  if (text) {
    content.push({
      type: 'text',
      text: `Here is the syllabus content:\n\n${text}`,
    })
  }

  if (content.length === 0) {
    throw new Error('No content to parse.')
  }

  const response = await provider.complete({
    messages: [
      {
        role: 'user',
        content: content.length === 1 && content[0].type === 'text'
          ? content[0].text!
          : content,
      },
    ],
    systemPrompt: getSyllabusWithContextPrompt(context),
    temperature: 0.1,
    maxTokens: 4096,
  })

  const jsonMatch = response.content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response as JSON')
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    let assignments = parsed.assignments || []

    // Post-process: convert "Week X" dates if we have semester start
    if (context.semesterStart) {
      assignments = assignments.map((a: ParsedAssignment) => {
        // If the AI returned a week-based estimate, it might have already calculated
        // But let's validate any obviously old dates
        const dueDate = new Date(a.dueDate)
        const semesterStart = context.semesterStart!

        // If date is before semester start or more than 6 months before, it might be wrong year
        if (dueDate < semesterStart) {
          // Try adding a year
          dueDate.setFullYear(dueDate.getFullYear() + 1)
          return { ...a, dueDate: format(dueDate, 'yyyy-MM-dd') }
        }

        return a
      })
    }

    return validateAssignments(assignments)
  } catch {
    throw new Error('Failed to parse AI response: Invalid JSON')
  }
}

// Prompt for parsing course schedules
const COURSE_SCHEDULE_PROMPT = `You are an expert at extracting course schedule information from academic documents.
Analyze the provided course schedule and extract all courses listed.

IMPORTANT RULES:
- If multiple images are provided, they are consecutive pages of the SAME document
- A course may appear partially at the bottom of one image and fully in the next - only include it ONCE
- A single course may have MULTIPLE meeting times (e.g., lecture MWF 9-10am AND lab T 2-4pm)
- Create a SEPARATE entry for EACH meeting time, even if they're the same course
- We will merge entries with the same course code automatically

For each meeting time extract:
- Course code (e.g., "CHEM 101", "MATH 201")
- Course name
- Instructor name (if shown)
- Meeting days (array of: "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
- Start time (in 24hr format HH:MM)
- End time (in 24hr format HH:MM)
- Location/room (if shown)
- imageIndex: which image this appears in (0 = first image, 1 = second image, etc.)
- classStartDate: when the class begins (ISO format YYYY-MM-DD, e.g., "Class Begin: 01/12/2026" → "2026-01-12")
- classEndDate: when the class ends (ISO format YYYY-MM-DD, e.g., "Class End: 05/01/2026" → "2026-05-01")

Common abbreviations:
- M = Monday, T = Tuesday, W = Wednesday, Th or R = Thursday, F = Friday
- MWF = Monday, Wednesday, Friday
- TTh or TR = Tuesday, Thursday

IDENTIFYING MEETING DAYS - Common Visual Patterns:
Different schedules represent meeting days in various ways. Look for these patterns:

1. TEXT ABBREVIATIONS: "MWF", "TTh", "TR", "MW", "M/W/F", "Tues/Thurs"
2. COLORED/HIGHLIGHTED BOXES: Row of day letters (S M T W T F S) where colored/filled boxes = meeting days
3. CHECKMARKS OR X MARKS: Days with ✓, ✗, or X marks indicating selected days
4. FILLED VS EMPTY: Filled circles ●, squares ■, or boxes vs empty ones ○, □
5. BOLD OR STYLED TEXT: Bold, underlined, or differently-colored day letters
6. CALENDAR GRIDS: Shaded or marked cells in a weekly calendar view
7. BULLET LISTS: Days listed explicitly (e.g., "Days: Monday, Wednesday, Friday")

Key principle: Look for VISUAL CONTRAST - whatever stands out as different (colored, filled, marked, bold) indicates the meeting days. The unmarked/plain items are non-meeting days.

CRITICAL - BE PRECISE:
- Count EXACTLY which boxes/days are marked. Do NOT assume "all weekdays" if only some are colored.
- MWF (Monday, Wednesday, Friday) = 3 days, NOT 5 days. Tuesday and Thursday are DIFFERENT boxes.
- If boxes for M, W, F are colored but T (Tuesday) and T (Thursday) are NOT colored → days are ONLY ["monday", "wednesday", "friday"]
- If ALL five weekday boxes are colored → days are ["monday", "tuesday", "wednesday", "thursday", "friday"]
- Online/asynchronous courses typically have NO meeting days → return empty array []
- Hybrid courses may have fewer in-person days than traditional courses

Common mistakes to avoid:
- Do NOT return all 5 weekdays when only 3 are marked (e.g., MWF pattern)
- Do NOT confuse the two "T" boxes - first T is Tuesday, second T (or R/Th) is Thursday
- Examine EACH box individually to determine if it is colored/marked or not

Respond with valid JSON:
{
  "courses": [
    {
      "code": "CHEM 101",
      "name": "Introduction to Chemistry",
      "instructor": "Dr. Smith",
      "days": ["monday", "wednesday", "friday"],
      "startTime": "09:00",
      "endTime": "09:50",
      "location": "Science Hall 101",
      "confidence": 0.9,
      "imageIndex": 0,
      "classStartDate": "2026-01-12",
      "classEndDate": "2026-05-01"
    },
    {
      "code": "CHEM 101",
      "name": "Introduction to Chemistry",
      "instructor": "Dr. Smith",
      "days": ["tuesday"],
      "startTime": "14:00",
      "endTime": "16:00",
      "location": "Lab 201",
      "confidence": 0.9,
      "imageIndex": 0,
      "classStartDate": "2026-01-12",
      "classEndDate": "2026-05-01"
    }
  ]
}

confidence score (0.0 to 1.0) indicates certainty of extraction.`

/**
 * Parse a course schedule document to extract courses
 */
export async function parseCourseSchedule(
  text: string,
  images: Array<{ data: string; mediaType: string }> = []
): Promise<ParsedScheduleEntry[]> {
  const provider = await getConfiguredProvider()

  if (!provider) {
    throw new Error('No AI provider configured. Please add an API key in Settings.')
  }

  const content: AIMessageContent[] = []

  if (images.length > 0 && provider.supportsVision()) {
    for (const image of images) {
      content.push({
        type: 'image',
        image: {
          data: image.data,
          mediaType: image.mediaType,
        },
      })
    }
    content.push({
      type: 'text',
      text: 'Please analyze this course schedule and extract all courses.',
    })
  }

  if (text) {
    content.push({
      type: 'text',
      text: `Here is the course schedule:\n\n${text}`,
    })
  }

  if (content.length === 0) {
    throw new Error('No content to parse.')
  }

  const response = await provider.complete({
    messages: [
      {
        role: 'user',
        content: content.length === 1 && content[0].type === 'text'
          ? content[0].text!
          : content,
      },
    ],
    systemPrompt: COURSE_SCHEDULE_PROMPT,
    temperature: 0.1,
    maxTokens: 4096,
  })

  const jsonMatch = response.content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response as JSON')
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    const entries = (parsed.courses || []).map((c: ParsedScheduleEntry) => ({
      ...c,
      days: validateDays(c.days),
      confidence: Math.max(0, Math.min(1, c.confidence || 0.5)),
    }))
    // Merge courses with the same code into single entries with multiple schedules
    return mergeCoursesByCode(entries)
  } catch {
    throw new Error('Failed to parse AI response: Invalid JSON')
  }
}

function validateDays(days: string[]): DayOfWeek[] {
  const validDays: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  return days.filter((d): d is DayOfWeek => validDays.includes(d as DayOfWeek))
}

/**
 * Merge multiple entries with the same course code into single entries with multiple schedules
 */
function mergeCoursesByCode(entries: ParsedScheduleEntry[]): ParsedScheduleEntry[] {
  const courseMap = new Map<string, ParsedScheduleEntry>()

  for (const entry of entries) {
    const existing = courseMap.get(entry.code)

    if (existing) {
      // Add this entry's schedule to the existing course
      if (!existing.schedules) {
        // Convert the first entry's single schedule to array format
        existing.schedules = [{
          days: existing.days,
          startTime: existing.startTime,
          endTime: existing.endTime,
          location: existing.location,
        }]
      }
      // Add the new schedule
      existing.schedules.push({
        days: entry.days,
        startTime: entry.startTime,
        endTime: entry.endTime,
        location: entry.location,
      })
      // Keep the higher confidence
      existing.confidence = Math.max(existing.confidence, entry.confidence)
      // Prefer non-empty instructor
      if (!existing.instructor && entry.instructor) {
        existing.instructor = entry.instructor
      }
      // Keep the first imageIndex (or prefer the one that's defined)
      if (existing.imageIndex === undefined && entry.imageIndex !== undefined) {
        existing.imageIndex = entry.imageIndex
      }
      // Keep class dates (prefer defined values)
      if (!existing.classStartDate && entry.classStartDate) {
        existing.classStartDate = entry.classStartDate
      }
      if (!existing.classEndDate && entry.classEndDate) {
        existing.classEndDate = entry.classEndDate
      }
    } else {
      // First time seeing this course code
      courseMap.set(entry.code, { ...entry })
    }
  }

  return Array.from(courseMap.values())
}
