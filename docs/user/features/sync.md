# Device Sync

Sync your Lockdn data between your own devices. This guide explains how peer-to-peer sync works and how to set it up.

---

## How Sync Works

Lockdn uses peer-to-peer (P2P) technology to sync data:

- **Direct connection** — Devices talk to each other, not a server
- **No cloud storage** — Your data never sits on someone else's computer
- **Real-time updates** — Changes sync within seconds when both devices are online
- **Works offline** — Data syncs when devices reconnect

---

## What Syncs

### Data That Syncs

- Courses and assignments
- Notes and extracted content
- Study materials (guides and exams)
- Study sessions and plans
- Tutor conversations
- Analytics and daily summaries
- Preferences (except API keys)

### Data That Doesn't Sync

- **API keys** — Never leave your device (for security)
- **Encryption secrets** — Device-specific

> **Important:** You'll need to enter your API key on each device separately.

---

## Setting Up Sync

### Prerequisites

- Two or more devices (laptop, desktop, tablet)
- Both devices connected to the internet
- Lockdn open on both devices

### Pairing Devices

#### On Your First Device:

1. Go to **Settings** → **Device Sync**
2. Click **Add Device**
3. A QR code and pairing code appear

#### On Your Second Device:

1. Go to **Settings** → **Device Sync**
2. Click **Pair Device**
3. Either:
   - Scan the QR code with your camera, or
   - Enter the 6-character pairing code manually
4. Click **Connect**

### Confirming the Connection

When paired successfully:

- Both devices show "Connected"
- A sync icon appears in the header
- Initial data sync begins automatically

---

## Sync Status

### Status Indicators

The sync icon in your header shows connection status:

- **🟢 Green** — Connected and synced
- **🟡 Yellow** — Syncing in progress
- **⚪ Gray** — Not connected (offline or no peers)

### Detailed Status

Go to **Settings** → **Device Sync** to see:

- Connected devices
- Last sync time
- Sync health

---

## Managing Paired Devices

### Viewing Paired Devices

In **Settings** → **Device Sync**, see all your paired devices:

- Device name/identifier
- Last seen online
- Connection status

### Removing a Device

To unpair a device:

1. Go to **Settings** → **Device Sync**
2. Find the device to remove
3. Click **Remove**
4. Confirm removal

The device will no longer sync with your others.

---

## How P2P Sync Works

### Technical Overview

Lockdn uses WebRTC for peer-to-peer connections:

1. **Signaling** — A small server helps devices find each other
2. **Connection** — Devices establish a direct encrypted link
3. **Data transfer** — Changes flow directly between devices

### Conflict Resolution

When changes happen on multiple devices:

- Most recent change wins (timestamp-based)
- Both versions are preserved in history
- No data is lost

### Security

- All P2P connections are encrypted
- Device pairing requires physical access (QR code or code entry)
- API keys never sync (stay on each device)

---

## Sync Scenarios

### Both Devices Online

Changes sync in real-time:

1. You add a course on your laptop
2. Within seconds, it appears on your desktop
3. Works in both directions

### One Device Offline

1. You make changes on your offline laptop
2. Changes are stored locally
3. When you reconnect, changes sync automatically

### Both Devices Were Offline

1. Device A made changes offline
2. Device B made changes offline
3. When they reconnect, both sets of changes merge
4. Conflicts are resolved by timestamp

---

## Troubleshooting Sync

### "Devices won't connect"

Check:
- Both devices have internet access
- Lockdn is open on both devices
- You're using the correct pairing code

Try:
- Refresh Lockdn on both devices
- Generate a new pairing code
- Check firewall settings

### "Sync seems slow"

P2P sync speed depends on:
- Internet connection on both devices
- Network conditions
- Amount of data to sync

Large initial syncs may take a minute.

### "Data isn't appearing on the other device"

1. Check sync status on both devices
2. Verify they show as connected
3. Wait a moment for sync to complete
4. If still missing, try refreshing

### "I see duplicate data"

Duplicates can occur if:
- Same data was added on multiple devices before syncing
- Sync interrupted during merge

To clean up:
- Delete duplicates manually
- Future syncs will stay in sync

---

## Best Practices

### Initial Setup

- Pair devices when both have good internet
- Wait for initial sync to complete before making changes
- Verify key data appears on both devices

### Daily Use

- Open Lockdn on your primary device daily
- Changes sync automatically when devices are online
- Don't worry about manual syncing

### Managing Multiple Devices

- Pair all devices with each other
- Remove devices you no longer use
- Re-pair if connection issues persist

### Security

- Only pair your own devices
- Don't share pairing codes
- Unpair lost or stolen devices immediately
- Enter API keys separately on each device

---

## Sync Without the Internet

### Local Network Sync

If devices are on the same WiFi network, they may sync directly even without internet access (depends on network configuration).

### Offline Changes

Work offline with confidence:
- All changes save locally
- Changes queue for sync
- Everything merges when you reconnect

---

## FAQ

### "Do I need to sync?"

No! Sync is optional. If you only use Lockdn on one device, you don't need it.

### "Is my data secure during sync?"

Yes. All P2P connections use encryption. Data travels directly between your devices.

### "What if I lose a device?"

1. Remove the lost device from your paired devices list
2. Your data remains safe on your other devices
3. The lost device can't sync without being re-paired

### "Can I sync with a friend's device?"

Lockdn sync is designed for your own devices. Sharing with friends would mix your data together.

### "What about tablet/phone?"

Lockdn works in mobile browsers, but is optimized for desktop/laptop. You can sync with mobile devices using the same pairing process.
