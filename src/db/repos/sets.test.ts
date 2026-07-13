import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/ledger'
import { resetDb } from '@/db/test-utils'
import { sets } from '@/db/repos/sets'

describe('sets repo - kg weight persistence (§3.13)', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('persists weights as plain kg numbers with full precision', async () => {
    const created = await sets.create({
      workoutExerciseId: 'we-1',
      orderIndex: 0,
      type: 'working',
      weight: 62.5,
      reps: 8,
      rir: 0,
      rirIsPlus: false,
    })

    const stored = await db.sets.get(created.id)
    // Stored value is the exact kg number handed in - no rounding, no
    // unit conversion at the data-layer boundary.
    expect(stored?.weight).toBe(62.5)
  })

  it('does not round-trip through a display unit - awkward float survives exactly', async () => {
    const created = await sets.create({
      workoutExerciseId: 'we-1',
      orderIndex: 1,
      type: 'working',
      weight: 100.12345,
      reps: 5,
      rir: 1,
      rirIsPlus: true,
    })

    const fetched = await sets.get(created.id)
    expect(fetched?.weight).toBe(100.12345)
  })

  it('stores unilateral left/right weights as raw kg numbers', async () => {
    const created = await sets.create({
      workoutExerciseId: 'we-1',
      orderIndex: 2,
      type: 'working',
      weight: 0,
      reps: 0,
      rir: 0,
      rirIsPlus: false,
      unilateral: { leftWeight: 22.5, leftReps: 10, rightWeight: 20.25, rightReps: 10 },
    })

    const fetched = await sets.get(created.id)
    expect(fetched?.unilateral).toEqual({
      leftWeight: 22.5,
      leftReps: 10,
      rightWeight: 20.25,
      rightReps: 10,
    })
  })
})
