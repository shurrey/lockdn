import { useState, useEffect, useRef } from 'react'
import { BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  StudyTimeChart,
  StreaksCard,
  WeeklyComparisonCard,
  CourseBreakdownChart,
  CompletionRateCard,
  ExamPerformanceChart,
  ProductivityHeatmap,
} from '@/components/analytics'
import {
  useAnalytics,
  useDailySummaries,
  useCourses,
  useAssignments,
  useExamAttempts,
  useStudyTimeByCourse,
  useProductivityHeatmap,
  backfillDailySummaries,
  backfillStreaks,
} from '@/db/hooks'

type DateRange = 7 | 14 | 30

export function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>(30)
  const backfillRan = useRef(false)

  // Backfill daily summaries and streaks from existing sessions on first load
  useEffect(() => {
    if (!backfillRan.current) {
      backfillRan.current = true
      backfillDailySummaries().then(() => backfillStreaks())
    }
  }, [])

  // Fetch all required data
  const analytics = useAnalytics()
  const dailySummaries = useDailySummaries(dateRange)
  const courses = useCourses()
  const assignments = useAssignments()
  const examAttempts = useExamAttempts()
  const studyTimeByCourse = useStudyTimeByCourse(dateRange)
  const heatmapData = useProductivityHeatmap(90) // Always use 90 days for heatmap

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header with date range selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 md:h-8 md:w-8" />
            Analytics
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Track your study habits and progress
          </p>
        </div>

        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 self-start sm:self-auto">
          {([7, 14, 30] as DateRange[]).map((days) => (
            <Button
              key={days}
              variant={dateRange === days ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setDateRange(days)}
              className="px-3"
            >
              {days}d
            </Button>
          ))}
        </div>
      </div>

      {/* Main grid layout */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Row 1: Study Time Chart (2 cols) + Weekly Comparison (1 col) */}
        <StudyTimeChart dailySummaries={dailySummaries} days={dateRange} />
        <WeeklyComparisonCard dailySummaries={dailySummaries} />

        {/* Row 2: Course Breakdown + Exam Performance + Streaks */}
        <CourseBreakdownChart studyTimeByCourse={studyTimeByCourse} courses={courses} />
        <ExamPerformanceChart examAttempts={examAttempts} />
        <StreaksCard analytics={analytics} />

        {/* Row 3: Productivity Heatmap (2 cols) + Completion Rate (1 col) */}
        <ProductivityHeatmap heatmapData={heatmapData} />
        <CompletionRateCard assignments={assignments} />
      </div>
    </div>
  )
}
