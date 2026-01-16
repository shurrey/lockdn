# Lockdn

**Your private, local-first study companion.**

Lockdn helps undergraduate students organize their academic lives with AI-powered tools — while keeping all data on their own devices.

🌐 **Try it now:** [lockdn.wtf](https://lockdn.wtf)

---

## Features

- **📚 Course Management** — Add courses, upload syllabi, automatically extract assignments and due dates
- **📅 Smart Scheduling** — AI-powered study planning based on your deadlines and productivity patterns
- **🤖 AI Tutor** — Get help understanding concepts with a tutor that guides rather than gives answers
- **📝 Note Processing** — Upload photos of handwritten notes; AI extracts and organizes the content
- **📖 Study Materials** — Generate study guides and practice exams from your notes
- **📊 Analytics** — Understand your study habits with visualizations of time, completion rates, and trends
- **🔄 Device Sync** — Sync between your devices using peer-to-peer technology
- **🔒 Privacy First** — All data stays on your device; bring your own AI API key

---

## Why Lockdn?

Unlike other study apps, Lockdn is built on a **local-first** philosophy:

| Traditional Apps | Lockdn |
|------------------|--------|
| Your data on their servers | Your data on your device |
| Account required | No account needed |
| Subscription fees | Free and open source |
| They control your data | You control your data |
| Works when they say | Works offline |

---

## Getting Started

### As a Student

1. Visit [lockdn.wtf](https://lockdn.wtf)
2. Add your AI API key (Anthropic, OpenAI, Google, or Ollama)
3. Upload your syllabi
4. Start studying smarter

📖 **[Read the User Guide](docs/user/README.md)**

### As a Developer

```bash
# Clone the repository
git clone https://github.com/lockdn/lockdn.git
cd lockdn

# Use Node.js 20
nvm use 20

# Install dependencies
npm install

# Start development server
npm run dev
```

📖 **[Read the Development Guide](docs/contributing/development.md)**

---

## Documentation

| Audience | Documentation |
|----------|---------------|
| **Students** | [User Guide](docs/user/README.md) — How to use Lockdn effectively |
| **IT Professionals** | [IT Documentation](docs/it/README.md) — Security, privacy, and compliance |
| **Contributors** | [Contributing Guide](docs/contributing/README.md) — How to contribute |

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS
- **Storage:** Dexie.js (IndexedDB)
- **AI:** Anthropic Claude, OpenAI, Google Gemini, Ollama
- **Sync:** WebRTC peer-to-peer with Yjs
- **Build:** Vite

---

## Security & Privacy

- **No backend database** — All data stored locally in your browser
- **No tracking** — Zero analytics or telemetry
- **Encrypted credentials** — API keys encrypted with AES-256-GCM
- **P2P sync** — Device sync without cloud storage
- **Open source** — Audit the code yourself

📖 **[Read the Security Documentation](docs/it/security.md)**

---

## Contributing

We welcome contributions! Whether you're fixing bugs, adding features, or improving documentation.

1. Read the [Contributing Guide](docs/contributing/CONTRIBUTING.md)
2. Check out [good first issues](https://github.com/lockdn/lockdn/labels/good%20first%20issue)
3. Join the discussion on GitHub

**Using AI coding assistants?** See [AGENTS.md](docs/contributing/AGENTS.md) for guidelines.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Links

- 🌐 **Website:** [lockdn.wtf](https://lockdn.wtf)
- 📖 **Documentation:** [docs/](docs/)
- 🐛 **Issues:** [GitHub Issues](https://github.com/lockdn/lockdn/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/lockdn/lockdn/discussions)
