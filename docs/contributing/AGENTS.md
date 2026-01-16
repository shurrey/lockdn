# AGENTS.md — AI Coding Assistant Guidelines

This file provides guidelines for AI coding assistants (GitHub Copilot, Claude, Cursor, etc.) when working on the Lockdn codebase. If you're using an AI assistant to generate code for Lockdn, ensure it has access to this file.

---

## Project Overview

**Lockdn** is a local-first study management application for undergraduate students. It helps students organize courses, manage assignments, take notes, and study with AI assistance.

**Key characteristics:**
- React 19 + TypeScript
- Vite build system
- Dexie.js (IndexedDB) for storage
- No backend — all data is client-side
- P2P sync via WebRTC

---

## Critical Requirements

### Node.js Version

Always use Node.js 20:

```bash
nvm use 20 && npm install
nvm use 20 && npm run dev
nvm use 20 && npm test
```

### Never Do These Things

1. **Never add backend dependencies** — Lockdn has no backend
2. **Never add authentication libraries** — Lockdn has no accounts
3. **Never add telemetry/analytics** — Lockdn doesn't track users
4. **Never store unencrypted API keys** — Use the crypto utilities
5. **Never sync API keys** — They must never leave the device
6. **Never use `any` type** — Use proper TypeScript types

---

## Code Style

### TypeScript

```typescript
// Always type function parameters and returns
function calculateGrade(assignments: Assignment[]): number | undefined {
  // ...
}

// Use interfaces for objects
interface Course {
  id: number;
  name: string;
  code: string;
  color: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Use type for unions
type AssignmentStatus = 'pending' | 'in_progress' | 'completed';
```

### React Components

```typescript
// Use functional components with TypeScript
interface CourseCardProps {
  course: Course;
  onEdit?: (course: Course) => void;
}

function CourseCard({ course, onEdit }: CourseCardProps) {
  // Hooks at the top
  const assignments = useAssignments(course.id);
  const [isEditing, setIsEditing] = useState(false);

  // Event handlers
  const handleEdit = () => {
    setIsEditing(true);
    onEdit?.(course);
  };

  // Render
  return (
    <Card>
      <CardHeader>{course.name}</CardHeader>
      {/* ... */}
    </Card>
  );
}
```

### Imports

```typescript
// Order: React, external libs, internal absolute, internal relative
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '@/components/ui/button';
import { db } from '@/db';
import { CourseCard } from './CourseCard';
```

---

## Database Patterns

### Querying Data

```typescript
// Use custom hooks from db/hooks.ts when available
const courses = useCourses();
const assignments = useAssignments(courseId);

// For custom queries, use useLiveQuery
const upcomingAssignments = useLiveQuery(() =>
  db.assignments
    .where('dueDate')
    .aboveOrEqual(new Date())
    .and(a => a.status !== 'completed')
    .toArray()
);
```

### Writing Data

```typescript
// Add records
const id = await db.courses.add({
  name: 'Physics 101',
  code: 'PHY101',
  color: '#3b82f6',
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date()
});

// Update records
await db.courses.update(id, {
  name: 'Updated Name',
  updatedAt: new Date()
});

// Soft delete (preferred)
await db.courses.update(id, {
  archivedAt: new Date(),
  updatedAt: new Date()
});

// Hard delete (rare)
await db.courses.delete(id);
```

### Schema Changes

When adding tables or fields, create a new schema version:

```typescript
// In db/index.ts
db.version(NEXT_VERSION).stores({
  // ... existing tables
  newTable: '++id, field1, field2, [field1+field2]'
});
```

---

## AI Provider Integration

### Using AI Providers

```typescript
import { getConfiguredProvider, hasConfiguredProvider } from '@/lib/ai';

async function generateStudyGuide(notes: Note[]): Promise<string> {
  const provider = await getConfiguredProvider();
  if (!provider) {
    throw new Error('No AI provider configured');
  }

  const response = await provider.sendMessage({
    messages: [{
      role: 'user',
      content: `Generate a study guide from these notes: ${formatNotes(notes)}`
    }],
    systemPrompt: STUDY_GUIDE_SYSTEM_PROMPT,
    temperature: 0.7
  });

  return response.content;
}
```

### System Prompts

For tutor-like features, use the existing tutor patterns:

```typescript
import { buildTutorContext, getTutorSystemPrompt } from '@/lib/tutor';

const context = await buildTutorContext(courseId);
const systemPrompt = getTutorSystemPrompt(context);
```

---

## Component Patterns

### UI Components

Use shadcn/ui components from `@/components/ui/`:

```typescript
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
```

### Forms

Use React Hook Form with Zod validation:

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const courseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  color: z.string()
});

type CourseFormData = z.infer<typeof courseSchema>;

function CourseForm() {
  const form = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: { name: '', code: '', color: '#3b82f6' }
  });

  const onSubmit = async (data: CourseFormData) => {
    await db.courses.add({
      ...data,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* ... */}
    </form>
  );
}
```

---

## Testing

### Unit Tests

```typescript
// myFunction.test.ts
import { describe, it, expect } from 'vitest';
import { myFunction } from './myFunction';

describe('myFunction', () => {
  it('handles normal input', () => {
    expect(myFunction('input')).toBe('expected');
  });

  it('handles edge cases', () => {
    expect(myFunction('')).toBeUndefined();
    expect(myFunction(null)).toBeUndefined();
  });
});
```

### Component Tests

```typescript
// MyComponent.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    const onClick = vi.fn();
    render(<MyComponent onClick={onClick} />);

    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
});
```

---

## File Structure

When adding new features:

```
src/
├── components/
│   └── feature-name/
│       ├── FeatureComponent.tsx
│       ├── FeatureComponent.test.tsx
│       └── index.ts              # Re-exports
├── lib/
│   ├── featureLogic.ts           # Business logic
│   └── featureLogic.test.ts
└── pages/
    └── FeaturePage.tsx           # If new page needed
```

---

## Common Patterns

### Async Data Loading

```typescript
function DataComponent({ id }: { id: number }) {
  const data = useLiveQuery(() => db.items.get(id), [id]);

  if (data === undefined) {
    return <Skeleton />;  // Loading
  }

  if (data === null) {
    return <div>Not found</div>;
  }

  return <DataDisplay data={data} />;
}
```

### Error Handling

```typescript
async function performAction() {
  try {
    await riskyOperation();
    toast.success('Action completed');
  } catch (error) {
    console.error('Action failed:', error);
    toast.error('Something went wrong');
  }
}
```

### Date Formatting

```typescript
import { format, formatDistanceToNow } from 'date-fns';

// Display formats
const formatted = format(date, 'MMM d, yyyy');           // "Jan 15, 2024"
const withTime = format(date, 'MMM d, yyyy h:mm a');    // "Jan 15, 2024 3:30 PM"
const relative = formatDistanceToNow(date, { addSuffix: true }); // "in 3 days"
```

---

## Things to Avoid

### Anti-Patterns

```typescript
// ❌ Don't use any
function process(data: any) { }

// ✅ Use proper types
function process(data: ProcessData) { }

// ❌ Don't mutate state directly
const [items, setItems] = useState([]);
items.push(newItem);  // Wrong!

// ✅ Create new arrays
setItems([...items, newItem]);

// ❌ Don't fetch in render
function Component() {
  const data = await fetchData();  // Wrong!
}

// ✅ Use hooks
function Component() {
  const data = useLiveQuery(() => db.items.toArray());
}
```

### Security Anti-Patterns

```typescript
// ❌ Never store API keys in plain text
localStorage.setItem('apiKey', key);

// ✅ Use the crypto utilities
import { encryptApiKey } from '@/lib/crypto';
const encrypted = await encryptApiKey(key);
await db.encryptedApiKeys.add({ provider, encryptedKey: encrypted });

// ❌ Never include API keys in sync
const syncData = { ...allData, apiKeys };  // Wrong!

// ✅ Exclude sensitive data from sync
const syncData = excludeSensitiveData(allData);
```

---

## Helpful Resources

When working on Lockdn, refer to:

1. **Architecture**: `docs/contributing/architecture.md`
2. **Development**: `docs/contributing/development.md`
3. **Style Guide**: `docs/STYLE_GUIDE.md`
4. **Database Schema**: `src/db/index.ts`
5. **Type Definitions**: `src/types/index.ts`
6. **Sample Data**: `dev/sample-data.json` — realistic test data for development
7. **Existing Patterns**: Similar files in the codebase

### Sample Data for Testing

The `dev/sample-data.json` file contains realistic test data that can be imported via **Settings → Data → Import**. Use this to:

- Test features with a populated database
- Verify UI with realistic data volumes
- Debug issues without manual data entry

The sample data includes 4 courses, 15 assignments, notes, study materials, study sessions, and analytics data.

---

## Checklist Before Committing

When generating code, ensure:

- [ ] TypeScript types are complete (no `any`)
- [ ] React hooks follow Rules of Hooks
- [ ] New database operations use existing hooks or create new ones
- [ ] Sensitive data is encrypted
- [ ] Tests are included for new logic
- [ ] No telemetry or external tracking added
- [ ] No backend dependencies introduced
- [ ] Code follows existing patterns in the codebase
