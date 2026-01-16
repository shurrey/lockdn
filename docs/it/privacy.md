# Privacy Documentation

This document details Lockdn's privacy practices, data handling, and compliance considerations for privacy officers and data protection professionals.

---

## Privacy Philosophy

Lockdn is built on privacy-by-design principles:

1. **Data minimization** — Don't collect what you don't need
2. **Local storage** — Keep data on user's device
3. **User control** — Users own and control their data
4. **Transparency** — Open-source code, clear documentation

---

## Data Collection

### What Lockdn Collects

**Nothing.**

Lockdn does not collect, store, or transmit any data to Lockdn-operated servers.

| Data Type | Collected by Lockdn? |
|-----------|---------------------|
| Personal identifiers | No |
| Usage analytics | No |
| Error logs | No |
| Telemetry | No |
| Cookies (tracking) | No |
| Device fingerprints | No |
| IP addresses | No |
| Behavioral data | No |

### Data Stored Locally

Data stored in the user's browser (IndexedDB):

| Data Category | Examples | Stored By |
|---------------|----------|-----------|
| Academic data | Courses, assignments, grades | User input |
| Content | Notes, study materials | User uploads |
| Preferences | Settings, productivity hours | User configuration |
| Credentials | Encrypted API keys | User input |
| Analytics | Study time, streaks | Calculated locally |

This data never leaves the browser except:
- When user opts into P2P sync (to their own devices)
- When user sends content to their AI provider

---

## Third-Party Data Sharing

### AI Providers

When users configure an AI provider, data flows to that provider:

| Provider | Data Sent | Governed By |
|----------|-----------|-------------|
| Anthropic | Prompts, documents, images | Anthropic's privacy policy |
| OpenAI | Prompts, documents, images | OpenAI's privacy policy |
| Google | Prompts, documents, images | Google's privacy policy |
| Ollama | Prompts, documents | User's local instance |

**Important considerations:**
- Users bring their own API keys (BYOK)
- Users agree to provider's terms independently
- Lockdn is not party to this data sharing
- Institution is not party to this data sharing

### P2P Sync

When users enable device sync:

| Data Shared | With Whom | How |
|-------------|-----------|-----|
| All local data (except API keys) | User's own paired devices | Encrypted P2P connection |

### Signaling Server

For P2P discovery only:

| Data | Purpose | Retention |
|------|---------|-----------|
| Device identifier | Peer discovery | Duration of session only |

No user content flows through the signaling server.

---

## Data Subject Rights

### Right to Access

Users have immediate access to all their data:

- View any data in the app
- Export all data via Settings → Data Management

### Right to Rectification

Users can edit any data:

- Modify courses, assignments, notes
- Update preferences
- Correct any information

### Right to Erasure

Users can delete data:

- Delete individual items (courses, notes, etc.)
- Archive and delete by semester
- Clear all data via browser settings

### Right to Portability

Users can export data:

- Export to JSON format
- Includes all stored data
- Can be imported to other systems

### Right to Restriction / Objection

Not applicable — Lockdn doesn't process data for any purpose users might object to.

---

## FERPA Considerations

### Educational Records

FERPA protects educational records — records directly related to a student that are maintained by an educational agency.

**Lockdn's position:**

| Factor | Analysis |
|--------|----------|
| Who maintains records? | Student (on their device), not institution |
| Who has access? | Student only |
| Institutional involvement | None |

### Directory Information

Lockdn doesn't collect or display directory information.

### Disclosure

Since Lockdn doesn't maintain educational records and isn't acting on behalf of the institution, FERPA disclosure rules don't directly apply to Lockdn.

### Recommendation

Consult legal counsel regarding:
- Whether student-stored data in Lockdn constitutes an educational record
- Implications of students sharing educational data with AI providers

---

## GDPR Considerations

### Lawful Basis

For EU users, Lockdn's data processing (local storage) relies on:

- **Contract** — Necessary to provide the requested service
- **Legitimate interests** — User clearly wants the app to function

No consent mechanism is required because Lockdn doesn't collect data beyond what's necessary for the user-requested service.

### Data Controller

For data stored locally:
- **Controller:** The individual user
- **Processor:** Not applicable (no third-party processing by Lockdn)

For AI provider communications:
- **Controller:** Individual user
- **Processor:** AI provider

### International Data Transfers

Lockdn doesn't transfer data internationally. When users configure AI providers, any international transfer is between the user and their chosen provider.

### Data Protection Officer

Not required for Lockdn's operations (no data processing).

---

## CCPA Considerations

### Sale of Personal Information

Lockdn does not sell personal information. There is no personal information to sell — everything stays on the user's device.

### Business Purpose

Lockdn doesn't process personal information for any business purpose beyond immediate user functionality.

### Opt-Out Rights

No opt-out mechanism needed (no data collection to opt out of).

---

## Children's Privacy

### COPPA Considerations

Lockdn is designed for undergraduate students (adults or near-adults). However:

- No age verification is performed
- No data is collected that would trigger COPPA
- Parents/guardians could delete browser data if needed

### Recommendation

Institutions may want to advise that Lockdn is intended for students 13+ or 18+ depending on institutional policy.

---

## Cookies and Tracking

### First-Party Cookies

Lockdn uses browser localStorage for:
- Device-specific encryption secret
- Sync identifiers

These are functional, not tracking.

### Third-Party Cookies

None.

### Tracking Technologies

| Technology | Used? |
|------------|-------|
| Cookies (tracking) | No |
| Pixel tags | No |
| Web beacons | No |
| Device fingerprinting | No |
| Analytics (Google, etc.) | No |
| Ad tracking | No |

---

## Data Retention

### Retention Policy

Lockdn doesn't enforce any retention policy. Data persists until:

- User deletes it manually
- User clears browser storage
- User archives and removes old data

### User Control

Users control retention through:
- Manual deletion of items
- Semester archival
- Browser data clearing
- Data export before deletion

---

## Privacy by Design

### Technical Measures

| Principle | Implementation |
|-----------|----------------|
| Data minimization | Only store what user explicitly provides |
| Purpose limitation | Data used only for stated functionality |
| Storage limitation | User controls retention |
| Integrity | Local storage, no transmission risk |
| Confidentiality | Encrypted API keys, P2P encryption |

### Organizational Measures

As an open-source project:
- Transparent codebase
- Public documentation
- Community oversight

---

## Privacy Impact Assessment Summary

| Factor | Assessment |
|--------|------------|
| Data collected | None by Lockdn |
| Data processed | Locally only |
| Third-party sharing | User-controlled (AI providers) |
| International transfer | None by Lockdn |
| Special category data | Not processed |
| Automated decision-making | Study planning (fully local, user-controlled) |
| Risk to individuals | Low (local storage, no central database) |

---

## Recommendations for Institutions

### Student Communication

Inform students that:
1. Lockdn doesn't collect their data
2. AI provider usage is their responsibility
3. Data stays on their device
4. They control export and deletion

### Policy Considerations

No institutional privacy policy updates needed for Lockdn itself. Consider guidance on:
- Student use of commercial AI providers
- What data students should avoid sharing with AI services
- Best practices for local data protection

### Data Requests

Institutions won't receive data requests for Lockdn data because:
- Institution doesn't hold Lockdn data
- Students hold their own data
- Direct students to Lockdn's self-service data export

---

## Contact

For privacy questions about Lockdn:
- Open an issue on GitHub
- Review the open-source code

Lockdn has no dedicated privacy officer (no data processing operations to oversee).
