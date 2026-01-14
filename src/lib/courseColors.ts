/**
 * Course color palette - 10 distinct, visually distinguishable colors
 * These colors are chosen to be accessible and work well in both light and dark modes
 */
export const COURSE_COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
] as const

export type CourseColor = typeof COURSE_COLORS[number]['value']

/**
 * Get the next available color that isn't already used by existing courses
 * @param usedColors - Array of color values currently in use
 * @returns The first available color, or cycles back if all are used
 */
export function getNextAvailableColor(usedColors: string[]): string {
  const usedSet = new Set(usedColors.map(c => c.toLowerCase()))

  // Find the first color not in use
  for (const color of COURSE_COLORS) {
    if (!usedSet.has(color.value.toLowerCase())) {
      return color.value
    }
  }

  // If all colors are used (more than 10 courses), cycle back to the first
  return COURSE_COLORS[0].value
}

/**
 * Get available colors for display (marks which ones are in use)
 * @param usedColors - Array of color values currently in use
 * @param currentColor - The current course's color (to not mark it as "in use")
 */
export function getColorsWithAvailability(
  usedColors: string[],
  currentColor?: string
): Array<{ name: string; value: string; inUse: boolean }> {
  const usedSet = new Set(
    usedColors
      .filter(c => c.toLowerCase() !== currentColor?.toLowerCase())
      .map(c => c.toLowerCase())
  )

  return COURSE_COLORS.map(color => ({
    ...color,
    inUse: usedSet.has(color.value.toLowerCase()),
  }))
}
