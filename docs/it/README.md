# Lockdn IT Professional Documentation

This documentation provides IT administrators, security professionals, and institutional decision-makers with the technical and compliance information needed to evaluate Lockdn for student use.

---

## Executive Summary

**Lockdn** is an open-source, local-first study management application for undergraduate students. It helps students organize courses, manage deadlines, take notes, and study with AI assistance.

### Key IT Considerations

| Aspect | Summary |
|--------|---------|
| **Data Storage** | All data stored locally in browser (IndexedDB) |
| **Cloud Services** | None required; optional P2P sync between student's own devices |
| **AI Services** | Student provides own API key (BYOK); institution not involved |
| **Account Management** | No accounts; no authentication needed |
| **Data Privacy** | No telemetry, analytics, or data collection by Lockdn |
| **Network Requirements** | Works offline; internet only needed for AI features |

---

## Quick Links

| Topic | Document |
|-------|----------|
| Security architecture and controls | [Security Overview](./security.md) |
| Privacy practices and data handling | [Privacy](./privacy.md) |
| Compliance mapping | [Compliance](./compliance.md) |
| Technical architecture | [Architecture](./architecture.md) |
| AI usage and academic integrity | [AI Usage](./ai-usage.md) |
| Deployment considerations | [Deployment](./deployment.md) |

---

## Architecture Overview

### Local-First Design

Lockdn follows a local-first architecture pattern:

```
┌─────────────────────────────────────────────────────────┐
│                    Student's Browser                     │
│                                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐ │
│  │  Application  │  │   IndexedDB   │  │  LocalStore │ │
│  │    (React)    │  │  (User Data)  │  │  (Config)   │ │
│  └───────────────┘  └───────────────┘  └─────────────┘ │
│           │                                             │
│           ▼                                             │
│  ┌───────────────────────────────────────────────────┐ │
│  │              Service Worker (PWA)                  │ │
│  │         Offline Support & Caching                  │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
           │                          │
           ▼                          ▼
    ┌─────────────┐           ┌─────────────────┐
    │  AI Provider │           │  P2P Signaling  │
    │  (External)  │           │    (WebRTC)     │
    │  - Anthropic │           │                 │
    │  - OpenAI    │           │  Peer Discovery │
    │  - Google    │           │      Only       │
    │  - Ollama    │           │                 │
    └─────────────┘           └─────────────────┘
```

### No Backend Infrastructure

Lockdn requires no backend servers for core functionality:

- No user database
- No authentication server
- No data storage server
- No analytics collection

The only external services are:

1. **AI Providers** — Student-configured, using student's own API keys
2. **Signaling Server** — For P2P device discovery only (no data storage)

---

## Data Flow Summary

### Data That Stays Local

| Data Type | Storage Location | Leaves Device? |
|-----------|-----------------|----------------|
| Course information | IndexedDB | Only via P2P sync to student's other devices |
| Assignments | IndexedDB | Only via P2P sync |
| Notes and images | IndexedDB | Processed via AI API (student-configured) |
| Grades | IndexedDB | Only via P2P sync |
| Study sessions | IndexedDB | Only via P2P sync |
| Analytics | IndexedDB | Never |
| API keys | IndexedDB (encrypted) | Never |

### External Data Flows

| Flow | Purpose | Student Controlled? |
|------|---------|-------------------|
| AI API calls | Document processing, tutoring | Yes (student's own API key) |
| P2P signaling | Device discovery for sync | Yes (opt-in feature) |
| P2P data sync | Sync between student's devices | Yes (encrypted, direct) |

---

## Security Highlights

### Encryption

- API keys encrypted with AES-256-GCM before storage
- Device-specific encryption secrets (never synced)
- P2P connections encrypted via WebRTC DTLS

### No Attack Surface

- No authentication = no credential theft risk
- No server database = no data breach risk
- No user accounts = no account takeover risk

### Student Data Ownership

- All data stored on student's device
- Student controls export and deletion
- No vendor lock-in

See [Security Overview](./security.md) for complete details.

---

## Privacy Highlights

### No Data Collection

Lockdn does not collect:

- Usage analytics
- Telemetry
- Error reports
- User behavior data
- Personal information

### FERPA Considerations

- Student educational records remain on student's device
- Institution has no access to student's Lockdn data
- No third-party data sharing (except student-chosen AI provider)

See [Privacy](./privacy.md) for complete details.

---

## AI and Academic Integrity

### BYOK Model

Students bring their own API keys (BYOK):

- Institution is not a party to AI service agreements
- No institutional data flows through shared AI accounts
- Student responsible for their own AI usage

### Academic Integrity Features

The AI tutor is designed to support learning, not cheating:

- **Socratic method** — Guides students to answers, doesn't provide them
- **Mode detection** — Recognizes when student is seeking homework answers
- **Gentle redirection** — Steers toward learning without shaming

See [AI Usage](./ai-usage.md) for complete details.

---

## Deployment Considerations

### Network Requirements

| Requirement | Details |
|-------------|---------|
| Bandwidth | Low (text-based sync; AI calls are student's responsibility) |
| Ports | Standard HTTPS (443) |
| Firewall | Allow WebRTC for P2P sync (optional) |
| Offline | Full functionality except AI features |

### Browser Support

- Chrome 80+
- Firefox 75+
- Safari 14+
- Edge 80+

### No Installation Required

- Pure web application
- No client software to deploy
- No browser extensions required

See [Deployment](./deployment.md) for complete details.

---

## Frequently Asked Questions

### Does Lockdn store student data on your servers?

No. Lockdn has no backend data storage. All student data resides in the browser's IndexedDB on the student's device.

### What happens to data when students graduate?

Students own their data. They can export it, delete it, or continue using Lockdn. No institutional action required.

### Is there a data processing agreement (DPA) needed?

Lockdn doesn't process or store student data on any servers, so a traditional DPA may not be necessary. Consult your legal team regarding the student's relationship with their chosen AI provider.

### Can we monitor student usage?

No. Lockdn has no analytics or telemetry. Usage data stays on student devices.

### What if a student's device is lost or stolen?

Data on the device is at risk like any other local data. Lockdn doesn't have remote wipe capability (since there's no server connection). Students should use device-level security (disk encryption, passwords).

### Is Lockdn FERPA compliant?

Lockdn's local-first architecture means educational records aren't transmitted to or stored by Lockdn. The institution isn't providing educational records to Lockdn. FERPA compliance depends on how students use AI providers and whether they share educational records with those services.

---

## Contact and Support

- **Source Code:** [github.com/lockdn/lockdn](https://github.com/lockdn/lockdn)
- **Issues:** [github.com/lockdn/lockdn/issues](https://github.com/lockdn/lockdn/issues)
- **License:** [MIT License](https://opensource.org/licenses/MIT)

Lockdn is open source. You can audit the code, fork it, or contribute improvements.
