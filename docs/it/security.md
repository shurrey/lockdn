# Security Overview

This document details Lockdn's security architecture, controls, and considerations for IT security professionals.

---

## Security Architecture Philosophy

Lockdn's security model is built on minimizing attack surface through architectural simplicity:

1. **No backend = No server-side vulnerabilities**
2. **No accounts = No credential management risks**
3. **Local data = No database breach exposure**
4. **Client encryption = Data protected at rest**

---

## Data Storage Security

### Browser Storage (IndexedDB)

All user data is stored in the browser's IndexedDB:

```
┌─────────────────────────────────────────┐
│              IndexedDB                   │
├─────────────────────────────────────────┤
│  courses          │ plaintext           │
│  assignments      │ plaintext           │
│  notes            │ plaintext           │
│  study_materials  │ plaintext           │
│  study_sessions   │ plaintext           │
│  tutor_messages   │ plaintext           │
│  preferences      │ plaintext           │
│  encryptedApiKeys │ AES-256-GCM         │
└─────────────────────────────────────────┘
```

### What's Encrypted

| Data | Encrypted? | Reason |
|------|-----------|--------|
| API Keys | Yes (AES-256-GCM) | Sensitive credentials |
| Notes | No | No sensitive data expected |
| Course data | No | Non-sensitive academic info |
| Grades | No | Stored locally only |

### API Key Encryption Details

API keys are the only sensitive data Lockdn handles. They're encrypted before storage:

**Algorithm:** AES-256-GCM
**Key Derivation:** PBKDF2
**Iterations:** 100,000
**Salt:** Randomly generated per key
**IV:** Randomly generated per encryption operation

```typescript
// Encryption flow
1. Generate random salt (16 bytes)
2. Generate random IV (12 bytes)
3. Derive encryption key via PBKDF2(device_secret, salt, 100000)
4. Encrypt API key with AES-256-GCM(key, iv, data)
5. Store: salt + iv + ciphertext (base64 encoded)
```

### Device Secret

Each device has a unique secret stored in localStorage:

- Generated on first use (256-bit random value)
- Never transmitted (even via P2P sync)
- Required to decrypt API keys on that device

This means:
- API keys can only be decrypted on the device they were stored on
- If localStorage is cleared, encrypted API keys become inaccessible
- Students must re-enter API keys on new devices

---

## Network Security

### No Central Server Communication

Lockdn makes no calls to any Lockdn-operated servers for data storage or retrieval.

### External Communications

| Endpoint | Purpose | Data Sent |
|----------|---------|-----------|
| AI Provider APIs | Document processing, tutoring | Student content, NOT API keys (used for auth) |
| Signaling Server | P2P peer discovery | Device identifiers only |
| Peer Devices | Data sync | Encrypted sync data |

### AI Provider Communication

```
Student Device → AI Provider API
   │
   ├─ Uses HTTPS
   ├─ Authenticates with student's API key
   ├─ Sends: prompts, document content, images
   └─ Receives: AI responses
```

**Important:** This communication is between the student and their chosen AI provider. Lockdn doesn't proxy or store these communications.

### P2P Communication Security

Device-to-device sync uses WebRTC:

```
Device A ←──────────────────────→ Device B
         │  WebRTC DataChannel  │
         │  DTLS Encrypted      │
         │  Direct P2P          │
```

**Security features:**
- DTLS encryption (mandatory in WebRTC)
- Direct connection (no data through servers)
- Device pairing requires physical access (QR code or pairing code)

---

## Authentication and Access Control

### No Authentication System

Lockdn has no user accounts or authentication:

| Typical Risk | Lockdn Status |
|--------------|---------------|
| Password breaches | N/A - no passwords |
| Session hijacking | N/A - no sessions |
| Account takeover | N/A - no accounts |
| Credential stuffing | N/A - no credentials |

### Access Control

Access to Lockdn data is controlled by:

1. **Physical access** to the device
2. **Browser access** to the origin's storage
3. **Device security** (OS-level protection)

### Device Pairing Security

P2P sync requires explicit device pairing:

1. User initiates pairing on Device A
2. Device A generates time-limited pairing code
3. User physically enters code on Device B
4. Shared secret established for sync session

This prevents:
- Unauthorized device pairing
- Remote sync attacks
- Man-in-the-middle during pairing

---

## Vulnerability Surface Analysis

### Reduced Attack Surface

| Attack Vector | Traditional App | Lockdn |
|---------------|-----------------|--------|
| SQL injection | Server database | N/A - no server DB |
| XSS leading to credential theft | Session tokens | N/A - no sessions |
| CSRF | State-changing operations | N/A - no server state |
| Server-side RCE | Server processes | N/A - no server |
| Data breach (database) | Centralized database | N/A - distributed local storage |
| Credential stuffing | User accounts | N/A - no accounts |

### Remaining Attack Vectors

| Vector | Risk | Mitigation |
|--------|------|------------|
| Device compromise | Data accessible to attacker | Device-level security (user responsibility) |
| XSS (client-side) | Script injection | CSP headers, input sanitization, React's XSS protections |
| Browser extension attacks | Malicious extensions could access data | User responsibility |
| Physical device access | Full data access | Device encryption (user responsibility) |
| AI API key exposure | Attacker could use student's API credits | Client-side encryption, never transmitted to Lockdn |

---

## Data in Transit

### HTTPS Only

All external communications use HTTPS:

- AI provider API calls
- Signaling server communication
- Static asset loading

### WebRTC Encryption

P2P sync data is encrypted:

- DTLS for the data channel
- SRTP if any media streams (not currently used)
- Encryption is mandatory per WebRTC spec

---

## Data at Rest

### Browser Storage

IndexedDB data is stored as-is by the browser. Security depends on:

- Browser sandboxing (per-origin isolation)
- OS-level file system protection
- Device disk encryption (if enabled)

### Recommendations for Enhanced Security

For students with sensitive data:

1. **Enable disk encryption** (FileVault, BitLocker)
2. **Use device passwords/biometrics**
3. **Lock device when unattended**
4. **Don't use shared/public computers**

---

## Incident Response

### If API Key Is Compromised

1. Student revokes key with AI provider
2. Student generates new key
3. Student updates key in Lockdn settings

Lockdn has no role in this process (no central credential management).

### If Device Is Lost/Stolen

1. Data on device is potentially exposed
2. Student should:
   - Revoke AI API keys
   - Remote wipe device if possible (OS-level)
   - Re-pair other devices (if using sync)

### If Vulnerability Is Discovered

As an open-source project:

1. Report via GitHub security advisory
2. Patch developed and released
3. Users update to patched version

---

## Security Controls Summary

| Control | Implementation |
|---------|----------------|
| Data encryption at rest | AES-256-GCM for API keys |
| Data encryption in transit | HTTPS, WebRTC DTLS |
| Access control | Device access only (no app-level auth) |
| Input validation | Client-side validation, React XSS protections |
| Secure key storage | Encrypted with device-specific secret |
| Audit logging | Not applicable (no central logs) |
| Session management | Not applicable (no sessions) |

---

## Compliance Mapping

| Framework | Relevant Controls |
|-----------|-------------------|
| SOC 2 - Security | Data encryption, no central data storage |
| ISO 27001 - A.10 | Encryption controls |
| NIST 800-53 - SC | System and communications protection |
| FERPA | No institutional data handling |

See [Compliance](./compliance.md) for detailed mapping.

---

## Recommendations for Institutions

### Low-Risk Profile

Lockdn presents minimal risk to institutional systems because:

- No integration with institutional systems
- No institutional data flows through Lockdn
- No accounts to manage or secure
- No server infrastructure to monitor

### Student Guidance

Recommend students:

1. Use device-level security (encryption, passwords)
2. Understand their AI provider's data policies
3. Export data periodically as backup
4. Don't enter sensitive information (SSN, financial data)

### No Action Required

Institutions don't need to:

- Provision accounts
- Configure LDAP/SAML
- Manage API keys
- Process data requests
- Maintain data retention policies (for Lockdn data)
