# Deployment Considerations

This document covers deployment, network requirements, and infrastructure considerations for IT professionals.

---

## Deployment Model

Lockdn is a static web application requiring no institutional infrastructure.

### Deployment Options

| Option | Description | IT Involvement |
|--------|-------------|----------------|
| **Public instance** | Students access lockdn.app (or similar) | None |
| **Self-hosted** | Institution hosts static files | Minimal |
| **Local development** | Students run locally | None |

Most institutions will use the public instance, requiring no deployment.

---

## Self-Hosting (Optional)

If your institution wants to host Lockdn:

### Requirements

| Component | Requirement |
|-----------|-------------|
| Web server | Any static file server |
| SSL certificate | Required (HTTPS only) |
| Storage | ~50 MB for static assets |
| CDN | Recommended for performance |

### Build Process

```bash
# Clone repository
git clone https://github.com/lockdn/lockdn.git
cd lockdn

# Install dependencies
npm install

# Build for production
npm run build

# Output in /dist directory
```

### Deployment Targets

Any static hosting works:
- Nginx
- Apache
- AWS S3 + CloudFront
- Google Cloud Storage
- Azure Blob Storage
- Vercel
- Netlify
- GitHub Pages

### Configuration

No server-side configuration required. Optional environment variables:

| Variable | Purpose | Default |
|----------|---------|---------|
| `VITE_SIGNALING_URL` | P2P signaling server | Public default |

---

## Network Requirements

### Outbound Connections

| Destination | Port | Protocol | Purpose | Required |
|-------------|------|----------|---------|----------|
| AI Provider APIs | 443 | HTTPS | AI features | For AI features |
| Signaling server | 443 | WSS | P2P discovery | For device sync |
| CDN (if public) | 443 | HTTPS | Static assets | For public instance |
| WebRTC peers | Dynamic | UDP | P2P data | For device sync |

### Firewall Considerations

For full functionality, allow:

```
# AI Providers
api.anthropic.com:443
api.openai.com:443
generativelanguage.googleapis.com:443

# Signaling (default)
lockdn-sync.shurrey.partykit.dev:443

# WebRTC (for P2P sync)
UDP - various ports (TURN/STUN)
```

### WebRTC/P2P Sync

P2P sync uses WebRTC which may require:
- STUN servers (public, no configuration needed)
- TURN servers (for NAT traversal when direct connection fails)

If institutional firewalls are restrictive, P2P sync may not work. This only affects multi-device sync; all other features work normally.

---

## Browser Requirements

### Supported Browsers

| Browser | Minimum Version | Recommended |
|---------|-----------------|-------------|
| Chrome | 80 | Latest |
| Firefox | 75 | Latest |
| Safari | 14 | Latest |
| Edge | 80 | Latest |

### Required APIs

| API | Purpose | Support |
|-----|---------|---------|
| IndexedDB | Data storage | Universal |
| Web Crypto | Encryption | Universal |
| Service Worker | PWA/offline | Universal |
| WebRTC | P2P sync | Universal |
| localStorage | Configuration | Universal |

### Mobile Support

Lockdn works on mobile browsers but is optimized for desktop:
- Full functionality in mobile Chrome/Safari
- Smaller screens may be less optimal for complex features
- PWA installable on mobile

---

## Storage Considerations

### Browser Storage

Lockdn uses browser storage with these limits:

| Browser | IndexedDB Limit | Typical |
|---------|-----------------|---------|
| Chrome | 60% of disk | Varies |
| Firefox | 50% of disk | Varies |
| Safari | 1 GB (prompt for more) | 1 GB |

### Typical Usage

| User Type | Estimated Storage |
|-----------|-------------------|
| Light (few courses, no images) | 10-50 MB |
| Moderate (several courses, some notes) | 50-200 MB |
| Heavy (many image notes) | 200 MB - 1 GB |

### Storage Management

- Users can archive old semesters
- Users can export and delete data
- Browser storage can be cleared via browser settings

---

## Security Considerations for IT

### No Server-Side Vulnerabilities

Since there's no backend:
- No SQL injection
- No server-side RCE
- No data breach (no database)
- No authentication bypass

### Client-Side Security

Lockdn implements:
- Content Security Policy (CSP)
- XSS protection (React's built-in protections)
- Encrypted credential storage

### Third-Party Dependencies

Lockdn uses standard npm packages. Security updates:
- Track Lockdn releases for updates
- Monitor npm advisories
- Use tools like `npm audit`

---

## Integration Scenarios

### LMS Integration

Currently no direct LMS integration. Potential future features:
- Calendar export (iCal)
- Assignment import

### SSO/Identity

Lockdn has no authentication system. No SSO integration is needed or available.

### Campus Network

No special campus network configuration required. Standard HTTPS access.

---

## Performance Characteristics

### Load Profile

| Metric | Typical Value |
|--------|---------------|
| Initial page load | 1-2 seconds |
| Subsequent navigation | < 100ms |
| AI request latency | 2-30 seconds (provider dependent) |
| Storage operations | < 50ms |

### Bandwidth

| Operation | Bandwidth |
|-----------|-----------|
| Initial load | 2-5 MB |
| AI requests | 1-100 KB per request |
| P2P sync | Varies (local data size) |

### Offline Capability

Most features work offline after initial load:
- Dashboard, courses, calendar
- Note viewing
- Grade tracking

Requires network:
- AI features (tutor, processing)
- P2P sync

---

## Monitoring and Logging

### No Server-Side Monitoring

Lockdn has no backend to monitor. No:
- Application logs
- Performance metrics
- Error tracking
- Usage analytics

### Client-Side Debugging

For troubleshooting:
- Browser DevTools
- Console logging
- Network inspection
- IndexedDB inspection

---

## Disaster Recovery

### Data Backup

Lockdn data lives on user devices. Recommendations:

| Approach | Method |
|----------|--------|
| User export | Settings → Export Data |
| Device sync | Syncs to other devices |
| Browser sync | Chrome/Firefox account sync (depends on settings) |

### Data Loss Scenarios

| Scenario | Recovery |
|----------|----------|
| Browser data cleared | Restore from export or synced device |
| Device lost | Restore from export or synced device |
| Browser corrupted | Restore from export |

### Institution's Role

None required. Data ownership is with students.

---

## Accessibility

### WCAG Compliance

Lockdn targets WCAG 2.1 AA:
- Keyboard navigation
- Screen reader support
- Color contrast
- Focus management

### Accommodations

No special institutional configuration needed. Built-in accessibility features work out of the box.

---

## Support Model

### Community Support

- GitHub Issues for bug reports
- GitHub Discussions for questions
- Open-source community contributions

### No Institutional Support Agreement

Lockdn is open-source. No:
- SLA
- Dedicated support
- Enterprise support tier

### Self-Support Options

- Documentation (this guide)
- Source code access
- Community forums

---

## Checklist for IT Evaluation

### Before Recommending

- [ ] Review network requirements
- [ ] Check browser compatibility with institutional standards
- [ ] Review AI provider considerations
- [ ] Consider student data privacy guidance
- [ ] Review academic integrity guidance

### No Action Required

- [ ] Server provisioning
- [ ] Database setup
- [ ] Authentication configuration
- [ ] Data retention policies
- [ ] Backup systems
- [ ] Monitoring setup

### Optional Actions

- [ ] Self-host for institutional control
- [ ] Whitelist AI provider domains if firewall is restrictive
- [ ] Develop student guidance documentation
