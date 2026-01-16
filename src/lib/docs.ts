/**
 * Documentation utilities for in-app help
 */

// Map page routes to their corresponding doc paths
export const PAGE_DOCS: Record<string, string> = {
  '/': 'user/features/dashboard',
  '/courses': 'user/features/courses',
  '/study': 'user/features/study-planning',
  '/tutor': 'user/features/tutor',
  '/notes': 'user/features/notes',
  '/materials': 'user/features/study-materials',
  '/analytics': 'user/features/analytics',
  '/calendar': 'user/features/calendar',
  '/settings': 'user/features/settings',
}

// Get the doc path for a given route
export function getDocPathForRoute(route: string): string {
  return PAGE_DOCS[route] || 'user/getting-started'
}

// Cache for fetched docs
const docCache = new Map<string, { content: string; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// GitHub raw content URL base
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/shurrey/lockdn/main/docs'

/**
 * Fetch markdown content from GitHub
 */
export async function getDocContent(docPath: string): Promise<string> {
  // Check cache first
  const cached = docCache.get(docPath)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.content
  }

  try {
    // Fetch from GitHub raw content
    const response = await fetch(`${GITHUB_RAW_BASE}/${docPath}.md`)

    if (!response.ok) {
      throw new Error(`Failed to fetch doc: ${response.status}`)
    }

    const content = await response.text()

    // Cache the result
    docCache.set(docPath, { content, timestamp: Date.now() })

    return content
  } catch (error) {
    console.error('Error fetching doc:', error)
    return `# Documentation Not Found

The documentation for this page could not be loaded.

Please check the [full documentation on GitHub](https://github.com/anthropics/student-course-tools/tree/main/docs).`
  }
}

/**
 * Get the GitHub URL for a doc path
 */
export function getGitHubDocUrl(docPath: string): string {
  return `https://github.com/shurrey/lockdn/blob/main/docs/${docPath}.md`
}
