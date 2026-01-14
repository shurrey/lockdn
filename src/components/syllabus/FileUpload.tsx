import { useCallback, useState } from 'react'
import { Upload, File, X, FileText, Image, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { isHeicFile, convertHeicToJpeg } from '@/lib/imageConverter'
import { toast } from 'sonner'

export interface UploadedFile {
  file: File
  preview?: string
  extractedText?: string
}

interface FileUploadProps {
  onFilesSelected: (files: UploadedFile[]) => void
  isProcessing?: boolean
  maxFiles?: number
  acceptedTypes?: string[]
}

const DEFAULT_ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
  'text/plain',
]

// File extensions to accept (for browsers that don't recognize HEIC MIME type)
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif', '.txt']

const FILE_TYPE_ICONS: Record<string, typeof File> = {
  'application/pdf': FileText,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileText,
  'application/msword': FileText,
  'text/plain': FileText,
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image
  return FILE_TYPE_ICONS[mimeType] || File
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileUpload({
  onFilesSelected,
  isProcessing = false,
  maxFiles = 5,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isConverting, setIsConverting] = useState(false)

  // Check if a file is acceptable (by MIME type or extension)
  const isFileAcceptable = useCallback((file: File): boolean => {
    // Check MIME type
    if (acceptedTypes.includes(file.type)) return true
    // Check extension (for HEIC files that may not have correct MIME type)
    const extension = '.' + file.name.toLowerCase().split('.').pop()
    return ACCEPTED_EXTENSIONS.includes(extension)
  }, [acceptedTypes])

  const handleFiles = useCallback(
    async (newFiles: FileList | null) => {
      if (!newFiles) return

      const filesToProcess: File[] = []

      for (let i = 0; i < newFiles.length && files.length + filesToProcess.length < maxFiles; i++) {
        const file = newFiles[i]
        if (isFileAcceptable(file)) {
          filesToProcess.push(file)
        }
      }

      if (filesToProcess.length === 0) return

      // Check if any files need HEIC conversion
      const hasHeicFiles = filesToProcess.some(isHeicFile)

      if (hasHeicFiles) {
        setIsConverting(true)
        toast.info('Converting HEIC images...')
      }

      try {
        const validFiles: UploadedFile[] = []

        for (const file of filesToProcess) {
          let processedFile = file

          // Convert HEIC to JPEG
          if (isHeicFile(file)) {
            try {
              processedFile = await convertHeicToJpeg(file)
            } catch (error) {
              toast.error(`Failed to convert ${file.name}`)
              continue
            }
          }

          const uploadedFile: UploadedFile = { file: processedFile }

          // Create preview for images
          if (processedFile.type.startsWith('image/')) {
            uploadedFile.preview = URL.createObjectURL(processedFile)
          }

          validFiles.push(uploadedFile)
        }

        if (validFiles.length > 0) {
          const updatedFiles = [...files, ...validFiles]
          setFiles(updatedFiles)
          onFilesSelected(updatedFiles)

          if (hasHeicFiles) {
            toast.success('HEIC images converted successfully')
          }
        }
      } finally {
        setIsConverting(false)
      }
    },
    [files, maxFiles, isFileAcceptable, onFilesSelected]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files)
      e.target.value = '' // Reset input
    },
    [handleFiles]
  )

  const removeFile = useCallback(
    (index: number) => {
      const updatedFiles = files.filter((_, i) => i !== index)
      // Revoke object URL if it exists
      if (files[index].preview) {
        URL.revokeObjectURL(files[index].preview!)
      }
      setFiles(updatedFiles)
      onFilesSelected(updatedFiles)
    },
    [files, onFilesSelected]
  )

  const clearAll = useCallback(() => {
    files.forEach((f) => {
      if (f.preview) URL.revokeObjectURL(f.preview)
    })
    setFiles([])
    onFilesSelected([])
  }, [files, onFilesSelected])

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          (isProcessing || isConverting) && 'pointer-events-none opacity-50'
        )}
      >
        <input
          type="file"
          multiple
          accept={[...acceptedTypes, ...ACCEPTED_EXTENSIONS].join(',')}
          onChange={handleInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isProcessing || isConverting || files.length >= maxFiles}
        />

        <div className="flex flex-col items-center gap-2">
          {isProcessing || isConverting ? (
            <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
          ) : (
            <Upload className="h-10 w-10 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium">
              {isConverting
                ? 'Converting HEIC images...'
                : isProcessing
                  ? 'Processing syllabus...'
                  : 'Drop your syllabus here or click to browse'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports PDF, Word, images (including iPhone HEIC), and text files
            </p>
          </div>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {files.length} file{files.length !== 1 ? 's' : ''} selected
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={isProcessing}
            >
              Clear all
            </Button>
          </div>

          <div className="grid gap-2">
            {files.map((uploadedFile, index) => {
              const Icon = getFileIcon(uploadedFile.file.type)
              return (
                <Card key={index}>
                  <CardContent className="flex items-center gap-3 p-3">
                    {uploadedFile.preview ? (
                      <img
                        src={uploadedFile.preview}
                        alt={uploadedFile.file.name}
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {uploadedFile.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(uploadedFile.file.size)}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(index)}
                      disabled={isProcessing}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
