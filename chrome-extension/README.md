# West Marches Companion - Chrome Extension

A Chrome extension that integrates West Marches tools directly into D&D Beyond.

## Features

- **Command Palette** (Ctrl/Cmd+K) — Quick navigation for D&D Beyond and West Marches
- **Map Sidebar** (Ctrl/Cmd+Shift+M) — View the hex map without leaving D&D Beyond
- **Quick NPC** — Create NPCs on the fly during sessions
- **Quick Notes** — Jot down notes that sync to West Marches
- **Floating Action Button** — Quick access from any D&D Beyond page

## Installation (Development)

1. Open Chrome and go to `chrome://extensions`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder from this repo
5. The extension icon should appear in your toolbar

## Setup

Before using the extension, you need to set up OAuth credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials?project=westmarches-dnd)
2. Click "Create Credentials" → "OAuth client ID"
3. Choose "Chrome Extension"
4. Enter the extension ID (shown in `chrome://extensions` after loading)
5. Copy the Client ID
6. Update `src/background/background.js` with your Client ID

## Usage

### Command Palette
- Press `Ctrl+K` (or `Cmd+K` on Mac) anywhere on D&D Beyond
- Type to search for pages, characters, spells, etc.
- Use arrow keys to navigate, Enter to select

### Map Sidebar
- Press `Ctrl+Shift+M` to toggle the map sidebar
- Or click the floating 🐉 button → Open Map

### Quick Actions
- Open command palette → select "Quick NPC" or "Quick Note"
- Fill in the form and save
- Data syncs to your West Marches Firebase

## File Structure

```
chrome-extension/
├── manifest.json          # Extension config
├── src/
│   ├── popup/            # Toolbar popup (login/settings)
│   ├── content/          # Injected into D&D Beyond pages
│   ├── background/       # Service worker (auth, API calls)
│   ├── sidebar/          # Map sidebar components
│   └── assets/           # Icons
└── README.md
```

## Development

The extension uses:
- Manifest V3 (latest Chrome extension format)
- Firebase Auth (via Google OAuth)
- Firestore REST API for data operations

To test changes:
1. Make edits to the source files
2. Go to `chrome://extensions`
3. Click the refresh icon on the West Marches Companion card
4. Reload the D&D Beyond page

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Open command palette |
| `Ctrl/Cmd + Shift + M` | Toggle map sidebar |
| `Escape` | Close palette/sidebar |
| `↑ / ↓` | Navigate results |
| `Enter` | Select result |

## Known Issues

- Map iframe may not work if West Marches site blocks embedding (need to add `?embed=true` support)
- OAuth flow requires manual Client ID setup
- Icons are placeholder red squares (need proper dragon icons)
