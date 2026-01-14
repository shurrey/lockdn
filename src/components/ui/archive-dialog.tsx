import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Archive, AlertTriangle } from 'lucide-react'

export type ArchiveItemType = 'course' | 'assignment' | 'note' | 'studyMaterial' | 'studySession' | 'tutoringConversation'

export interface ArchiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemType: ArchiveItemType
  itemName: string
  onConfirm: (options?: { keepNotesAndMaterials?: boolean }) => void | Promise<void>
  // For courses only - show counts of related items
  relatedItems?: {
    assignments?: number
    notes?: number
    studyMaterials?: number
    studySessions?: number
    tutoringConversations?: number
  }
  isLoading?: boolean
}

const TYPE_LABELS: Record<ArchiveItemType, string> = {
  course: 'Course',
  assignment: 'Assignment',
  note: 'Note',
  studyMaterial: 'Study Material',
  studySession: 'Study Session',
  tutoringConversation: 'Conversation',
}

export function ArchiveDialog({
  open,
  onOpenChange,
  itemType,
  itemName,
  onConfirm,
  relatedItems,
  isLoading = false,
}: ArchiveDialogProps) {
  const [keepNotesAndMaterials, setKeepNotesAndMaterials] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)

  const handleArchive = async () => {
    setIsArchiving(true)
    try {
      if (itemType === 'course') {
        await onConfirm({ keepNotesAndMaterials })
      } else {
        await onConfirm()
      }
      onOpenChange(false)
    } finally {
      setIsArchiving(false)
    }
  }

  const hasRelatedItems = relatedItems && (
    (relatedItems.assignments ?? 0) > 0 ||
    (relatedItems.notes ?? 0) > 0 ||
    (relatedItems.studyMaterials ?? 0) > 0 ||
    (relatedItems.studySessions ?? 0) > 0 ||
    (relatedItems.tutoringConversations ?? 0) > 0
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Archive {TYPE_LABELS[itemType]}
          </DialogTitle>
          <DialogDescription>
            Archive "{itemName}"? You can restore it later from the Archive page.
          </DialogDescription>
        </DialogHeader>

        {itemType === 'course' && hasRelatedItems && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-3 space-y-2">
              <p className="text-sm font-medium">This will also archive:</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                {(relatedItems?.assignments ?? 0) > 0 && (
                  <li>{relatedItems!.assignments} assignment{relatedItems!.assignments !== 1 ? 's' : ''}</li>
                )}
                {(relatedItems?.notes ?? 0) > 0 && (
                  <li>{relatedItems!.notes} note{relatedItems!.notes !== 1 ? 's' : ''}</li>
                )}
                {(relatedItems?.studyMaterials ?? 0) > 0 && (
                  <li>{relatedItems!.studyMaterials} study material{relatedItems!.studyMaterials !== 1 ? 's' : ''}</li>
                )}
                {(relatedItems?.studySessions ?? 0) > 0 && (
                  <li>{relatedItems!.studySessions} study session{relatedItems!.studySessions !== 1 ? 's' : ''}</li>
                )}
              </ul>
              {(relatedItems?.tutoringConversations ?? 0) > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  {relatedItems!.tutoringConversations} tutoring conversation{relatedItems!.tutoringConversations !== 1 ? 's' : ''} will be moved to Uncategorized.
                </p>
              )}
            </div>

            <div className="flex items-start space-x-3 p-3 border rounded-lg">
              <input
                type="checkbox"
                id="keepNotesAndMaterials"
                checked={keepNotesAndMaterials}
                onChange={(e) => setKeepNotesAndMaterials(e.target.checked)}
                className="mt-1"
              />
              <div>
                <Label htmlFor="keepNotesAndMaterials" className="font-medium cursor-pointer">
                  Keep notes and study materials
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Move notes and study materials to "Uncategorized" instead of archiving them.
                </p>
              </div>
            </div>
          </div>
        )}

        {itemType === 'note' && (
          <div className="rounded-lg bg-muted p-3">
            <p className="text-sm text-muted-foreground">
              Study materials generated from this note will be preserved. The note reference will be removed from them.
            </p>
          </div>
        )}

        {itemType === 'studyMaterial' && (
          <div className="rounded-lg bg-muted p-3">
            <p className="text-sm text-muted-foreground">
              Exam attempts for this study material will also be archived.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isArchiving || isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleArchive}
            disabled={isArchiving || isLoading}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isArchiving ? 'Archiving...' : 'Archive'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Permanent Delete Confirmation Dialog
export interface PermanentDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemType: ArchiveItemType | 'semester'
  itemName: string
  onConfirm: () => void | Promise<void>
  isLoading?: boolean
}

export function PermanentDeleteDialog({
  open,
  onOpenChange,
  itemType: _itemType,
  itemName,
  onConfirm,
  isLoading = false,
}: PermanentDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Permanently Delete
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to permanently delete "{itemName}"?
            <span className="font-semibold text-destructive"> This action cannot be undone.</span>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting || isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting || isLoading}
          >
            {isDeleting ? 'Deleting...' : 'Permanently Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
