import { StorageEntry, DiffResult } from '../types/storage';

export function calculateDiff(listA: StorageEntry[], listB: StorageEntry[]): DiffResult[] {
  const mapA = new Map<string, StorageEntry>();
  const mapB = new Map<string, StorageEntry>();

  listA.forEach((item) => mapA.set(`${item.type}:${item.key}`, item));
  listB.forEach((item) => mapB.set(`${item.type}:${item.key}`, item));

  const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
  const results: DiffResult[] = [];

  allKeys.forEach((compositeKey) => {
    const entryA = mapA.get(compositeKey);
    const entryB = mapB.get(compositeKey);

    const [type, key] = compositeKey.split(':');

    if (entryA && !entryB) {
      results.push({
        key,
        type: entryA.type,
        valA: entryA.value,
        status: 'onlyA',
      });
    } else if (!entryA && entryB) {
      results.push({
        key,
        type: entryB.type,
        valB: entryB.value,
        status: 'onlyB',
      });
    } else if (entryA && entryB) {
      if (entryA.value === entryB.value) {
        results.push({
          key,
          type: entryA.type,
          valA: entryA.value,
          valB: entryB.value,
          status: 'identical',
        });
      } else {
        results.push({
          key,
          type: entryA.type,
          valA: entryA.value,
          valB: entryB.value,
          status: 'different',
        });
      }
    }
  });

  return results.sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.key.localeCompare(b.key);
  });
}
