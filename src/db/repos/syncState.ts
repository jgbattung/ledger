import { db } from '@/db/ledger'
import { now } from '@/db/ids'

/**
 * Outbox helpers for the future sync engine (M7). `syncState` rows carry no
 * id/timestamps/deletedAt of their own - just `[table, recordId, dirtyAt]`.
 * Both helpers touch only `db.syncState`, so they compose inside any
 * caller-provided `db.transaction('rw', ...)` scope.
 */

export function markDirty(table: string, recordId: string) {
  return db.syncState.put({ table, recordId, dirtyAt: now() })
}

export function clearDirty(table: string, recordId: string) {
  return db.syncState.delete([table, recordId])
}
