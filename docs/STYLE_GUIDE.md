# Lockdn Documentation Style Guide

This guide establishes the standards for all Lockdn documentation. Following these guidelines ensures consistency, clarity, and accessibility across all documentation.

---

## Documentation Philosophy

Lockdn documentation follows these core principles:

1. **User-centered**: Write for what users want to accomplish, not what features exist
2. **Progressive disclosure**: Start simple, link to advanced topics
3. **Clarity over cleverness**: Plain language beats technical jargon
4. **Task-oriented**: Help users complete real-world tasks
5. **Inclusive**: Accessible to readers of all backgrounds and abilities

---

## Documentation Structure

### Audience Segmentation

Lockdn documentation is organized for three distinct audiences:

| Audience | Primary Goal | Documentation Path |
|----------|--------------|-------------------|
| Students | Use Lockdn effectively | `/docs/user/` |
| IT Professionals | Evaluate security and compliance | `/docs/it/` |
| Contributors | Contribute to the project | `/docs/contributing/` |

### Information Architecture

Each documentation section follows a three-tier structure:

1. **Getting Started** — Quick wins and orientation
2. **Guides** — Task-oriented walkthroughs
3. **Reference** — Comprehensive technical details

---

## Writing Standards

### Voice and Tone

- **Use second person**: Address the reader directly as "you"
- **Be conversational but professional**: Write like a knowledgeable friend
- **Be encouraging**: Lockdn exists to help students succeed
- **Be direct**: Get to the point quickly

**Good:**
> "You can upload your syllabus to automatically extract assignments and due dates."

**Avoid:**
> "The syllabus parsing functionality enables the extraction of assignment metadata from uploaded documents."

### Sentence Style

- Use active voice
- Keep sentences under 25 words when possible
- One idea per sentence
- Start with the action or outcome

**Good:**
> "Click **Upload Syllabus** to add your course materials."

**Avoid:**
> "The Upload Syllabus button can be clicked in order to facilitate the addition of course materials to the system."

### Headings

- Use sentence-style capitalization (capitalize only the first word and proper nouns)
- Keep headings under 8 words
- Make headings descriptive and action-oriented
- Use heading levels hierarchically (don't skip from H2 to H4)

**Good:**
> "## Set up your API key"

**Avoid:**
> "## API Key Setup And Configuration Instructions"

### Lists

Use bulleted lists for unordered items:

- Privacy-first architecture
- Multiple AI provider support
- Offline functionality

Use numbered lists for sequential steps:

1. Open Settings
2. Navigate to API Keys
3. Enter your API key

### Code Examples

- Provide complete, working examples
- Include expected output when helpful
- Use syntax highlighting
- Add comments explaining non-obvious lines

```typescript
// Get the configured AI provider
const provider = await getConfiguredProvider();

// Send a message to the tutor
const response = await provider.sendMessage({
  messages: [{ role: 'user', content: 'Explain photosynthesis' }],
  systemPrompt: tutorSystemPrompt
});
```

---

## Terminology

### Consistent Terms

Use these terms consistently throughout documentation:

| Use This | Not This |
|----------|----------|
| Lockdn | LockDn, Lock-dn, lockdn |
| API key | API token, secret key, credentials |
| AI provider | AI service, LLM provider |
| study session | study block, study time |
| practice exam | practice test, quiz |
| P2P sync | peer sync, device sync |

### Acronyms

- Spell out acronyms on first use in each document
- Provide a link to the glossary when introducing technical terms

**Good:**
> "Lockdn uses IndexedDB (a browser-based database) to store your data locally."

### Product-Specific Terms

| Term | Definition |
|------|------------|
| Attention Card | A dashboard widget highlighting items needing your focus |
| BYOK | Bring Your Own Key — you provide your own AI API keys |
| Local-first | Your data stays on your device, not on remote servers |
| Wise Mentor | Lockdn's AI tutor personality |

---

## Visual Elements

### Screenshots

- Capture at consistent dimensions (recommended: 1200px width)
- Use a clean browser window (no bookmarks bar, minimal extensions)
- Highlight relevant UI elements with annotations
- Update screenshots when UI changes

### Callouts

Use callouts to highlight important information:

> **Note:** Provides additional helpful context

> **Important:** Critical information for completing a task

> **Warning:** Potential data loss or security implications

> **Tip:** Helpful shortcuts or best practices

### Icons

Use icons sparingly and consistently:
- ⚡ Performance tips
- 🔒 Security-related information
- 💡 Pro tips and insights
- ⚠️ Warnings and cautions

---

## Accessibility

### Images

- Provide descriptive alt text for all images
- Don't rely solely on color to convey information
- Use sufficient color contrast

### Structure

- Use proper heading hierarchy
- Write descriptive link text (not "click here")
- Keep paragraphs focused and readable

**Good:**
> "Learn more about [configuring AI providers](./settings.md#ai-providers)."

**Avoid:**
> "For more information, [click here](./settings.md#ai-providers)."

---

## Audience-Specific Guidelines

### Student Documentation

- Assume no technical background
- Focus on outcomes ("get organized") not features ("syllabus parser")
- Include troubleshooting for common issues
- Use encouraging, supportive language
- Add screenshots for complex workflows

### IT Professional Documentation

- Lead with security and privacy
- Map features to compliance frameworks
- Provide technical architecture details
- Include data flow diagrams
- Document audit capabilities
- Use precise technical language

### Contributor Documentation

- Include complete setup instructions
- Document coding standards and patterns
- Explain architectural decisions
- Provide contribution workflow
- Reference related files and modules

---

## Document Maintenance

### Version Control

- Track documentation alongside code
- Update docs when features change
- Note deprecated features clearly

### Review Cycle

- Review getting-started guides quarterly
- Review reference documentation when APIs change
- Gather user feedback through issues

### Changelog

Document significant changes:

```markdown
## [2024-01-15] Updated AI provider documentation
- Added Ollama configuration guide
- Updated screenshots for new settings UI
- Fixed broken links in API reference
```

---

## File Organization

```
docs/
├── STYLE_GUIDE.md          # This file
├── user/                   # Student documentation
│   ├── README.md           # User docs overview
│   ├── getting-started.md
│   ├── features/
│   └── troubleshooting.md
├── it/                     # IT professional documentation
│   ├── README.md           # IT docs overview
│   ├── security.md
│   ├── privacy.md
│   └── compliance.md
└── contributing/           # Contributor documentation
    ├── README.md           # Contributing overview
    ├── CONTRIBUTING.md     # How to contribute
    ├── AGENTS.md          # AI coding assistant guide
    ├── architecture.md
    └── development.md
```

---

## Reference Resources

This style guide draws inspiration from:

- [Stripe Documentation](https://stripe.com/docs) — Best-in-class developer docs
- [MDN Web Docs](https://developer.mozilla.org/) — Comprehensive style guidelines
- [Google Developer Style Guide](https://developers.google.com/style) — Technical writing standards
- [Tailwind CSS Documentation](https://tailwindcss.com/docs) — Clean, developer-friendly design

---

*Last updated: January 2025*
