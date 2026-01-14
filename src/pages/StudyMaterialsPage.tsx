import { useState, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  BookOpen,
  ClipboardList,
  Download,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  History,
  TrendingUp,
  Archive,
  FileText,
  FileDown,
} from 'lucide-react'
import { Mascot } from '@/components/Mascot'
import { useCourses, archiveStudyMaterial } from '@/db/hooks'
import { db, generateId } from '@/db'
import { useLiveQuery } from 'dexie-react-hooks'
import type { StudyMaterial, Course, ExamAttempt } from '@/types'
import { exportToMarkdown, exportToPdf } from '@/lib/notesProcessor'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'

export function StudyMaterialsPage() {
  const courses = useCourses()
  const studyMaterials = useLiveQuery(() =>
    db.studyMaterials
      .filter((m) => m.archivedAt === undefined)
      .reverse()
      .sortBy('createdAt')
  )
  const examAttempts = useLiveQuery(() =>
    db.examAttempts
      .filter((a) => a.archivedAt === undefined)
      .reverse()
      .sortBy('completedAt')
  )

  const [filterCourse, setFilterCourse] = useState<string>('all')
  const [selectedMaterial, setSelectedMaterial] = useState<StudyMaterial | null>(null)
  const [showMaterialDialog, setShowMaterialDialog] = useState(false)
  const [showHistoryDialog, setShowHistoryDialog] = useState(false)
  const [selectedAttempt, setSelectedAttempt] = useState<ExamAttempt | null>(null)
  const [examAnswers, setExamAnswers] = useState<Record<string, string | string[]>>({})
  const [showResults, setShowResults] = useState(false)
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set())

  // Filter materials
  const filteredMaterials = useMemo(() => {
    if (!studyMaterials) return { guides: [], exams: [] }

    const filtered = filterCourse === 'all'
      ? studyMaterials
      : studyMaterials.filter((m) => m.courseId === filterCourse)

    return {
      guides: filtered.filter((m) => m.type === 'guide'),
      exams: filtered.filter((m) => m.type === 'practice_exam'),
    }
  }, [studyMaterials, filterCourse])

  // Get attempts for selected exam
  const currentExamAttempts = useMemo(() => {
    if (!selectedMaterial || !examAttempts) return []
    return examAttempts
      .filter((a) => a.examId === selectedMaterial.id)
      .sort((a, b) => b.attemptNumber - a.attemptNumber)
  }, [selectedMaterial, examAttempts])

  // Get best score for an exam
  const getBestScore = useCallback((examId: string) => {
    if (!examAttempts) return null
    const attempts = examAttempts.filter((a) => a.examId === examId)
    if (attempts.length === 0) return null
    return Math.max(...attempts.map((a) => a.percentage))
  }, [examAttempts])

  // Get attempt count for an exam
  const getAttemptCount = useCallback((examId: string) => {
    if (!examAttempts) return 0
    return examAttempts.filter((a) => a.examId === examId).length
  }, [examAttempts])

  const getCourseById = useCallback(
    (courseId: string | undefined): Course | undefined => {
      if (!courseId) return undefined
      return courses?.find((c) => c.id === courseId)
    },
    [courses]
  )

  const handleViewMaterial = useCallback((material: StudyMaterial) => {
    setSelectedMaterial(material)
    setShowMaterialDialog(true)
    setExamAnswers({})
    setShowResults(false)
    setExpandedQuestions(new Set())
    setSelectedAttempt(null)
  }, [])

  const handleArchiveMaterial = useCallback(async (id: string) => {
    if (!confirm('Archive this study material? You can restore it later from the Archive page.')) return
    await archiveStudyMaterial(id)
    setShowMaterialDialog(false)
    setSelectedMaterial(null)
    toast.success('Study material archived')
  }, [])

  const handleExportMarkdown = useCallback((material: StudyMaterial) => {
    const markdown = exportToMarkdown(material)
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${material.title.replace(/[^a-z0-9]/gi, '_')}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Exported to Markdown')
  }, [])

  const handleExportPdf = useCallback(async (material: StudyMaterial) => {
    toast.info('Generating PDF...')
    try {
      await exportToPdf(material)
      toast.success('Exported to PDF')
    } catch (error) {
      console.error('PDF export failed:', error)
      toast.error('Failed to export PDF')
    }
  }, [])

  const handleAnswerChange = useCallback((questionId: string, answer: string) => {
    setExamAnswers((prev) => ({ ...prev, [questionId]: answer }))
  }, [])

  const handleSubmitExam = useCallback(async () => {
    if (!selectedMaterial?.questions) return

    // Calculate score
    let correct = 0
    for (const q of selectedMaterial.questions) {
      const userAnswer = examAnswers[q.id]
      if (userAnswer === q.correctAnswer) {
        correct++
      }
    }

    const total = selectedMaterial.questions.length
    const percentage = Math.round((correct / total) * 100)

    // Save attempt
    const attemptNumber = currentExamAttempts.length + 1
    await db.examAttempts.add({
      id: generateId(),
      examId: selectedMaterial.id,
      attemptNumber,
      answers: examAnswers,
      score: correct,
      totalQuestions: total,
      percentage,
      completedAt: new Date(),
    })

    setShowResults(true)
    // Expand all questions to show results
    setExpandedQuestions(new Set(selectedMaterial.questions.map((q) => q.id)))

    toast.success(`Attempt ${attemptNumber} complete: ${correct}/${total} (${percentage}%)`)
  }, [selectedMaterial, examAnswers, currentExamAttempts])

  const handleRetakeExam = useCallback(() => {
    setExamAnswers({})
    setShowResults(false)
    setExpandedQuestions(new Set())
    setSelectedAttempt(null)
  }, [])

  const handleViewAttempt = useCallback((attempt: ExamAttempt) => {
    setSelectedAttempt(attempt)
    setExamAnswers(attempt.answers)
    setShowResults(true)
    if (selectedMaterial?.questions) {
      setExpandedQuestions(new Set(selectedMaterial.questions.map((q) => q.id)))
    }
    setShowHistoryDialog(false)
  }, [selectedMaterial])

  const toggleQuestion = useCallback((questionId: string) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev)
      if (next.has(questionId)) {
        next.delete(questionId)
      } else {
        next.add(questionId)
      }
      return next
    })
  }, [])

  const calculateScore = useCallback(() => {
    if (!selectedMaterial?.questions) return { correct: 0, total: 0, percentage: 0 }

    let correct = 0
    for (const q of selectedMaterial.questions) {
      const userAnswer = examAnswers[q.id]
      if (userAnswer === q.correctAnswer) {
        correct++
      }
    }
    const total = selectedMaterial.questions.length
    return { correct, total, percentage: Math.round((correct / total) * 100) }
  }, [selectedMaterial, examAnswers])

  const renderMaterialCard = (material: StudyMaterial) => {
    const course = getCourseById(material.courseId)
    const isGuide = material.type === 'guide'
    const attemptCount = getAttemptCount(material.id)
    const bestScore = getBestScore(material.id)

    return (
      <Card
        key={material.id}
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => handleViewMaterial(material)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'p-2 rounded-lg',
                isGuide ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
              )}
            >
              {isGuide ? (
                <BookOpen className="h-5 w-5" />
              ) : (
                <ClipboardList className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">{material.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                {course && (
                  <Badge
                    variant="outline"
                    style={{ borderColor: course.color, color: course.color }}
                  >
                    {course.code}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {format(new Date(material.createdAt), 'MMM d, yyyy')}
                </span>
              </div>
              {!isGuide && material.questions && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {material.questions.length} questions
                  </p>
                  {attemptCount > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {attemptCount} attempt{attemptCount !== 1 ? 's' : ''}
                      </Badge>
                      {bestScore !== null && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            bestScore >= 80 ? 'border-green-500 text-green-600' :
                            bestScore >= 60 ? 'border-yellow-500 text-yellow-600' :
                            'border-red-500 text-red-600'
                          )}
                        >
                          Best: {bestScore}%
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Study Materials</h1>
          <p className="text-muted-foreground">
            View your generated study guides and practice exams.
          </p>
        </div>
        <Select value={filterCourse} onValueChange={setFilterCourse}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Courses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            {courses?.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                {course.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="guides" className="space-y-4">
        <TabsList>
          <TabsTrigger value="guides" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Study Guides ({filteredMaterials.guides.length})
          </TabsTrigger>
          <TabsTrigger value="exams" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Practice Exams ({filteredMaterials.exams.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="guides">
          {filteredMaterials.guides.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mascot size="lg" />
                <h3 className="text-lg font-medium mb-2 mt-4">No study guides yet</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Generate study guides from your notes to see them here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredMaterials.guides.map(renderMaterialCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="exams">
          {filteredMaterials.exams.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mascot size="lg" />
                <h3 className="text-lg font-medium mb-2 mt-4">No practice exams yet</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Generate practice exams from your notes to see them here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredMaterials.exams.map(renderMaterialCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Study Guide Viewer Dialog - Full Width */}
      <Dialog
        open={showMaterialDialog && selectedMaterial?.type === 'guide'}
        onOpenChange={setShowMaterialDialog}
      >
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="text-xl">{selectedMaterial?.title}</DialogTitle>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => selectedMaterial && handleExportPdf(selectedMaterial)}>
                      <FileDown className="h-4 w-4 mr-2" />
                      Export as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => selectedMaterial && handleExportMarkdown(selectedMaterial)}>
                      <FileText className="h-4 w-4 mr-2" />
                      Export as Markdown
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                  onClick={() => selectedMaterial && handleArchiveMaterial(selectedMaterial.id)}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2">
            {selectedMaterial && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{selectedMaterial.content}</ReactMarkdown>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Practice Exam Viewer Dialog - Full Width */}
      <Dialog
        open={showMaterialDialog && selectedMaterial?.type === 'practice_exam'}
        onOpenChange={setShowMaterialDialog}
      >
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between pr-8">
              <div>
                <DialogTitle className="text-xl">{selectedMaterial?.title}</DialogTitle>
                {selectedAttempt && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Viewing Attempt {selectedAttempt.attemptNumber} from {format(new Date(selectedAttempt.completedAt), 'MMM d, yyyy h:mm a')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {currentExamAttempts.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHistoryDialog(true)}
                  >
                    <History className="h-4 w-4 mr-2" />
                    History ({currentExamAttempts.length})
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => selectedMaterial && handleExportPdf(selectedMaterial)}>
                      <FileDown className="h-4 w-4 mr-2" />
                      Export as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => selectedMaterial && handleExportMarkdown(selectedMaterial)}>
                      <FileText className="h-4 w-4 mr-2" />
                      Export as Markdown
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                  onClick={() => selectedMaterial && handleArchiveMaterial(selectedMaterial.id)}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2">
            {selectedMaterial?.questions && (
              <div className="space-y-4">
                {/* Score Card */}
                {showResults && (
                  <Card className="bg-primary/10 border-primary">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div>
                            <span className="font-medium">Your Score:</span>
                            <span className="text-2xl font-bold ml-2">
                              {calculateScore().correct} / {calculateScore().total}
                            </span>
                          </div>
                          <div className="w-32">
                            <Progress value={calculateScore().percentage} className="h-2" />
                          </div>
                          <span className={cn(
                            'text-lg font-semibold',
                            calculateScore().percentage >= 80 ? 'text-green-600' :
                            calculateScore().percentage >= 60 ? 'text-yellow-600' :
                            'text-red-600'
                          )}>
                            {calculateScore().percentage}%
                          </span>
                        </div>
                        <Button onClick={handleRetakeExam} className="gap-2">
                          <RotateCcw className="h-4 w-4" />
                          Retake Exam
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Questions */}
                {selectedMaterial.questions.map((question, index) => {
                  const isExpanded = expandedQuestions.has(question.id)
                  const userAnswer = examAnswers[question.id]
                  const isCorrect = userAnswer === question.correctAnswer

                  return (
                    <Card key={question.id} className={cn(
                      showResults && isCorrect && 'border-green-300',
                      showResults && !isCorrect && userAnswer && 'border-red-300'
                    )}>
                      <CardContent className="py-4">
                        <div
                          className="flex items-start gap-3 cursor-pointer"
                          onClick={() => toggleQuestion(question.id)}
                        >
                          <span className="font-medium text-muted-foreground min-w-[2rem]">
                            Q{index + 1}
                          </span>
                          <div className="flex-1">
                            <p className="font-medium">{question.question}</p>
                            <Badge variant="outline" className="mt-1 text-xs">
                              {question.bloomLevel}
                            </Badge>
                          </div>
                          {showResults && userAnswer && (
                            isCorrect ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                            )
                          )}
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>

                        {isExpanded && (
                          <div className="mt-4 ml-10 space-y-3">
                            {question.type === 'multiple_choice' && question.options && (
                              <div className="space-y-2">
                                {question.options.map((option, optIndex) => (
                                  <label
                                    key={optIndex}
                                    className={cn(
                                      'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                                      !showResults && 'hover:bg-accent',
                                      !showResults && userAnswer === option && 'bg-accent',
                                      showResults && option === question.correctAnswer && 'bg-green-100 dark:bg-green-900/30',
                                      showResults && userAnswer === option && option !== question.correctAnswer && 'bg-red-100 dark:bg-red-900/30'
                                    )}
                                  >
                                    <input
                                      type="radio"
                                      name={question.id}
                                      value={option}
                                      checked={userAnswer === option}
                                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                      disabled={showResults}
                                      className="h-4 w-4"
                                    />
                                    <span className="flex-1">{option}</span>
                                    {showResults && option === question.correctAnswer && (
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    )}
                                  </label>
                                ))}
                              </div>
                            )}

                            {question.type === 'fill_in_blank' && (
                              <input
                                type="text"
                                placeholder="Your answer..."
                                value={(userAnswer as string) || ''}
                                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                disabled={showResults}
                                className="w-full p-3 border rounded-lg bg-background"
                              />
                            )}

                            {question.type === 'free_form' && (
                              <textarea
                                placeholder="Your answer..."
                                value={(userAnswer as string) || ''}
                                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                disabled={showResults}
                                className="w-full p-3 border rounded-lg min-h-[120px] bg-background"
                              />
                            )}

                            {showResults && (
                              <div className="p-4 bg-muted rounded-lg space-y-2">
                                <p className="text-sm">
                                  <strong>Correct Answer:</strong>{' '}
                                  <span className="text-green-600 dark:text-green-400">
                                    {Array.isArray(question.correctAnswer)
                                      ? question.correctAnswer.join(', ')
                                      : question.correctAnswer}
                                  </span>
                                </p>
                                {question.explanation && (
                                  <p className="text-sm text-muted-foreground">
                                    <strong>Explanation:</strong> {question.explanation}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}

                {/* Submit Button */}
                {!showResults && (
                  <Button
                    className="w-full py-6 text-lg"
                    onClick={handleSubmitExam}
                    disabled={Object.keys(examAnswers).length === 0}
                  >
                    Submit Answers
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Attempt History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Attempt History
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Performance Summary */}
            {currentExamAttempts.length > 0 && (
              <Card className="bg-muted/50">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Performance Summary</p>
                        <p className="text-sm text-muted-foreground">
                          {currentExamAttempts.length} attempt{currentExamAttempts.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">
                        {Math.max(...currentExamAttempts.map(a => a.percentage))}%
                      </p>
                      <p className="text-xs text-muted-foreground">Best Score</p>
                    </div>
                  </div>
                  {currentExamAttempts.length > 1 && (
                    <div className="mt-4 flex gap-1">
                      {currentExamAttempts
                        .slice()
                        .reverse()
                        .map((attempt, i) => (
                          <div
                            key={attempt.id}
                            className="flex-1 h-2 rounded-full bg-muted"
                            title={`Attempt ${i + 1}: ${attempt.percentage}%`}
                          >
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                attempt.percentage >= 80 ? 'bg-green-500' :
                                attempt.percentage >= 60 ? 'bg-yellow-500' :
                                'bg-red-500'
                              )}
                              style={{ width: `${attempt.percentage}%` }}
                            />
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Attempt List */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {currentExamAttempts.map((attempt) => (
                <Card
                  key={attempt.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleViewAttempt(attempt)}
                >
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">#{attempt.attemptNumber}</Badge>
                        <div>
                          <p className="font-medium">
                            {attempt.score}/{attempt.totalQuestions} correct
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(attempt.completedAt), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={attempt.percentage} className="w-20 h-2" />
                        <span className={cn(
                          'font-semibold min-w-[3rem] text-right',
                          attempt.percentage >= 80 ? 'text-green-600' :
                          attempt.percentage >= 60 ? 'text-yellow-600' :
                          'text-red-600'
                        )}>
                          {attempt.percentage}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryDialog(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setShowHistoryDialog(false)
              handleRetakeExam()
            }}>
              <RotateCcw className="h-4 w-4 mr-2" />
              New Attempt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
