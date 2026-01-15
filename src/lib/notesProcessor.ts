import { getConfiguredProvider } from '@/lib/ai'
import type { Note, NoteImage, StudyMaterial, PracticeQuestion, QuestionType, BloomLevel } from '@/types'

// Valid image types for Anthropic API
const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type ValidImageType = typeof VALID_IMAGE_TYPES[number]

/**
 * Normalize mimeType to a valid type for the AI API
 * Falls back to 'image/jpeg' for unsupported types like HEIC
 */
function normalizeImageType(mimeType: string): ValidImageType {
  if (VALID_IMAGE_TYPES.includes(mimeType as ValidImageType)) {
    return mimeType as ValidImageType
  }
  // Default to jpeg for unsupported types (HEIC should have been converted, but just in case)
  console.warn(`Unsupported image type "${mimeType}", falling back to image/jpeg`)
  return 'image/jpeg'
}

export interface ProcessedNote {
  extractedText: string
  aiSummary: string
  topics: string[]
  suggestedTitle: string  // AI-generated title based on content
  detectedCourseCode?: string  // Course code if detected in notes (e.g., "MATH 101")
}

export interface GeneratedStudyGuide {
  title: string
  content: string // markdown
  keyTerms: { term: string; definition: string }[]
  conceptMap: string // markdown representation
}

export interface GeneratedPracticeExam {
  title: string
  questions: PracticeQuestion[]
}

/**
 * Process note images using AI vision to extract text and summarize
 */
export async function processNoteImages(
  images: NoteImage[],
  courseContext?: { name: string; code: string }
): Promise<ProcessedNote> {
  const provider = await getConfiguredProvider()

  if (!provider) {
    throw new Error('No AI provider configured. Please add an API key in Settings.')
  }

  if (!provider.supportsVision()) {
    throw new Error('Your configured AI provider does not support vision. Please use a vision-capable model.')
  }

  // Build the message with images
  const content = images.map((img) => ({
    type: 'image' as const,
    image: {
      data: img.dataUrl.includes(',') ? img.dataUrl.split(',')[1] : img.dataUrl,
      mediaType: normalizeImageType(img.mimeType),
    },
  }))

  const courseInfo = courseContext
    ? `These are notes from ${courseContext.code}: ${courseContext.name}.`
    : 'These are student notes. Look for any course code or class name written on the notes.'

  const systemPrompt = `You are an expert at reading and understanding handwritten and typed notes. ${courseInfo}

Analyze these note images and provide:
1. A complete transcription of all text content (be thorough - capture everything)
2. A concise summary of the key concepts (2-3 sentences max)
3. A list of main topics covered (most important/descriptive topics first)
4. A suggested title for these notes (short and descriptive, like "Chapter 5: Derivatives" or "Cell Membrane Structure")
5. If you can identify a course code (like "MATH 101", "CHEM 201", "BIO 110"), include it

Format your response as JSON:
{
  "extractedText": "Full transcription of notes...",
  "summary": "Concise summary of key concepts...",
  "topics": ["Most Important Topic", "Second Topic", ...],
  "suggestedTitle": "Descriptive Title for Notes",
  "detectedCourseCode": "COURSE 101" or null if not found
}

Be thorough in transcription but concise in summary. Focus on academic content.
For topics, list them in order of importance/relevance, with the most descriptive topics first.`

  const response = await provider.complete({
    messages: [
      {
        role: 'user',
        content: [
          ...content,
          { type: 'text' as const, text: 'Please analyze these notes and extract the content.' },
        ],
      },
    ],
    systemPrompt,
    temperature: 0.3,
    maxTokens: 4096,
  })

  // Parse the JSON response
  try {
    // Find JSON in the response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])
    return {
      extractedText: parsed.extractedText || '',
      aiSummary: parsed.summary || '',
      topics: parsed.topics || [],
      suggestedTitle: parsed.suggestedTitle || 'Untitled Notes',
      detectedCourseCode: parsed.detectedCourseCode || undefined,
    }
  } catch {
    // If parsing fails, use the raw response and generate a basic title
    const now = new Date()
    return {
      extractedText: response.content,
      aiSummary: '',
      topics: [],
      suggestedTitle: `Notes - ${now.toLocaleDateString()}`,
      detectedCourseCode: undefined,
    }
  }
}

/**
 * Generate a study guide from notes
 */
export async function generateStudyGuide(
  notes: Note[],
  courseContext?: { name: string; code: string }
): Promise<GeneratedStudyGuide> {
  const provider = await getConfiguredProvider()

  if (!provider) {
    throw new Error('No AI provider configured. Please add an API key in Settings.')
  }

  // Combine all note content
  const noteContent = notes
    .map((n) => {
      let content = `## ${n.title}\n`
      if (n.extractedText) content += n.extractedText + '\n'
      if (n.aiSummary) content += `Summary: ${n.aiSummary}\n`
      if (n.topics.length > 0) content += `Topics: ${n.topics.join(', ')}\n`
      return content
    })
    .join('\n---\n')

  const courseInfo = courseContext
    ? `for ${courseContext.code}: ${courseContext.name}`
    : ''

  const systemPrompt = `You are an expert educator creating study materials. Generate a comprehensive study guide ${courseInfo} based on the provided notes.

The study guide should include:
1. A clear title
2. Organized content in markdown format with headers, bullet points, and emphasis
3. Key terms with definitions
4. A concept map showing relationships between ideas

Format your response as JSON:
{
  "title": "Study Guide: [Topic]",
  "content": "# Main Topic\\n\\n## Section 1\\n...(full markdown content)",
  "keyTerms": [
    {"term": "Term 1", "definition": "Definition..."},
    ...
  ],
  "conceptMap": "# Concept Map\\n\\n- Main Concept\\n  - Sub-concept 1\\n    - Detail\\n  - Sub-concept 2\\n..."
}

Make the content thorough, well-organized, and student-friendly.`

  const response = await provider.complete({
    messages: [
      {
        role: 'user',
        content: `Please create a study guide from these notes:\n\n${noteContent}`,
      },
    ],
    systemPrompt,
    temperature: 0.5,
    maxTokens: 4096,
  })

  // Parse the JSON response
  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])
    return {
      title: parsed.title || 'Study Guide',
      content: parsed.content || response.content,
      keyTerms: parsed.keyTerms || [],
      conceptMap: parsed.conceptMap || '',
    }
  } catch {
    return {
      title: 'Study Guide',
      content: response.content,
      keyTerms: [],
      conceptMap: '',
    }
  }
}

/**
 * Generate practice exam questions from notes
 */
export async function generatePracticeExam(
  notes: Note[],
  options: {
    questionCount?: number
    questionTypes?: QuestionType[]
    bloomLevels?: BloomLevel[]
    courseContext?: { name: string; code: string }
  } = {}
): Promise<GeneratedPracticeExam> {
  const provider = await getConfiguredProvider()

  if (!provider) {
    throw new Error('No AI provider configured. Please add an API key in Settings.')
  }

  const {
    questionCount = 10,
    questionTypes = ['multiple_choice', 'fill_in_blank', 'free_form'],
    bloomLevels = ['knowledge', 'comprehension', 'application'],
    courseContext,
  } = options

  // Combine all note content
  const noteContent = notes
    .map((n) => {
      let content = `## ${n.title}\n`
      if (n.extractedText) content += n.extractedText + '\n'
      if (n.aiSummary) content += `Summary: ${n.aiSummary}\n`
      return content
    })
    .join('\n---\n')

  const courseInfo = courseContext
    ? `for ${courseContext.code}: ${courseContext.name}`
    : ''

  const systemPrompt = `You are an expert educator creating practice exam questions ${courseInfo}.

Generate ${questionCount} practice questions based on the provided notes.

Question type distribution:
${questionTypes.map((t) => `- ${t}`).join('\n')}

Bloom's taxonomy levels to cover:
${bloomLevels.map((l) => `- ${l}`).join('\n')}

Format your response as JSON:
{
  "title": "Practice Exam: [Topic]",
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "bloomLevel": "knowledge",
      "question": "Question text...",
      "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
      "correctAnswer": "A) Option 1",
      "explanation": "Explanation of why this is correct..."
    },
    {
      "id": "q2",
      "type": "fill_in_blank",
      "bloomLevel": "comprehension",
      "question": "The _____ is responsible for...",
      "correctAnswer": "term",
      "explanation": "Explanation..."
    },
    {
      "id": "q3",
      "type": "free_form",
      "bloomLevel": "application",
      "question": "Explain how...",
      "correctAnswer": "A good answer would include...",
      "explanation": "Key points to cover..."
    }
  ]
}

Make questions challenging but fair, and ensure they test understanding of the material.`

  const response = await provider.complete({
    messages: [
      {
        role: 'user',
        content: `Please create a practice exam from these notes:\n\n${noteContent}`,
      },
    ],
    systemPrompt,
    temperature: 0.7,
    maxTokens: 4096,
  })

  // Parse the JSON response
  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])
    return {
      title: parsed.title || 'Practice Exam',
      questions: (parsed.questions || []).map((q: PracticeQuestion, i: number) => ({
        ...q,
        id: q.id || `q${i + 1}`,
      })),
    }
  } catch {
    return {
      title: 'Practice Exam',
      questions: [],
    }
  }
}

/**
 * Export study material to markdown
 */
export function exportToMarkdown(material: StudyMaterial): string {
  let markdown = `# ${material.title}\n\n`
  markdown += `*Created: ${new Date(material.createdAt).toLocaleDateString()}*\n\n`

  if (material.type === 'guide') {
    markdown += material.content
  } else if (material.type === 'practice_exam' && material.questions) {
    markdown += '---\n\n'
    material.questions.forEach((q, i) => {
      markdown += `## Question ${i + 1}\n\n`
      markdown += `**Type:** ${q.type} | **Level:** ${q.bloomLevel}\n\n`
      markdown += `${q.question}\n\n`

      if (q.options) {
        q.options.forEach((opt) => {
          markdown += `- ${opt}\n`
        })
        markdown += '\n'
      }

      markdown += `<details>\n<summary>Answer</summary>\n\n`
      markdown += `**Answer:** ${Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer}\n\n`
      if (q.explanation) {
        markdown += `**Explanation:** ${q.explanation}\n`
      }
      markdown += `</details>\n\n---\n\n`
    })
  }

  return markdown
}

/**
 * Export study material to PDF
 * Uses jsPDF directly to avoid html2canvas iframe issues with oklch colors
 */
export async function exportToPdf(material: StudyMaterial): Promise<void> {
  // Dynamically import jspdf
  const { jsPDF } = await import('jspdf')

  const markdown = exportToMarkdown(material)

  // Create PDF document
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40
  const maxWidth = pageWidth - margin * 2
  let y = margin

  // Helper to add new page if needed
  const checkNewPage = (height: number) => {
    if (y + height > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
  }

  // Parse markdown into lines and render
  const lines = markdown.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      y += 8
      continue
    }

    // Headers
    if (trimmed.startsWith('# ')) {
      checkNewPage(30)
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      const text = trimmed.slice(2)
      const splitText = doc.splitTextToSize(text, maxWidth)
      doc.text(splitText, margin, y)
      y += splitText.length * 24 + 8
      // Underline
      doc.setDrawColor(100)
      doc.line(margin, y - 4, pageWidth - margin, y - 4)
      y += 8
    } else if (trimmed.startsWith('## ')) {
      checkNewPage(24)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      const text = trimmed.slice(3)
      const splitText = doc.splitTextToSize(text, maxWidth)
      doc.text(splitText, margin, y)
      y += splitText.length * 20 + 6
    } else if (trimmed.startsWith('### ')) {
      checkNewPage(20)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      const text = trimmed.slice(4)
      const splitText = doc.splitTextToSize(text, maxWidth)
      doc.text(splitText, margin, y)
      y += splitText.length * 18 + 4
    } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      // Bold text
      checkNewPage(16)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      const text = trimmed.slice(2, -2)
      const splitText = doc.splitTextToSize(text, maxWidth)
      doc.text(splitText, margin, y)
      y += splitText.length * 14 + 4
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      // List item
      checkNewPage(16)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      const text = trimmed.slice(2)
      const splitText = doc.splitTextToSize(text, maxWidth - 15)
      doc.text('•', margin, y)
      doc.text(splitText, margin + 15, y)
      y += splitText.length * 14 + 2
    } else if (trimmed === '---') {
      // Horizontal rule
      checkNewPage(16)
      doc.setDrawColor(200)
      doc.line(margin, y, pageWidth - margin, y)
      y += 16
    } else if (trimmed.startsWith('*') && trimmed.endsWith('*') && !trimmed.startsWith('**')) {
      // Italic text (like date)
      checkNewPage(16)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(100)
      const text = trimmed.slice(1, -1)
      doc.text(text, margin, y)
      doc.setTextColor(0)
      y += 14
    } else if (trimmed.startsWith('<details>') || trimmed.startsWith('</details>') ||
               trimmed.startsWith('<summary>') || trimmed.includes('</summary>')) {
      // Skip HTML tags for details/summary
      continue
    } else {
      // Regular paragraph - handle inline bold
      checkNewPage(16)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')

      // Remove markdown formatting for PDF
      const text = trimmed
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`(.*?)`/g, '$1')

      const splitText = doc.splitTextToSize(text, maxWidth)
      doc.text(splitText, margin, y)
      y += splitText.length * 14 + 4
    }
  }

  // Save the PDF
  doc.save(`${material.title.replace(/[^a-z0-9]/gi, '_')}.pdf`)
}
