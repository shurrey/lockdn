# Architecture Guide

This document explains Lockdn's architecture, design patterns, and key technical decisions for contributors.

---

## Architectural Principles

### 1. Local-First

All data lives on the user's device:
- IndexedDB for persistent storage
- No backend database
- Optional P2P sync

### 2. Privacy by Design

- No telemetry or analytics collection
- API keys encrypted at rest
- User owns and controls all data

### 3. Progressive Enhancement

- Core features work without AI
- AI features enhance, don't require
- Offline-capable for basic functionality

### 4. Simplicity

- Minimal dependencies
- Standard React patterns
- Clear separation of concerns

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌───────────────┐  │
│  │  Pages  │  │   UI    │  │ Feature │  │    Layouts    │  │
│  │         │  │Components│ │Components│  │               │  │
│  └────┬────┘  └────┬────┘  └────┬────┘  └───────────────┘  │
└───────┼────────────┼────────────┼───────────────────────────┘
        │            │            │
        ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────┐
│                      State Layer                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │   Dexie Hooks   │  │   Zustand (UI)  │  │ React Query │  │
│  │  (Live Queries) │  │   (Sync State)  │  │  (AI Calls) │  │
│  └────────┬────────┘  └────────┬────────┘  └──────┬──────┘  │
└───────────┼─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Tutor     │  │   Study     │  │   Grade Calculator  │  │
│  │   Logic     │  │   Planner   │  │   Exam Grading      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Notes     │  │  Syllabus   │  │   Attention         │  │
│  │  Processor  │  │   Parser    │  │   Prioritizer       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Data Access Layer                        │
│  ┌─────────────────────────────┐  ┌───────────────────────┐ │
│  │       Dexie.js              │  │    AI Providers       │ │
│  │    (IndexedDB Wrapper)      │  │   (API Abstraction)   │ │
│  └─────────────────────────────┘  └───────────────────────┘ │
│  ┌─────────────────────────────┐  ┌───────────────────────┐ │
│  │       Crypto                │  │    Sync Provider      │ │
│  │   (Key Encryption)          │  │   (WebRTC P2P)        │ │
│  └─────────────────────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Layer Responsibilities

### Presentation Layer

**Pages** (`src/pages/`)
- Route-level components
- Layout and composition
- Page-level state management

**UI Components** (`src/components/ui/`)
- Reusable UI primitives
- Based on Radix UI + shadcn/ui
- Stateless, composable

**Feature Components** (`src/components/*/`)
- Feature-specific components
- Combine UI components with business logic
- May contain local state

### State Layer

**Dexie Hooks** (`src/db/hooks.ts`)
- Primary data access
- Live queries for reactive updates
- CRUD operations

**Zustand** (`src/stores/`)
- UI state (not persisted)
- Sync status
- Transient application state

**React Query** (via TanStack Query)
- AI request caching
- Request deduplication
- Loading/error states

### Business Logic Layer

**Pure functions** (`src/lib/`)
- No React dependencies
- Testable in isolation
- Domain logic

### Data Access Layer

**Dexie.js** (`src/db/`)
- IndexedDB wrapper
- Schema management
- Queries and transactions

**AI Providers** (`src/lib/ai/`)
- Provider abstraction
- Request formatting
- Response parsing

---

## Key Design Patterns

### Repository Pattern (Database)

```typescript
// db/hooks.ts provides data access methods
export function useCourses() {
  return useLiveQuery(() =>
    db.courses
      .where('archivedAt')
      .equals(null)
      .toArray()
  );
}

export async function addCourse(course: Omit<Course, 'id'>) {
  return db.courses.add(course);
}
```

### Provider Pattern (AI)

```typescript
// lib/ai/index.ts
interface AIProvider {
  sendMessage(request: AIRequest): Promise<AIResponse>;
  supportsVision(): boolean;
}

// Usage
const provider = await getConfiguredProvider();
const response = await provider.sendMessage(request);
```

### Singleton Pattern (Preferences)

```typescript
// Single record for user preferences
const PREFERENCES_ID = 'user_preferences';

async function getPreferences(): Promise<Preferences> {
  return db.preferences.get(PREFERENCES_ID);
}

async function updatePreferences(updates: Partial<Preferences>) {
  await db.preferences.update(PREFERENCES_ID, updates);
}
```

### Observer Pattern (Live Queries)

```typescript
// Components re-render when data changes
function CourseList() {
  // Automatically updates when courses change
  const courses = useLiveQuery(() => db.courses.toArray());

  return (
    <ul>
      {courses?.map(course => (
        <li key={course.id}>{course.name}</li>
      ))}
    </ul>
  );
}
```

---

## Data Flow

### Read Flow

```
User Views Page
       │
       ▼
┌──────────────────┐
│  useLiveQuery    │ ─── Subscribe to changes
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│    Dexie.js      │ ─── Execute query
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│    IndexedDB     │ ─── Return data
└────────┬─────────┘
         │
         ▼
   Component Renders
```

### Write Flow

```
User Action (Add Course)
       │
       ▼
┌──────────────────┐
│  Event Handler   │ ─── Validate input
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  db.courses.add  │ ─── Write to DB
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Live Query     │ ─── Notified of change
│   Subscribers    │
└────────┬─────────┘
         │
         ▼
   Components Re-render
```

### AI Request Flow

```
User Asks Question
       │
       ▼
┌──────────────────┐
│  Build Context   │ ─── Gather relevant data
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Format Request   │ ─── Create AI request
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  AI Provider     │ ─── Send to external API
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Parse Response   │ ─── Extract content
└────────┬─────────┘
         │
         ▼
   Display to User
```

---

## Database Schema

### Schema Version Management

```typescript
// db/index.ts
db.version(1).stores({
  courses: '++id, name, code',
  assignments: '++id, courseId, dueDate, status'
});

db.version(2).stores({
  courses: '++id, name, code, archivedAt',
  assignments: '++id, courseId, dueDate, status, archivedAt'
});

// Continue for new versions...
```

### Key Tables

| Table | Purpose | Key Indexes |
|-------|---------|-------------|
| `courses` | Course definitions | `archivedAt` |
| `assignments` | Assignments per course | `courseId`, `dueDate`, `status` |
| `notes` | Uploaded notes | `courseId`, `archivedAt` |
| `studyMaterials` | Generated materials | `courseId`, `type` |
| `studySessions` | Study tracking | `courseId`, `status` |
| `preferences` | User settings | Single record (`user_preferences`) |
| `encryptedApiKeys` | API credentials | `provider` |

### Soft Deletes

Most tables use soft deletes via `archivedAt`:

```typescript
// Query active records
db.courses.where('archivedAt').equals(null).toArray();

// Archive (soft delete)
db.courses.update(id, { archivedAt: new Date() });

// Hard delete (rare)
db.courses.delete(id);
```

---

## AI Provider Architecture

### Abstraction Layer

```typescript
// lib/ai/types.ts
interface AIProviderInterface {
  sendMessage(request: AIRequest): Promise<AIResponse>;
  supportsVision(): boolean;
}

interface AIRequest {
  messages: Message[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}
```

### Provider Implementations

```
lib/ai/
├── index.ts        # Factory and exports
├── types.ts        # Shared types
├── anthropic.ts    # Anthropic implementation
├── openai.ts       # OpenAI implementation
├── google.ts       # Google implementation
└── ollama.ts       # Ollama implementation
```

### Provider Selection

```typescript
// Get user's preferred provider
const provider = await getConfiguredProvider();

// Get specific provider
const anthropic = await getProvider('anthropic');

// Check if any provider is configured
const hasProvider = await hasConfiguredProvider();
```

---

## Sync Architecture

### Protocol Overview

```
Device A                    Signaling Server                    Device B
    │                             │                                 │
    │──── Connect ───────────────►│                                 │
    │                             │◄──────────────── Connect ───────│
    │                             │                                 │
    │◄─────────────── Peer Info ──┼──── Peer Info ─────────────────►│
    │                             │                                 │
    │◄════════════════════════════╪═══════════════════════════════►│
    │         Direct WebRTC Connection (DTLS Encrypted)             │
    │                                                               │
    │──── Sync Request ────────────────────────────────────────────►│
    │◄──────────────────────────────────────────── Sync Response ───│
    │                                                               │
    │◄════════════ Real-time Change Notifications ════════════════►│
```

### Sync Protocol Messages

| Message Type | Purpose |
|--------------|---------|
| `sync_request` | Request full data sync |
| `sync_response` | Full data batch |
| `change` | Single record update |
| `delete` | Record deletion |
| `ack` | Acknowledgment |
| `device_info` | Device handshake |

### Conflict Resolution

Last-write-wins based on `updatedAt` timestamp:

```typescript
function resolveConflict(local: Record, remote: Record): Record {
  return local.updatedAt > remote.updatedAt ? local : remote;
}
```

---

## Security Architecture

### API Key Encryption

```
User enters API key
        │
        ▼
┌───────────────────────────────────────┐
│ 1. Get device secret from localStorage │
│ 2. Generate random salt (16 bytes)     │
│ 3. Generate random IV (12 bytes)       │
│ 4. PBKDF2(secret, salt, 100000) → key  │
│ 5. AES-GCM(key, iv, apiKey) → cipher   │
│ 6. base64(salt + iv + cipher) → stored │
└───────────────────────────────────────┘
        │
        ▼
   IndexedDB (encrypted value)
```

### Device Secret

- Generated once per browser/device
- Stored in localStorage (not synced)
- Required to decrypt API keys

---

## Component Architecture

### Page Components

```typescript
// Typical page structure
function CoursesPage() {
  // Data from hooks
  const courses = useCourses();
  const assignments = useAssignments();

  // Local UI state
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Render
  return (
    <PageLayout title="Courses">
      <CourseList courses={courses} />
      <AddCourseDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
      />
    </PageLayout>
  );
}
```

### Feature Components

```typescript
// Feature component with local state and business logic
function CourseCard({ course }: { course: Course }) {
  const assignments = useAssignments(course.id);
  const grade = calculateGrade(assignments);

  return (
    <Card>
      <CardHeader>{course.name}</CardHeader>
      <CardContent>
        <GradeDisplay grade={grade} />
        <AssignmentList assignments={assignments} />
      </CardContent>
    </Card>
  );
}
```

### UI Components

```typescript
// Pure UI component, no business logic
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
  onClick?: () => void;
}

function Button({ variant = 'primary', children, onClick }: ButtonProps) {
  return (
    <button className={cn(baseStyles, variantStyles[variant])} onClick={onClick}>
      {children}
    </button>
  );
}
```

---

## Testing Strategy

### Unit Tests

- Business logic functions
- Utility functions
- Data transformations

### Integration Tests

- Component rendering
- Hook behavior
- User interactions

### E2E Tests

- Critical user flows
- Cross-feature interactions
- Edge cases

### Test Organization

```
src/
├── lib/
│   ├── gradeCalculator.ts
│   └── gradeCalculator.test.ts    # Unit test
├── components/
│   └── CourseCard.test.tsx        # Integration test
e2e/
└── courses.spec.ts                # E2E test
```

---

## Performance Considerations

### Database Queries

- Use indexes for filtered queries
- Limit result sets when possible
- Use live queries for automatic updates

### Rendering

- Memo expensive computations
- Use React.memo for pure components
- Lazy load heavy components

### AI Requests

- Cache responses where appropriate
- Stream long responses
- Handle timeouts gracefully

---

## Extension Points

### Adding New AI Providers

1. Implement `AIProviderInterface`
2. Add to provider factory
3. Add UI for configuration

### Adding New Data Types

1. Add table to schema (new version)
2. Create hooks for access
3. Add sync support

### Adding New Features

1. Create lib functions for logic
2. Create components for UI
3. Add page if needed
4. Write tests
