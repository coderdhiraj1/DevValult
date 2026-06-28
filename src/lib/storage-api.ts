import { StorageEntry, StorageType } from '../types/storage';

export function isInspectable(urlStr?: string): boolean {
  if (!urlStr) return false;
  return urlStr.startsWith('http://') || urlStr.startsWith('https://') || urlStr.startsWith('file://');
}

export function getSiteOrigin(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    return url.origin;
  } catch {
    return '';
  }
}

export async function checkPermission(urlStr: string): Promise<boolean> {
  if (!isInspectable(urlStr)) return false;
  const origin = getSiteOrigin(urlStr) + '/*';
  return await chrome.permissions.contains({
    origins: [origin],
  });
}

export async function requestPermission(urlStr: string): Promise<boolean> {
  if (!isInspectable(urlStr)) return false;
  const origin = getSiteOrigin(urlStr) + '/*';
  return await chrome.permissions.request({
    origins: [origin],
  });
}

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

export async function getPageStorage(tabId: number, urlStr: string): Promise<{ local: StorageEntry[]; session: StorageEntry[] }> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const localData: { [key: string]: string } = {};
        const sessionData: { [key: string]: string } = {};
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key !== null) {
            localData[key] = localStorage.getItem(key) || '';
          }
        }
        
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key !== null) {
            sessionData[key] = sessionStorage.getItem(key) || '';
          }
        }
        
        return { local: localData, session: sessionData };
      },
    });

    if (!results || results.length === 0 || !results[0].result) {
      return { local: [], session: [] };
    }
    const result = results[0].result;

    const local = Object.entries(result.local).map(([key, value]) => ({
      key,
      value,
      type: 'local' as StorageType,
    }));

    const session = Object.entries(result.session).map(([key, value]) => ({
      key,
      value,
      type: 'session' as StorageType,
    }));

    return { local, session };
  } catch (error) {
    console.error('Failed to get page storage:', error);
    return { local: [], session: [] };
  }
}

export async function getPageCookies(urlStr: string): Promise<StorageEntry[]> {
  try {
    const cookies = await chrome.cookies.getAll({ url: urlStr });
    return cookies.map((c) => ({
      key: c.name,
      value: c.value,
      type: 'cookie' as StorageType,
      domain: c.domain,
      path: c.path,
      expirationDate: c.expirationDate,
      hostOnly: c.hostOnly,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
      session: c.session,
    }));
  } catch (error) {
    console.error('Failed to get page cookies:', error);
    return [];
  }
}

export async function updatePageStorageEntry(
  tabId: number,
  type: 'local' | 'session',
  key: string,
  value: string
): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (storageType: string, k: string, v: string) => {
        const storage = storageType === 'local' ? localStorage : sessionStorage;
        storage.setItem(k, v);
      },
      args: [type, key, value],
    });
    return true;
  } catch (error) {
    console.error(`Failed to update ${type} storage entry:`, error);
    return false;
  }
}

export async function deletePageStorageEntry(
  tabId: number,
  type: 'local' | 'session',
  key: string
): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (storageType: string, k: string) => {
        const storage = storageType === 'local' ? localStorage : sessionStorage;
        storage.removeItem(k);
      },
      args: [type, key],
    });
    return true;
  } catch (error) {
    console.error(`Failed to delete ${type} storage entry:`, error);
    return false;
  }
}

export async function clearPageStorage(
  tabId: number,
  type: 'local' | 'session',
  keys?: string[]
): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (storageType: string, keysToClear?: string[]) => {
        const storage = storageType === 'local' ? localStorage : sessionStorage;
        if (keysToClear) {
          keysToClear.forEach((k) => storage.removeItem(k));
        } else {
          storage.clear();
        }
      },
      args: [type, keys || undefined],
    });
    return true;
  } catch (error) {
    console.error(`Failed to clear ${type} storage:`, error);
    return false;
  }
}

export async function updateCookieEntry(urlStr: string, entry: Omit<StorageEntry, 'type'>): Promise<boolean> {
  try {
    const url = new URL(urlStr);
    const domain = entry.domain || url.hostname;
    
    // Clean domain for local cookies to avoid setting domain mismatch
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    
    const details: chrome.cookies.SetDetails = {
      url: urlStr,
      name: entry.key,
      value: entry.value,
      path: entry.path || '/',
      secure: entry.secure ?? false,
      httpOnly: entry.httpOnly ?? false,
    };

    // Chrome cookies.set throws error if domain is specified incorrectly for localhost
    if (!isLocalhost && domain) {
      details.domain = domain;
    }

    if (entry.expirationDate !== undefined) {
      details.expirationDate = entry.expirationDate;
    }

    if (entry.sameSite) {
      details.sameSite = entry.sameSite;
    }

    await chrome.cookies.set(details);
    return true;
  } catch (error) {
    console.error('Failed to update cookie:', error);
    return false;
  }
}

export async function deleteCookieEntry(urlStr: string, key: string): Promise<boolean> {
  try {
    await chrome.cookies.remove({
      url: urlStr,
      name: key,
    });
    return true;
  } catch (error) {
    console.error('Failed to delete cookie:', error);
    return false;
  }
}
