import { db } from '@/db/ledger'
import { now } from '@/db/ids'
import { createRepo } from '@/db/repos/base'
import { markDirty } from '@/db/repos/syncState'
import type { Program } from '@/db/types'

const baseRepo = createRepo<Program>(db.programs, 'programs')

/**
 * Adds the single-active-program rule on top of the base repo: at most one
 * program may have `isActive === true`.
 */
export const programs = {
  ...baseRepo,

  async setActive(id: string): Promise<void> {
    await db.transaction('rw', db.programs, db.syncState, async () => {
      const currentlyActive = await db.programs.where({ isActive: true }).toArray()
      const timestamp = now()

      for (const program of currentlyActive) {
        if (program.id === id) continue
        await db.programs.update(program.id, { isActive: false, updatedAt: timestamp })
        await markDirty('programs', program.id)
      }

      await db.programs.update(id, { isActive: true, updatedAt: timestamp })
      await markDirty('programs', id)
    })
  },
}
