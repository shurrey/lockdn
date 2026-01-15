import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from './router'
import { initializeDefaults } from './db'
import { ThemeProvider } from './components/ThemeProvider'
import { setupSyncHooks, syncProvider } from './lib/sync'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

// Initialize database defaults
initializeDefaults().catch(console.error)

// Set up real-time sync hooks
setupSyncHooks()

// Auto-reconnect to saved room after store hydrates
setTimeout(() => {
  syncProvider.autoReconnect().catch(console.error)
}, 100)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
)
