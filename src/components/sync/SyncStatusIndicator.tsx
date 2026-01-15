/**
 * Sync Status Indicator
 *
 * Shows the current sync status and peer count.
 */

import { Cloud, CloudOff, Loader2, AlertCircle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSyncStatus } from '@/lib/sync'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface SyncStatusIndicatorProps {
  className?: string
  showLabel?: boolean
}

export function SyncStatusIndicator({
  className,
  showLabel = false,
}: SyncStatusIndicatorProps) {
  const { status, peerCount, lastSyncedAt, error } = useSyncStatus()

  const getIcon = () => {
    switch (status) {
      case 'connecting':
      case 'syncing':
        return <Loader2 className="h-4 w-4 animate-spin" />
      case 'connected':
        return <Cloud className="h-4 w-4" />
      case 'error':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <CloudOff className="h-4 w-4" />
    }
  }

  const getColor = () => {
    switch (status) {
      case 'connected':
        return 'text-green-500'
      case 'syncing':
        return 'text-blue-500'
      case 'connecting':
        return 'text-yellow-500'
      case 'error':
        return 'text-red-500'
      default:
        return 'text-muted-foreground'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'connecting':
        return 'Connecting...'
      case 'syncing':
        return 'Syncing...'
      case 'connected':
        return peerCount > 0
          ? `Connected (${peerCount} device${peerCount > 1 ? 's' : ''})`
          : 'Connected'
      case 'error':
        return error || 'Sync error'
      default:
        return 'Not syncing'
    }
  }

  const getTooltipContent = () => {
    const lines = [getStatusText()]

    if (lastSyncedAt) {
      lines.push(
        `Last synced ${formatDistanceToNow(lastSyncedAt, { addSuffix: true })}`
      )
    }

    if (error) {
      lines.push(`Error: ${error}`)
    }

    return lines.join('\n')
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-1.5 cursor-default',
              getColor(),
              className
            )}
          >
            {getIcon()}
            {showLabel && (
              <span className="text-sm">{getStatusText()}</span>
            )}
            {status === 'connected' && peerCount > 0 && !showLabel && (
              <span className="text-xs bg-green-500/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full">
                {peerCount}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="whitespace-pre-line">{getTooltipContent()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
