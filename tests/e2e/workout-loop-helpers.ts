import type { Page } from '@playwright/test';

export { seedActiveProgram, PPL_SIX } from './program-rotation-helpers';

/** Reads every row of an IndexedDB store of the app's `ledger` database. */
export async function readStore<T = Record<string, unknown>>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(async (storeName) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ledger');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return rows as never[];
  }, store);
}

/**
 * Writes `reps` (and optionally `weight`) onto every live set straight into
 * IndexedDB, then reloads so the session store hydrates it. Used where a test
 * is about something other than the number pad.
 */
export async function fillAllSets(page: Page, values: { reps: number; weight?: number }) {
  await page.evaluate(async (v) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ledger');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sets', 'readwrite');
      const store = tx.objectStore('sets');
      store.openCursor().onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (!cursor) return;
        const row = cursor.value;
        if (row.deletedAt == null) {
          row.reps = v.reps;
          if (v.weight !== undefined) row.weight = v.weight;
          cursor.update(row);
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, values);
  await page.reload();
}
