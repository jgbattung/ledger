import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb } from '@/db/test-utils'
import { programExercises } from '@/db/repos/programExercises'

const exerciseRef = { source: 'db' as const, exerciseId: 'x' }

describe('programExercises repo', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('listByDay scopes to the parent, sorts by orderIndex and hides soft-deleted rows', async () => {
    const second = await programExercises.create({ programDayId: 'd1', orderIndex: 1, exerciseRef })
    const first = await programExercises.create({ programDayId: 'd1', orderIndex: 0, exerciseRef })
    const removed = await programExercises.create({ programDayId: 'd1', orderIndex: 2, exerciseRef })
    await programExercises.create({ programDayId: 'd2', orderIndex: 0, exerciseRef })
    await programExercises.softDelete(removed.id)

    const result = await programExercises.listByDay('d1')
    expect(result.map((e) => e.id)).toEqual([first.id, second.id])
  })
})
