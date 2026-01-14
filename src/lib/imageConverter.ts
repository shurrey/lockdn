import heic2any from 'heic2any'

/**
 * Check if a file is a HEIC/HEIF image
 */
export function isHeicFile(file: File): boolean {
  // Check MIME type
  if (file.type === 'image/heic' || file.type === 'image/heif') {
    return true
  }
  // Also check file extension (some browsers don't set MIME type correctly)
  const extension = file.name.toLowerCase().split('.').pop()
  return extension === 'heic' || extension === 'heif'
}

/**
 * Convert a HEIC/HEIF file to JPEG
 * Returns a new File object with the converted image
 */
export async function convertHeicToJpeg(file: File): Promise<File> {
  if (!isHeicFile(file)) {
    return file
  }

  try {
    const convertedBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9,
    })

    // heic2any can return a single blob or array of blobs
    const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob

    // Create a new filename with .jpg extension
    const newFileName = file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg')

    // Create a new File object
    return new File([blob], newFileName, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    })
  } catch (error) {
    console.error('Failed to convert HEIC file:', error)
    throw new Error(`Failed to convert ${file.name} from HEIC format. Please convert it to JPEG or PNG manually.`)
  }
}

/**
 * Process a file, converting HEIC to JPEG if necessary
 */
export async function processImageFile(file: File): Promise<File> {
  if (isHeicFile(file)) {
    return convertHeicToJpeg(file)
  }
  return file
}
