import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb } from '@/db/test-utils'
import { programDays } from '@/db/repos/programDays'

describe('programDays repo', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('listByProgram scopes to the parent, sorts by orderIndex and hides soft-deleted rows', async () => {
    const second = await programDays.create({ programId: 'p1', orderIndex: 1, name: 'B' })
    const first = await programDays.create({ programId: 'p1', orderIndex: 0, name: 'A' })
    const removed = await programDays.create({ programId: 'p1', orderIndex: 2, name: 'C' })
    await programDays.create({ programId: 'p2', orderIndex: 0, name: 'Other' })
    await programDays.softDelete(removed.id)

    const result = await programDays.listByProgram('p1')
    expect(result.map((d) => d.id)).toEqual([first.id, second.id])
  })
})
