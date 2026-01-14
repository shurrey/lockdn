import * as pdfjsLib from 'pdfjs-dist'
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import mammoth from 'mammoth'

// Configure PDF.js worker using local import
pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker

export interface ExtractedContent {
  text: string
  images: ExtractedImage[]
  pageCount?: number
}

export interface ExtractedImage {
  data: string // base64
  mediaType: string
  width?: number
  height?: number
}

/**
 * Render a PDF page to an image
 */
async function renderPageToImage(
  page: pdfjsLib.PDFPageProxy,
  scale: number = 2.0
): Promise<ExtractedImage> {
  const viewport = page.getViewport({ scale })

  // Create a canvas to render the page
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!
  canvas.width = viewport.width
  canvas.height = viewport.height

  // Render the page
  await page.render({
    canvasContext: context,
    viewport,
    canvas,
  }).promise

  // Convert to base64
  const dataUrl = canvas.toDataURL('image/png')
  const base64 = dataUrl.split(',')[1]

  return {
    data: base64,
    mediaType: 'image/png',
    width: viewport.width,
    height: viewport.height,
  }
}

/**
 * Extract text and images from a PDF file
 * If no text is found, renders pages as images for vision-based parsing
 */
export async function extractFromPDF(file: File): Promise<ExtractedContent> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const textParts: string[] = []
  const images: ExtractedImage[] = []

  // First pass: try to extract text
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .trim()
    textParts.push(pageText)
  }

  const combinedText = textParts.join('\n\n').trim()

  // If we got meaningful text, return it
  if (combinedText.length > 50) {
    return {
      text: combinedText,
      images: [],
      pageCount: pdf.numPages,
    }
  }

  // No text found - render pages as images for vision-based parsing

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    // Use scale of 1.5 for balance between quality and size
    // Limit to first 10 pages to avoid overwhelming the AI
    if (i <= 10) {
      const image = await renderPageToImage(page, 1.5)
      images.push(image)
    }
  }

  return {
    text: '', // No text, will rely on images
    images,
    pageCount: pdf.numPages,
  }
}

/**
 * Extract text from a Word document (DOCX)
 */
export async function extractFromDOCX(file: File): Promise<ExtractedContent> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })

  return {
    text: result.value,
    images: [],
  }
}

/**
 * Convert an image file to base64
 */
export async function extractFromImage(file: File): Promise<ExtractedContent> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      resolve({
        text: '', // Images don't have extractable text without OCR
        images: [
          {
            data: base64,
            mediaType: file.type,
          },
        ],
      })
    }

    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Extract text from a plain text file
 */
export async function extractFromText(file: File): Promise<ExtractedContent> {
  const text = await file.text()
  return {
    text,
    images: [],
  }
}

/**
 * Extract content from any supported file type
 */
export async function extractFromFile(file: File): Promise<ExtractedContent> {
  const type = file.type

  if (type === 'application/pdf') {
    return extractFromPDF(file)
  }

  if (
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    type === 'application/msword'
  ) {
    return extractFromDOCX(file)
  }

  if (type.startsWith('image/')) {
    return extractFromImage(file)
  }

  if (type === 'text/plain') {
    return extractFromText(file)
  }

  throw new Error(`Unsupported file type: ${type}`)
}

/**
 * Extract content from multiple files
 */
export async function extractFromFiles(files: File[]): Promise<{
  combinedText: string
  allImages: ExtractedImage[]
  fileResults: Array<{ fileName: string; content: ExtractedContent }>
}> {
  const fileResults: Array<{ fileName: string; content: ExtractedContent }> = []
  const allImages: ExtractedImage[] = []
  const textParts: string[] = []

  for (const file of files) {
    try {
      const content = await extractFromFile(file)
      fileResults.push({ fileName: file.name, content })

      if (content.text) {
        textParts.push(`--- ${file.name} ---\n${content.text}`)
      }

      allImages.push(...content.images)
    } catch (error) {
      console.error(`Failed to extract from ${file.name}:`, error)
      fileResults.push({
        fileName: file.name,
        content: { text: '', images: [] },
      })
    }
  }

  return {
    combinedText: textParts.join('\n\n'),
    allImages,
    fileResults,
  }
}
