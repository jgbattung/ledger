import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/ledger'
import { resetDb } from '@/db/test-utils'
import { settings } from '@/db/repos/settings'

describe('settings repo', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('getOrInit seeds the documented defaults', async () => {
    const seeded = await settings.getOrInit()

    expect(seeded.id).toBe('settings')
    expect(seeded.defaultRir).toBe(0)
    expect(seeded.defaultRestSeconds).toBe(180)
    expect(seeded.defaultWarmupSetCount).toBe(2)
    expect(seeded.unit).toBe('kg')
    expect(seeded.theme).toBe('system')
    expect(seeded.weekStartsOn).toBe('mon')
    expect(seeded.dashboardWidgets).toEqual([])
    expect(seeded.sync).toEqual({ autoSyncEnabled: false, lastPulledAt: {} })
  })

  it('getOrInit is idempotent', async () => {
    const first = await settings.getOrInit()
    const second = await settings.getOrInit()

    expect(second).toEqual(first)
    const rows = await db.settings.toArray()
    expect(rows).toHaveLength(1)
  })

  it('update persists changes and marks dirty', async () => {
    await settings.getOrInit()
    await db.syncState.clear()

    await settings.update({ defaultRir: 2 })

    const updated = await settings.get()
    expect(updated?.defaultRir).toBe(2)

    const dirty = await db.syncState.get(['settings', 'settings'])
    expect(dirty).toBeDefined()
  })
})
