import { Fragment, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { Badge } from '@/components/ui/badge'
import { FileText, BookOpen, ClipboardCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ResourceType = 'note' | 'guide' | 'exam'

export interface ResourceLink {
  type: ResourceType
  id: string
  title: string
}

interface MessageRendererProps {
  content: string
  onResourceClick?: (resource: ResourceLink) => void
  className?: string
}

// Parse [[type:id:title]] format from message content
function parseResourceLinks(content: string): (string | ResourceLink)[] {
  const regex = /\[\[(note|guide|exam):([^:]+):([^\]]+)\]\]/g
  const parts: (string | ResourceLink)[] = []
  let lastIndex = 0
  let match

  while ((match = regex.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index))
    }

    // Add the resource link
    parts.push({
      type: match[1] as ResourceType,
      id: match[2],
      title: match[3],
    })

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }

  return parts
}

function ResourceIcon({ type }: { type: ResourceType }) {
  switch (type) {
    case 'note':
      return <FileText className="h-3 w-3" />
    case 'guide':
      return <BookOpen className="h-3 w-3" />
    case 'exam':
      return <ClipboardCheck className="h-3 w-3" />
  }
}

function ResourceChip({
  resource,
  onClick,
}: {
  resource: ResourceLink
  onClick?: () => void
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1 cursor-pointer transition-colors',
        'hover:bg-primary hover:text-primary-foreground',
        'mx-0.5 py-0.5'
      )}
      onClick={onClick}
    >
      <ResourceIcon type={resource.type} />
      <span className="max-w-[200px] truncate">{resource.title}</span>
    </Badge>
  )
}

// Markdown text renderer for text parts
function MarkdownText({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        // Remove default paragraph wrapper to allow inline flow
        p: ({ children }) => <span className="inline">{children}</span>,
        // Style other elements appropriately
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children }) => (
          <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>
        ),
        ul: ({ children }) => <ul className="list-disc list-inside my-2">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside my-2">{children}</ol>,
        li: ({ children }) => <li className="my-0.5">{children}</li>,
        h1: ({ children }) => <span className="block text-lg font-bold mt-3 mb-1">{children}</span>,
        h2: ({ children }) => <span className="block text-base font-bold mt-2 mb-1">{children}</span>,
        h3: ({ children }) => <span className="block text-sm font-bold mt-2 mb-1">{children}</span>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-muted-foreground/30 pl-3 my-2 italic">
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => (
          <a href={href} className="text-primary underline hover:no-underline" target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        pre: ({ children }) => (
          <pre className="bg-muted p-2 rounded my-2 overflow-x-auto text-xs">{children}</pre>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

export function MessageRenderer({
  content,
  onResourceClick,
  className,
}: MessageRendererProps) {
  const parts = useMemo(() => parseResourceLinks(content), [content])

  return (
    <div className={cn('text-sm', className)}>
      {parts.map((part, index) => {
        if (typeof part === 'string') {
          return (
            <Fragment key={index}>
              <MarkdownText content={part} />
            </Fragment>
          )
        }

        return (
          <ResourceChip
            key={index}
            resource={part}
            onClick={() => onResourceClick?.(part)}
          />
        )
      })}
    </div>
  )
}

// Export utility for external use
export { parseResourceLinks }
