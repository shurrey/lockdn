import { Outlet, NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Calendar,
  Brain,
  BookOpen,
  MessageSquare,
  FileText,
  Library,
  BarChart3,
  Settings,
  Archive,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Toaster } from '@/components/ui/sonner'
import { usePreferences } from '@/db/hooks'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { Logo } from '@/components/Logo'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/study', icon: Brain, label: 'Study' },
  { to: '/courses', icon: BookOpen, label: 'Courses' },
  { to: '/tutor', icon: MessageSquare, label: 'Tutor' },
  { to: '/notes', icon: FileText, label: 'Notes' },
  { to: '/materials', icon: Library, label: 'Study Materials' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/archive', icon: Archive, label: 'Archive' },
]

export function RootLayout() {
  const preferences = usePreferences()

  // Show loading while preferences are being fetched
  if (preferences === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Show onboarding wizard if not completed
  if (!preferences?.onboardingCompleted) {
    return (
      <>
        <OnboardingWizard />
        <Toaster />
      </>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card">
        <div className="flex h-16 items-center border-b border-border px-6">
          <Logo size="md" />
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      <Toaster />
    </div>
  )
}
