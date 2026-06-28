export type StorageType = 'local' | 'session' | 'cookie';

export interface StorageEntry {
  key: string;
  value: string;
  type: StorageType;
  // Cookie specific fields
  domain?: string;
  path?: string;
  expirationDate?: number;
  hostOnly?: boolean;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'no_restriction' | 'lax' | 'strict' | 'unspecified';
  session?: boolean;
}

export interface StorageSnapshot {
  id: string;
  name: string;
  timestamp: number;
  origin: string;
  data: {
    local: { [key: string]: string };
    session: { [key: string]: string };
    cookies: Omit<StorageEntry, 'type'>[];
  };
}

export interface DiffResult {
  key: string;
  type: StorageType;
  valA?: string;
  valB?: string;
  status: 'onlyA' | 'onlyB' | 'different' | 'identical';
}
