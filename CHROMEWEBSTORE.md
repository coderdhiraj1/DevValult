# Chrome Web Store Listing — DevVault

> Last Updated: 2026-06-17

## Store Listing

**Extension Name**
DevVault

**Short Description**
Offline-first developer tool for inspecting, editing, and diffing localStorage, sessionStorage, and cookies.

**Detailed Description**
DevVault is a light, powerful, and secure developer utility that stays open in a Chrome Side Panel while you interact with your web application. It lets you inspect, edit, delete, export, and diff storage engines across active tabs and environments without cluttering your browser window.

Features include:
1. Tabbed storage viewer for Cookies, Local Storage, and Session Storage.
2. In-place, validated inline editing of storage keys and values (including JSON formats).
3. Client-side, secure JWT decoder that expands token headers and payloads directly on your device.
4. Offline storage snapshots. Save, name, and restore entire tab states to chrome.storage.local with a single click.
5. Three-column storage diff. Instantly compare your active tab storage against other open tabs or saved snapshots, with git-like color coding.
6. Client-side instant filter for keys and values.
7. Fully offline operation. We do not make any network requests or call third-party APIs. Your data stays in your browser.

How to use it:
- Open the extension side panel using the browser toolbar action icon or the customizable keyboard shortcut (default: Ctrl+Shift+Y).
- Click on any tab (Local, Session, Cookies) to browse entries.
- Search for a specific key/value in the filter bar.
- Double-click any row to view, format JSON, decode JWT payloads, or save edits.
- Go to the "Snapshots" tab to save current states or load them back.
- Go to the "Diff" tab to select a target and run a comparison.

**Category**
Developer Tools

**Single Purpose**
Inspect, edit, and diff browser storage and cookies from a convenient, offline-first Chrome Side Panel.

**Primary Language**
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon | 128×128 PNG | ⬜ Not created | (Fallback to Chrome default icon) |
| Screenshot 1 | 1280×800 | ⬜ Not created | |
| Screenshot 2 | 1280×800 | ⬜ Not created | |

### Screenshot Notes
- **Screenshot 1**: Side panel displaying the localStorage grid, highlighting the JWT token row with the "JWT" badge and the search filter bar.
- **Screenshot 2**: Side panel displaying the "Diff" view, showing a color-coded comparison of active tab storage vs a saved snapshot (green for additions, red for deletions, yellow for changes).

## Permissions Justification

Every permission used in this extension is strictly mapped to developer features:

| Permission | Type | Justification |
|------------|------|---------------|
| `storage` | permissions | Used to save and load named user snapshots of storage data into the local extension storage (chrome.storage.local). |
| `cookies` | permissions | Used to query, update, and remove cookies for the active tab's domain. |
| `scripting` | permissions | Used to inject temporary scripts into the active tab to retrieve, edit, and clear localStorage and sessionStorage variables. |
| `tabs` | permissions | Used to query the active tab's URL, favicon, and title to display connection status and inspectable origin. |
| `sidePanel` | permissions | Used to register and render the primary developer interface inside Chrome's side panel UI. |
| `activeTab` | permissions | Used to grant temporary access to the current tab during user activation gestures. |

*Note: The extension declares **no host permissions** by default in its manifest.json. Instead, it requests host access for specific active tab domains dynamically at runtime when the user clicks the "Grant Access to Site" button, ensuring maximum privacy.*

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

*Everything is kept local and fully offline.*

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL**
Not applicable (No user data is collected, stored outside the browser, or transmitted off-device).

## Distribution

**Visibility**: Public
**Regions**: All regions
**Pricing**: Free

## Developer Info

**Publisher Name**
Developer

**Contact Email**
developer@example.com

**Support URL / Email**
https://github.com/developer/storage-manager/issues

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-06-17 | Initial release with full viewer, editor, JWT decoder, snapshots, and diff viewer. | Draft |

## Review Notes

### Known Issues / Limitations
- Storage access is blocked on system pages (e.g. `chrome://extensions/`) and the Chrome Web Store due to browser security restrictions. An informative screen is shown in these cases.
