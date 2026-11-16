import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/ledger'
import { resetDb } from '@/db/test-utils'
import { programs } from '@/db/repos/programs'
import { workouts } from '@/db/repos/workouts'
import { LastExerciseError, workoutExercises } from '@/db/repos/workoutExercises'
import { sets } from '@/db/repos/sets'
import { exercise, seedProgram, setAllUnilateral } from '@/workouts/test-fixtures'

const ref = (exerciseId: string) => ({ source: 'db' as const, exerciseId })

async function startPush() {
  const { programId, pushId } = await seedProgram()
  const id = await workouts.startFromProgramDay(programId, pushId)
  const session = await workouts.loadSession(id)
  return { programId, pushId, id, bench: session!.exercises[0] }
}

describe('workoutExercises.swap', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('keep swaps the ref and keeps the snapshot and set rows', async () => {
    const { id, bench } = await startPush()
    await workoutExercises.swap(bench.exercise.id, ref('db-press'), 'keep')
    const after = (await workouts.loadSession(id))!.exercises[0]
    expect(after.exercise.exerciseRef).toEqual(ref('db-press'))
    expect(after.exercise.swappedFrom).toEqual(ref('bench'))
    expect(after.exercise.targetsSnapshot).toEqual(bench.exercise.targetsSnapshot)
    expect(after.sets.map((s) => s.id)).toEqual(bench.sets.map((s) => s.id))
  })

  it('reset clears the snapshot and blanks the set values', async () => {
    const { id, bench } = await startPush()
    await sets.patch(bench.sets[0].id, { weight: 80, reps: 6, partialReps: 2, rir: 3 })
    await workoutExercises.swap(bench.exercise.id, ref('db-press'), 'reset')
    const after = (await workouts.loadSession(id))!.exercises[0]
    expect(after.exercise.targetsSnapshot).toBeUndefined()
    expect(after.exercise.swappedFrom).toEqual(ref('bench'))
    expect(after.sets).toHaveLength(3)
    for (const set of after.sets) {
      expect(set).toMatchObject({ weight: 0, reps: 0, rir: 0, rirIsPlus: false })
      expect(set.partialReps).toBeUndefined()
    }
  })

  describe('reset pre-fill from the new exercise', () => {
    /** One finished session where db-press was logged 100x8 and 90x6, then a fresh bench session. */
    async function startWithPressHistory() {
      const { programId, pushId } = await seedProgram([exercise('bench'), exercise('db-press')])
      const first = await workouts.startFromProgramDay(programId, pushId)
      const press = (await workouts.loadSession(first))!.exercises[1].sets
      await sets.patch(press[0].id, { weight: 100, reps: 8 })
      await sets.setCompleted(press[0].id, true)
      await sets.patch(press[1].id, { weight: 90, reps: 6 })
      await sets.setCompleted(press[1].id, true)
      await workouts.finish(first)

      const id = await workouts.startFromProgramDay(programId, pushId)
      return { id, bench: (await workouts.loadSession(id))!.exercises[0] }
    }

    it('pre-fills row by row from the last session of the new exercise', async () => {
      const { id, bench } = await startWithPressHistory()
      await sets.patch(bench.sets[0].id, { weight: 80, reps: 5, partialReps: 2, rir: 3 })
      await workoutExercises.swap(bench.exercise.id, ref('db-press'), 'reset')
      const after = (await workouts.loadSession(id))!.exercises[0]
      expect(after.sets.map((s) => [s.weight, s.reps, s.rir, s.rirIsPlus])).toEqual([
        [100, 8, 0, false],
        [90, 6, 0, false],
        [90, 6, 0, false],
      ])
      for (const set of after.sets) expect(set.partialReps).toBeUndefined()
    })

    it('stays blank when the new exercise has no history', async () => {
      const { id, bench } = await startWithPressHistory()
      await workoutExercises.swap(bench.exercise.id, ref('never-done'), 'reset')
      const after = (await workouts.loadSession(id))!.exercises[0]
      for (const set of after.sets) expect(set).toMatchObject({ weight: 0, reps: 0, rir: 0 })
    })

    it('keep mode leaves the values as they were', async () => {
      const { id, bench } = await startWithPressHistory()
      await sets.patch(bench.sets[0].id, { weight: 80, reps: 5 })
      await workoutExercises.swap(bench.exercise.id, ref('db-press'), 'keep')
      const after = (await workouts.loadSession(id))!.exercises[0]
      expect(after.sets.map((s) => [s.weight, s.reps])).toEqual([
        [80, 5],
        [0, 0],
        [0, 0],
      ])
    })

    it('maps by position among live rows after a removal', async () => {
      const { id, bench } = await startWithPressHistory()
      await sets.softDelete(bench.sets[0].id)
      await workoutExercises.swap(bench.exercise.id, ref('db-press'), 'reset')
      const after = (await workouts.loadSession(id))!.exercises[0]
      expect(after.sets.map((s) => [s.weight, s.reps])).toEqual([
        [100, 8],
        [90, 6],
      ])
    })

    it("uses the new exercise's history, not the old one's or the current workout's", async () => {
      const { programId, pushId } = await seedProgram([exercise('bench'), exercise('db-press')])
      const first = await workouts.startFromProgramDay(programId, pushId)
      const [oldBench, oldPress] = (await workouts.loadSession(first))!.exercises
      await sets.patch(oldBench.sets[0].id, { weight: 60, reps: 12 })
      await sets.setCompleted(oldBench.sets[0].id, true)
      await sets.patch(oldPress.sets[0].id, { weight: 30, reps: 10 })
      await sets.setCompleted(oldPress.sets[0].id, true)
      await workouts.finish(first)

      const id = await workouts.startFromProgramDay(programId, pushId)
      const [bench, press] = (await workouts.loadSession(id))!.exercises
      await sets.patch(press.sets[0].id, { weight: 45, reps: 4 })
      await sets.setCompleted(press.sets[0].id, true)

      await workoutExercises.swap(bench.exercise.id, ref('db-press'), 'reset')
      const after = (await workouts.loadSession(id))!.exercises[0]
      for (const set of after.sets) expect(set).toMatchObject({ weight: 30, reps: 10 })
    })
  })

  it('repeated swaps keep the first original in swappedFrom', async () => {
    const { id, bench } = await startPush()
    await workoutExercises.swap(bench.exercise.id, ref('a'), 'keep')
    await workoutExercises.swap(bench.exercise.id, ref('b'), 'keep')
    const after = (await workouts.loadSession(id))!.exercises[0]
    expect(after.exercise.exerciseRef).toEqual(ref('b'))
    expect(after.exercise.swappedFrom).toEqual(ref('bench'))
  })

  it('is blocked once a set is checked', async () => {
    const { bench } = await startPush()
    await sets.patch(bench.sets[0].id, { reps: 8 })
    await sets.setCompleted(bench.sets[0].id, true)
    await expect(workoutExercises.swap(bench.exercise.id, ref('a'), 'keep')).rejects.toThrow(
      'checked sets',
    )
  })

  it('LOG-10 accept: bench to DB press keeping targets records swappedFrom after finish', async () => {
    const { id, bench, programId, pushId } = await startPush()
    await workoutExercises.swap(bench.exercise.id, ref('db-press'), 'keep')
    const swapped = (await workouts.loadSession(id))!.exercises[0]
    expect(swapped.exercise.targetsSnapshot).toMatchObject({ repMin: 8, repMax: 10 })
    await sets.patch(swapped.sets[0].id, { weight: 30, reps: 9 })
    await sets.setCompleted(swapped.sets[0].id, true)
    await workouts.finish(id)

    const finished = (await workouts.loadSession(id))!.exercises[0]
    expect(finished.exercise.exerciseRef).toEqual(ref('db-press'))
    expect(finished.exercise.swappedFrom).toEqual(ref('bench'))
    expect((await programs.get(programId))?.completedDayIds).toContain(pushId)
  })

  it('listByWorkout returns live exercises in order', async () => {
    const { id } = await startPush()
    const list = await workoutExercises.listByWorkout(id)
    expect(list.map((e) => e.orderIndex)).toEqual([0, 1])
  })
})

describe('workoutExercises.swap - L/R sets (LG-012)', () => {
  beforeEach(async () => {
    await resetDb()
  })

  const LR = { leftWeight: 20, leftReps: 12, rightWeight: 22, rightReps: 10 }

  it('keep preserves L/R; reset clears it when the new exercise has no L/R history', async () => {
    const { id, bench } = await startPush()
    await setAllUnilateral(bench.exercise.id, true)
    await workoutExercises.swap(bench.exercise.id, ref('db-press'), 'keep')
    let after = (await workouts.loadSession(id))!.exercises[0]
    for (const set of after.sets) expect(set.unilateral).toBeDefined()

    await workoutExercises.swap(bench.exercise.id, ref('never-done'), 'reset')
    after = (await workouts.loadSession(id))!.exercises[0]
    for (const set of after.sets) {
      expect(set.unilateral).toBeUndefined()
      expect(set).toMatchObject({ weight: 0, reps: 0 })
    }
  })

  it('reset re-fills as L/R when the new exercise was last logged that way', async () => {
    const { programId, pushId } = await seedProgram([exercise('bench'), exercise('db-press')])
    const first = await workouts.startFromProgramDay(programId, pushId)
    const press = (await workouts.loadSession(first))!.exercises[1]
    await setAllUnilateral(press.exercise.id, true)
    const [row] = await sets.listByWorkoutExercise(press.exercise.id)
    await sets.patch(row.id, { unilateral: LR, weight: 22, reps: 10 })
    await sets.setCompleted(row.id, true)
    await workouts.finish(first)

    const id = await workouts.startFromProgramDay(programId, pushId)
    const bench = (await workouts.loadSession(id))!.exercises[0]
    await workoutExercises.swap(bench.exercise.id, ref('db-press'), 'reset')
    const after = (await workouts.loadSession(id))!.exercises[0]
    expect(after.sets[0]).toMatchObject({ weight: 22, reps: 10, unilateral: LR })
    expect(after.sets[0].partialReps).toBeUndefined()
  })
})

describe('workoutExercises.insert (LG-013)', () => {
  beforeEach(async () => {
    await resetDb()
  })

  const idsOf = async (id: string) =>
    (await workoutExercises.listByWorkout(id)).map((row) => row.exerciseRef.exerciseId)

  it('inserts at the start, after a middle row and at the end with contiguous indexes', async () => {
    const { programId, pushId } = await seedProgram([exercise('a'), exercise('b'), exercise('c')])
    const id = await workouts.startFromProgramDay(programId, pushId)
    const [a] = await workoutExercises.listByWorkout(id)

    await workoutExercises.insert(id, [ref('s1'), ref('s2')], { kind: 'start' })
    expect(await idsOf(id)).toEqual(['s1', 's2', 'a', 'b', 'c'])

    await workoutExercises.insert(id, [ref('m1'), ref('m2')], {
      kind: 'after',
      workoutExerciseId: a.id,
    })
    expect(await idsOf(id)).toEqual(['s1', 's2', 'a', 'm1', 'm2', 'b', 'c'])

    const ids = await workoutExercises.insert(id, [ref('e1'), ref('e2')], { kind: 'end' })
    const rows = await workoutExercises.listByWorkout(id)
    expect(rows.map((row) => row.exerciseRef.exerciseId)).toEqual([
      's1',
      's2',
      'a',
      'm1',
      'm2',
      'b',
      'c',
      'e1',
      'e2',
    ])
    expect(rows.map((row) => row.orderIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(rows.slice(-2).map((row) => row.id)).toEqual(ids)
  })

  it('new rows carry no snapshot and no swappedFrom, and start with one blank set', async () => {
    const { id } = await startPush()
    const [added] = await workoutExercises.insert(id, [ref('cable-curl')], { kind: 'end' })
    const row = (await workoutExercises.listByWorkout(id)).find((r) => r.id === added)!
    expect(row.targetsSnapshot).toBeUndefined()
    expect(row.swappedFrom).toBeUndefined()
    const rowSets = await sets.listByWorkoutExercise(added)
    expect(rowSets).toHaveLength(1)
    expect(rowSets[0]).toMatchObject({ type: 'working', weight: 0, reps: 0, orderIndex: 0 })
  })

  it('starts with the last session working-set count, pre-filled row by row', async () => {
    const { programId, pushId } = await seedProgram([exercise('bench'), exercise('curl')])
    const first = await workouts.startFromProgramDay(programId, pushId)
    const curl = (await workouts.loadSession(first))!.exercises[1].sets
    await sets.patch(curl[0].id, { weight: 20, reps: 12 })
    await sets.setCompleted(curl[0].id, true)
    await sets.patch(curl[1].id, { weight: 18, reps: 10 })
    await sets.setCompleted(curl[1].id, true)
    await sets.patch(curl[2].id, { weight: 16, reps: 8 })
    await sets.setCompleted(curl[2].id, true)
    await workouts.finish(first)

    const other = await seedProgram([exercise('bench')])
    const id = await workouts.startFromProgramDay(other.programId, other.pushId)
    const [added] = await workoutExercises.insert(id, [ref('curl')], { kind: 'end' })
    const addedSets = await sets.listByWorkoutExercise(added)
    expect(addedSets.map((s) => [s.weight, s.reps])).toEqual([
      [20, 12],
      [18, 10],
      [16, 8],
    ])
  })

  it('carries L/R from the last session', async () => {
    const LR = { leftWeight: 20, leftReps: 12, rightWeight: 22, rightReps: 10 }
    const { programId, pushId } = await seedProgram([exercise('curl')])
    const first = await workouts.startFromProgramDay(programId, pushId)
    const curl = (await workouts.loadSession(first))!.exercises[0]
    await setAllUnilateral(curl.exercise.id, true)
    const [row] = await sets.listByWorkoutExercise(curl.exercise.id)
    await sets.patch(row.id, { unilateral: LR, weight: 22, reps: 10 })
    await sets.setCompleted(row.id, true)
    await workouts.finish(first)

    const other = await seedProgram([exercise('bench')])
    const id = await workouts.startFromProgramDay(other.programId, other.pushId)
    const [added] = await workoutExercises.insert(id, [ref('curl')], { kind: 'end' })
    const [first1] = await sets.listByWorkoutExercise(added)
    expect(first1).toMatchObject({ unilateral: LR })
  })

  it('rejects a duplicate, an unknown anchor, no refs and a finished workout, writing nothing', async () => {
    const { id } = await startPush()
    const before = await workoutExercises.listByWorkout(id)
    await db.syncState.clear()
    await expect(workoutExercises.insert(id, [ref('bench')], { kind: 'end' })).rejects.toThrow(
      'already',
    )
    await expect(workoutExercises.insert(id, [ref('x'), ref('x')], { kind: 'end' })).rejects.toThrow(
      'already',
    )
    await expect(
      workoutExercises.insert(id, [ref('x')], { kind: 'after', workoutExerciseId: 'nope' }),
    ).rejects.toThrow('not found')
    await expect(workoutExercises.insert(id, [], { kind: 'end' })).rejects.toThrow()
    expect(await workoutExercises.listByWorkout(id)).toEqual(before)
    expect(await db.syncState.count()).toBe(0)

    await workouts.finish(id)
    await expect(workoutExercises.insert(id, [ref('x')], { kind: 'end' })).rejects.toThrow(
      'not in progress',
    )
  })

  it('marks shifted and new rows dirty but not untouched ones', async () => {
    const { id } = await startPush()
    const [bench, fly] = await workoutExercises.listByWorkout(id)
    await db.syncState.clear()
    const [added] = await workoutExercises.insert(id, [ref('x')], {
      kind: 'after',
      workoutExerciseId: bench.id,
    })
    const dirty = (await db.syncState.toArray())
      .filter((row) => row.table === 'workoutExercises')
      .map((row) => row.recordId)
    expect([...dirty].sort()).toEqual([fly.id, added].sort())
  })
})

describe('workoutExercises.remove (LG-013)', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('soft-deletes a planned exercise and its sets and renumbers the rest', async () => {
    const { programId, pushId } = await seedProgram([exercise('a'), exercise('b'), exercise('c')])
    const id = await workouts.startFromProgramDay(programId, pushId)
    const [a, b] = await workoutExercises.listByWorkout(id)
    expect(await sets.listByWorkoutExercise(b.id)).not.toHaveLength(0)

    await workoutExercises.remove(b.id)
    const rows = await workoutExercises.listByWorkout(id)
    expect(rows.map((row) => [row.exerciseRef.exerciseId, row.orderIndex])).toEqual([
      ['a', 0],
      ['c', 1],
    ])
    expect(rows[0].id).toBe(a.id)
    expect(await sets.listByWorkoutExercise(b.id)).toEqual([])
    const session = await workouts.loadSession(id)
    expect(session!.exercises.map((e) => e.exercise.id)).not.toContain(b.id)
    const raw = await db.sets.where('workoutExerciseId').equals(b.id).toArray()
    expect(raw.length).toBeGreaterThan(0)
    expect(raw.every((s) => s.deletedAt != null)).toBe(true)
  })

  it('removes an added exercise', async () => {
    const { id } = await startPush()
    const [added] = await workoutExercises.insert(id, [ref('x')], { kind: 'end' })
    await workoutExercises.remove(added)
    expect(await workoutExercises.listByWorkout(id)).toHaveLength(2)
  })

  it('refuses the last exercise and writes nothing', async () => {
    const { programId, pushId } = await seedProgram([exercise('a')])
    const id = await workouts.startFromProgramDay(programId, pushId)
    const [only] = await workoutExercises.listByWorkout(id)
    await db.syncState.clear()
    await expect(workoutExercises.remove(only.id)).rejects.toBeInstanceOf(LastExerciseError)
    expect(await workoutExercises.listByWorkout(id)).toHaveLength(1)
    expect(await sets.listByWorkoutExercise(only.id)).not.toHaveLength(0)
    expect(await db.syncState.count()).toBe(0)
  })

  it('a removed exercise never feeds smart defaults or history after finish', async () => {
    const { programId, pushId } = await seedProgram([exercise('bench'), exercise('curl')])
    const first = await workouts.startFromProgramDay(programId, pushId)
    const [bench, curl] = (await workouts.loadSession(first))!.exercises
    await sets.patch(curl.sets[0].id, { weight: 20, reps: 12 })
    await sets.setCompleted(curl.sets[0].id, true)
    await sets.patch(bench.sets[0].id, { weight: 60, reps: 8 })
    await sets.setCompleted(bench.sets[0].id, true)
    await workoutExercises.remove(curl.exercise.id)
    await workouts.finish(first)

    expect(await workouts.previousSets(ref('curl'), 'other')).toEqual([])
    expect(await workouts.historyForExercise(ref('curl'))).toEqual([])
    expect(await workouts.historyForExercise(ref('bench'))).toHaveLength(1)
  })
})

describe('workoutExercises insert and remove together (LG-013 QA)', () => {
  beforeEach(async () => {
    await resetDb()
  })

  const programTree = async () => ({
    programs: await db.programs.toArray(),
    programDays: await db.programDays.toArray(),
    programExercises: await db.programExercises.toArray(),
  })

  it('adding and removing never change the program, its days or its exercises', async () => {
    const { programId, pushId } = await seedProgram([exercise('a'), exercise('b'), exercise('c')])
    const id = await workouts.startFromProgramDay(programId, pushId)
    const before = await programTree()
    await db.syncState.clear()

    const [a, b] = await workoutExercises.listByWorkout(id)
    const [added] = await workoutExercises.insert(id, [ref('x')], {
      kind: 'after',
      workoutExerciseId: a.id,
    })
    await workoutExercises.remove(b.id)
    await workoutExercises.remove(added)

    expect(await programTree()).toEqual(before)
    const touched = new Set((await db.syncState.toArray()).map((row) => row.table))
    expect(touched.has('programs')).toBe(false)
    expect(touched.has('programDays')).toBe(false)
    expect(touched.has('programExercises')).toBe(false)
  })

  it('a removed exercise can be added back and starts fresh, pre-filled from its last session', async () => {
    const { programId, pushId } = await seedProgram([exercise('bench'), exercise('curl')])
    const first = await workouts.startFromProgramDay(programId, pushId)
    const curl = (await workouts.loadSession(first))!.exercises[1].sets
    await sets.patch(curl[0].id, { weight: 20, reps: 12 })
    await sets.setCompleted(curl[0].id, true)
    await sets.patch(curl[1].id, { weight: 18, reps: 10 })
    await sets.setCompleted(curl[1].id, true)
    await workouts.finish(first)

    const id = await workouts.startFromProgramDay(programId, pushId)
    const [, removed] = await workoutExercises.listByWorkout(id)
    const [gone] = await sets.listByWorkoutExercise(removed.id)
    await sets.patch(gone.id, { weight: 99, reps: 1 })
    await sets.setCompleted(gone.id, true)
    await workoutExercises.remove(removed.id)

    const [readded] = await workoutExercises.insert(id, [ref('curl')], { kind: 'end' })
    expect(readded).not.toBe(removed.id)
    const rows = await workoutExercises.listByWorkout(id)
    expect(rows.map((row) => [row.exerciseRef.exerciseId, row.orderIndex])).toEqual([
      ['bench', 0],
      ['curl', 1],
    ])
    const fresh = await sets.listByWorkoutExercise(readded)
    expect(fresh.map((s) => [s.weight, s.reps, s.completedAt ?? null])).toEqual([
      [20, 12, null],
      [18, 10, null],
    ])
    // The removed row stays soft-deleted; it is not revived.
    expect((await db.workoutExercises.get(removed.id))?.deletedAt).not.toBeNull()
  })

  it('a sequence of inserts and removes keeps orderIndex contiguous and in the expected order', async () => {
    const { programId, pushId } = await seedProgram([exercise('a'), exercise('b'), exercise('c')])
    const id = await workouts.startFromProgramDay(programId, pushId)
    const [a, b] = await workoutExercises.listByWorkout(id)
    const order = async () =>
      (await workoutExercises.listByWorkout(id)).map((row) => [row.exerciseRef.exerciseId, row.orderIndex])

    const [m] = await workoutExercises.insert(id, [ref('m')], { kind: 'after', workoutExerciseId: a.id })
    await workoutExercises.remove(b.id)
    await workoutExercises.insert(id, [ref('s')], { kind: 'start' })
    expect(await order()).toEqual([
      ['s', 0],
      ['a', 1],
      ['m', 2],
      ['c', 3],
    ])
    await workoutExercises.remove(a.id)
    await workoutExercises.insert(id, [ref('e')], { kind: 'after', workoutExerciseId: m })
    await workoutExercises.insert(id, [ref('z')], { kind: 'end' })
    expect(await order()).toEqual([
      ['s', 0],
      ['m', 1],
      ['e', 2],
      ['c', 3],
      ['z', 4],
    ])
    const session = await workouts.loadSession(id)
    expect(session!.exercises.map((e) => e.exercise.exerciseRef.exerciseId)).toEqual(['s', 'm', 'e', 'c', 'z'])
  })

  it('an added exercise can be swapped with keep and with reset', async () => {
    const { programId, pushId } = await seedProgram([exercise('bench'), exercise('curl')])
    const first = await workouts.startFromProgramDay(programId, pushId)
    const curl = (await workouts.loadSession(first))!.exercises[1].sets
    await sets.patch(curl[0].id, { weight: 20, reps: 12 })
    await sets.setCompleted(curl[0].id, true)
    await workouts.finish(first)

    const other = await seedProgram([exercise('row')])
    const id = await workouts.startFromProgramDay(other.programId, other.pushId)
    const [added] = await workoutExercises.insert(id, [ref('x')], { kind: 'end' })
    const [blank] = await sets.listByWorkoutExercise(added)
    await sets.patch(blank.id, { weight: 7, reps: 7 })

    await workoutExercises.swap(added, ref('y'), 'keep')
    let row = (await db.workoutExercises.get(added))!
    expect(row).toMatchObject({ exerciseRef: ref('y'), swappedFrom: ref('x') })
    expect(row.targetsSnapshot).toBeUndefined()
    expect((await sets.listByWorkoutExercise(added)).map((s) => [s.weight, s.reps])).toEqual([[7, 7]])

    await workoutExercises.swap(added, ref('curl'), 'reset')
    row = (await db.workoutExercises.get(added))!
    expect(row).toMatchObject({ exerciseRef: ref('curl'), swappedFrom: ref('x') })
    expect(row.targetsSnapshot).toBeUndefined()
    expect((await sets.listByWorkoutExercise(added)).map((s) => [s.weight, s.reps])).toEqual([[20, 12]])
  })
})
