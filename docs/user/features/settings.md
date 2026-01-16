# Settings

Customize Lockdn to fit your workflow. This guide covers API configuration, study preferences, device sync, appearance, and data management.

---

## API keys

Lockdn uses a BYOK (Bring Your Own Key) model. You provide your own API keys, which stay encrypted on your device.

### Supported providers

| Provider | Best For | Cost |
|----------|----------|------|
| Anthropic (Claude) | Most accurate responses | Pay-per-use |
| OpenAI (ChatGPT) | Wide compatibility | Pay-per-use |
| Google (Gemini) | Budget-friendly | Free tier available |
| Ollama | Complete privacy | Free (runs locally) |

### Adding an API key

1. Go to **Settings** → **API Keys**
2. Select your provider
3. Enter your API key
4. Click **Save**

Your key is encrypted using AES-256-GCM before being stored in your browser's local database.

### Getting an API key

- **Anthropic**: Sign up at [console.anthropic.com](https://console.anthropic.com)
- **OpenAI**: Sign up at [platform.openai.com](https://platform.openai.com)
- **Google**: Sign up at [aistudio.google.com](https://aistudio.google.com)
- **Ollama**: Install from [ollama.ai](https://ollama.ai) (no API key needed)

> **Tip:** Start with Ollama if you want to try AI features without any cost. It runs entirely on your computer.

### Removing an API key

1. Go to **Settings** → **API Keys**
2. Find the provider you want to remove
3. Click **Remove**

---

## Study preferences

Customize how Lockdn generates study plans and recommendations.

### Available hours

Tell Lockdn when you're available to study:

1. Go to **Settings** → **Preferences**
2. Set your **Earliest start time** (e.g., 8:00 AM)
3. Set your **Latest end time** (e.g., 10:00 PM)

Lockdn won't schedule study sessions outside these hours.

### Session length

Set your preferred study session duration:

- **Minimum session**: Shortest block Lockdn will suggest (default: 30 minutes)
- **Maximum session**: Longest block before a break (default: 2 hours)

### Break preferences

Configure break timing:

- **Short break**: Time between sessions (default: 10 minutes)
- **Long break**: Extended break after multiple sessions (default: 30 minutes)

---

## Device sync

Keep your data synchronized across multiple devices using peer-to-peer (P2P) sync.

### How P2P sync works

Lockdn uses WebRTC to connect devices directly — no cloud servers involved. Your data travels encrypted between your devices only.

### Setting up sync

1. Go to **Settings** → **Device Sync**
2. Click **Generate Pairing Code** on your first device
3. On your second device, click **Scan Code** or enter the code manually
4. Wait for the devices to connect

Once connected, changes sync automatically whenever both devices are online.

### Sync status

The sync indicator shows your connection status:

- **Green**: Connected and syncing
- **Yellow**: Connecting
- **Gray**: Not connected

> **Note:** Both devices must be online simultaneously for sync to work. Changes made offline will sync the next time devices connect.

For more details, see [Device sync](./sync.md).

---

## Appearance

Customize how Lockdn looks.

### Theme

Choose your preferred color scheme:

- **Light**: Bright background, dark text
- **Dark**: Dark background, light text
- **System**: Follows your device's setting

To change:

1. Go to **Settings** → **Appearance**
2. Click your preferred theme

The change applies immediately.

---

## Data management

Control your data with export, import, and reset options.

### Exporting your data

Create a backup of all your Lockdn data:

1. Go to **Settings** → **Data** → **Export**
2. Click **Export All Data**
3. Save the JSON file to your computer

The export includes:

- All courses and assignments
- Notes and study materials
- Study sessions and analytics
- Preferences (excluding API keys)

> **Tip:** Export your data regularly, especially before clearing browser data or switching devices.

### Importing data

Restore from a backup or transfer from another device:

1. Go to **Settings** → **Data** → **Import**
2. Select your backup file
3. Review the import summary
4. Click **Import**

> **Warning:** Importing data may overwrite existing items if they share the same IDs.

### Clearing data

Remove all Lockdn data from this device:

1. Go to **Settings** → **Data** → **Clear Data**
2. Read the warning carefully
3. Type "DELETE" to confirm
4. Click **Clear All Data**

> **Warning:** This action cannot be undone. Export your data first if you want to keep it.

---

## Tips for settings

- **Set up sync early** — Configure P2P sync before adding lots of data
- **Export regularly** — Keep a backup in case you need to clear browser data
- **Try Ollama** — If privacy is paramount, Ollama keeps AI processing entirely local
- **Adjust session length** — If you find yourself losing focus, try shorter maximum sessions
