import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/ledger'
import { resetDb } from '@/db/test-utils'
import { sets } from '@/db/repos/sets'
import { workouts } from '@/db/repos/workouts'
import { seedProgram } from '@/workouts/test-fixtures'

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

describe('sets repo - logging operations', () => {
  beforeEach(async () => {
    await resetDb()
  })

  async function seed(count: number) {
    const rows = []
    for (let index = 0; index < count; index += 1) {
      rows.push(
        await sets.create({
          workoutExerciseId: 'we-1',
          orderIndex: index,
          type: 'working',
          weight: 0,
          reps: 0,
          rir: 0,
          rirIsPlus: false,
        }),
      )
    }
    return rows
  }

  it('add uses last orderIndex + 1, never the row count', async () => {
    const [, second] = await seed(3)
    const fourth = await sets.add('we-1')
    expect(fourth.orderIndex).toBe(3)
    await sets.softDelete(second.id)
    const fifth = await sets.add('we-1')
    expect(fifth.orderIndex).toBe(4)
    expect((await sets.listByWorkoutExercise('we-1')).map((s) => s.orderIndex)).toEqual([0, 2, 3, 4])
  })

  it('add starts at 0 for an exercise with no sets and copies weight and RIR', async () => {
    expect((await sets.add('empty')).orderIndex).toBe(0)
    const [first] = await seed(1)
    await sets.patch(first.id, { weight: 62.5, reps: 8, partialReps: 2, rir: 6, rirIsPlus: true })
    const added = await sets.add('we-1')
    expect(added).toMatchObject({ weight: 62.5, reps: 0, rir: 6, rirIsPlus: true, type: 'working' })
    expect(added.partialReps).toBeUndefined()
    expect(added.completedAt).toBeUndefined()
  })

  it('patch writes only the given logged fields and round-trips 6+', async () => {
    const [first] = await seed(1)
    await sets.patch(first.id, { reps: 9, rir: 6, rirIsPlus: true })
    const stored = await sets.get(first.id)
    expect(stored).toMatchObject({ reps: 9, weight: 0, rir: 6, rirIsPlus: true })
    await sets.patch(first.id, { partialReps: undefined })
    expect((await sets.get(first.id))?.partialReps).toBeUndefined()
  })

  it('setCompleted needs reps, stamps and clears completedAt', async () => {
    const [first] = await seed(1)
    await expect(sets.setCompleted(first.id, true)).rejects.toThrow('at least 1 rep')
    await sets.patch(first.id, { reps: 5 })
    await sets.setCompleted(first.id, true)
    expect((await sets.get(first.id))?.completedAt).toBeTypeOf('number')
    await sets.setCompleted(first.id, false)
    expect((await sets.get(first.id))?.completedAt).toBeUndefined()
  })
})

describe('sets.add - pre-fill from last session', () => {
  beforeEach(async () => {
    await resetDb()
  })

  /** Finishes a bench session of 100x8 and 90x6, then starts a new one trimmed to `rows` live rows. */
  async function startWithHistory(rows: number) {
    const { programId, pushId } = await seedProgram()
    const first = await workouts.startFromProgramDay(programId, pushId)
    const logged = (await workouts.loadSession(first))!.exercises[0].sets
    await sets.patch(logged[0].id, { weight: 100, reps: 8 })
    await sets.setCompleted(logged[0].id, true)
    await sets.patch(logged[1].id, { weight: 90, reps: 6 })
    await sets.setCompleted(logged[1].id, true)
    await workouts.finish(first)

    const second = await workouts.startFromProgramDay(programId, pushId)
    const bench = (await workouts.loadSession(second))!.exercises[0]
    for (const set of bench.sets.slice(rows)) await sets.softDelete(set.id)
    return bench.exercise.id
  }

  it('maps the new row to the same row of last session', async () => {
    const exerciseId = await startWithHistory(1)
    expect(await sets.add(exerciseId)).toMatchObject({ weight: 90, reps: 6, rir: 0, rirIsPlus: false })
  })

  it('past last session keeps the weight above and blank reps', async () => {
    const exerciseId = await startWithHistory(2)
    const [, second] = await sets.listByWorkoutExercise(exerciseId)
    await sets.patch(second.id, { weight: 95 })
    const added = await sets.add(exerciseId)
    expect(added).toMatchObject({ weight: 95, reps: 0 })
  })

  it('keeps the existing behaviour with no history', async () => {
    const { programId, pushId } = await seedProgram()
    const id = await workouts.startFromProgramDay(programId, pushId)
    const bench = (await workouts.loadSession(id))!.exercises[0]
    await sets.patch(bench.sets[2].id, { weight: 50 })
    expect(await sets.add(bench.exercise.id)).toMatchObject({ weight: 50, reps: 0 })
  })
})
