import { db } from '@/db/ledger'

/**
 * Clears every table in the ledger database, including syncState. Intended
 * for `beforeEach` in db test suites so cases are isolated under
 * fake-indexeddb.
 */
export async function resetDb(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()))
  })
}
