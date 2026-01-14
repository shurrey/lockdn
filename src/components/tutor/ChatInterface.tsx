import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Send, Loader2, BookOpen, GraduationCap, Bot, User, ImagePlus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sendTutorMessage, generateGreeting, type TutorContext } from '@/lib/tutor'
import type { TutoringMessage, TutoringMode, TutoringMessageImage } from '@/types'
import { format } from 'date-fns'
import { MessageRenderer, type ResourceLink } from './MessageRenderer'

interface ChatInterfaceProps {
  context: TutorContext
  conversationId?: string
  initialMessages?: TutoringMessage[]
  onMessagesChange?: (messages: TutoringMessage[]) => void
  onModeChange?: (mode: TutoringMode) => void
  onResourceSelect?: (resource: ResourceLink) => void
  resourceOpen?: boolean
}

export function ChatInterface({
  context,
  initialMessages = [],
  onMessagesChange,
  onModeChange,
  onResourceSelect,
  resourceOpen,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<TutoringMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<TutoringMode>(context.mode)
  const [selectedCourse, setSelectedCourse] = useState<string | undefined>(
    context.currentCourse?.id
  )
  const [pendingImages, setPendingImages] = useState<TutoringMessageImage[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Scroll to bottom when layout changes (resource panel opens/closes)
  useEffect(() => {
    // Wait for CSS transition to complete (300ms) before scrolling
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' })
    }, 350)
    return () => clearTimeout(timer)
  }, [resourceOpen])

  // Generate greeting on mount if no messages
  useEffect(() => {
    if (messages.length === 0) {
      const greeting = generateGreeting(context)
      const greetingMessage: TutoringMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: greeting,
        timestamp: new Date(),
      }
      setMessages([greetingMessage])
      onMessagesChange?.([greetingMessage])
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleModeChange = useCallback(
    (newMode: TutoringMode) => {
      setMode(newMode)
      onModeChange?.(newMode)
    },
    [onModeChange]
  )

  const handleCourseChange = useCallback((courseId: string) => {
    setSelectedCourse(courseId === 'all' ? undefined : courseId)
  }, [])

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return

      const reader = new FileReader()
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string
        const newImage: TutoringMessageImage = {
          id: crypto.randomUUID(),
          dataUrl,
          mimeType: file.type,
          fileName: file.name,
        }
        setPendingImages((prev) => [...prev, newImage])
      }
      reader.readAsDataURL(file)
    })

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleRemoveImage = useCallback((imageId: string) => {
    setPendingImages((prev) => prev.filter((img) => img.id !== imageId))
  }, [])

  const handleResourceClick = useCallback(
    (resource: ResourceLink) => {
      onResourceSelect?.(resource)
    },
    [onResourceSelect]
  )

  const handleSubmit = useCallback(async () => {
    if ((!input.trim() && pendingImages.length === 0) || isLoading) return

    const imagesToSend = pendingImages.length > 0 ? [...pendingImages] : undefined
    const userMessage: TutoringMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      images: imagesToSend,
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setPendingImages([])
    setIsLoading(true)

    try {
      // Build context with current course selection
      const currentCourse = selectedCourse
        ? context.courses.find((c) => c.id === selectedCourse)
        : undefined

      const response = await sendTutorMessage(input.trim(), messages, {
        ...context,
        currentCourse,
        mode,
      }, imagesToSend)

      const assistantMessage: TutoringMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        tokens: response.usage
          ? response.usage.inputTokens + response.usage.outputTokens
          : undefined,
      }

      const finalMessages = [...updatedMessages, assistantMessage]
      setMessages(finalMessages)
      onMessagesChange?.(finalMessages)

      // Update mode if it was detected differently
      if (response.detectedMode !== mode) {
        setMode(response.detectedMode)
        onModeChange?.(response.detectedMode)
      }
    } catch (error) {
      const errorMessage: TutoringMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `I'm sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
      }
      setMessages([...updatedMessages, errorMessage])
    } finally {
      setIsLoading(false)
      // Use setTimeout to ensure focus happens after React's reconciliation and scroll
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
    }
  }, [input, isLoading, messages, context, selectedCourse, mode, pendingImages, onMessagesChange, onModeChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header with mode and course selection */}
      <div className="flex items-center gap-4 pb-4 border-b flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Mode:</span>
          <Select value={mode} onValueChange={(v) => handleModeChange(v as TutoringMode)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="learning">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Learning
                </div>
              </SelectItem>
              <SelectItem value="homework">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Homework Help
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Course:</span>
          <Select value={selectedCourse || 'all'} onValueChange={handleCourseChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {context.courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {mode === 'homework' && (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            Guided Mode Active
          </Badge>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex gap-3',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
            )}

            <Card
              className={cn(
                'max-w-[95%] p-3',
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              )}
            >
              {message.role === 'assistant' ? (
                <MessageRenderer
                  content={message.content}
                  onResourceClick={handleResourceClick}
                />
              ) : (
                <div className="space-y-2">
                  {/* User message images */}
                  {message.images && message.images.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {message.images.map((img) => (
                        <div
                          key={img.id}
                          className="relative rounded-lg overflow-hidden border border-primary-foreground/20"
                        >
                          <img
                            src={img.dataUrl}
                            alt={img.fileName || 'Uploaded image'}
                            className="max-w-[200px] max-h-[150px] object-contain"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {message.content && (
                    <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                  )}
                </div>
              )}
              <div
                className={cn(
                  'text-xs mt-2',
                  message.role === 'user'
                    ? 'text-primary-foreground/70'
                    : 'text-muted-foreground'
                )}
              >
                {format(new Date(message.timestamp), 'h:mm a')}
              </div>
            </Card>

            {message.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <Card className="bg-muted p-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </Card>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="pt-4 border-t">
        {/* Pending images preview */}
        {pendingImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {pendingImages.map((img) => (
              <div
                key={img.id}
                className="relative group rounded-lg overflow-hidden border"
              >
                <img
                  src={img.dataUrl}
                  alt={img.fileName || 'Pending upload'}
                  className="w-16 h-16 object-cover"
                />
                <button
                  onClick={() => handleRemoveImage(img.id)}
                  className="absolute top-0 right-0 p-0.5 bg-destructive text-destructive-foreground rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageUpload}
          />
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            className="min-h-[60px] resize-none"
            disabled={isLoading}
          />
          <div className="flex flex-col gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-[28px] w-10"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              title="Upload image"
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={(!input.trim() && pendingImages.length === 0) || isLoading}
              size="icon"
              className="h-[28px] w-10"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Enter to send, Shift+Enter for new line. Upload images of homework for guided help.
        </p>
      </div>
    </div>
  )
}
