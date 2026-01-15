import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const publicDir = path.join(__dirname, '..', 'public')
const svgPath = path.join(publicDir, 'lockdn-final-mascot-dark-bg.svg')

// Read SVG and add a background for better visibility on home screens
const svgContent = fs.readFileSync(svgPath, 'utf8')

// Parse viewBox from SVG to get proper dimensions
const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/)
const viewBox = viewBoxMatch ? viewBoxMatch[1].split(' ').map(Number) : [0, 0, 100, 100]
const svgWidth = viewBox[2] - viewBox[0]
const svgHeight = viewBox[3] - viewBox[1]

// Create a wrapper SVG with padding and background for maskable icon
function createMaskableSvg(size) {
  const padding = Math.round(size * 0.1) // 10% padding for safe area
  const innerSize = size - (padding * 2)

  // Calculate scale to fit
  const scale = innerSize / Math.max(svgWidth, svgHeight)
  const scaledWidth = svgWidth * scale
  const scaledHeight = svgHeight * scale

  // Center position
  const x = padding + (innerSize - scaledWidth) / 2
  const y = padding + (innerSize - scaledHeight) / 2

  // Extract inner content from SVG (remove svg wrapper)
  const innerContent = svgContent
    .replace(/<\?xml[^>]*\?>/, '')
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>/, '')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#1a1a2e"/>
    <g transform="translate(${x}, ${y}) scale(${scale})">
      ${innerContent}
    </g>
  </svg>`
}

// Generate icons
async function generateIcons() {
  const sizes = [192, 512]

  for (const size of sizes) {
    const maskableSvg = createMaskableSvg(size)

    await sharp(Buffer.from(maskableSvg))
      .resize(size, size)
      .png()
      .toFile(path.join(publicDir, `pwa-${size}x${size}.png`))

    console.log(`Generated pwa-${size}x${size}.png`)
  }

  // Also generate apple-touch-icon (180x180)
  const appleSvg = createMaskableSvg(180)
  await sharp(Buffer.from(appleSvg))
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'))
  console.log('Generated apple-touch-icon.png')
}

generateIcons().catch(console.error)
