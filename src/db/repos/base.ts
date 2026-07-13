import type { Table, UpdateSpec } from 'dexie'
import { db } from '@/db/ledger'
import { newId, now } from '@/db/ids'
import { markDirty } from '@/db/repos/syncState'
import type { BaseRecord } from '@/db/types'

/**
 * Shared record conventions encoded once and reused by every table: client
 * UUID id, createdAt/updatedAt stamping, soft delete via deletedAt, and
 * dirty-marking into the syncState outbox. Every write shares one Dexie
 * `rw` transaction with `db.syncState` so the outbox mark is atomic with
 * the record write.
 */
export function createRepo<T extends BaseRecord>(table: Table<T, string>, tableName: string) {
  return {
    async create(data: Omit<T, keyof BaseRecord>): Promise<T> {
      const timestamp = now()
      const record = {
        ...data,
        id: newId(),
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      } as unknown as T

      await db.transaction('rw', table, db.syncState, async () => {
        await table.put(record)
        await markDirty(tableName, record.id)
      })

      return record
    },

    async update(id: string, patch: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<void> {
      const { id: _id, createdAt: _createdAt, ...safePatch } = patch as Partial<T>

      await db.transaction('rw', table, db.syncState, async () => {
        await table.update(id, { ...safePatch, updatedAt: now() } as UpdateSpec<T>)
        await markDirty(tableName, id)
      })
    },

    async softDelete(id: string): Promise<void> {
      await db.transaction('rw', table, db.syncState, async () => {
        await table.update(id, { deletedAt: now(), updatedAt: now() } as unknown as UpdateSpec<T>)
        await markDirty(tableName, id)
      })
    },

    async get(id: string): Promise<T | undefined> {
      const record = await table.get(id)
      return record && record.deletedAt == null ? record : undefined
    },

    async list(): Promise<T[]> {
      return table.filter((record) => record.deletedAt == null).toArray()
    },
  }
}
