# Technical Architecture

This document provides a technical overview of Lockdn's architecture for IT professionals evaluating the application.

---

## System Overview

Lockdn is a client-side web application with no backend infrastructure:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Client (Browser)                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    React Application                     │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐│   │
│  │  │ Pages   │ │Components│ │  Hooks  │ │    Libraries    ││   │
│  │  │         │ │         │ │         │ │                 ││   │
│  │  │Dashboard│ │UI       │ │useLive  │ │AI Providers     ││   │
│  │  │Courses  │ │Settings │ │Query    │ │Study Planner    ││   │
│  │  │Calendar │ │Tutor    │ │useDB    │ │Exam Grading     ││   │
│  │  │Notes    │ │Analytics│ │         │ │Crypto           ││   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────────────┘│   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      Data Layer                          │   │
│  │  ┌─────────────────┐  ┌──────────────┐  ┌────────────┐  │   │
│  │  │   Dexie.js      │  │  localStorage │  │   Yjs      │  │   │
│  │  │  (IndexedDB)    │  │  (Config)     │  │  (CRDT)    │  │   │
│  │  └─────────────────┘  └──────────────┘  └────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Service Worker (PWA)                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
              │                              │
              ▼                              ▼
     ┌─────────────────┐          ┌─────────────────┐
     │   AI Providers   │          │  Signaling      │
     │   (External)     │          │  Server         │
     │                  │          │  (WebRTC)       │
     │  • Anthropic     │          │                 │
     │  • OpenAI        │          │  Peer Discovery │
     │  • Google        │          │  Only           │
     │  • Ollama        │          │                 │
     └─────────────────┘          └─────────────────┘
```

---

## Technology Stack

### Frontend

| Technology | Purpose | Version |
|------------|---------|---------|
| React | UI framework | 19.x |
| TypeScript | Type safety | 5.x |
| React Router | Navigation | 7.x |
| Tailwind CSS | Styling | 4.x |
| Radix UI | Accessible components | Latest |
| Recharts | Data visualization | 3.x |

### Data Storage

| Technology | Purpose | Details |
|------------|---------|---------|
| Dexie.js | IndexedDB wrapper | Typed queries, reactive hooks |
| localStorage | Configuration | Device secrets, theme preferences |
| Yjs | CRDT sync | Conflict-free data synchronization |

### Build & Tooling

| Tool | Purpose |
|------|---------|
| Vite | Build tool and dev server |
| ESLint | Code linting |
| Vitest | Unit testing |
| Playwright | E2E testing |

---

## Database Schema

### Tables

```
IndexedDB Database: lockdn

┌─────────────────────────────────────────────────────────────┐
│ Table: courses                                               │
├─────────────────────────────────────────────────────────────┤
│ id (auto)     │ Primary key                                  │
│ name          │ string                                       │
│ code          │ string                                       │
│ instructor    │ string?                                      │
│ color         │ string                                       │
│ schedule      │ MeetingTime[]                                │
│ semesterStart │ Date?                                        │
│ semesterEnd   │ Date?                                        │
│ syllabusData  │ SyllabusData?                                │
│ archivedAt    │ Date?                                        │
│ createdAt     │ Date                                         │
│ updatedAt     │ Date                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Table: assignments                                           │
├─────────────────────────────────────────────────────────────┤
│ id (auto)     │ Primary key                                  │
│ courseId      │ FK → courses                                 │
│ title         │ string                                       │
│ type          │ 'exam'│'paper'│'homework'│'project'│'quiz'   │
│ dueDate       │ Date                                         │
│ weight        │ number                                       │
│ status        │ 'pending'│'in_progress'│'completed'          │
│ grade         │ number?                                      │
│ estimatedEffort│ number?                                     │
│ submittedLate │ boolean                                      │
│ archivedAt    │ Date?                                        │
│ createdAt     │ Date                                         │
│ updatedAt     │ Date                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Table: notes                                                 │
├─────────────────────────────────────────────────────────────┤
│ id (auto)     │ Primary key                                  │
│ courseId      │ FK → courses?                                │
│ title         │ string                                       │
│ images        │ Blob[]                                       │
│ extractedText │ string                                       │
│ summary       │ string?                                      │
│ topics        │ string[]                                     │
│ archivedAt    │ Date?                                        │
│ createdAt     │ Date                                         │
│ updatedAt     │ Date                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Table: studyMaterials                                        │
├─────────────────────────────────────────────────────────────┤
│ id (auto)     │ Primary key                                  │
│ courseId      │ FK → courses                                 │
│ type          │ 'guide'│'practice_exam'                      │
│ title         │ string                                       │
│ content       │ string│ExamContent                           │
│ sourceNoteIds │ number[]                                     │
│ archivedAt    │ Date?                                        │
│ createdAt     │ Date                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Table: studySessions                                         │
├─────────────────────────────────────────────────────────────┤
│ id (auto)     │ Primary key                                  │
│ courseId      │ FK → courses                                 │
│ plannedStart  │ Date                                         │
│ plannedDuration│ number (minutes)                            │
│ actualStart   │ Date?                                        │
│ actualDuration│ number?                                      │
│ status        │ 'planned'│'completed'│'skipped'              │
│ activityType  │ string                                       │
│ linkedNoteIds │ number[]                                     │
│ archivedAt    │ Date?                                        │
│ createdAt     │ Date                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Table: tutoringConversations                                 │
├─────────────────────────────────────────────────────────────┤
│ id (auto)     │ Primary key                                  │
│ courseId      │ FK → courses?                                │
│ messages      │ Message[]                                    │
│ detectedMode  │ 'learning'│'homework'                        │
│ archivedAt    │ Date?                                        │
│ createdAt     │ Date                                         │
│ updatedAt     │ Date                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Table: encryptedApiKeys                                      │
├─────────────────────────────────────────────────────────────┤
│ id (auto)     │ Primary key                                  │
│ provider      │ 'anthropic'│'openai'│'google'│'ollama'       │
│ encryptedKey  │ string (base64)                              │
│ createdAt     │ Date                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Table: preferences (singleton)                               │
├─────────────────────────────────────────────────────────────┤
│ id            │ 'user_preferences'                           │
│ productivityHours│ DaySchedule[]                             │
│ breakDuration │ number                                       │
│ aiProvider    │ string                                       │
│ personaSettings│ PersonaSettings                             │
│ updatedAt     │ Date                                         │
└─────────────────────────────────────────────────────────────┘

Additional tables: dailySummaries, analytics, examAttempts,
semesterArchives, studyPlan, tutorBehavioralProfile
```

---

## Data Flow Diagrams

### Local Data Operations

```
User Action → React Component → Dexie Hook → IndexedDB
                                    ↓
                              Live Query
                                    ↓
                            Component Re-render
```

### AI Operations

```
User Request
     │
     ▼
┌─────────────────┐
│ Build Context   │ ← Local data (courses, notes, etc.)
│ (tutor.ts)      │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│ AI Provider     │ ← Encrypted API key (decrypted on use)
│ Abstraction     │
└─────────────────┘
     │
     ▼ HTTPS
┌─────────────────┐
│ External API    │ (Anthropic/OpenAI/Google/Ollama)
└─────────────────┘
     │
     ▼
┌─────────────────┐
│ Response        │ → Display to user
│ Processing      │ → Store conversation history
└─────────────────┘
```

### P2P Sync

```
Device A                                          Device B
    │                                                 │
    │         ┌─────────────────────────┐            │
    │         │    Signaling Server     │            │
    │◄───────►│    (Peer Discovery)     │◄──────────►│
    │         └─────────────────────────┘            │
    │                                                 │
    │◄═══════════════════════════════════════════════►│
    │            WebRTC Data Channel                  │
    │            (Direct, Encrypted)                  │
    │                                                 │
┌───┴───┐                                        ┌───┴───┐
│Dexie  │ ←── Yjs CRDT ──────────────────────── │Dexie  │
│       │     Sync Protocol                      │       │
└───────┘                                        └───────┘
```

---

## Security Architecture

### Encryption Flow

```
API Key Entry
     │
     ▼
┌─────────────────────────────────────────────────┐
│ Encryption (crypto.ts)                          │
│                                                 │
│  1. Get device secret (localStorage)            │
│  2. Generate random salt (16 bytes)             │
│  3. Generate random IV (12 bytes)               │
│  4. Derive key: PBKDF2(secret, salt, 100000)    │
│  5. Encrypt: AES-256-GCM(key, iv, apiKey)       │
│  6. Store: base64(salt + iv + ciphertext)       │
└─────────────────────────────────────────────────┘
     │
     ▼
IndexedDB (encryptedApiKeys table)
```

### Decryption Flow

```
API Key Needed
     │
     ▼
┌─────────────────────────────────────────────────┐
│ Decryption (crypto.ts)                          │
│                                                 │
│  1. Get device secret (localStorage)            │
│  2. Parse: salt, iv, ciphertext from stored     │
│  3. Derive key: PBKDF2(secret, salt, 100000)    │
│  4. Decrypt: AES-256-GCM(key, iv, ciphertext)   │
│  5. Return: plaintext API key                   │
└─────────────────────────────────────────────────┘
     │
     ▼
Use in AI Provider Request (Authorization header)
```

---

## Network Communications

### Outbound Connections

| Destination | Protocol | Port | Purpose | Data |
|-------------|----------|------|---------|------|
| AI Provider APIs | HTTPS | 443 | AI features | Prompts, documents |
| Signaling Server | WSS | 443 | Peer discovery | Device IDs only |
| CDN (assets) | HTTPS | 443 | Static assets | None |
| Peer devices | WebRTC | Dynamic | Data sync | Encrypted sync data |

### No Inbound Connections

Lockdn doesn't require any inbound connections or server infrastructure.

---

## PWA Architecture

### Service Worker

```
┌─────────────────────────────────────────────────────────────┐
│                    Service Worker                            │
├─────────────────────────────────────────────────────────────┤
│  Cache Strategy: Cache-first for assets                      │
│                  Network-first for AI calls                  │
│                                                              │
│  Cached Assets:                                              │
│  • HTML, CSS, JavaScript                                     │
│  • Images and icons                                          │
│  • Font files                                                │
│                                                              │
│  Not Cached:                                                 │
│  • AI API responses                                          │
│  • IndexedDB data                                            │
└─────────────────────────────────────────────────────────────┘
```

### Offline Capabilities

| Feature | Offline Status |
|---------|----------------|
| View dashboard | ✅ Full |
| View/edit courses | ✅ Full |
| View/edit assignments | ✅ Full |
| View notes | ✅ Full |
| Add new notes | ⚠️ Stored, processing queued |
| AI tutor | ❌ Requires network |
| Generate materials | ❌ Requires network |
| P2P sync | ❌ Requires network |

---

## Performance Characteristics

### Client Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| Browser | ES2020 support | Chrome 90+, Firefox 88+ |
| Memory | 100 MB | 256 MB |
| Storage | 50 MB | 500 MB (for notes with images) |
| CPU | Any modern | Multi-core for large operations |

### Load Profile

| Operation | Typical Duration |
|-----------|-----------------|
| Initial load | 1-2 seconds |
| Page navigation | < 100ms |
| Database query | < 50ms |
| AI request | 2-30 seconds (provider dependent) |
| Image processing | 1-5 seconds |

---

## Deployment Architecture

### Static Hosting

```
┌─────────────────────────────────────────────────────────────┐
│                    CDN / Static Host                         │
│                                                              │
│  Serves:                                                     │
│  • index.html                                                │
│  • JavaScript bundles                                        │
│  • CSS files                                                 │
│  • Static assets                                             │
│                                                              │
│  Examples: Vercel, Netlify, GitHub Pages, CloudFlare Pages   │
└─────────────────────────────────────────────────────────────┘
```

### No Server Requirements

The application can be served from any static file host. No:
- Application servers
- Database servers
- Caching servers
- Load balancers

---

## Integration Points

### AI Providers

| Provider | API Endpoint | Authentication |
|----------|--------------|----------------|
| Anthropic | api.anthropic.com | API key header |
| OpenAI | api.openai.com | Bearer token |
| Google | generativelanguage.googleapis.com | API key |
| Ollama | localhost:11434 | None (local) |

### Calendar Export (Planned)

- iCal format export
- No direct LMS integration currently

---

## Monitoring and Observability

### Client-Side Only

There is no server-side monitoring because there's no server.

### Browser DevTools

Debugging available via:
- Console logs
- IndexedDB inspection
- Network request inspection
- React DevTools

### No Telemetry

Lockdn doesn't send telemetry, error reports, or analytics to any server.
