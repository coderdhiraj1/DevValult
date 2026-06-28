import { StorageSnapshot } from '../types/storage';
import { clearPageStorage, updatePageStorageEntry, updateCookieEntry, getPageCookies, deleteCookieEntry } from './storage-api';

export async function saveSnapshot(
  name: string,
  origin: string,
  data: StorageSnapshot['data']
): Promise<StorageSnapshot> {
  const snapshot: StorageSnapshot = {
    id: `snap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    timestamp: Date.now(),
    origin,
    data,
  };

  const res = await chrome.storage.local.get('snapshots');
  const snapshots = (res.snapshots as StorageSnapshot[]) || [];
  snapshots.push(snapshot);
  await chrome.storage.local.set({ snapshots });
  return snapshot;
}

export async function listSnapshots(origin?: string): Promise<StorageSnapshot[]> {
  const res = await chrome.storage.local.get('snapshots');
  const snapshots = (res.snapshots as StorageSnapshot[]) || [];
  if (origin) {
    return snapshots.filter((s: StorageSnapshot) => s.origin === origin);
  }
  return snapshots;
}

export async function deleteSnapshot(id: string): Promise<void> {
  const res = await chrome.storage.local.get('snapshots');
  const snapshots = (res.snapshots as StorageSnapshot[]) || [];
  const updated = snapshots.filter((s: StorageSnapshot) => s.id !== id);
  await chrome.storage.local.set({ snapshots: updated });
}

export async function restoreSnapshot(
  tabId: number,
  urlStr: string,
  snapshot: StorageSnapshot
): Promise<boolean> {
  try {
    // 1. Restore Local Storage
    await clearPageStorage(tabId, 'local');
    for (const [key, value] of Object.entries(snapshot.data.local)) {
      await updatePageStorageEntry(tabId, 'local', key, value);
    }

    // 2. Restore Session Storage
    await clearPageStorage(tabId, 'session');
    for (const [key, value] of Object.entries(snapshot.data.session)) {
      await updatePageStorageEntry(tabId, 'session', key, value);
    }

    // 3. Restore Cookies
    // Clear active cookies first
    const currentCookies = await getPageCookies(urlStr);
    for (const c of currentCookies) {
      await deleteCookieEntry(urlStr, c.key);
    }
    // Set cookies from snapshot
    for (const c of snapshot.data.cookies) {
      await updateCookieEntry(urlStr, c);
    }

    return true;
  } catch (error) {
    console.error('Failed to restore snapshot:', error);
    return false;
  }
}
