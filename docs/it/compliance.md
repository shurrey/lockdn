# Compliance Documentation

This document maps Lockdn's features and architecture to common compliance frameworks relevant to educational institutions.

---

## Compliance Summary

Lockdn's local-first architecture simplifies compliance by eliminating most traditional data processing concerns:

| Framework | Applicability | Summary |
|-----------|--------------|---------|
| FERPA | Limited | No institutional data processing |
| GDPR | Limited | No data collection by Lockdn |
| CCPA | Minimal | No data sale or business processing |
| SOC 2 | N/A | No service infrastructure to audit |
| HIPAA | N/A | No health data processing |
| PCI DSS | N/A | No payment processing |

---

## FERPA (Family Educational Rights and Privacy Act)

### Overview

FERPA protects the privacy of student education records and applies to schools receiving federal funding.

### Lockdn Analysis

| FERPA Requirement | Lockdn Status |
|-------------------|---------------|
| Protect education records | Records stored locally by student, not institution |
| Consent for disclosure | No disclosure by Lockdn (no data collection) |
| Student access rights | Students have full access (it's on their device) |
| Amendment rights | Students can edit all local data |
| Annual notification | N/A — no institutional involvement |

### Key Considerations

**Is Lockdn a "school official"?**
No. Lockdn doesn't have institutional contracts, doesn't receive data from institutions, and doesn't act on behalf of educational agencies.

**Are student records "maintained" by Lockdn?**
No. Records are maintained by students on their own devices.

**Disclosure to AI providers:**
When students send content to AI providers (with their own API keys), this is student-initiated disclosure, not institutional disclosure.

### Recommendations

- Lockdn use doesn't create FERPA obligations for institutions
- Consider guidance for students about sharing educational content with AI providers
- No data sharing agreement needed between institution and Lockdn

---

## GDPR (General Data Protection Regulation)

### Overview

GDPR governs processing of personal data of EU residents.

### Lockdn Analysis

| GDPR Principle | Lockdn Implementation |
|----------------|----------------------|
| Lawfulness | Processing based on user's request for service |
| Purpose limitation | Data used only for stated features |
| Data minimization | Only stores user-provided data |
| Accuracy | User controls and corrects their data |
| Storage limitation | User controls deletion |
| Integrity/confidentiality | Local storage, encrypted credentials |
| Accountability | Open-source, transparent code |

### Data Processing Roles

| Entity | Role | Responsibility |
|--------|------|----------------|
| User | Data Controller | Determines purposes of processing |
| Lockdn | Not a processor | Provides software, doesn't process data |
| AI Provider | Processor | Processes data on user's instruction |

### GDPR Rights Implementation

| Right | Implementation |
|-------|----------------|
| Access | Full access via app interface |
| Rectification | Direct editing in app |
| Erasure | Delete in app or clear browser data |
| Portability | Export to JSON |
| Restriction | N/A (user controls all processing) |
| Object | N/A (no automated processing) |
| Automated decisions | Study planning is local, transparent |

### No DPA Required

Data Processing Agreements (DPAs) are not required because:
- Lockdn doesn't process personal data on behalf of anyone
- Software runs locally; no data transmitted to Lockdn

### International Transfers

Lockdn doesn't transfer data internationally. User's choice of AI provider may involve transfers (user's responsibility).

---

## CCPA (California Consumer Privacy Act)

### Overview

CCPA gives California residents rights regarding personal information.

### Lockdn Analysis

| CCPA Requirement | Lockdn Status |
|------------------|---------------|
| Disclose data collection | No data collection to disclose |
| Honor opt-out requests | No data sale to opt out of |
| Provide data access | Data is already in user's control |
| Delete data on request | User can delete via app/browser |
| Non-discrimination | No service tiers based on privacy choices |

### "Sale" of Personal Information

Lockdn does not sell personal information. There is no business relationship where personal information is exchanged for value.

---

## SOC 2 (Service Organization Control)

### Overview

SOC 2 audits evaluate service organizations' controls for security, availability, processing integrity, confidentiality, and privacy.

### Lockdn Analysis

**SOC 2 is not applicable** because:
- Lockdn doesn't operate as a service organization
- No backend infrastructure to audit
- No data processing services provided
- Software is open-source and runs locally

### Trust Service Criteria (If Applied)

| Category | Applicability |
|----------|---------------|
| Security | Limited to client-side code security |
| Availability | User's browser/device availability |
| Processing Integrity | Local processing, user-verifiable |
| Confidentiality | No confidential data transmitted to Lockdn |
| Privacy | No personal data collected |

---

## ISO 27001 (Information Security Management)

### Overview

ISO 27001 specifies requirements for information security management systems.

### Relevant Controls

| Control Area | Lockdn Implementation |
|--------------|----------------------|
| A.8 Asset Management | User manages their own data |
| A.10 Cryptography | AES-256-GCM for API keys |
| A.12 Operations Security | N/A (no operations) |
| A.13 Communications Security | HTTPS, WebRTC DTLS |
| A.14 System Development | Open-source, community review |
| A.18 Compliance | This documentation |

### Certification

Lockdn itself is not ISO 27001 certified (no organizational structure to certify). Institutions may consider the software's security features when assessing their own compliance.

---

## NIST Cybersecurity Framework

### Overview

NIST CSF provides a framework for managing cybersecurity risk.

### Lockdn Mapping

| Function | Implementation |
|----------|----------------|
| **Identify** | Limited scope (client-side only) |
| **Protect** | Encryption, local storage, no accounts |
| **Detect** | N/A (no server infrastructure) |
| **Respond** | Open-source vulnerability disclosure |
| **Recover** | User data export/backup |

### NIST 800-53 Controls

Selected relevant controls:

| Control | Implementation |
|---------|----------------|
| SC-8 (Transmission Confidentiality) | HTTPS, DTLS encryption |
| SC-13 (Cryptographic Protection) | AES-256-GCM for sensitive data |
| SC-28 (Protection of Information at Rest) | Encrypted API keys |
| AC-2 (Account Management) | N/A (no accounts) |
| AU-2 (Audit Events) | N/A (no central logging) |

---

## WCAG (Web Content Accessibility Guidelines)

### Overview

WCAG provides guidelines for accessible web content.

### Lockdn Implementation

| Guideline | Status |
|-----------|--------|
| Perceivable | Color contrast, alt text for images |
| Operable | Keyboard navigation, focus management |
| Understandable | Consistent navigation, clear labels |
| Robust | Semantic HTML, ARIA attributes |

### Current Status

Lockdn targets WCAG 2.1 AA compliance. As an open-source project, accessibility improvements are ongoing.

---

## AI-Specific Compliance

### EU AI Act Considerations

When students use AI features:

| Requirement | Analysis |
|-------------|----------|
| Risk classification | Low risk (study assistance) |
| Transparency | Users know they're using AI |
| Human oversight | User controls all interactions |

### Academic Integrity

Lockdn's AI tutor is designed to:
- Guide rather than give answers
- Detect homework-help-seeking behavior
- Redirect to learning-focused interactions

This supports institutional academic integrity policies.

---

## Compliance Checklist for Institutions

### Before Recommending Lockdn

| Item | Status |
|------|--------|
| Review privacy implications | ✅ No data collection |
| Assess security architecture | ✅ Local-first, encrypted credentials |
| Evaluate FERPA implications | ✅ No institutional data processing |
| Review AI provider considerations | ⚠️ Student's responsibility |
| Check accessibility | ✅ WCAG 2.1 AA targeted |

### Documentation to Keep

- This compliance documentation
- Record of decision to recommend/allow Lockdn
- Guidance provided to students about AI providers

### No Action Required

- No vendor contract
- No data processing agreement
- No BAA (Business Associate Agreement)
- No security questionnaire responses
- No SOC 2 report review

---

## Audit Support

### For Internal Audits

Lockdn is open-source. Auditors can:
- Review source code on GitHub
- Verify security claims in the code
- Test the application directly

### For External Audits

Provide:
- Link to this documentation
- Link to source code repository
- Statement that no institutional data is processed by Lockdn

### Evidence of Compliance

| Assertion | Evidence |
|-----------|----------|
| No data collection | Source code review, network analysis |
| Encryption implemented | Code in `src/lib/crypto.ts` |
| No external dependencies | Package manifest, network monitoring |
| User data control | Feature documentation, app functionality |

---

## Contact

For compliance questions:
- Open an issue on GitHub
- Review the open-source code
- Consult with your legal/compliance team
