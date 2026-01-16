import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ExternalLink, Loader2 } from 'lucide-react'
import { getDocContent, getGitHubDocUrl } from '@/lib/docs'

interface HelpPanelProps {
  docPath: string
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
}

export function HelpPanel({ docPath, open, onOpenChange, title }: HelpPanelProps) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && !content) {
      setLoading(true)
      setError(null)
      getDocContent(docPath)
        .then(setContent)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [open, docPath, content])

  // Reset content when docPath changes
  useEffect(() => {
    setContent(null)
    setError(null)
  }, [docPath])

  const githubUrl = getGitHubDocUrl(docPath)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-hidden flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>{title || 'Help'}</SheetTitle>
          <SheetDescription>
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto text-muted-foreground"
              asChild
            >
              <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                View full documentation on GitHub
              </a>
            </Button>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-destructive text-sm py-4">
              Failed to load documentation: {error}
            </div>
          ) : content ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Style links to open in new tabs
                  a: ({ children, href, ...props }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      {...props}
                    >
                      {children}
                    </a>
                  ),
                  // Style code blocks
                  code: ({ children, className, ...props }) => {
                    const isInline = !className
                    return isInline ? (
                      <code
                        className="bg-muted px-1 py-0.5 rounded text-sm"
                        {...props}
                      >
                        {children}
                      </code>
                    ) : (
                      <code
                        className={`block bg-muted p-3 rounded-md text-sm overflow-x-auto ${className || ''}`}
                        {...props}
                      >
                        {children}
                      </code>
                    )
                  },
                  // Style tables
                  table: ({ children }) => (
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse border border-border">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border border-border bg-muted px-3 py-2 text-left font-medium">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-border px-3 py-2">{children}</td>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
