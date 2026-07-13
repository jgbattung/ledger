import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/ledger'
import { resetDb } from '@/db/test-utils'
import { markDirty, clearDirty } from '@/db/repos/syncState'

describe('syncState outbox helpers', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('markDirty writes exactly the outbox shape - table, recordId, dirtyAt only', async () => {
    await markDirty('workouts', 'w-1')

    const row = await db.syncState.get(['workouts', 'w-1'])
    expect(row).toBeDefined()
    expect(row?.table).toBe('workouts')
    expect(row?.recordId).toBe('w-1')
    expect(typeof row?.dirtyAt).toBe('number')
    // No BaseRecord fields leak into the local-only outbox.
    expect(Object.keys(row ?? {}).sort()).toEqual(['dirtyAt', 'recordId', 'table'])
  })

  it('markDirty upserts - repeated marks for one record keep a single row', async () => {
    await markDirty('sets', 's-1')
    const first = await db.syncState.get(['sets', 's-1'])

    await new Promise((resolve) => setTimeout(resolve, 5))
    await markDirty('sets', 's-1')

    const all = await db.syncState.where('table').equals('sets').toArray()
    expect(all).toHaveLength(1)
    expect(all[0]?.dirtyAt).toBeGreaterThan(first?.dirtyAt ?? 0)
  })

  it('keys dirty rows per [table+recordId] so same id in different tables coexist', async () => {
    await markDirty('sets', 'shared-id')
    await markDirty('workouts', 'shared-id')

    expect(await db.syncState.count()).toBe(2)
  })

  it('clearDirty removes the outbox row for a record', async () => {
    await markDirty('photos', 'p-1')
    await clearDirty('photos', 'p-1')

    expect(await db.syncState.get(['photos', 'p-1'])).toBeUndefined()
  })
})
