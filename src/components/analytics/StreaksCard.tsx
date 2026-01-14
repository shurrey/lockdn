import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Flame, Trophy, Target } from 'lucide-react'
import type { Analytics } from '@/types'

interface StreaksCardProps {
  analytics: Analytics | undefined
}

export function StreaksCard({ analytics }: StreaksCardProps) {
  const currentStreak = analytics?.currentStreak ?? 0
  const longestStreak = analytics?.longestStreak ?? 0
  const milestones = analytics?.milestones ?? []
  const recentMilestones = milestones.slice(-3).reverse()

  const getStreakMessage = (streak: number) => {
    if (streak === 0) return "Start studying to build your streak!"
    if (streak === 1) return "Great start! Keep it going!"
    if (streak < 7) return "Building momentum!"
    if (streak < 14) return "You're on fire!"
    if (streak < 30) return "Incredible dedication!"
    return "Legendary consistency!"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          Study Streak
        </CardTitle>
        <CardDescription>{getStreakMessage(currentStreak)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Streak */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className={`h-8 w-8 ${currentStreak > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
            <div>
              <p className="text-2xl font-bold">{currentStreak}</p>
              <p className="text-xs text-muted-foreground">day{currentStreak !== 1 ? 's' : ''} current</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            <div className="text-right">
              <p className="text-lg font-semibold">{longestStreak}</p>
              <p className="text-xs text-muted-foreground">best</p>
            </div>
          </div>
        </div>

        {/* Streak progress indicator */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress to next milestone</span>
            <span>{currentStreak} / {getNextMilestone(currentStreak)}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-500"
              style={{ width: `${(currentStreak / getNextMilestone(currentStreak)) * 100}%` }}
            />
          </div>
        </div>

        {/* Recent Milestones */}
        {recentMilestones.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-1">
              <Target className="h-4 w-4" />
              Recent Milestones
            </p>
            <div className="flex flex-wrap gap-1">
              {recentMilestones.map((milestone) => (
                <Badge key={milestone.id} variant="secondary" className="text-xs">
                  {milestone.description}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {recentMilestones.length === 0 && currentStreak === 0 && (
          <div className="text-center py-2 text-muted-foreground text-sm">
            <p>Complete your first study session to start earning milestones!</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getNextMilestone(current: number): number {
  const milestones = [7, 14, 30, 60, 90, 180, 365]
  return milestones.find((m) => m > current) || current + 30
}
