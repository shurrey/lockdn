/**
 * Exam Grading Utilities
 *
 * Provides smart grading for practice exams:
 * - Multiple choice: exact match
 * - Fill in blank: case-insensitive + fuzzy matching for typos
 * - Free form: AI-based grading with 0-10 scale and feedback
 */

import { getConfiguredProvider } from './ai'
import type { PracticeQuestion } from '@/types'

export interface GradeResult {
  isCorrect: boolean
  score: number // 0-10 scale
  feedback?: string
  spellingNote?: string
  partialCredit?: boolean
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Calculate similarity percentage between two strings
 */
function stringSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 100
  const distance = levenshteinDistance(a, b)
  return Math.round((1 - distance / maxLen) * 100)
}

/**
 * Grade a multiple choice answer - exact match required
 */
export function gradeMultipleChoice(
  userAnswer: string | undefined,
  correctAnswer: string
): GradeResult {
  const isCorrect = userAnswer === correctAnswer
  return {
    isCorrect,
    score: isCorrect ? 10 : 0,
  }
}

/**
 * Grade a fill-in-blank answer with fuzzy matching
 * - Exact match (case-insensitive): full credit
 * - Close match (>80% similarity): full credit with spelling note
 * - Somewhat close (>60% similarity): partial credit
 */
export function gradeFillInBlank(
  userAnswer: string | undefined,
  correctAnswer: string
): GradeResult {
  if (!userAnswer) {
    return { isCorrect: false, score: 0 }
  }

  const userNormalized = userAnswer.trim().toLowerCase()
  const correctNormalized = correctAnswer.trim().toLowerCase()

  // Exact match (case-insensitive)
  if (userNormalized === correctNormalized) {
    // Check if original casing was different
    const caseDifferent = userAnswer.trim() !== correctAnswer.trim() &&
                          userNormalized === correctNormalized
    return {
      isCorrect: true,
      score: 10,
      spellingNote: caseDifferent ? `Note: The expected capitalization is "${correctAnswer}"` : undefined,
    }
  }

  // Fuzzy match
  const similarity = stringSimilarity(userNormalized, correctNormalized)

  if (similarity >= 85) {
    // Very close - count as correct but note the spelling
    return {
      isCorrect: true,
      score: 10,
      spellingNote: `Close! The correct spelling is "${correctAnswer}"`,
      partialCredit: false,
    }
  } else if (similarity >= 70) {
    // Somewhat close - partial credit
    return {
      isCorrect: false,
      score: 5,
      feedback: `Partial credit. Your answer "${userAnswer}" is close to "${correctAnswer}"`,
      partialCredit: true,
    }
  }

  // Not close enough
  return {
    isCorrect: false,
    score: 0,
  }
}

/**
 * Grade a free-form answer using AI
 * Returns a score 0-10 with detailed feedback
 */
export async function gradeFreeForm(
  userAnswer: string | undefined,
  correctAnswer: string,
  question: string
): Promise<GradeResult> {
  if (!userAnswer || userAnswer.trim().length === 0) {
    return {
      isCorrect: false,
      score: 0,
      feedback: 'No answer provided',
    }
  }

  const prompt = `You are grading a student's answer to a practice exam question. Grade it on a scale of 0-10.

Question: ${question}

Expected answer (reference): ${correctAnswer}

Student's answer: ${userAnswer}

Evaluate the student's answer based on:
1. Accuracy of key concepts
2. Completeness (are important points covered?)
3. Understanding demonstrated

Respond in this exact JSON format:
{
  "score": <number 0-10>,
  "isCorrect": <true if score >= 7, false otherwise>,
  "whatWasRight": "<brief list of correct points, or 'Nothing correct' if score is 0>",
  "whatWasMissing": "<brief list of missing or incorrect points, or 'Nothing missing' if score is 10>",
  "feedback": "<1-2 sentence summary of the grade>"
}

Be fair but rigorous. A score of 7+ means the answer demonstrates good understanding of the key concepts, even if not perfectly worded.`

  try {
    const provider = await getConfiguredProvider()
    if (!provider) {
      throw new Error('No AI provider configured')
    }

    const response = await provider.complete({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 500,
      temperature: 0.3,
    })

    // Parse the JSON response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const result = JSON.parse(jsonMatch[0])
    const score = Math.min(10, Math.max(0, Number(result.score) || 0))
    const isCorrect = score >= 7

    let feedback = result.feedback || ''
    if (result.whatWasRight && result.whatWasRight !== 'Nothing correct') {
      feedback += `\n\n**What was right:** ${result.whatWasRight}`
    }
    if (result.whatWasMissing && result.whatWasMissing !== 'Nothing missing') {
      feedback += `\n\n**What was missing:** ${result.whatWasMissing}`
    }

    return {
      isCorrect,
      score,
      feedback: feedback.trim(),
      partialCredit: score > 0 && score < 7,
    }
  } catch (error) {
    console.error('AI grading failed:', error)
    // Fallback to simple comparison
    const similarity = stringSimilarity(
      userAnswer.toLowerCase(),
      correctAnswer.toLowerCase()
    )
    const score = Math.round(similarity / 10)
    return {
      isCorrect: score >= 7,
      score,
      feedback: 'AI grading unavailable. Score based on text similarity.',
      partialCredit: score > 0 && score < 7,
    }
  }
}

/**
 * Grade a single question based on its type
 */
export async function gradeQuestion(
  question: PracticeQuestion,
  userAnswer: string | string[] | undefined
): Promise<GradeResult> {
  const answer = Array.isArray(userAnswer) ? userAnswer.join(', ') : userAnswer
  const correct = Array.isArray(question.correctAnswer)
    ? question.correctAnswer.join(', ')
    : question.correctAnswer

  switch (question.type) {
    case 'multiple_choice':
      return gradeMultipleChoice(answer, correct)

    case 'fill_in_blank':
      return gradeFillInBlank(answer, correct)

    case 'free_form':
      return gradeFreeForm(answer, correct, question.question)

    case 'matching':
      // For matching, do exact comparison for now
      return gradeMultipleChoice(answer, correct)

    default:
      return gradeMultipleChoice(answer, correct)
  }
}

/**
 * Grade all questions in an exam
 */
export async function gradeExam(
  questions: PracticeQuestion[],
  answers: Record<string, string | string[]>
): Promise<{
  results: Record<string, GradeResult>
  totalScore: number
  maxScore: number
  percentage: number
  correctCount: number
}> {
  const results: Record<string, GradeResult> = {}
  let totalScore = 0

  // Grade questions - do free-form questions in parallel for speed
  const freeFormQuestions = questions.filter(q => q.type === 'free_form')
  const otherQuestions = questions.filter(q => q.type !== 'free_form')

  // Grade non-AI questions synchronously (fast)
  for (const q of otherQuestions) {
    const result = await gradeQuestion(q, answers[q.id])
    results[q.id] = result
    totalScore += result.score
  }

  // Grade free-form questions in parallel (slow, needs AI)
  if (freeFormQuestions.length > 0) {
    const freeFormResults = await Promise.all(
      freeFormQuestions.map(q => gradeQuestion(q, answers[q.id]))
    )
    freeFormQuestions.forEach((q, i) => {
      results[q.id] = freeFormResults[i]
      totalScore += freeFormResults[i].score
    })
  }

  const maxScore = questions.length * 10
  const percentage = Math.round((totalScore / maxScore) * 100)
  const correctCount = Object.values(results).filter(r => r.isCorrect).length

  return {
    results,
    totalScore,
    maxScore,
    percentage,
    correctCount,
  }
}
