import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/ledger'
import { resetDb } from '@/db/test-utils'
import { programs } from '@/db/repos/programs'
import {
  workouts,
  WorkoutInProgressError,
  type WorkoutEditDraft,
  type WorkoutSession,
} from '@/db/repos/workouts'
import { newId } from '@/db/ids'
import type { Set as SetRecord } from '@/db/types'
import { workoutExercises } from '@/db/repos/workoutExercises'
import { sets } from '@/db/repos/sets'
import type { ProgramDraft } from '@/programs/model'
import { exercise, seedProgram, setAllUnilateral } from '@/workouts/test-fixtures'

const ref = (exerciseId: string) => ({ source: 'db' as const, exerciseId })

describe('workouts.startFromProgramDay', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('creates the workout, exercises in order and blank working sets', async () => {
    const { programId, pushId, draft } = await seedProgram()
    const id = await workouts.startFromProgramDay(programId, pushId)

    const session = await workouts.loadSession(id)
    expect(session?.workout).toMatchObject({
      programId,
      programDayId: pushId,
      name: 'Push',
      programName: 'PPL',
      cycleIndexAtTime: 0,
      status: 'in_progress',
    })
    expect(session?.exercises.map((e) => e.exercise.exerciseRef.exerciseId)).toEqual(['bench', 'fly'])
    expect(session?.exercises.map((e) => e.sets.length)).toEqual([3, 2])
    expect(session?.exercises[0].exercise.targetsSnapshot).toEqual({
      workingSets: 3,
      repMin: 8,
      repMax: 10,
      rirTarget: 1,
      restSeconds: 90,
    })
    for (const { sets: rows } of session?.exercises ?? []) {
      rows.forEach((set, index) => {
        expect(set).toMatchObject({
          orderIndex: index,
          type: 'working',
          weight: 0,
          reps: 0,
          rir: 0,
          rirIsPlus: false,
        })
        expect(set.completedAt).toBeUndefined()
      })
    }
    expect(draft.days[0].exercises).toHaveLength(2)
  })

  it('gives exercises with missing targets one blank set and an empty snapshot', async () => {
    const { programId, pushId } = await seedProgram([exercise('bench', {})])
    const id = await workouts.startFromProgramDay(programId, pushId)
    const session = await workouts.loadSession(id)
    expect(session?.exercises[0].sets).toHaveLength(1)
    expect(session?.exercises[0].exercise.targetsSnapshot).toEqual({})
  })

  it('throws WorkoutInProgressError when one is already in progress', async () => {
    const { programId, pushId, pullId } = await seedProgram()
    await workouts.startFromProgramDay(programId, pushId)
    await expect(workouts.startFromProgramDay(programId, pullId)).rejects.toBeInstanceOf(
      WorkoutInProgressError,
    )
    expect(await db.workouts.count()).toBe(1)
  })

  it('rejects an archived program, a rest day, a missing program and a foreign day', async () => {
    const { programId, pushId, draft } = await seedProgram()
    await expect(workouts.startFromProgramDay(programId, draft.days[2].id)).rejects.toThrow(
      'rest day',
    )
    await expect(workouts.startFromProgramDay('nope', pushId)).rejects.toThrow('Program not found')
    await expect(workouts.startFromProgramDay(programId, 'nope')).rejects.toThrow('Day not found')
    await programs.archive(programId)
    await expect(workouts.startFromProgramDay(programId, pushId)).rejects.toThrow('Archived')
    expect(await db.workouts.count()).toBe(0)
  })

  it('LOG-5: later program edits never reach the in-progress workout', async () => {
    const { programId, pushId, draft } = await seedProgram()
    const id = await workouts.startFromProgramDay(programId, pushId)
    const before = await workouts.loadSession(id)

    const edited: ProgramDraft = {
      ...draft,
      name: 'Renamed',
      isNew: false,
      days: [
        {
          ...draft.days[0],
          name: 'Renamed day',
          exercises: [{ ...draft.days[0].exercises[0], workingSets: 5, repMin: 1, repMax: 2 }],
        },
        ...draft.days.slice(1),
      ],
    }
    await programs.saveTree(edited)

    const after = await workouts.loadSession(id)
    expect(after?.workout.name).toBe('Push')
    expect(after?.workout.programName).toBe('PPL')
    expect(after?.exercises.map((e) => e.exercise)).toEqual(before?.exercises.map((e) => e.exercise))
    expect(after?.exercises.map((e) => e.sets)).toEqual(before?.exercises.map((e) => e.sets))
  })

  it('marks every created record dirty', async () => {
    const { programId, pushId } = await seedProgram()
    await db.syncState.clear()
    const id = await workouts.startFromProgramDay(programId, pushId)
    const session = await workouts.loadSession(id)
    const dirty = await db.syncState.toArray()
    const has = (table: string, recordId: string) =>
      dirty.some((row) => row.table === table && row.recordId === recordId)
    expect(has('workouts', id)).toBe(true)
    for (const { exercise, sets: rows } of session?.exercises ?? []) {
      expect(has('workoutExercises', exercise.id)).toBe(true)
      for (const set of rows) expect(has('sets', set.id)).toBe(true)
    }
  })

  describe('pre-fill from last session', () => {
    /** Logs the first N rows of bench as the given weight x reps pairs, then finishes. */
    async function finishBench(workoutId: string, logged: [number, number][]) {
      const session = await workouts.loadSession(workoutId)
      const rows = session!.exercises[0].sets
      for (const [index, [weight, reps]] of logged.entries()) {
        await sets.patch(rows[index].id, { weight, reps })
        await sets.setCompleted(rows[index].id, true)
      }
      await workouts.finish(workoutId)
    }

    it('LIB-10: pre-fills each working row from the same row of last session', async () => {
      const { programId, pushId } = await seedProgram()
      const first = await workouts.startFromProgramDay(programId, pushId)
      await finishBench(first, [
        [100, 8],
        [90, 6],
      ])

      const second = await workouts.startFromProgramDay(programId, pushId)
      const bench = (await workouts.loadSession(second))!.exercises[0].sets
      expect(bench[0]).toMatchObject({ weight: 100, reps: 8, rir: 0, rirIsPlus: false })
      expect(bench[1]).toMatchObject({ weight: 90, reps: 6, rir: 0, rirIsPlus: false })
      for (const set of bench) {
        expect(set.partialReps).toBeUndefined()
        expect(set.completedAt).toBeUndefined()
      }
    })

    it('LG-012: starts in L/R, pre-filled per side, when last session was logged L/R', async () => {
      const { programId, pushId } = await seedProgram()
      const first = await workouts.startFromProgramDay(programId, pushId)
      const logged = (await workouts.loadSession(first))!.exercises[0]
      await setAllUnilateral(logged.exercise.id, true)
      const [row] = await sets.listByWorkoutExercise(logged.exercise.id)
      const sides = { leftWeight: 20, leftReps: 12, rightWeight: 20, rightReps: 10 }
      await sets.patch(row.id, { unilateral: sides, weight: 20, reps: 10 })
      await sets.setCompleted(row.id, true)
      await workouts.finish(first)

      const second = await workouts.startFromProgramDay(programId, pushId)
      const bench = (await workouts.loadSession(second))!.exercises[0].sets
      expect(bench).toHaveLength(3)
      for (const set of bench) {
        expect(set.unilateral).toEqual(sides)
        expect(set).toMatchObject({ weight: 20, reps: 10 })
      }
    })

    it('rows beyond last session pre-fill from its final working set', async () => {
      const { programId, pushId } = await seedProgram()
      const first = await workouts.startFromProgramDay(programId, pushId)
      await finishBench(first, [
        [100, 8],
        [90, 6],
      ])

      const second = await workouts.startFromProgramDay(programId, pushId)
      const bench = (await workouts.loadSession(second))!.exercises[0].sets
      expect(bench).toHaveLength(3)
      expect(bench[2]).toMatchObject({ weight: 90, reps: 6 })
    })

    it('ignores discarded and in-progress workouts', async () => {
      const { programId, pushId } = await seedProgram()
      const first = await workouts.startFromProgramDay(programId, pushId)
      await finishBench(first, [[100, 8]])

      const discarded = await workouts.startFromProgramDay(programId, pushId)
      await logAll(discarded, 12)
      await workouts.discard(discarded)

      const next = await workouts.startFromProgramDay(programId, pushId)
      const bench = (await workouts.loadSession(next))!.exercises[0].sets
      expect(bench.map((set) => [set.weight, set.reps])).toEqual([
        [100, 8],
        [100, 8],
        [100, 8],
      ])
    })

    it('leaves an exercise with no history blank', async () => {
      const { programId, pushId } = await seedProgram()
      const first = await workouts.startFromProgramDay(programId, pushId)
      await finishBench(first, [[100, 8]])

      const second = await workouts.startFromProgramDay(programId, pushId)
      const fly = (await workouts.loadSession(second))!.exercises[1].sets
      for (const set of fly) expect(set).toMatchObject({ weight: 0, reps: 0, rir: 0 })
    })

    it('uses the newest finished session when there are several', async () => {
      const { programId, pushId } = await seedProgram()
      const older = await workouts.startFromProgramDay(programId, pushId)
      await finishBench(older, [[100, 8]])
      const newer = await workouts.startFromProgramDay(programId, pushId)
      await finishBench(newer, [[110, 5]])

      const next = await workouts.startFromProgramDay(programId, pushId)
      const bench = (await workouts.loadSession(next))!.exercises[0].sets
      expect(bench[0]).toMatchObject({ weight: 110, reps: 5 })
    })

    it('warm-up rows of last session do not take a working row', async () => {
      const { programId, pushId } = await seedProgram()
      const first = await workouts.startFromProgramDay(programId, pushId)
      await finishBench(first, [
        [100, 8],
        [90, 6],
      ])
      const benchId = (await workouts.loadSession(first))!.exercises[0].exercise.id
      await db.sets.put({
        id: 'warmup-1',
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
        workoutExerciseId: benchId,
        orderIndex: -1,
        type: 'warmup',
        weight: 40,
        reps: 10,
        rir: 0,
        rirIsPlus: false,
        completedAt: 1,
      })

      const second = await workouts.startFromProgramDay(programId, pushId)
      const bench = (await workouts.loadSession(second))!.exercises[0].sets
      expect(bench.map((set) => [set.weight, set.reps])).toEqual([
        [100, 8],
        [90, 6],
        [90, 6],
      ])
    })

    it('keeps full kg precision (§3.13)', async () => {
      const { programId, pushId } = await seedProgram()
      const first = await workouts.startFromProgramDay(programId, pushId)
      await finishBench(first, [[102.0582, 8]])

      const second = await workouts.startFromProgramDay(programId, pushId)
      const bench = (await workouts.loadSession(second))!.exercises[0].sets
      expect(bench[0].weight).toBe(102.0582)
    })

    it('neither reads nor writes exerciseMeta.lastUsed', async () => {
      const { programId, pushId } = await seedProgram()
      await db.exerciseMeta.put({
        id: 'meta-bench',
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
        source: 'db',
        exerciseId: 'bench',
        isFavorite: false,
        lastUsed: { weight: 200, reps: 1, unit: 'kg', at: 1 },
      })

      const first = await workouts.startFromProgramDay(programId, pushId)
      const bench = (await workouts.loadSession(first))!.exercises[0]
      for (const set of bench.sets) expect(set).toMatchObject({ weight: 0, reps: 0 })

      await finishBench(first, [[100, 8]])
      const second = await workouts.startFromProgramDay(programId, pushId)
      const next = (await workouts.loadSession(second))!.exercises[0]
      await sets.add(next.exercise.id)
      await workoutExercises.swap(next.exercise.id, ref('fly'), 'reset')

      const metas = await db.exerciseMeta.toArray()
      expect(metas).toHaveLength(1)
      expect(metas[0].lastUsed).toEqual({ weight: 200, reps: 1, unit: 'kg', at: 1 })
      expect(metas[0].updatedAt).toBe(1)
    })
  })

  it('getInProgress finds only the live in-progress workout', async () => {
    expect(await workouts.getInProgress()).toBeUndefined()
    const { programId, pushId } = await seedProgram()
    const id = await workouts.startFromProgramDay(programId, pushId)
    expect((await workouts.getInProgress())?.id).toBe(id)
    await workouts.discard(id)
    expect(await workouts.getInProgress()).toBeUndefined()
  })
})

async function logAll(id: string, reps = 8) {
  const session = await workouts.loadSession(id)
  for (const { sets: rows } of session?.exercises ?? []) {
    for (const set of rows) {
      await sets.patch(set.id, { weight: 60, reps })
      await sets.setCompleted(set.id, true)
    }
  }
}

describe('workouts finish, discard, previous', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('finish drops unchecked sets, keeps empty exercises and ticks the day', async () => {
    const { programId, pushId } = await seedProgram()
    const id = await workouts.startFromProgramDay(programId, pushId)
    const session = await workouts.loadSession(id)
    const first = session!.exercises[0].sets[0]
    await sets.patch(first.id, { weight: 50, reps: 8 })
    await sets.setCompleted(first.id, true)

    await workouts.finish(id)

    const finished = await workouts.loadSession(id)
    expect(finished?.workout.status).toBe('finished')
    expect(finished?.workout.finishedAt).toBeTypeOf('number')
    expect(finished?.exercises.map((e) => e.sets.length)).toEqual([1, 0])
    expect((await programs.get(programId))?.completedDayIds).toContain(pushId)
  })

  it('finish still works after the program is deleted or the day removed', async () => {
    const { programId, pushId, draft } = await seedProgram()
    const id = await workouts.startFromProgramDay(programId, pushId)
    await programs.saveTree({ ...draft, isNew: false, days: draft.days.slice(1) })
    await workouts.finish(id)
    expect((await workouts.get(id))?.status).toBe('finished')

    const second = await workouts.startFromProgramDay(programId, draft.days[1].id)
    await programs.softDeleteCascade(programId)
    await workouts.finish(second)
    expect((await workouts.get(second))?.status).toBe('finished')
  })

  it('discard marks the workout discarded and does not tick the day', async () => {
    const { programId, pushId } = await seedProgram()
    const id = await workouts.startFromProgramDay(programId, pushId)
    await workouts.discard(id)
    expect((await workouts.get(id))?.status).toBe('discarded')
    expect((await programs.get(programId))?.completedDayIds ?? []).not.toContain(pushId)
  })

  it('stores workout and exercise notes', async () => {
    const { programId, pushId } = await seedProgram()
    const id = await workouts.startFromProgramDay(programId, pushId)
    const session = await workouts.loadSession(id)
    await workouts.setNotes(id, 'Felt strong')
    await workoutExercises.setNotes(session!.exercises[0].exercise.id, 'Pause reps')
    const reloaded = await workouts.loadSession(id)
    expect(reloaded?.workout.notes).toBe('Felt strong')
    expect(reloaded?.exercises[0].exercise.notes).toBe('Pause reps')
  })

  it('previousSets returns the newest finished workout and ignores discarded, in-progress and deleted rows', async () => {
    const { programId, pushId } = await seedProgram()

    const older = await workouts.startFromProgramDay(programId, pushId)
    await logAll(older, 5)
    await workouts.finish(older)

    const newer = await workouts.startFromProgramDay(programId, pushId)
    await logAll(newer, 8)
    await workouts.finish(newer)

    const discarded = await workouts.startFromProgramDay(programId, pushId)
    await logAll(discarded, 12)
    await workouts.discard(discarded)

    const current = await workouts.startFromProgramDay(programId, pushId)
    await logAll(current, 20)

    const previous = await workouts.previousSets(ref('bench'), current)
    expect(previous.map((set) => set.reps)).toEqual([8, 8, 8])

    await workouts.softDelete(newer)
    expect((await workouts.previousSets(ref('bench'), current)).map((set) => set.reps)).toEqual([
      5, 5, 5,
    ])
    expect(await workouts.previousSets(ref('squat'), current)).toEqual([])
  })

  it('previousSets with a before cutoff returns the newest session finished before it, not a later one', async () => {
    const { programId, pushId } = await seedProgram()
    for (const [reps, finishedAt] of [
      [5, 1_000],
      [8, 2_000],
      [12, 3_000],
    ]) {
      const id = await workouts.startFromProgramDay(programId, pushId)
      await logAll(id, reps)
      await workouts.finish(id)
      await workouts.update(id, { finishedAt })
    }

    const reps = async (before: number) =>
      (await workouts.previousSets(ref('bench'), 'none', before)).map((set) => set.reps)
    expect(await reps(2_500)).toEqual([8, 8, 8])
    expect(await reps(2_000)).toEqual([5, 5, 5])
    expect(await reps(1_000)).toEqual([])
  })
})

describe('workouts.saveEdit', () => {
  beforeEach(async () => {
    await resetDb()
  })

  /** A finished Push workout: bench 3 x (60 x 8), fly 2 x (60 x 8). */
  async function finishedPush() {
    const seeded = await seedProgram()
    const id = await workouts.startFromProgramDay(seeded.programId, seeded.pushId)
    await logAll(id, 8)
    await workouts.finish(id)
    const session = (await workouts.loadSession(id))!
    return { ...seeded, id, session }
  }

  /** A copy of the stored session in the draft shape the edit page saves. */
  function draftOf(session: WorkoutSession): WorkoutEditDraft {
    return {
      notes: session.workout.notes,
      exercises: session.exercises.map(({ exercise, sets: rows }) => ({
        exercise: { ...exercise },
        sets: rows.map((row) => ({ ...row })),
      })),
    }
  }

  const newSet = (from: SetRecord, fields: Partial<SetRecord>): SetRecord => ({
    ...from,
    id: newId(),
    completedAt: undefined,
    ...fields,
  })

  it('persists an edited set, an added set and a removed set', async () => {
    const { id, session } = await finishedPush()
    const draft = draftOf(session)
    const bench = draft.exercises[0]
    const [first, second, third] = bench.sets
    bench.sets = [{ ...first, weight: 80, reps: 6 }, third, newSet(third, { weight: 70, reps: 5 })]

    await workouts.saveEdit(id, draft)

    const saved = (await workouts.loadSession(id))!.exercises[0].sets
    expect(saved.map((set) => [set.weight, set.reps, set.orderIndex])).toEqual([
      [80, 6, 0],
      [60, 8, 1],
      [70, 5, 2],
    ])
    expect(saved[0].id).toBe(first.id)
    expect((await db.sets.get(second.id))?.deletedAt).toBeTypeOf('number')
  })

  it('persists an added exercise at its position, a removed exercise with its sets, and both note types', async () => {
    const { id, session } = await finishedPush()
    const draft = draftOf(session)
    const [bench, fly] = draft.exercises
    const added = {
      exercise: { ...bench.exercise, id: newId(), exerciseRef: ref('dip'), notes: 'Slow negatives' },
      sets: [newSet(bench.sets[0], { workoutExerciseId: '', weight: 20, reps: 10 })],
    }
    draft.exercises = [{ ...bench, exercise: { ...bench.exercise, notes: 'Pause reps' } }, added]
    draft.notes = 'Felt strong'

    await workouts.saveEdit(id, draft)

    const saved = (await workouts.loadSession(id))!
    expect(saved.workout.notes).toBe('Felt strong')
    expect(saved.exercises.map((e) => [e.exercise.exerciseRef.exerciseId, e.exercise.orderIndex])).toEqual([
      ['bench', 0],
      ['dip', 1],
    ])
    expect(saved.exercises[0].exercise.notes).toBe('Pause reps')
    expect(saved.exercises[1].exercise.notes).toBe('Slow negatives')
    expect(saved.exercises[1].sets.map((set) => [set.weight, set.reps, set.workoutExerciseId])).toEqual([
      [20, 10, added.exercise.id],
    ])
    expect((await db.workoutExercises.get(fly.exercise.id))?.deletedAt).toBeTypeOf('number')
    for (const set of fly.sets) expect((await db.sets.get(set.id))?.deletedAt).toBeTypeOf('number')

    // Clearing a note removes it from the row.
    const cleared = draftOf(saved)
    cleared.notes = ''
    cleared.exercises[0].exercise.notes = ''
    await workouts.saveEdit(id, cleared)
    expect('notes' in (await db.workouts.get(id))!).toBe(false)
    expect('notes' in (await db.workoutExercises.get(bench.exercise.id))!).toBe(false)
  })

  it('marks dirty exactly the rows it wrote, and an unchanged draft writes nothing', async () => {
    const { id, session } = await finishedPush()
    const changed = draftOf(session)
    const target = changed.exercises[1].sets[1]
    changed.exercises[1].sets[1] = { ...target, reps: 9 }
    await db.syncState.clear()

    await workouts.saveEdit(id, changed)
    expect((await db.syncState.toArray()).map((row) => [row.table, row.recordId])).toEqual([
      ['sets', target.id],
    ])

    const before = (await workouts.loadSession(id))!
    await db.syncState.clear()
    await workouts.saveEdit(id, draftOf(before))
    expect(await db.syncState.toArray()).toEqual([])
    expect(await workouts.loadSession(id)).toEqual(before)
  })

  it('never changes the workout status, times, name or the program pass', async () => {
    const { id, session, programId } = await finishedPush()
    const workoutBefore = (await db.workouts.get(id))!
    const passBefore = (await programs.get(programId))?.completedDayIds
    const draft = draftOf(session)
    draft.notes = 'Edited'
    draft.exercises[0].sets[0] = { ...draft.exercises[0].sets[0], weight: 100 }

    await workouts.saveEdit(id, draft)

    const after = (await db.workouts.get(id))!
    const pick = (w: typeof after) => [w.status, w.startedAt, w.finishedAt, w.pausedMs, w.pausedAt, w.name]
    expect(pick(after)).toEqual(pick(workoutBefore))
    expect((await programs.get(programId))?.completedDayIds).toEqual(passBefore)
  })

  it('rejects a workout that is not finished, and a missing one', async () => {
    const { programId, pushId } = await seedProgram()
    const id = await workouts.startFromProgramDay(programId, pushId)
    const session = (await workouts.loadSession(id))!
    const draft = draftOf(session)
    draft.exercises[0].sets[0] = { ...draft.exercises[0].sets[0], weight: 100, reps: 5 }

    await expect(workouts.saveEdit(id, draft)).rejects.toThrow('Workout is not finished')
    expect(await workouts.loadSession(id)).toEqual(session)
    await expect(workouts.saveEdit('missing', draft)).rejects.toThrow('Workout not found')
  })

  it('drops sets with no reps and stamps new sets with the workout finish time', async () => {
    const { id, session } = await finishedPush()
    const finishedAt = session.workout.finishedAt
    const draft = draftOf(session)
    const bench = draft.exercises[0]
    const [first, second, third] = bench.sets
    const empty = newSet(third, { weight: 50, reps: 0 })
    const fresh = newSet(third, { weight: 65, reps: 4 })
    bench.sets = [{ ...first, reps: 0 }, second, empty, third, fresh]

    await workouts.saveEdit(id, draft)

    const saved = (await workouts.loadSession(id))!.exercises[0].sets
    expect(saved.map((set) => [set.id, set.orderIndex])).toEqual([
      [second.id, 0],
      [third.id, 1],
      [fresh.id, 2],
    ])
    expect((await db.sets.get(first.id))?.deletedAt).toBeTypeOf('number')
    expect(await db.sets.get(empty.id)).toBeUndefined()
    expect(saved[2].completedAt).toBe(finishedAt)
  })
})

describe('workouts pause and resume', () => {
  beforeEach(async () => {
    await resetDb()
  })

  async function start() {
    const { programId, pushId } = await seedProgram()
    return workouts.startFromProgramDay(programId, pushId)
  }

  it('pause then resume accumulates pausedMs and clears pausedAt', async () => {
    const id = await start()
    await workouts.pause(id, 1_000)
    expect((await workouts.get(id))?.pausedAt).toBe(1_000)
    await workouts.resume(id, 4_000)
    await workouts.pause(id, 10_000)
    await workouts.resume(id, 12_000)
    const row = await workouts.get(id)
    expect(row?.pausedAt).toBeNull()
    expect(row?.pausedMs).toBe(5_000)
  })

  it('a second pause or resume is a no-op', async () => {
    const id = await start()
    await workouts.resume(id, 500)
    expect((await workouts.get(id))?.pausedMs).toBeUndefined()
    await workouts.pause(id, 1_000)
    await workouts.pause(id, 9_000)
    expect((await workouts.get(id))?.pausedAt).toBe(1_000)
    await workouts.resume(id, 2_000)
    await workouts.resume(id, 9_000)
    expect((await workouts.get(id))?.pausedMs).toBe(1_000)
  })

  it('pause does nothing on a finished or discarded workout', async () => {
    const finished = await start()
    await workouts.finish(finished)
    await workouts.pause(finished, 1_000)
    expect((await workouts.get(finished))?.pausedAt ?? null).toBeNull()

    const discarded = await start()
    await workouts.discard(discarded)
    await workouts.pause(discarded, 1_000)
    expect((await workouts.get(discarded))?.pausedAt ?? null).toBeNull()
  })

  it('finish while paused folds the open pause into pausedMs', async () => {
    const id = await start()
    const startedAt = (await workouts.get(id))!.startedAt
    await workouts.pause(id, startedAt - 60_000)
    await workouts.finish(id)
    const row = await workouts.get(id)
    expect(row?.status).toBe('finished')
    expect(row?.pausedAt).toBeNull()
    expect(row?.pausedMs).toBeGreaterThanOrEqual(60_000)
  })
})

describe('workouts.historyForExercise', () => {
  beforeEach(async () => {
    await resetDb()
  })

  async function finishedWorkout(programId: string, dayId: string, reps: number, finishedAt: number) {
    const id = await workouts.startFromProgramDay(programId, dayId)
    await logAll(id, reps)
    await workouts.finish(id)
    await workouts.update(id, { finishedAt })
    return id
  }

  it('returns finished workouts newest first with checked sets in order', async () => {
    const { programId, pushId } = await seedProgram()
    const older = await finishedWorkout(programId, pushId, 5, 1_000)
    const newer = await finishedWorkout(programId, pushId, 8, 2_000)

    const history = await workouts.historyForExercise(ref('bench'))
    expect(history.map((entry) => entry.workout.id)).toEqual([newer, older])
    expect(history[0].sets.map((set) => set.reps)).toEqual([8, 8, 8])
    expect(history[1].sets.map((set) => set.reps)).toEqual([5, 5, 5])
    expect(history[0].sets.map((set) => set.orderIndex)).toEqual([0, 1, 2])
  })

  it('excludes in-progress and discarded workouts', async () => {
    const { programId, pushId } = await seedProgram()
    const finished = await finishedWorkout(programId, pushId, 6, 1_000)
    const discarded = await workouts.startFromProgramDay(programId, pushId)
    await logAll(discarded, 12)
    await workouts.discard(discarded)
    const inProgress = await workouts.startFromProgramDay(programId, pushId)
    await logAll(inProgress, 20)

    const history = await workouts.historyForExercise(ref('bench'))
    expect(history.map((entry) => entry.workout.id)).toEqual([finished])
  })

  it('excludes soft-deleted sets, unchecked sets and soft-deleted workouts', async () => {
    const { programId, pushId } = await seedProgram()
    const id = await finishedWorkout(programId, pushId, 8, 2_000)
    const gone = await finishedWorkout(programId, pushId, 9, 3_000)
    await workouts.softDelete(gone)
    const session = await workouts.loadSession(id)
    await sets.softDelete(session!.exercises[0].sets[0].id)

    const history = await workouts.historyForExercise(ref('bench'))
    expect(history).toHaveLength(1)
    expect(history[0].sets).toHaveLength(2)
  })

  it('matches on source and exerciseId only', async () => {
    const { programId, pushId } = await seedProgram()
    await finishedWorkout(programId, pushId, 8, 1_000)

    expect(await workouts.historyForExercise({ source: 'custom', exerciseId: 'bench' })).toEqual([])
    expect(await workouts.historyForExercise(ref('fly'))).toHaveLength(1)
  })

  it('concatenates sets when the exercise appears twice in one workout', async () => {
    const { programId, pushId } = await seedProgram([
      exercise('bench', { workingSets: 1 }),
      exercise('fly', { workingSets: 1 }),
      exercise('bench', { workingSets: 2 }),
    ])
    const id = await workouts.startFromProgramDay(programId, pushId)
    const session = await workouts.loadSession(id)
    let reps = 1
    for (const { sets: rows } of session!.exercises) {
      for (const set of rows) {
        await sets.patch(set.id, { weight: 60, reps: reps++ })
        await sets.setCompleted(set.id, true)
      }
    }
    await workouts.finish(id)

    const history = await workouts.historyForExercise(ref('bench'))
    expect(history).toHaveLength(1)
    expect(history[0].sets.map((set) => set.reps)).toEqual([1, 3, 4])
  })

  it('skips workouts where the exercise logged nothing', async () => {
    const { programId, pushId } = await seedProgram()
    const id = await workouts.startFromProgramDay(programId, pushId)
    const session = await workouts.loadSession(id)
    const fly = session!.exercises[1].sets[0]
    await sets.patch(fly.id, { weight: 20, reps: 12 })
    await sets.setCompleted(fly.id, true)
    await workouts.finish(id)

    expect(await workouts.historyForExercise(ref('bench'))).toEqual([])
    expect(await workouts.historyForExercise(ref('fly'))).toHaveLength(1)
  })

  it('returns an empty array for a never-logged exercise', async () => {
    expect(await workouts.historyForExercise(ref('squat'))).toEqual([])
  })
})
