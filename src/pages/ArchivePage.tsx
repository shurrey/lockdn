import { useState, useMemo } from 'react'
import { Archive, RotateCcw, Trash2, Filter, Calendar, BookOpen, FileText, ClipboardList, MessageSquare, GraduationCap, HelpCircle } from 'lucide-react'
import { Mascot } from '@/components/Mascot'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  useArchivedItems,
  useSemesterArchives,
  restoreCourse,
  restoreNote,
  restoreAssignment,
  restoreStudyMaterial,
  restoreStudySession,
  restoreTutoringConversation,
  permanentlyDeleteCourse,
  permanentlyDeleteNote,
  permanentlyDeleteAssignment,
  permanentlyDeleteStudyMaterial,
  permanentlyDeleteStudySession,
  permanentlyDeleteTutoringConversation,
  permanentlyDeleteSemesterArchive,
  type ArchivedItem,
} from '@/db/hooks'
import { PermanentDeleteDialog } from '@/components/ui/archive-dialog'
import { HelpPanel } from '@/components/HelpPanel'
import { toast } from 'sonner'

const TYPE_ICONS = {
  course: GraduationCap,
  assignment: ClipboardList,
  note: FileText,
  studyMaterial: BookOpen,
  studySession: Calendar,
  tutoringConversation: MessageSquare,
}

const TYPE_LABELS = {
  course: 'Courses',
  assignment: 'Assignments',
  note: 'Notes',
  studyMaterial: 'Study Materials',
  studySession: 'Study Sessions',
  tutoringConversation: 'Conversations',
}

type FilterType = 'all' | ArchivedItem['type']

export function ArchivePage() {
  const archivedItems = useArchivedItems()
  const semesterArchives = useSemesterArchives()

  const [filterType, setFilterType] = useState<FilterType>('all')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ArchivedItem | null>(null)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  // Group items by type
  const groupedItems = useMemo(() => {
    if (!archivedItems) return {}

    const filtered = filterType === 'all'
      ? archivedItems
      : archivedItems.filter(item => item.type === filterType)

    return filtered.reduce((acc, item) => {
      if (!acc[item.type]) {
        acc[item.type] = []
      }
      acc[item.type].push(item)
      return acc
    }, {} as Record<ArchivedItem['type'], ArchivedItem[]>)
  }, [archivedItems, filterType])

  const totalCount = archivedItems?.length ?? 0

  const handleRestore = async (item: ArchivedItem) => {
    setIsProcessing(item.id)
    try {
      switch (item.type) {
        case 'course':
          await restoreCourse(item.id)
          break
        case 'note':
          await restoreNote(item.id)
          break
        case 'assignment':
          await restoreAssignment(item.id)
          break
        case 'studyMaterial':
          await restoreStudyMaterial(item.id)
          break
        case 'studySession':
          await restoreStudySession(item.id)
          break
        case 'tutoringConversation':
          await restoreTutoringConversation(item.id)
          break
      }
      toast.success(`${TYPE_LABELS[item.type].slice(0, -1)} restored`)
    } catch (error) {
      toast.error('Failed to restore item')
      console.error('Restore error:', error)
    } finally {
      setIsProcessing(null)
    }
  }

  const handlePermanentDelete = async () => {
    if (!selectedItem) return

    setIsProcessing(selectedItem.id)
    try {
      switch (selectedItem.type) {
        case 'course':
          await permanentlyDeleteCourse(selectedItem.id)
          break
        case 'note':
          await permanentlyDeleteNote(selectedItem.id)
          break
        case 'assignment':
          await permanentlyDeleteAssignment(selectedItem.id)
          break
        case 'studyMaterial':
          await permanentlyDeleteStudyMaterial(selectedItem.id)
          break
        case 'studySession':
          await permanentlyDeleteStudySession(selectedItem.id)
          break
        case 'tutoringConversation':
          await permanentlyDeleteTutoringConversation(selectedItem.id)
          break
      }
      toast.success(`${TYPE_LABELS[selectedItem.type].slice(0, -1)} permanently deleted`)
      setSelectedItem(null)
    } catch (error) {
      toast.error('Failed to delete item')
      console.error('Delete error:', error)
    } finally {
      setIsProcessing(null)
    }
  }

  const openDeleteDialog = (item: ArchivedItem) => {
    setSelectedItem(item)
    setDeleteDialogOpen(true)
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
  }

  const getReasonLabel = (reason?: string) => {
    switch (reason) {
      case 'user_archived':
        return 'Archived by you'
      case 'course_archived':
        return 'Course archived'
      case 'semester_cleanup':
        return 'Semester cleanup'
      default:
        return 'Archived'
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Archive className="h-8 w-8" />
            Archive
          </h1>
          <p className="text-muted-foreground mt-1">
            {totalCount} archived item{totalCount !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="course">Courses</SelectItem>
              <SelectItem value="assignment">Assignments</SelectItem>
              <SelectItem value="note">Notes</SelectItem>
              <SelectItem value="studyMaterial">Study Materials</SelectItem>
              <SelectItem value="studySession">Study Sessions</SelectItem>
              <SelectItem value="tutoringConversation">Conversations</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={() => setShowHelp(true)}>
            <HelpCircle className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Semester Archives Section */}
      {semesterArchives && semesterArchives.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Semester Archives</CardTitle>
            <CardDescription>
              Complete semester cleanups ready for permanent deletion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {semesterArchives
                .filter(sa => !sa.permanentlyDeletedAt)
                .map(archive => (
                  <div
                    key={archive.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div>
                      <p className="font-medium">{archive.semesterName}</p>
                      <p className="text-sm text-muted-foreground">
                        {archive.courseCodes.join(', ')} - Archived {formatDate(archive.archivedAt)}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Permanently delete all data from ${archive.semesterName}? This cannot be undone.`)) {
                          permanentlyDeleteSemesterArchive(archive.id)
                            .then(() => toast.success('Semester data permanently deleted'))
                            .catch(() => toast.error('Failed to delete semester data'))
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete Forever
                    </Button>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {totalCount === 0 && (
        <Card className="p-12 text-center">
          <Mascot size="lg" className="mx-auto" />
          <h2 className="text-xl font-semibold mb-2 mt-4">No Archived Items</h2>
          <p className="text-muted-foreground">
            When you archive courses, notes, or other items, they'll appear here.
          </p>
        </Card>
      )}

      {/* Archived Items by Type */}
      {(Object.entries(groupedItems) as [ArchivedItem['type'], ArchivedItem[]][]).map(([type, items]) => {
        const Icon = TYPE_ICONS[type]
        const label = TYPE_LABELS[type]

        return (
          <Card key={type}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Icon className="h-5 w-5" />
                {label}
                <Badge variant="secondary" className="ml-2">
                  {items.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {items.map((item: ArchivedItem, index: number) => (
                  <div key={item.id}>
                    {index > 0 && <Separator className="my-2" />}
                    <div className="flex items-center justify-between py-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{item.title}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{formatDate(item.archivedAt)}</span>
                          {item.courseName && (
                            <>
                              <span>•</span>
                              <span>{item.courseName}</span>
                            </>
                          )}
                          {item.archiveReason && (
                            <>
                              <span>•</span>
                              <span>{getReasonLabel(item.archiveReason)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestore(item)}
                          disabled={isProcessing === item.id}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restore
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(item)}
                          disabled={isProcessing === item.id}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* Permanent Delete Dialog */}
      <PermanentDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemType={selectedItem?.type ?? 'note'}
        itemName={selectedItem?.title ?? ''}
        onConfirm={handlePermanentDelete}
        isLoading={isProcessing !== null}
      />

      {/* Help Panel */}
      <HelpPanel
        docPath="user/features/archive"
        open={showHelp}
        onOpenChange={setShowHelp}
        title="Archive Help"
      />
    </div>
  )
}
