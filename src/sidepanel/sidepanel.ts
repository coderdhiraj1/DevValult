import { StorageEntry, StorageType, StorageSnapshot, DiffResult } from '../types/storage';
import {
  getActiveTab,
  isInspectable,
  getSiteOrigin,
  checkPermission,
  requestPermission,
  getPageStorage,
  getPageCookies,
  updatePageStorageEntry,
  deletePageStorageEntry,
  clearPageStorage,
  updateCookieEntry,
  deleteCookieEntry,
} from '../lib/storage-api';
import { saveSnapshot, listSnapshots, deleteSnapshot, restoreSnapshot } from '../lib/snapshots';
import { calculateDiff } from '../lib/diff';
import { isJWT, decodeJWT } from '../lib/jwt';

// State Variables
let activeTab: chrome.tabs.Tab | null = null;
let currentTabOrigin = '';
let currentTabUrl = '';
let activeMode: StorageType | 'diff' | 'snapshots' = 'local';

let localEntries: StorageEntry[] = [];
let sessionEntries: StorageEntry[] = [];
let cookieEntries: StorageEntry[] = [];

let syncInterval: number | null = null;
let filteredEntries: StorageEntry[] = [];

// DOM Elements
const elActiveTabInfo = document.getElementById('active-tab-info')!;
const elTabFavicon = document.getElementById('tab-favicon')!;
const elTabTitle = document.getElementById('tab-title')!;
const elBtnRefresh = document.getElementById('btn-refresh')!;
const elBtnSettings = document.getElementById('btn-settings')!;
const elModalSettings = document.getElementById('modal-settings')!;
const elBtnSaveSettings = document.getElementById('btn-save-settings')!;

const elPermissionScreen = document.getElementById('permission-screen')!;
const elPermissionOrigin = document.getElementById('permission-origin')!;
const elBtnGrantPermission = document.getElementById('btn-grant-permission')!;

const elSystemScreen = document.getElementById('system-screen')!;
const elWorkspaceScreen = document.getElementById('workspace-screen')!;

const elMainNav = document.querySelector('.main-nav')!;
const elActionBar = document.getElementById('action-bar')!;
const elSearchInput = document.getElementById('search-input') as HTMLInputElement;
const elBtnClearSearch = document.getElementById('btn-clear-search')!;
const elBtnAddEntry = document.getElementById('btn-add-entry')!;
const elBtnBulkDelete = document.getElementById('btn-bulk-delete')!;
const elBtnExportJson = document.getElementById('btn-export-json')!;
const elBtnImportJson = document.getElementById('btn-import-json')!;
const elFileImport = document.getElementById('file-import') as HTMLInputElement;

const elViewStorage = document.getElementById('view-storage')!;
const elTableHeaders = document.getElementById('table-headers')!;
const elStorageList = document.getElementById('storage-list')!;
const elStorageEmpty = document.getElementById('storage-empty')!;

// Diff DOM
const elViewDiff = document.getElementById('view-diff')!;
const elDiffTargetSelect = document.getElementById('diff-target-select') as HTMLSelectElement;
const elBtnCalculateDiff = document.getElementById('btn-calculate-diff')!;
const elDiffList = document.getElementById('diff-list')!;
const elDiffEmpty = document.getElementById('diff-empty')!;

// Snapshots DOM
const elViewSnapshots = document.getElementById('view-snapshots')!;
const elSnapshotNameInput = document.getElementById('snapshot-name-input') as HTMLInputElement;
const elBtnCreateSnapshot = document.getElementById('btn-create-snapshot')!;
const elSnapshotsList = document.getElementById('snapshots-list')!;
const elSnapshotsEmpty = document.getElementById('snapshots-empty')!;

// Modals DOM
const elModalEdit = document.getElementById('modal-edit')!;
const elModalTitle = document.getElementById('modal-title')!;
const elEditForm = document.getElementById('edit-form') as HTMLFormElement;
const elEditKey = document.getElementById('edit-key') as HTMLInputElement;
const elEditValue = document.getElementById('edit-value') as HTMLTextAreaElement;
const elJsonTools = document.getElementById('json-tools')!;
const elBtnFormatJson = document.getElementById('btn-format-json')!;
const elCookieFields = document.getElementById('cookie-fields')!;

// Cookie form fields
const elCookieDomain = document.getElementById('edit-cookie-domain') as HTMLInputElement;
const elCookiePath = document.getElementById('edit-cookie-path') as HTMLInputElement;
const elCookieSecure = document.getElementById('edit-cookie-secure') as HTMLInputElement;
const elCookieHttpOnly = document.getElementById('edit-cookie-httponly') as HTMLInputElement;
const elCookieSameSite = document.getElementById('edit-cookie-samesite') as HTMLSelectElement;
const elCookieExpiration = document.getElementById('edit-cookie-expiration') as HTMLInputElement;

// JWT DOM
const elJwtDecoderBox = document.getElementById('jwt-decoder-box')!;
const elBtnToggleJwtDecode = document.getElementById('btn-toggle-jwt-decode')!;
const elJwtPayloadDisplay = document.getElementById('jwt-payload-display')!;
const elJwtHeaderCode = document.getElementById('jwt-header-code')!;
const elJwtPayloadCode = document.getElementById('jwt-payload-code')!;

const elBtnSaveEntry = document.getElementById('btn-save-entry')!;

// Confirm Dialog
const elModalConfirm = document.getElementById('modal-confirm')!;
const elConfirmTitle = document.getElementById('confirm-title')!;
const elConfirmMessage = document.getElementById('confirm-message')!;
const elBtnConfirmOk = document.getElementById('btn-confirm-ok')!;

// Modals close button
const elBtnCloseModals = document.querySelectorAll('.btn-close-modal');

// Toast Helper
function showToast(message: string, type: 'success' | 'danger' | 'warning' = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

// Dialog Confirm Action Helper
let confirmCallback: (() => void) | null = null;
function showConfirm(title: string, message: string, onConfirm: () => void) {
  elConfirmTitle.innerText = title;
  elConfirmMessage.innerText = message;
  confirmCallback = onConfirm;
  elModalConfirm.classList.remove('hidden');
}

// Startup Initialization
async function init() {
  setupEventListeners();
  await loadSettings();
  await refreshActiveTabContext();
  startSyncWatcher();
}

// Set up UI Event Listeners
function setupEventListeners() {
  // Main Tab Navigation
  elMainNav.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('nav-tab')) {
      document.querySelectorAll('.nav-tab').forEach((tab) => tab.classList.remove('active'));
      target.classList.add('active');
      const tabName = target.getAttribute('data-tab') as any;
      switchTab(tabName);
    }
  });

  // Settings Buttons
  elBtnSettings.addEventListener('click', openSettingsModal);
  elBtnSaveSettings.addEventListener('click', handleSaveSettings);

  // Refresh Button
  elBtnRefresh.addEventListener('click', async () => {
    await refreshActiveTabContext();
    showToast('State reloaded from tab', 'success');
  });

  // Search input
  elSearchInput.addEventListener('input', () => {
    if (elSearchInput.value.length > 0) {
      elBtnClearSearch.classList.remove('hidden');
    } else {
      elBtnClearSearch.classList.add('hidden');
    }
    renderCurrentTab();
  });

  // Clear search
  elBtnClearSearch.addEventListener('click', () => {
    elSearchInput.value = '';
    elBtnClearSearch.classList.add('hidden');
    renderCurrentTab();
  });

  // Grant Permission Button
  elBtnGrantPermission.addEventListener('click', async () => {
    if (currentTabUrl) {
      const granted = await requestPermission(currentTabUrl);
      if (granted) {
        showToast('Access permission granted', 'success');
        await refreshActiveTabContext();
      } else {
        showToast('Permission request denied', 'danger');
      }
    }
  });

  // Modal Save button
  elBtnSaveEntry.addEventListener('click', handleSaveEntry);

  // Close modals
  elBtnCloseModals.forEach((btn) => {
    btn.addEventListener('click', () => {
      closeAllModals();
    });
  });

  // Format JSON
  elBtnFormatJson.addEventListener('click', () => {
    try {
      const val = elEditValue.value;
      const parsed = JSON.parse(val);
      elEditValue.value = JSON.stringify(parsed, null, 2);
    } catch {
      showToast('Invalid JSON structure', 'danger');
    }
  });

  // JSON input change in Modal (for validation & JWT detection)
  elEditValue.addEventListener('input', () => {
    const val = elEditValue.value;
    
    // JSON detection
    try {
      if ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'))) {
        JSON.parse(val);
        elJsonTools.classList.remove('hidden');
      } else {
        elJsonTools.classList.add('hidden');
      }
    } catch {
      elJsonTools.classList.add('hidden');
    }

    // JWT detection
    if (isJWT(val)) {
      elJwtDecoderBox.classList.remove('hidden');
    } else {
      elJwtDecoderBox.classList.add('hidden');
      elJwtPayloadDisplay.classList.add('hidden');
      elBtnToggleJwtDecode.textContent = 'Decode';
    }
  });

  // JWT Toggle Decode
  elBtnToggleJwtDecode.addEventListener('click', () => {
    const token = elEditValue.value;
    if (elJwtPayloadDisplay.classList.contains('hidden')) {
      const decoded = decodeJWT(token);
      if (decoded) {
        elJwtHeaderCode.textContent = JSON.stringify(decoded.header, null, 2);
        elJwtPayloadCode.textContent = JSON.stringify(decoded.payload, null, 2);
        elJwtPayloadDisplay.classList.remove('hidden');
        elBtnToggleJwtDecode.textContent = 'Hide';
      } else {
        showToast('Failed to decode JWT', 'danger');
      }
    } else {
      elJwtPayloadDisplay.classList.add('hidden');
      elBtnToggleJwtDecode.textContent = 'Decode';
    }
  });

  // Add Item Button
  elBtnAddEntry.addEventListener('click', () => {
    openEditModal(null);
  });

  // Bulk Delete Button
  elBtnBulkDelete.addEventListener('click', () => {
    if (filteredEntries.length === 0) {
      showToast('No entries to delete', 'warning');
      return;
    }
    showConfirm(
      'Bulk Delete',
      `Are you sure you want to delete all ${filteredEntries.length} items matching the current filter? This cannot be undone.`,
      async () => {
        if (!activeTab || !activeTab.id) return;
        let success = true;
        const keysToDelete = filteredEntries.map((e) => e.key);

        if (activeMode === 'local' || activeMode === 'session') {
          success = await clearPageStorage(activeTab.id, activeMode, keysToDelete);
        } else if (activeMode === 'cookie') {
          for (const key of keysToDelete) {
            const delSuccess = await deleteCookieEntry(currentTabUrl, key);
            if (!delSuccess) success = false;
          }
        }

        if (success) {
          showToast(`Deleted ${keysToDelete.length} entries`, 'success');
          await loadStorageData();
        } else {
          showToast('Failed to delete some entries', 'danger');
        }
        closeAllModals();
      }
    );
  });

  // Confirm dialog button
  elBtnConfirmOk.addEventListener('click', () => {
    if (confirmCallback) {
      confirmCallback();
    }
  });

  // Export JSON Button
  elBtnExportJson.addEventListener('click', handleExportJson);

  // Import JSON trigger click on file input
  elBtnImportJson.addEventListener('click', () => {
    elFileImport.click();
  });

  // File import change handler
  elFileImport.addEventListener('change', handleImportJson);

  // Save Snapshot Button
  elBtnCreateSnapshot.addEventListener('click', handleCreateSnapshot);

  // Calculate Diff Button
  elBtnCalculateDiff.addEventListener('click', handleCalculateDiff);
}

// Close all open modals
function closeAllModals() {
  elModalEdit.classList.add('hidden');
  elModalConfirm.classList.add('hidden');
  elModalSettings.classList.add('hidden');
}

// Switch tabs inside workspace
function switchTab(tabName: StorageType | 'diff' | 'snapshots') {
  activeMode = tabName;
  
  // Hide all view panels
  elViewStorage.classList.remove('active');
  elViewDiff.classList.remove('active');
  elViewSnapshots.classList.remove('active');

  if (tabName === 'diff') {
    elViewDiff.classList.add('active');
    elActionBar.classList.add('hidden');
    loadDiffOptions();
  } else if (tabName === 'snapshots') {
    elViewSnapshots.classList.add('active');
    elActionBar.classList.add('hidden');
    loadSnapshotsList();
  } else {
    elViewStorage.classList.add('active');
    elActionBar.classList.remove('hidden');
    renderCurrentTab();
  }
}

// Read current active tab URL and check permission
async function refreshActiveTabContext() {
  activeTab = await getActiveTab();
  
  if (!activeTab || !activeTab.url) {
    elWorkspaceScreen.classList.add('hidden');
    elPermissionScreen.classList.add('hidden');
    elSystemScreen.classList.remove('hidden');
    return;
  }

  currentTabUrl = activeTab.url;
  
  if (!isInspectable(currentTabUrl)) {
    elWorkspaceScreen.classList.add('hidden');
    elPermissionScreen.classList.add('hidden');
    elSystemScreen.classList.remove('hidden');
    return;
  }

  currentTabOrigin = getSiteOrigin(currentTabUrl);
  elTabFavicon.style.backgroundImage = activeTab.favIconUrl ? `url(${activeTab.favIconUrl})` : 'none';
  elTabTitle.textContent = `${activeTab.title || 'Active Tab'} (${currentTabOrigin})`;

  const hasPerm = await checkPermission(currentTabUrl);
  if (!hasPerm) {
    elWorkspaceScreen.classList.add('hidden');
    elSystemScreen.classList.add('hidden');
    elPermissionOrigin.textContent = currentTabOrigin;
    elPermissionScreen.classList.remove('hidden');
    return;
  }

  // Load storage data and render
  elPermissionScreen.classList.add('hidden');
  elSystemScreen.classList.add('hidden');
  elWorkspaceScreen.classList.remove('hidden');
  
  await loadStorageData();
}

// Retrieve storage entries from active tab context
async function loadStorageData() {
  if (!activeTab || !activeTab.id || !currentTabUrl) return;

  const { local, session } = await getPageStorage(activeTab.id, currentTabUrl);
  localEntries = local;
  sessionEntries = session;
  cookieEntries = await getPageCookies(currentTabUrl);

  renderCurrentTab();
}

// Render data based on current tab
function renderCurrentTab() {
  if (activeMode === 'diff' || activeMode === 'snapshots') return;

  elTableHeaders.innerHTML = '';
  elStorageList.innerHTML = '';

  const search = elSearchInput.value.toLowerCase();
  let sourceList: StorageEntry[] = [];

  if (activeMode === 'local') {
    sourceList = localEntries;
    elTableHeaders.innerHTML = `
      <th style="width: 35%">Key</th>
      <th style="width: 50%">Value</th>
      <th style="width: 15%; text-align: right">Actions</th>
    `;
  } else if (activeMode === 'session') {
    sourceList = sessionEntries;
    elTableHeaders.innerHTML = `
      <th style="width: 35%">Key</th>
      <th style="width: 50%">Value</th>
      <th style="width: 15%; text-align: right">Actions</th>
    `;
  } else if (activeMode === 'cookie') {
    sourceList = cookieEntries;
    elTableHeaders.innerHTML = `
      <th style="width: 25%">Key</th>
      <th style="width: 35%">Value</th>
      <th style="width: 25%">Attributes</th>
      <th style="width: 15%; text-align: right">Actions</th>
    `;
  }

  // Filter list by search criteria
  filteredEntries = sourceList.filter(
    (e) => e.key.toLowerCase().includes(search) || e.value.toLowerCase().includes(search)
  );

  if (filteredEntries.length === 0) {
    elStorageEmpty.classList.remove('hidden');
    return;
  }

  elStorageEmpty.classList.add('hidden');

  filteredEntries.forEach((entry) => {
    const tr = document.createElement('tr');
    
    // Key cell
    const tdKey = document.createElement('td');
    tdKey.style.fontWeight = '500';
    tdKey.textContent = entry.key;

    // Value cell
    const tdValue = document.createElement('td');
    const valueWrapper = document.createElement('div');
    valueWrapper.style.display = 'flex';
    valueWrapper.style.alignItems = 'center';
    valueWrapper.style.gap = '6px';

    const valueSpan = document.createElement('span');
    valueSpan.style.display = 'inline-block';
    valueSpan.style.maxWidth = '180px';
    valueSpan.style.overflow = 'hidden';
    valueSpan.style.textOverflow = 'ellipsis';
    valueSpan.style.whiteSpace = 'nowrap';
    valueSpan.style.fontFamily = 'var(--font-mono)';
    valueSpan.style.fontSize = '11px';
    valueSpan.textContent = entry.value;

    valueWrapper.appendChild(valueSpan);

    // If it is JSON or JWT, add a badge
    let isValJson = false;
    try {
      if ((entry.value.startsWith('{') && entry.value.endsWith('}')) || 
          (entry.value.startsWith('[') && entry.value.endsWith(']'))) {
        JSON.parse(entry.value);
        isValJson = true;
      }
    } catch {}

    if (isValJson) {
      const badgeJson = document.createElement('span');
      badgeJson.className = 'badge badge-sec';
      badgeJson.textContent = 'JSON';
      valueWrapper.appendChild(badgeJson);
    }

    if (isJWT(entry.value)) {
      const badgeJwt = document.createElement('span');
      badgeJwt.className = 'badge badge-jwt';
      badgeJwt.textContent = 'JWT';
      badgeJwt.title = 'Click to view decoded JWT';
      badgeJwt.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(entry);
        // Trigger JWT decode automatically
        setTimeout(() => {
          elBtnToggleJwtDecode.click();
        }, 100);
      });
      valueWrapper.appendChild(badgeJwt);
    }

    tdValue.appendChild(valueWrapper);

    // Double-click row to edit
    tr.addEventListener('dblclick', () => {
      openEditModal(entry);
    });

    if (activeMode === 'cookie') {
      // Attributes cell
      const tdAttr = document.createElement('td');
      const attrWrapper = document.createElement('div');
      attrWrapper.style.display = 'flex';
      attrWrapper.style.flexWrap = 'wrap';
      attrWrapper.style.gap = '4px';

      if (entry.httpOnly) {
        const badge = document.createElement('span');
        badge.className = 'badge badge-sec';
        badge.textContent = 'HttpOnly';
        attrWrapper.appendChild(badge);
      }
      if (entry.secure) {
        const badge = document.createElement('span');
        badge.className = 'badge badge-sec';
        badge.textContent = 'Secure';
        attrWrapper.appendChild(badge);
      }
      if (entry.session) {
        const badge = document.createElement('span');
        badge.className = 'badge badge-sec';
        badge.textContent = 'Session';
        attrWrapper.appendChild(badge);
      } else if (entry.expirationDate) {
        const badge = document.createElement('span');
        badge.className = 'badge badge-sec';
        const date = new Date(entry.expirationDate * 1000);
        badge.textContent = `Exp: ${date.toLocaleDateString()}`;
        badge.title = date.toLocaleString();
        attrWrapper.appendChild(badge);
      }

      tdAttr.appendChild(attrWrapper);

      // Actions cell
      const tdActions = document.createElement('td');
      tdActions.className = 'row-actions';
      tdActions.innerHTML = `
        <button class="btn-icon btn-edit" title="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
        <button class="btn-icon btn-delete" title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg></button>
      `;

      tdActions.querySelector('.btn-edit')!.addEventListener('click', () => openEditModal(entry));
      tdActions.querySelector('.btn-delete')!.addEventListener('click', () => handleDeleteEntry(entry));

      tr.appendChild(tdKey);
      tr.appendChild(tdValue);
      tr.appendChild(tdAttr);
      tr.appendChild(tdActions);
    } else {
      // Actions cell
      const tdActions = document.createElement('td');
      tdActions.className = 'row-actions';
      tdActions.innerHTML = `
        <button class="btn-icon btn-edit" title="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
        <button class="btn-icon btn-delete" title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg></button>
      `;

      tdActions.querySelector('.btn-edit')!.addEventListener('click', () => openEditModal(entry));
      tdActions.querySelector('.btn-delete')!.addEventListener('click', () => handleDeleteEntry(entry));

      tr.appendChild(tdKey);
      tr.appendChild(tdValue);
      tr.appendChild(tdActions);
    }

    elStorageList.appendChild(tr);
  });
}

// Open Edit modal
let currentEditingEntry: StorageEntry | null = null;
function openEditModal(entry: StorageEntry | null) {
  currentEditingEntry = entry;
  closeAllModals();

  // Reset modal states
  elEditForm.reset();
  elJsonTools.classList.add('hidden');
  elJwtDecoderBox.classList.add('hidden');
  elJwtPayloadDisplay.classList.add('hidden');
  elBtnToggleJwtDecode.textContent = 'Decode';
  elCookieFields.classList.add('hidden');

  if (entry) {
    elModalTitle.textContent = `Edit ${entry.type === 'cookie' ? 'Cookie' : activeMode === 'local' ? 'Local Storage' : 'Session Storage'} Entry`;
    elEditKey.value = entry.key;
    elEditKey.disabled = true; // Key cannot be edited for existing item (or we delete/re-insert)
    elEditValue.value = entry.value;

    // Trigger validation event
    elEditValue.dispatchEvent(new Event('input'));

    if (entry.type === 'cookie') {
      elCookieFields.classList.remove('hidden');
      elCookieDomain.value = entry.domain || '';
      elCookiePath.value = entry.path || '/';
      elCookieSecure.checked = entry.secure ?? false;
      elCookieHttpOnly.checked = entry.httpOnly ?? false;
      elCookieSameSite.value = entry.sameSite || 'unspecified';
      elCookieExpiration.value = entry.expirationDate ? String(entry.expirationDate) : '';
    }
  } else {
    // Creating new entry
    elModalTitle.textContent = `Add ${activeMode === 'local' ? 'Local Storage' : activeMode === 'session' ? 'Session Storage' : 'Cookie'} Entry`;
    elEditKey.value = '';
    elEditKey.disabled = false;
    elEditValue.value = '';

    if (activeMode === 'cookie') {
      elCookieFields.classList.remove('hidden');
      elCookieDomain.value = '';
      elCookiePath.value = '/';
      elCookieSecure.checked = false;
      elCookieHttpOnly.checked = false;
      elCookieSameSite.value = 'lax';
      elCookieExpiration.value = '';
    }
  }

  elModalEdit.classList.remove('hidden');
}

// Handle Save Action in Modal
async function handleSaveEntry() {
  const key = elEditKey.value.trim();
  const value = elEditValue.value;

  if (!key) {
    showToast('Key cannot be empty', 'danger');
    return;
  }

  // Validate JSON if JSON is input and JSON status is active
  if (!elJsonTools.classList.contains('hidden')) {
    try {
      JSON.parse(value);
    } catch {
      showToast('Value must be a valid JSON', 'danger');
      return;
    }
  }

  let success = false;
  if (activeMode === 'local' || activeMode === 'session') {
    if (activeTab && activeTab.id) {
      success = await updatePageStorageEntry(activeTab.id, activeMode, key, value);
    }
  } else if (activeMode === 'cookie') {
    const expirationVal = elCookieExpiration.value.trim();
    const entry: Omit<StorageEntry, 'type'> = {
      key,
      value,
      domain: elCookieDomain.value.trim() || undefined,
      path: elCookiePath.value.trim() || undefined,
      secure: elCookieSecure.checked,
      httpOnly: elCookieHttpOnly.checked,
      sameSite: elCookieSameSite.value as any,
      expirationDate: expirationVal ? Number(expirationVal) : undefined,
    };
    success = await updateCookieEntry(currentTabUrl, entry);
  }

  if (success) {
    showToast(currentEditingEntry ? 'Entry updated successfully' : 'Entry added successfully', 'success');
    closeAllModals();
    await loadStorageData();
  } else {
    showToast('Failed to save entry', 'danger');
  }
}

// Handle Delete Row Action
function handleDeleteEntry(entry: StorageEntry) {
  showConfirm(
    'Delete Entry',
    `Are you sure you want to delete "${entry.key}"? This action is immediate.`,
    async () => {
      let success = false;
      if (entry.type === 'local' || entry.type === 'session') {
        if (activeTab && activeTab.id) {
          success = await deletePageStorageEntry(activeTab.id, entry.type, entry.key);
        }
      } else if (entry.type === 'cookie') {
        success = await deleteCookieEntry(currentTabUrl, entry.key);
      }

      if (success) {
        showToast(`Deleted "${entry.key}"`, 'success');
        await loadStorageData();
      } else {
        showToast('Failed to delete entry', 'danger');
      }
      closeAllModals();
    }
  );
}

// JSON Export System
function handleExportJson() {
  const exportData = {
    origin: currentTabOrigin,
    timestamp: Date.now(),
    local: localEntries.reduce((acc, entry) => ({ ...acc, [entry.key]: entry.value }), {}),
    session: sessionEntries.reduce((acc, entry) => ({ ...acc, [entry.key]: entry.value }), {}),
    cookies: cookieEntries.map((e) => {
      const { type, ...rest } = e;
      return rest;
    }),
  };

  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  // Format filename cleanly
  const filename = `${currentTabOrigin.replace(/https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '_')}_storage.json`;
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Storage exported to JSON file', 'success');
}

// JSON Import System
async function handleImportJson(e: Event) {
  const target = e.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;

  const file = target.files[0];
  const reader = new FileReader();

  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target?.result as string);
      
      // Structure Validation
      if (!data || typeof data !== 'object') throw new Error('Invalid JSON');
      
      showConfirm(
        'Import Storage JSON',
        'Are you sure you want to import this file? It will OVERWRITE the current active tab storage for matching keys.',
        async () => {
          if (!activeTab || !activeTab.id) return;

          let success = true;

          // Import local
          if (data.local && typeof data.local === 'object') {
            for (const [key, value] of Object.entries(data.local)) {
              const res = await updatePageStorageEntry(activeTab.id!, 'local', key, String(value));
              if (!res) success = false;
            }
          }

          // Import session
          if (data.session && typeof data.session === 'object') {
            for (const [key, value] of Object.entries(data.session)) {
              const res = await updatePageStorageEntry(activeTab.id!, 'session', key, String(value));
              if (!res) success = false;
            }
          }

          // Import cookies
          if (Array.isArray(data.cookies)) {
            for (const c of data.cookies) {
              const res = await updateCookieEntry(currentTabUrl, c);
              if (!res) success = false;
            }
          }

          if (success) {
            showToast('Storage imported successfully', 'success');
            await loadStorageData();
          } else {
            showToast('Failed to import some entries', 'danger');
          }
          closeAllModals();
        }
      );
    } catch (err) {
      showToast('Invalid storage JSON structure', 'danger');
      console.error(err);
    } finally {
      // Reset input
      target.value = '';
    }
  };

  reader.readAsText(file);
}

// Create Snapshot System
async function handleCreateSnapshot() {
  const name = elSnapshotNameInput.value.trim();
  if (!name) {
    showToast('Please enter a snapshot name', 'danger');
    return;
  }

  const data = {
    local: localEntries.reduce((acc, entry) => ({ ...acc, [entry.key]: entry.value }), {}),
    session: sessionEntries.reduce((acc, entry) => ({ ...acc, [entry.key]: entry.value }), {}),
    cookies: cookieEntries.map((e) => {
      const { type, ...rest } = e;
      return rest;
    }),
  };

  try {
    await saveSnapshot(name, currentTabOrigin, data);
    elSnapshotNameInput.value = '';
    showToast(`Snapshot "${name}" saved!`, 'success');
    await loadSnapshotsList();
  } catch (error) {
    showToast('Failed to save snapshot', 'danger');
    console.error(error);
  }
}

// List Snapshots for the active origin
async function loadSnapshotsList() {
  elSnapshotsList.innerHTML = '';
  const snapshots = await listSnapshots(currentTabOrigin);

  if (snapshots.length === 0) {
    elSnapshotsEmpty.classList.remove('hidden');
    return;
  }

  elSnapshotsEmpty.classList.add('hidden');

  snapshots.sort((a, b) => b.timestamp - a.timestamp).forEach((snap) => {
    const card = document.createElement('div');
    card.className = 'snapshot-card';

    const info = document.createElement('div');
    info.className = 'snapshot-info';
    
    const title = document.createElement('h4');
    title.textContent = snap.name;
    
    const meta = document.createElement('div');
    meta.className = 'snapshot-meta';
    
    const dateStr = new Date(snap.timestamp).toLocaleString();
    const localCount = Object.keys(snap.data.local).length;
    const sessionCount = Object.keys(snap.data.session).length;
    const cookieCount = snap.data.cookies.length;
    
    meta.textContent = `${dateStr} • Local: ${localCount}, Session: ${sessionCount}, Cookies: ${cookieCount}`;
    
    info.appendChild(title);
    info.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'snapshot-actions';

    const btnRestore = document.createElement('button');
    btnRestore.className = 'btn btn-primary btn-xs';
    btnRestore.textContent = 'Restore';
    btnRestore.addEventListener('click', () => {
      showConfirm(
        'Restore Snapshot',
        `Restoring "${snap.name}" will completely overwrite the active tab's current storage and cookies. Are you sure?`,
        async () => {
          if (!activeTab || !activeTab.id) return;
          const success = await restoreSnapshot(activeTab.id, currentTabUrl, snap);
          if (success) {
            showToast('Snapshot restored successfully!', 'success');
            await loadStorageData();
          } else {
            showToast('Failed to restore snapshot', 'danger');
          }
          closeAllModals();
        }
      );
    });

    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn btn-danger-outline btn-xs';
    btnDelete.textContent = 'Delete';
    btnDelete.addEventListener('click', () => {
      showConfirm(
        'Delete Snapshot',
        `Are you sure you want to delete snapshot "${snap.name}"? This is permanent.`,
        async () => {
          await deleteSnapshot(snap.id);
          showToast(`Snapshot "${snap.name}" deleted`, 'success');
          await loadSnapshotsList();
          closeAllModals();
        }
      );
    });

    actions.appendChild(btnRestore);
    actions.appendChild(btnDelete);

    card.appendChild(info);
    card.appendChild(actions);

    elSnapshotsList.appendChild(card);
  });
}

// Populate Diff target dropdown
async function loadDiffOptions() {
  // Clear options but keep default
  elDiffTargetSelect.innerHTML = '<option value="">-- Choose target --</option>';

  // 1. Add other tabs
  const allTabs = await chrome.tabs.query({});
  const otherTabs = allTabs.filter((tab) => tab.id !== activeTab?.id && tab.url && isInspectable(tab.url));
  
  if (otherTabs.length > 0) {
    const optGroupTabs = document.createElement('optgroup');
    optGroupTabs.label = 'Other Tabs';
    otherTabs.forEach((tab) => {
      const opt = document.createElement('option');
      opt.value = `tab_${tab.id}`;
      opt.textContent = `${tab.title || 'Tab'} (${getSiteOrigin(tab.url!)})`;
      optGroupTabs.appendChild(opt);
    });
    elDiffTargetSelect.appendChild(optGroupTabs);
  }

  // 2. Add saved snapshots
  const snapshots = await listSnapshots();
  if (snapshots.length > 0) {
    const optGroupSnaps = document.createElement('optgroup');
    optGroupSnaps.label = 'Snapshots';
    snapshots.forEach((snap) => {
      const opt = document.createElement('option');
      opt.value = `snap_${snap.id}`;
      opt.textContent = `Snapshot: ${snap.name} (${snap.origin})`;
      optGroupSnaps.appendChild(opt);
    });
    elDiffTargetSelect.appendChild(optGroupSnaps);
  }
}

// Calculate Diff between Active Tab and selected Target
async function handleCalculateDiff() {
  const targetId = elDiffTargetSelect.value;
  if (!targetId) {
    showToast('Please select a comparison target', 'danger');
    return;
  }

  elDiffList.innerHTML = '';
  elDiffEmpty.classList.add('hidden');

  let targetEntries: StorageEntry[] = [];
  const activeEntries = [...localEntries, ...sessionEntries, ...cookieEntries];

  try {
    if (targetId.startsWith('snap_')) {
      // Target is a snapshot
      const snapshotId = targetId.replace('snap_', '');
      const snapshots = await listSnapshots();
      const snap = snapshots.find((s) => s.id === snapshotId);
      
      if (!snap) {
        showToast('Snapshot not found', 'danger');
        return;
      }

      // Convert snapshot structure to list of StorageEntry
      const snapLocal = Object.entries(snap.data.local).map(([k, v]) => ({
        key: k,
        value: String(v),
        type: 'local' as StorageType,
      }));
      const snapSession = Object.entries(snap.data.session).map(([k, v]) => ({
        key: k,
        value: String(v),
        type: 'session' as StorageType,
      }));
      const snapCookies = snap.data.cookies.map((c) => ({
        ...c,
        type: 'cookie' as StorageType,
      }));

      targetEntries = [...snapLocal, ...snapSession, ...snapCookies];
    } else if (targetId.startsWith('tab_')) {
      // Target is another tab
      const targetTabId = Number(targetId.replace('tab_', ''));
      const allTabs = await chrome.tabs.query({});
      const targetTab = allTabs.find((t) => t.id === targetTabId);
      
      if (!targetTab || !targetTab.url) {
        showToast('Target tab not found or inaccessible', 'danger');
        return;
      }

      // Check permission for target tab domain
      const hasPerm = await checkPermission(targetTab.url);
      if (!hasPerm) {
        showToast(`No host permission to inspect target tab domain: ${getSiteOrigin(targetTab.url)}`, 'danger');
        // Let's ask permission dynamically
        showConfirm(
          'Target Permission Required',
          `To compare with the target tab, you must grant host access to its domain: ${getSiteOrigin(targetTab.url)}`,
          async () => {
            const granted = await requestPermission(targetTab.url!);
            if (granted) {
              showToast('Permission granted. Please calculate diff again.', 'success');
            } else {
              showToast('Permission denied', 'danger');
            }
            closeAllModals();
          }
        );
        return;
      }

      const { local, session } = await getPageStorage(targetTabId, targetTab.url);
      const cookies = await getPageCookies(targetTab.url);
      targetEntries = [...local, ...session, ...cookies];
    }

    // Run Diffing Algorithm
    const diffResults = calculateDiff(activeEntries, targetEntries);
    const nonIdenticalResults = diffResults.filter((r) => r.status !== 'identical');

    if (nonIdenticalResults.length === 0) {
      elDiffList.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--success); font-weight: bold; padding: 20px;">🎉 Storage states are identical!</td></tr>`;
      return;
    }

    nonIdenticalResults.forEach((res) => {
      const tr = document.createElement('tr');
      
      // Color coding row based on status
      if (res.status === 'onlyA') {
        tr.className = 'diff-row-onlyA';
      } else if (res.status === 'onlyB') {
        tr.className = 'diff-row-onlyB';
      } else if (res.status === 'different') {
        tr.className = 'diff-row-different';
      }

      // Type cell
      const tdType = document.createElement('td');
      tdType.innerHTML = `<span class="badge badge-sec">${res.type}</span>`;

      // Key cell
      const tdKey = document.createElement('td');
      tdKey.style.fontWeight = '500';
      tdKey.textContent = res.key;

      // Value Active Tab cell
      const tdValA = document.createElement('td');
      tdValA.className = 'diff-value-cell';
      tdValA.textContent = res.valA !== undefined ? res.valA : '[Not present]';

      // Value Target cell
      const tdValB = document.createElement('td');
      tdValB.className = 'diff-value-cell';
      tdValB.textContent = res.valB !== undefined ? res.valB : '[Not present]';

      tr.appendChild(tdType);
      tr.appendChild(tdKey);
      tr.appendChild(tdValA);
      tr.appendChild(tdValB);

      elDiffList.appendChild(tr);
    });
  } catch (error) {
    showToast('Failed to calculate diff', 'danger');
    console.error(error);
  }
}

// Start Live sync watcher
function startSyncWatcher() {
  if (syncInterval) {
    clearInterval(syncInterval);
  }

  // 1. Poll localStorage & sessionStorage state every 3 seconds
  syncInterval = window.setInterval(async () => {
    // Only refresh if side panel is active, workspace is showing, and we are not in edit modal
    const isEditModalOpen = !elModalEdit.classList.contains('hidden');
    const isConfirmModalOpen = !elModalConfirm.classList.contains('hidden');
    const isWorkspaceVisible = !elWorkspaceScreen.classList.contains('hidden');

    if (isWorkspaceVisible && !isEditModalOpen && !isConfirmModalOpen) {
      if (activeTab && activeTab.id && currentTabUrl) {
        const { local, session } = await getPageStorage(activeTab.id, currentTabUrl);
        
        // Check if values actually changed to avoid redraw flicker
        const localChanged = JSON.stringify(local) !== JSON.stringify(localEntries);
        const sessionChanged = JSON.stringify(session) !== JSON.stringify(sessionEntries);

        if (localChanged || sessionChanged) {
          localEntries = local;
          sessionEntries = session;
          if (activeMode === 'local' || activeMode === 'session') {
            renderCurrentTab();
          }
        }
      }
    }
  }, 3000);

  // 2. Cookie change listener
  chrome.cookies.onChanged.addListener(async (changeInfo) => {
    if (!currentTabUrl) return;
    try {
      const url = new URL(currentTabUrl);
      const cookieDomain = changeInfo.cookie.domain;

      // If cookie domain matches active tab domain, refresh cookies
      if (url.hostname.includes(cookieDomain) || cookieDomain.includes(url.hostname)) {
        cookieEntries = await getPageCookies(currentTabUrl);
        if (activeMode === 'cookie') {
          renderCurrentTab();
        }
      }
    } catch (e) {
      console.error('Error handling cookie change event:', e);
    }
  });

  // 3. Tab navigation/change listeners
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    // Refresh context if active window tab changed
    await refreshActiveTabContext();
  });

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Refresh context if active tab URL loaded or changed
    if (tabId === activeTab?.id && changeInfo.status === 'complete') {
      await refreshActiveTabContext();
    }
  });
}

// Settings and Theme Management Functions
async function loadSettings() {
  const res = await chrome.storage.local.get(['theme', 'showDiff', 'showSnapshots']);
  
  // Theme
  const theme = (res.theme as 'system' | 'light' | 'dark') || 'system';
  applyTheme(theme);
  
  // Tab visibility
  const showDiff = res.showDiff !== false;
  const showSnapshots = res.showSnapshots !== false;
  applyTabVisibility(showDiff, showSnapshots);
}

function applyTheme(theme: 'system' | 'light' | 'dark') {
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else if (theme === 'light') {
    root.setAttribute('data-theme', 'light');
  } else if (theme === 'dark') {
    root.setAttribute('data-theme', 'dark');
  }
}

function applyTabVisibility(showDiff: boolean, showSnapshots: boolean) {
  const elTabDiffBtn = document.querySelector('.nav-tab[data-tab="diff"]') as HTMLElement;
  const elTabSnapshotsBtn = document.querySelector('.nav-tab[data-tab="snapshots"]') as HTMLElement;
  
  if (elTabDiffBtn) {
    if (showDiff) elTabDiffBtn.classList.remove('hidden');
    else elTabDiffBtn.classList.add('hidden');
  }
  
  if (elTabSnapshotsBtn) {
    if (showSnapshots) elTabSnapshotsBtn.classList.remove('hidden');
    else elTabSnapshotsBtn.classList.add('hidden');
  }
  
  // Handle edge case: if user is currently viewing a tab they just hid, switch them back to 'local'
  if (!showDiff && activeMode === 'diff') {
    document.querySelectorAll('.nav-tab').forEach((tab) => tab.classList.remove('active'));
    const localTab = document.querySelector('.nav-tab[data-tab="local"]');
    if (localTab) localTab.classList.add('active');
    switchTab('local');
  }
  
  if (!showSnapshots && activeMode === 'snapshots') {
    document.querySelectorAll('.nav-tab').forEach((tab) => tab.classList.remove('active'));
    const localTab = document.querySelector('.nav-tab[data-tab="local"]');
    if (localTab) localTab.classList.add('active');
    switchTab('local');
  }
}

async function openSettingsModal() {
  closeAllModals();
  const res = await chrome.storage.local.get(['theme', 'showDiff', 'showSnapshots']);
  
  const elSettingsTheme = document.getElementById('settings-theme') as HTMLSelectElement;
  const elSettingsShowDiff = document.getElementById('settings-show-diff') as HTMLInputElement;
  const elSettingsShowSnapshots = document.getElementById('settings-show-snapshots') as HTMLInputElement;
  
  elSettingsTheme.value = (res.theme as string) || 'system';
  elSettingsShowDiff.checked = res.showDiff !== false;
  elSettingsShowSnapshots.checked = res.showSnapshots !== false;
  
  elModalSettings.classList.remove('hidden');
}

async function handleSaveSettings() {
  const elSettingsTheme = document.getElementById('settings-theme') as HTMLSelectElement;
  const elSettingsShowDiff = document.getElementById('settings-show-diff') as HTMLInputElement;
  const elSettingsShowSnapshots = document.getElementById('settings-show-snapshots') as HTMLInputElement;
  
  const theme = elSettingsTheme.value as 'system' | 'light' | 'dark';
  const showDiff = elSettingsShowDiff.checked;
  const showSnapshots = elSettingsShowSnapshots.checked;
  
  await chrome.storage.local.set({
    theme,
    showDiff,
    showSnapshots
  });
  
  applyTheme(theme);
  applyTabVisibility(showDiff, showSnapshots);
  
  closeAllModals();
  showToast('Settings saved successfully', 'success');
}

// Launch application
init();
