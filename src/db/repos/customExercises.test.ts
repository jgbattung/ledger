import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb } from '@/db/test-utils'
import { customExercises } from '@/db/repos/customExercises'

describe('customExercises repo', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('listAll returns a soft-deleted row while list does not', async () => {
    const live = await customExercises.create({
      name: 'SSB Squat',
      primaryMuscles: ['quads'],
      secondaryMuscles: ['glutes'],
      equipmentTag: 'barbell',
      mechanic: 'compound',
    })
    const gone = await customExercises.create({
      name: 'Old Move',
      primaryMuscles: ['chest'],
      secondaryMuscles: [],
    })
    await customExercises.softDelete(gone.id)

    expect((await customExercises.list()).map((r) => r.id)).toEqual([live.id])

    const all = await customExercises.listAll()
    expect(all.map((r) => r.id).sort()).toEqual([live.id, gone.id].sort())
    expect(all.find((r) => r.id === gone.id)?.deletedAt).not.toBeNull()
  })
})
