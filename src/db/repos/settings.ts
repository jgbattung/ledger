import { db } from '@/db/ledger'
import { now } from '@/db/ids'
import { markDirty } from '@/db/repos/syncState'
import type { Settings } from '@/db/types'

const SETTINGS_ID = 'settings'

const DEFAULT_SETTINGS: Omit<Settings, 'createdAt' | 'updatedAt' | 'deletedAt'> = {
  id: SETTINGS_ID,
  defaultRir: 0,
  defaultRestSeconds: 180,
  defaultWarmupSetCount: 2,
  unit: 'kg',
  theme: 'system',
  weekStartsOn: 'mon',
  dashboardWidgets: [],
  backup: {},
  sync: {
    autoSyncEnabled: false,
    lastPulledAt: {},
  },
}

/**
 * `settings` is a single row keyed by the literal id 'settings'. It is
 * never soft-deleted, so it does not use the shared createRepo factory.
 */
export const settings = {
  async get(): Promise<Settings | undefined> {
    return db.settings.get(SETTINGS_ID)
  },

  async getOrInit(): Promise<Settings> {
    const existing = await db.settings.get(SETTINGS_ID)
    if (existing) return existing

    const timestamp = now()
    const record: Settings = {
      ...DEFAULT_SETTINGS,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    }

    await db.transaction('rw', db.settings, db.syncState, async () => {
      await db.settings.put(record)
      await markDirty('settings', SETTINGS_ID)
    })

    return record
  },

  async update(patch: Partial<Omit<Settings, 'id' | 'createdAt'>>): Promise<void> {
    const { id: _id, createdAt: _createdAt, ...safePatch } = patch as Partial<Settings>

    await db.transaction('rw', db.settings, db.syncState, async () => {
      await db.settings.update(SETTINGS_ID, { ...safePatch, updatedAt: now() })
      await markDirty('settings', SETTINGS_ID)
    })
  },
}
