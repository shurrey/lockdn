# Development Guide

This guide walks you through setting up a local development environment for Lockdn.

---

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 20.x | Runtime |
| npm | 10.x+ | Package manager |
| Git | 2.x+ | Version control |

### Recommended Tools

| Tool | Purpose |
|------|---------|
| VS Code | IDE with excellent TypeScript support |
| nvm | Node version management |
| React DevTools | Browser extension for debugging |

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/lockdn/lockdn.git
cd lockdn
```

### 2. Use Correct Node Version

Lockdn requires Node.js 20:

```bash
# Using nvm (recommended)
nvm install 20
nvm use 20

# Verify version
node --version  # Should show v20.x.x
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 5. Load Sample Data (Optional)

To test with realistic data, import the sample data file:

1. Start the app and complete the onboarding
2. Go to **Settings** → **Data** → **Import**
3. Select `dev/sample-data.json` from the repository
4. Click **Import**

The sample data includes:
- 4 courses (PSY 101, MATH 152, CS 201, ENG 102)
- 15 assignments with various due dates and weights
- 4 notes linked to courses
- 2 study materials
- 5 study sessions
- Analytics data with streaks
- User preferences

This gives you a populated app to test against without manually creating data.

---

## Project Structure

```
lockdn/
├── src/
│   ├── components/         # React components
│   │   ├── ui/            # Reusable UI components (shadcn/ui)
│   │   ├── analytics/     # Analytics visualizations
│   │   ├── courses/       # Course-related components
│   │   ├── onboarding/    # Onboarding wizard
│   │   ├── settings/      # Settings forms
│   │   ├── syllabus/      # Syllabus upload/review
│   │   ├── sync/          # Device sync components
│   │   └── tutor/         # AI tutor interface
│   │
│   ├── pages/             # Page components (routes)
│   │   ├── DashboardPage.tsx
│   │   ├── CoursesPage.tsx
│   │   ├── CalendarPage.tsx
│   │   └── ...
│   │
│   ├── lib/               # Business logic and utilities
│   │   ├── ai/            # AI provider implementations
│   │   ├── sync/          # P2P sync protocol
│   │   ├── tutor.ts       # Tutor system prompts
│   │   ├── studyPlanner.ts
│   │   ├── gradeCalculator.ts
│   │   ├── crypto.ts      # Encryption utilities
│   │   └── ...
│   │
│   ├── db/                # Database layer
│   │   ├── index.ts       # Dexie database definition
│   │   └── hooks.ts       # React hooks for data access
│   │
│   ├── types/             # TypeScript type definitions
│   ├── hooks/             # Custom React hooks
│   ├── router.tsx         # Route definitions
│   ├── main.tsx           # App entry point
│   └── index.css          # Global styles
│
├── public/                # Static assets
├── e2e/                   # End-to-end tests (Playwright)
├── docs/                  # Documentation
├── dev/                   # Developer resources
│   └── sample-data.json   # Test data for development
├── signaling/             # Signaling server (PartyKit)
└── scripts/               # Build scripts
```

---

## Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm test` | Run unit tests |
| `npm run test:ui` | Run tests with UI |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:e2e` | Run E2E tests |
| `npm run test:e2e:ui` | Run E2E tests with UI |
| `npm run lint` | Run ESLint |

---

## Development Workflow

### Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/my-feature
   ```

2. Start the dev server:
   ```bash
   npm run dev
   ```

3. Make changes — the browser will hot-reload

4. Run tests:
   ```bash
   npm test
   ```

5. Commit changes:
   ```bash
   git add .
   git commit -m "feat: add my feature"
   ```

### Testing Your Changes

**Unit tests:**
```bash
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test src/lib/foo.test.ts  # Run specific test
```

**E2E tests:**
```bash
npm run test:e2e           # Run all E2E tests
npm run test:e2e:headed    # Run with browser visible
npm run test:e2e:ui        # Run with Playwright UI
```

### Debugging

**Browser DevTools:**
- React DevTools for component inspection
- Network tab for API calls
- Application tab for IndexedDB inspection

**VS Code:**
- Use the debugger with breakpoints
- Install recommended extensions

---

## Key Concepts

### Database (Dexie.js)

Lockdn uses Dexie.js for IndexedDB access:

```typescript
// Access the database
import { db } from '@/db';

// Query courses
const courses = await db.courses.toArray();

// Add a course
const id = await db.courses.add({
  name: 'Physics 101',
  code: 'PHY101',
  color: '#3b82f6',
  createdAt: new Date(),
  updatedAt: new Date()
});

// Use live queries in components
import { useLiveQuery } from 'dexie-react-hooks';

function CourseList() {
  const courses = useLiveQuery(() => db.courses.toArray());
  // Re-renders automatically when data changes
}
```

### Custom Hooks (db/hooks.ts)

Most data access should use the custom hooks:

```typescript
import { useCourses, useAssignments, useNotes } from '@/db/hooks';

function MyComponent() {
  const courses = useCourses();
  const assignments = useAssignments(courseId);
  // ...
}
```

### AI Providers (lib/ai/)

AI provider abstraction:

```typescript
import { getConfiguredProvider } from '@/lib/ai';

async function askTutor(question: string) {
  const provider = await getConfiguredProvider();
  if (!provider) return null;

  const response = await provider.sendMessage({
    messages: [{ role: 'user', content: question }],
    systemPrompt: tutorSystemPrompt
  });

  return response;
}
```

### P2P Sync (lib/sync/)

Sync uses WebRTC for P2P communication:

```typescript
import { syncProvider } from '@/lib/sync/provider';

// Start sync
await syncProvider.connect();

// Subscribe to sync events
syncProvider.onData((data) => {
  // Handle incoming sync data
});
```

---

## Adding New Features

### 1. Add a New Page

```typescript
// src/pages/NewPage.tsx
export function NewPage() {
  return (
    <div>
      <h1>New Page</h1>
    </div>
  );
}

// Add to router.tsx
import { NewPage } from './pages/NewPage';

// In routes array:
{ path: '/new', element: <NewPage /> }
```

### 2. Add a New Database Table

```typescript
// src/db/index.ts
// Add to schema version
this.version(7).stores({
  // ... existing tables
  newTable: '++id, field1, [field1+field2]'
});

// Add type
interface NewRecord {
  id?: number;
  field1: string;
  field2: string;
}
```

### 3. Add a New AI Feature

```typescript
// src/lib/newFeature.ts
import { getConfiguredProvider } from '@/lib/ai';

export async function newAIFeature(input: string): Promise<string> {
  const provider = await getConfiguredProvider();
  if (!provider) throw new Error('No AI provider configured');

  const response = await provider.sendMessage({
    messages: [{ role: 'user', content: input }],
    systemPrompt: 'Your system prompt here...'
  });

  return response.content;
}
```

---

## Common Tasks

### Working with UI Components

Lockdn uses shadcn/ui components:

```typescript
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

function MyComponent() {
  return (
    <Card>
      <CardHeader>Title</CardHeader>
      <CardContent>
        <Input placeholder="Enter text" />
        <Button>Submit</Button>
      </CardContent>
    </Card>
  );
}
```

### Adding Tests

```typescript
// src/lib/myFunction.test.ts
import { describe, it, expect } from 'vitest';
import { myFunction } from './myFunction';

describe('myFunction', () => {
  it('should return expected value', () => {
    expect(myFunction('input')).toBe('expected output');
  });

  it('should handle edge case', () => {
    expect(myFunction('')).toBeUndefined();
  });
});
```

### Working with Dates

Use date-fns for date manipulation:

```typescript
import { format, addDays, isBefore } from 'date-fns';

const formatted = format(new Date(), 'MMM d, yyyy');
const nextWeek = addDays(new Date(), 7);
const isPast = isBefore(dueDate, new Date());
```

---

## Environment Variables

Create `.env.local` for local overrides:

```env
# Optional: Custom signaling server
VITE_SIGNALING_URL=wss://your-signaling-server.com
```

---

## Troubleshooting

### "Module not found"

```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
```

### "Build fails with type errors"

```bash
# Check TypeScript errors
npx tsc --noEmit
```

### "Tests fail randomly"

```bash
# Run tests in isolation
npm test -- --run --reporter=verbose
```

### "IndexedDB issues in tests"

Tests use fake-indexeddb. If you encounter issues:

```typescript
// In your test file
import 'fake-indexeddb/auto';
```

---

## IDE Setup

### VS Code Extensions

Recommended extensions (in `.vscode/extensions.json`):
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript Vue Plugin

### VS Code Settings

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

---

## Next Steps

- Read the [Architecture Guide](./architecture.md) for system design
- Review [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines
- Check the issue tracker for work items
- Join GitHub Discussions for questions
