import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Settings, Plus, MessageSquare, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Mascot } from '@/components/Mascot'
import { ChatInterface } from '@/components/tutor/ChatInterface'
import { ResourceViewer } from '@/components/tutor/ResourceViewer'
import type { ResourceLink } from '@/components/tutor/MessageRenderer'
import {
  useCourses,
  useUpcomingAssignments,
  useNotes,
  useApiKeys,
  useTutoringConversations,
  useStudyMaterials,
  useExamAttempts,
  useTutorBehavioralProfile,
  createTutoringConversation,
  updateTutoringConversation,
  analyzeTutoringHistory,
  toPatternProfile,
} from '@/db/hooks'
import { db } from '@/db'
import type { TutoringMessage, TutoringMode, TutoringConversation } from '@/types'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

export function TutorPage() {
  const courses = useCourses()
  const upcomingAssignments = useUpcomingAssignments(10)
  const notes = useNotes()
  const studyMaterials = useStudyMaterials()
  const examAttempts = useExamAttempts()
  const apiKeys = useApiKeys()
  const conversations = useTutoringConversations()
  const behavioralProfile = useTutorBehavioralProfile()

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [activeConversation, setActiveConversation] = useState<TutoringConversation | null>(null)
  const [selectedResource, setSelectedResource] = useState<ResourceLink | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Track if we've analyzed recently to avoid excessive analysis
  const lastAnalysisRef = useRef<number>(0)

  const hasApiKey = apiKeys && apiKeys.length > 0

  // Load active conversation when ID changes
  useEffect(() => {
    if (activeConversationId) {
      db.tutoringConversations.get(activeConversationId).then((conv) => {
        setActiveConversation(conv || null)
      })
    } else {
      setActiveConversation(null)
    }
  }, [activeConversationId])

  // Build tutor context with all available data
  const tutorContext = useMemo(
    () => ({
      courses: courses || [],
      upcomingAssignments: upcomingAssignments || [],
      notes: notes || [],
      studyMaterials: studyMaterials || [],
      examAttempts: examAttempts || [],
      mode: (activeConversation?.detectedMode || 'learning') as TutoringMode,
      behavioralProfile: behavioralProfile ? toPatternProfile(behavioralProfile) : undefined,
    }),
    [courses, upcomingAssignments, notes, studyMaterials, examAttempts, activeConversation?.detectedMode, behavioralProfile]
  )

  // Trigger behavioral analysis periodically (every 5 minutes if there are conversations)
  useEffect(() => {
    const now = Date.now()
    const fiveMinutes = 5 * 60 * 1000

    if (conversations && conversations.length > 0 && now - lastAnalysisRef.current > fiveMinutes) {
      lastAnalysisRef.current = now
      analyzeTutoringHistory().catch(console.error)
    }
  }, [conversations])

  const handleNewConversation = useCallback(async () => {
    const id = await createTutoringConversation({
      title: `Chat ${format(new Date(), 'MMM d, h:mm a')}`,
      messages: [],
      detectedMode: 'learning',
    })
    setActiveConversationId(id)
  }, [])

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id)
  }, [])

  const handleMessagesChange = useCallback(
    async (messages: TutoringMessage[]) => {
      if (!activeConversationId) return

      // Generate title from first user message if available
      const firstUserMessage = messages.find((m) => m.role === 'user')
      const title = firstUserMessage
        ? firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
        : `Chat ${format(new Date(), 'MMM d, h:mm a')}`

      await updateTutoringConversation(activeConversationId, {
        messages,
        title,
      }, { recordActivity: true })
    },
    [activeConversationId]
  )

  const handleModeChange = useCallback(
    async (mode: TutoringMode) => {
      if (!activeConversationId) return
      await updateTutoringConversation(activeConversationId, {
        detectedMode: mode,
      })
    },
    [activeConversationId]
  )

  const handleDeleteConversation = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      await db.tutoringConversations.delete(id)
      if (activeConversationId === id) {
        setActiveConversationId(null)
      }
    },
    [activeConversationId]
  )

  const handleResourceSelect = useCallback((resource: ResourceLink) => {
    setSelectedResource(resource)
    setSidebarCollapsed(true) // Auto-collapse sidebar when viewing resource
  }, [])

  const handleCloseResource = useCallback(() => {
    setSelectedResource(null)
    setSidebarCollapsed(false) // Expand sidebar when closing resource
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev)
  }, [])

  // Show API key setup if not configured
  if (!hasApiKey) {
    return (
      <div className="p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">AI Tutor</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Get help with your coursework from your AI study buddy.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configure API Key</CardTitle>
          </CardHeader>
          <CardContent className="min-h-[300px] md:min-h-[400px] flex flex-col items-center justify-center">
            <Mascot size="lg" />
            <p className="text-sm text-muted-foreground mb-4 text-center mt-4">
              To use the AI tutor, you need to configure an API key first.
            </p>
            <Button asChild>
              <Link to="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Configure API Key
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">AI Tutor</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Get help with your coursework from your AI study buddy.
        </p>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Conversation Sidebar - Collapsible, hidden on mobile by default */}
        <Card
          className={cn(
            'flex-shrink-0 flex-col transition-all duration-300 hidden md:flex',
            sidebarCollapsed ? 'w-12' : 'w-64'
          )}
        >
          {sidebarCollapsed ? (
            // Collapsed state - just a chevron
            <div className="flex-1 flex items-center justify-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleSidebar}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            // Expanded state - full sidebar
            <>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Conversations</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNewConversation}>
                      <Plus className="h-4 w-4" />
                    </Button>
                    {selectedResource && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleSidebar}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-2 space-y-1">
                {conversations && conversations.length > 0 ? (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-accent group',
                        activeConversationId === conv.id && 'bg-accent'
                      )}
                      onClick={() => handleSelectConversation(conv.id)}
                    >
                      <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{conv.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(conv.updatedAt), 'MMM d')}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No conversations yet
                  </p>
                )}
              </CardContent>
            </>
          )}
        </Card>

        {/* Chat Area - Shrinks when resource is open */}
        <Card
          className={cn(
            'flex flex-col min-h-0 transition-all duration-300',
            selectedResource ? 'w-96 flex-shrink-0' : 'flex-1'
          )}
        >
          <CardContent className="flex-1 p-4 flex flex-col min-h-0">
            {activeConversationId && activeConversation ? (
              <ChatInterface
                key={activeConversationId}
                context={tutorContext}
                conversationId={activeConversationId}
                initialMessages={activeConversation.messages}
                onMessagesChange={handleMessagesChange}
                onModeChange={handleModeChange}
                onResourceSelect={handleResourceSelect}
                resourceOpen={!!selectedResource}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <Mascot size="lg" />
                <h3 className="text-lg font-medium mb-2 mt-4">Start a conversation</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Click "New Chat" to start talking with your AI tutor
                </p>
                <Button onClick={handleNewConversation}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Chat
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resource Viewer - Takes remaining space */}
        {selectedResource && (
          <Card className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right duration-300">
            <ResourceViewer
              resource={selectedResource}
              onClose={handleCloseResource}
              compact
            />
          </Card>
        )}
      </div>
    </div>
  )
}
