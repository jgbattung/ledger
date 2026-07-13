import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/ledger'
import { resetDb } from '@/db/test-utils'
import { programs } from '@/db/repos/programs'

describe('programs repo', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('setActive enforces at most one active program', async () => {
    const programA = await programs.create({
      name: 'Program A',
      isActive: true,
      isArchived: false,
      currentDayIndex: 0,
      currentCycleIndex: 0,
    })
    const programB = await programs.create({
      name: 'Program B',
      isActive: false,
      isArchived: false,
      currentDayIndex: 0,
      currentCycleIndex: 0,
    })

    await db.syncState.clear()
    await programs.setActive(programB.id)

    const refreshedA = await programs.get(programA.id)
    const refreshedB = await programs.get(programB.id)
    expect(refreshedA?.isActive).toBe(false)
    expect(refreshedB?.isActive).toBe(true)

    const dirtyA = await db.syncState.get(['programs', programA.id])
    const dirtyB = await db.syncState.get(['programs', programB.id])
    expect(dirtyA).toBeDefined()
    expect(dirtyB).toBeDefined()
  })
})
