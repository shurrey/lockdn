import { useState, useCallback, useEffect, useRef } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SourceImage {
  id: string
  dataUrl: string
  name?: string
}

// Bounding box for highlighting (normalized 0-1000 coordinates)
export interface ImageBoundingBox {
  imageIndex: number
  x: number
  y: number
  width: number
  height: number
  label?: string
}

interface SourceImageViewerProps {
  images: SourceImage[]
  highlightedIndex?: number | null
  boundingBoxes?: ImageBoundingBox[] // All bounding boxes
  activeBoundingBoxIndex?: number | null // Which one to highlight
  activeImageIndex?: number | null // Externally controlled: switch to this image
  onImageHover?: (index: number | null) => void
  className?: string
}

export function SourceImageViewer({
  images,
  highlightedIndex,
  boundingBoxes = [],
  activeBoundingBoxIndex,
  activeImageIndex,
  onImageHover,
  className,
}: SourceImageViewerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showFullscreen, setShowFullscreen] = useState(false)
  const imageContainerRef = useRef<HTMLDivElement>(null)

  // Get bounding boxes for the current image
  const currentBoxes = boundingBoxes.filter(box => box.imageIndex === selectedIndex)

  // Get the active bounding box if it's on the current image
  const activeBox = activeBoundingBoxIndex !== null && activeBoundingBoxIndex !== undefined
    ? boundingBoxes[activeBoundingBoxIndex]
    : null

  // Auto-switch to the image containing the active bounding box
  useEffect(() => {
    if (activeBox && activeBox.imageIndex !== selectedIndex) {
      setSelectedIndex(activeBox.imageIndex)
    }
  }, [activeBox, selectedIndex])

  // Auto-switch to externally specified image index
  useEffect(() => {
    if (activeImageIndex !== null && activeImageIndex !== undefined && activeImageIndex !== selectedIndex) {
      setSelectedIndex(activeImageIndex)
    }
  }, [activeImageIndex, selectedIndex])

  const navigateImage = useCallback((direction: 'prev' | 'next') => {
    setSelectedIndex((prev) => {
      if (direction === 'prev') {
        return prev > 0 ? prev - 1 : images.length - 1
      } else {
        return prev < images.length - 1 ? prev + 1 : 0
      }
    })
  }, [images.length])

  if (images.length === 0) return null

  const currentImage = images[selectedIndex]

  // Convert normalized coordinates (0-1000) to percentages
  const boxToStyle = (box: ImageBoundingBox) => ({
    left: `${box.x / 10}%`,
    top: `${box.y / 10}%`,
    width: `${box.width / 10}%`,
    height: `${box.height / 10}%`,
  })

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Main Image Display */}
      <div
        ref={imageContainerRef}
        className="flex-1 relative bg-muted/30 rounded-lg overflow-hidden min-h-0"
      >
        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center bg-gradient-to-r from-black/30 to-transparent hover:from-black/50 transition-all z-10"
              onClick={() => navigateImage('prev')}
            >
              <ChevronLeft className="h-6 w-6 text-white drop-shadow-lg" />
            </button>
            <button
              className="absolute right-0 top-0 bottom-0 w-10 flex items-center justify-center bg-gradient-to-l from-black/30 to-transparent hover:from-black/50 transition-all z-10"
              onClick={() => navigateImage('next')}
            >
              <ChevronRight className="h-6 w-6 text-white drop-shadow-lg" />
            </button>
          </>
        )}

        {/* Image with Overlay Container */}
        <div
          className={cn(
            'w-full h-full flex items-center justify-center p-2 transition-all duration-200',
            highlightedIndex !== null && highlightedIndex !== undefined && highlightedIndex !== selectedIndex && 'opacity-50'
          )}
        >
          {/* This wrapper uses inline-block to shrink to fit the image exactly */}
          <div className="relative inline-block max-w-full max-h-full">
            <img
              src={currentImage.dataUrl}
              alt={currentImage.name || `Image ${selectedIndex + 1}`}
              className="block max-w-full max-h-full object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setShowFullscreen(true)}
            />

            {/* Bounding Box Overlays - positioned relative to image */}
            {currentBoxes.map((box, idx) => {
              const isActive = activeBox &&
                activeBox.imageIndex === box.imageIndex &&
                activeBox.x === box.x &&
                activeBox.y === box.y

              return (
                <div
                  key={idx}
                  className={cn(
                    'absolute border-2 pointer-events-none transition-all duration-300',
                    isActive
                      ? 'border-primary bg-primary/20 shadow-lg shadow-primary/50 animate-pulse'
                      : 'border-yellow-400/50 bg-yellow-400/10'
                  )}
                  style={boxToStyle(box)}
                >
                  {isActive && box.label && (
                    <span className="absolute -top-6 left-0 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded whitespace-nowrap">
                      {box.label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Zoom button */}
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8 bg-white/90 hover:bg-white z-20"
          onClick={() => setShowFullscreen(true)}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>

        {/* Page indicator */}
        {images.length > 1 && (
          <Badge className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 z-20">
            {selectedIndex + 1} / {images.length}
          </Badge>
        )}
      </div>

      {/* Thumbnail Strip */}
      {images.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
          {images.map((image, index) => {
            const hasActiveBox = activeBox?.imageIndex === index
            return (
              <button
                key={image.id}
                className={cn(
                  'flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all',
                  index === selectedIndex
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-transparent hover:border-primary/50',
                  hasActiveBox && 'ring-2 ring-yellow-400 border-yellow-400'
                )}
                onClick={() => setSelectedIndex(index)}
                onMouseEnter={() => onImageHover?.(index)}
                onMouseLeave={() => onImageHover?.(null)}
              >
                <img
                  src={image.dataUrl}
                  alt={image.name || `Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            )
          })}
        </div>
      )}

      {/* Fullscreen Dialog */}
      <Dialog open={showFullscreen} onOpenChange={setShowFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 bg-black/95">
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/20 z-20"
              onClick={() => setShowFullscreen(false)}
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Navigation */}
            {images.length > 1 && (
              <>
                <button
                  className="absolute left-0 top-0 bottom-0 w-20 flex items-center justify-center hover:bg-white/10 transition-all z-10"
                  onClick={() => navigateImage('prev')}
                >
                  <ChevronLeft className="h-12 w-12 text-white" />
                </button>
                <button
                  className="absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center hover:bg-white/10 transition-all z-10"
                  onClick={() => navigateImage('next')}
                >
                  <ChevronRight className="h-12 w-12 text-white" />
                </button>
              </>
            )}

            {/* Image with Overlays - inline-block shrinks to fit image */}
            <div className="relative inline-block">
              <img
                src={currentImage.dataUrl}
                alt={currentImage.name || `Image ${selectedIndex + 1}`}
                className="block max-w-[90vw] max-h-[90vh] object-contain"
              />

              {/* Bounding Box Overlays in Fullscreen */}
              {currentBoxes.map((box, idx) => {
                const isActive = activeBox &&
                  activeBox.imageIndex === box.imageIndex &&
                  activeBox.x === box.x &&
                  activeBox.y === box.y

                return (
                  <div
                    key={idx}
                    className={cn(
                      'absolute border-2 pointer-events-none transition-all duration-300',
                      isActive
                        ? 'border-primary bg-primary/20 shadow-lg shadow-primary/50'
                        : 'border-yellow-400/50 bg-yellow-400/10'
                    )}
                    style={boxToStyle(box)}
                  />
                )
              })}
            </div>

            {/* Page indicator */}
            {images.length > 1 && (
              <Badge className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white">
                {selectedIndex + 1} / {images.length}
              </Badge>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Helper to convert File[] to SourceImage[]
export async function filesToSourceImages(files: File[]): Promise<SourceImage[]> {
  return Promise.all(
    files.map(async (file, index) => {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })
      return {
        id: `file-${index}`,
        dataUrl,
        name: file.name,
      }
    })
  )
}
