import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/ledger'
import { resetDb } from '@/db/test-utils'
import { programs } from '@/db/repos/programs'
import { workouts, WorkoutInProgressError } from '@/db/repos/workouts'
import { workoutExercises } from '@/db/repos/workoutExercises'
import { sets } from '@/db/repos/sets'
import type { ProgramDraft } from '@/programs/model'
import { exercise, seedProgram } from '@/workouts/test-fixtures'

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
