# DevVault - Chrome Extension (Manifest V3)

An offline-first, feature-rich developer tool rendered in a Chrome Side Panel for inspecting, editing, and comparing browser storage (localStorage, sessionStorage, cookies) across tabs and environments.

## Features
- **Unified Storage Viewer**: View all `localStorage`, `sessionStorage`, and cookies for the active tab's origin in a tabbed UI.
- **Inline Cell Editing & JSON Support**: Click or double-click to edit key/value pairs in place. Auto-detects, validates, and pretty-prints JSON values.
- **Client-Side JWT Auto-Decoder**: Automatically detects JSON Web Tokens (JWT) and offers a one-click decode utility to view the header and payload formatting locally.
- **Snapshot System**: Capture, name, and save the current state of tab storage into `chrome.storage.local`. Restore any snapshot with one click to overwrite the tab's current storage.
- **Three-Column Storage Diff**: Select any other open tab or saved snapshot to perform a git-like, color-coded diff comparison showing additions, deletions, and changed values.
- **Instant Filtering**: Search by key or value substring instantly on the client side.
- **Offline-First**: Fully secure, operates completely offline with no network calls or tracking.
- **System Theme Sync**: High-quality styling that automatically adjusts to the user's OS preference (Dark or Light theme).

## Tech Stack
- **Manifest V3**
- **Vanilla TypeScript** (zero heavy dependencies for minimal footprint)
- **Vite** with **@crxjs/vite-plugin** for Hot Module Replacement (HMR) during extension development

---

## Getting Started

### 1. Installation
Clone or navigate to the directory and install dependencies:
```bash
npm install
```

### 2. Run in Development Mode (With Hot Module Replacement)
Start the Vite dev server for HMR:
```bash
npm run dev
```

### 3. Load Unpacked Extension in Chrome
1. Open Google Chrome.
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Select the **`dist`** folder inside the project directory (Vite output).

The extension is now loaded! Click the extension icon in the toolbar, or use the keyboard shortcut `Ctrl+Shift+Y` (or `MacCtrl+Shift+Y` on macOS) to open the Side Panel.

---

## Production Build
To generate a clean production-ready build:
```bash
npm run build
```
This compiles the TypeScript files and bundles everything into the `dist/` directory.

---

## File Structure
- `manifest.json`: Extension entry point, declaring permissions (`storage`, `cookies`, `scripting`, `tabs`, `sidePanel`).
- `/src/types/storage.ts`: Shared TypeScript interfaces.
- `/src/background/service-worker.ts`: Ephemeral service worker setting up the action icon behavior.
- `/src/lib/storage-api.ts`: API layers managing active tab scripting and cookies.
- `/src/lib/snapshots.ts`: Local storage snapshot serializer.
- `/src/lib/diff.ts`: Diffs active tab storage with target.
- `/src/lib/jwt.ts`: Safe base64url parser & JWT structures finder.
- `/src/sidepanel/`: Side panel HTML, CSS, and main UI controller.
