import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/ledger'
import { resetDb } from '@/db/test-utils'
import { sets } from '@/db/repos/sets'
import { workouts } from '@/db/repos/workouts'
import { seedProgram, setAllUnilateral } from '@/workouts/test-fixtures'

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

  it('takes weight and reps from history but RIR from the row above', async () => {
    const exerciseId = await startWithHistory(1)
    const [first] = await sets.listByWorkoutExercise(exerciseId)
    await sets.patch(first.id, { rir: 2, rirIsPlus: true, partialReps: 3 })
    const added = await sets.add(exerciseId)
    expect(added).toMatchObject({ weight: 90, reps: 6, rir: 2, rirIsPlus: true })
    expect(added.partialReps).toBeUndefined()
  })

  it('never maps to the in-progress workout itself', async () => {
    const { programId, pushId } = await seedProgram()
    const id = await workouts.startFromProgramDay(programId, pushId)
    const bench = (await workouts.loadSession(id))!.exercises[0]
    await sets.patch(bench.sets[0].id, { weight: 120, reps: 3 })
    await sets.setCompleted(bench.sets[0].id, true)
    for (const set of bench.sets.slice(1)) await sets.softDelete(set.id)
    expect(await sets.add(bench.exercise.id)).toMatchObject({ weight: 120, reps: 0 })
  })

  it('appends with a blank row when every row was removed and there is no history', async () => {
    const { programId, pushId } = await seedProgram()
    const id = await workouts.startFromProgramDay(programId, pushId)
    const bench = (await workouts.loadSession(id))!.exercises[0]
    for (const set of bench.sets) await sets.softDelete(set.id)
    expect(await sets.add(bench.exercise.id)).toMatchObject({ weight: 0, reps: 0, rir: 0, rirIsPlus: false })
  })

  it('maps to set 1 of last session when every row was removed', async () => {
    const exerciseId = await startWithHistory(0)
    expect(await sets.add(exerciseId)).toMatchObject({ weight: 100, reps: 8, rir: 0, rirIsPlus: false })
  })
})

const LR = { leftWeight: 20, leftReps: 12, rightWeight: 22, rightReps: 10 }

describe('sets repo - L/R sets (LG-012)', () => {
  beforeEach(async () => {
    await resetDb()
  })

  async function seedSet(fields: Partial<Parameters<typeof sets.create>[0]> = {}, index = 0) {
    return sets.create({
      workoutExerciseId: 'we-1',
      orderIndex: index,
      type: 'working',
      weight: 0,
      reps: 0,
      rir: 0,
      rirIsPlus: false,
      ...fields,
    })
  }

  it('patch persists both sides and replaces the whole unilateral object', async () => {
    const set = await seedSet()
    await sets.patch(set.id, { unilateral: { ...LR, leftPartialReps: 2 }, weight: 22, reps: 10 })
    expect((await sets.get(set.id))?.unilateral).toEqual({ ...LR, leftPartialReps: 2 })
    await sets.patch(set.id, { unilateral: LR })
    expect((await sets.get(set.id))?.unilateral).toEqual(LR)
  })

  it('setCompleted rejects an L/R set with one side at 0 reps', async () => {
    const set = await seedSet({ reps: 10, unilateral: { ...LR, rightReps: 0 } })
    await expect(sets.setCompleted(set.id, true)).rejects.toThrow('at least 1 rep')
    await sets.patch(set.id, { unilateral: LR })
    await sets.setCompleted(set.id, true)
    expect((await sets.get(set.id))?.completedAt).toBeTypeOf('number')
  })

  it('patchMany writes every entry and marks each row dirty', async () => {
    const a = await seedSet({ weight: 20, reps: 10 }, 0)
    const b = await seedSet({ weight: 25, reps: 8 }, 1)
    await db.syncState.clear()
    await sets.patchMany([
      [a.id, { weight: 21, reps: 11 }],
      [b.id, { reps: 9 }],
    ])
    expect(await sets.get(a.id)).toMatchObject({ weight: 21, reps: 11 })
    expect(await sets.get(b.id)).toMatchObject({ weight: 25, reps: 9 })
    const dirty = JSON.stringify(await db.syncState.toArray())
    expect(dirty).toContain(a.id)
    expect(dirty).toContain(b.id)
  })

  it('patch and patchMany delete a field passed as undefined instead of storing the key', async () => {
    const a = await seedSet({ weight: 22, reps: 10, partialReps: 2, unilateral: LR })
    const b = await seedSet({ weight: 22, reps: 10, partialReps: 2, unilateral: LR }, 1)
    await sets.patch(a.id, { partialReps: undefined, unilateral: undefined })
    await sets.patchMany([[b.id, { partialReps: undefined, unilateral: undefined, reps: 12 }]])
    for (const id of [a.id, b.id]) {
      const stored = await db.sets.get(id)
      expect('partialReps' in stored!).toBe(false)
      expect('unilateral' in stored!).toBe(false)
    }
    expect((await db.sets.get(b.id))?.reps).toBe(12)
  })

  it('patchMany with no entries writes nothing', async () => {
    await seedSet({ weight: 22, reps: 10 })
    await db.syncState.clear()
    await sets.patchMany([])
    expect(await db.syncState.count()).toBe(0)
  })

  it('setAllUnilateral round-trips through the repo (setup helper)', async () => {
    await seedSet({ weight: 20, reps: 10, partialReps: 2 }, 0)
    await setAllUnilateral('we-1', true)
    const [on] = await sets.listByWorkoutExercise('we-1')
    expect(on.unilateral).toMatchObject({ leftWeight: 20, rightReps: 10, leftPartialReps: 2 })
    expect('partialReps' in (await db.sets.get(on.id))!).toBe(false)
    await setAllUnilateral('we-1', false)
    expect(await sets.get(on.id)).toMatchObject({ weight: 20, reps: 10, partialReps: 2 })
  })

  it('add copies the L/R mode from the last row with its side weights and blank reps', async () => {
    await seedSet({ weight: 22, reps: 10, rir: 2, unilateral: LR })
    const added = await sets.add('we-1')
    expect(added.unilateral).toEqual({ leftWeight: 20, leftReps: 0, rightWeight: 22, rightReps: 0 })
    expect(added).toMatchObject({ weight: 22, reps: 0, rir: 2 })
  })

  it('add stays normal after a normal row', async () => {
    await seedSet({ weight: 20, reps: 10 })
    expect((await sets.add('we-1')).unilateral).toBeUndefined()
  })

  it('add takes the same-row sides of last session when it was L/R', async () => {
    const { programId, pushId } = await seedProgram()
    const first = await workouts.startFromProgramDay(programId, pushId)
    const bench = (await workouts.loadSession(first))!.exercises[0]
    await setAllUnilateral(bench.exercise.id, true)
    const [a, b] = await sets.listByWorkoutExercise(bench.exercise.id)
    await sets.patch(a.id, { unilateral: LR, weight: 22, reps: 10 })
    await sets.patch(b.id, {
      unilateral: { leftWeight: 18, leftReps: 9, rightWeight: 18, rightReps: 8 },
      weight: 18,
      reps: 8,
    })
    await sets.setCompleted(a.id, true)
    await sets.setCompleted(b.id, true)
    await workouts.finish(first)

    const second = await workouts.startFromProgramDay(programId, pushId)
    const live = (await workouts.loadSession(second))!.exercises[0]
    expect(live.sets[1].unilateral).toEqual({
      leftWeight: 18,
      leftReps: 9,
      rightWeight: 18,
      rightReps: 8,
    })
    // Remove every live row: mode and sides come from the same (first) row of last session.
    for (const set of live.sets) await sets.softDelete(set.id)
    const added = await sets.add(live.exercise.id)
    expect(added.unilateral).toEqual(LR)
    expect(added).toMatchObject({ weight: 22, reps: 10 })
  })

  it('add never carries last session partials and switches sides by the current mode', async () => {
    const { programId, pushId } = await seedProgram()
    const first = await workouts.startFromProgramDay(programId, pushId)
    const bench = (await workouts.loadSession(first))!.exercises[0]
    const [a, b] = await sets.listByWorkoutExercise(bench.exercise.id)
    // Last session: row 1 L/R with partials, row 2 normal.
    await sets.patch(a.id, {
      unilateral: { ...LR, leftPartialReps: 2, rightPartialReps: 1 },
      weight: 22,
      reps: 10,
    })
    await sets.patch(b.id, { weight: 30, reps: 6 })
    await sets.setCompleted(a.id, true)
    await sets.setCompleted(b.id, true)
    await workouts.finish(first)

    const second = await workouts.startFromProgramDay(programId, pushId)
    const live = (await workouts.loadSession(second))!.exercises[0]
    for (const set of live.sets) await sets.softDelete(set.id)

    // Row 1: same row was L/R, sides carried without partials.
    const one = await sets.add(live.exercise.id)
    expect(one.unilateral).toEqual(LR)
    expect(one.partialReps).toBeUndefined()

    // Row 2: L/R because the last live row is, but the same row was normal, so the
    // sides take the last row's side weights with blank reps.
    const two = await sets.add(live.exercise.id)
    expect(two.unilateral).toEqual({ leftWeight: 20, leftReps: 0, rightWeight: 22, rightReps: 0 })
    expect(two).toMatchObject({ weight: 22, reps: 0 })
  })

  it('add in normal mode after an L/R last session takes the same-row aggregate', async () => {
    const { programId, pushId } = await seedProgram()
    const first = await workouts.startFromProgramDay(programId, pushId)
    const bench = (await workouts.loadSession(first))!.exercises[0]
    await setAllUnilateral(bench.exercise.id, true)
    const [a, b] = await sets.listByWorkoutExercise(bench.exercise.id)
    await sets.patch(a.id, { unilateral: LR, weight: 22, reps: 10 })
    await sets.patch(b.id, { unilateral: LR, weight: 22, reps: 10 })
    await sets.setCompleted(a.id, true)
    await sets.setCompleted(b.id, true)
    await workouts.finish(first)

    const second = await workouts.startFromProgramDay(programId, pushId)
    const live = (await workouts.loadSession(second))!.exercises[0]
    await setAllUnilateral(live.exercise.id, false)
    // Keep only row 1, so the added row is row 2 of last session.
    for (const set of live.sets.slice(1)) await sets.softDelete(set.id)
    const added = await sets.add(live.exercise.id)
    expect(added.unilateral).toBeUndefined()
    expect(added).toMatchObject({ weight: 22, reps: 10 })
  })
})
