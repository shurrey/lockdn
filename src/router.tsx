import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '@/pages/RootLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { CalendarPage } from '@/pages/CalendarPage'
import { StudyPage } from '@/pages/StudyPage'
import { CoursesPage } from '@/pages/CoursesPage'
import { TutorPage } from '@/pages/TutorPage'
import { NotesPage } from '@/pages/NotesPage'
import { StudyMaterialsPage } from '@/pages/StudyMaterialsPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ArchivePage } from '@/pages/ArchivePage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'calendar',
        element: <CalendarPage />,
      },
      {
        path: 'study',
        element: <StudyPage />,
      },
      {
        path: 'courses',
        element: <CoursesPage />,
      },
      {
        path: 'tutor',
        element: <TutorPage />,
      },
      {
        path: 'notes',
        element: <NotesPage />,
      },
      {
        path: 'materials',
        element: <StudyMaterialsPage />,
      },
      {
        path: 'analytics',
        element: <AnalyticsPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'archive',
        element: <ArchivePage />,
      },
    ],
  },
])
