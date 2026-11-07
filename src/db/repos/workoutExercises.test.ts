import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb } from '@/db/test-utils'
import { programs } from '@/db/repos/programs'
import { workouts } from '@/db/repos/workouts'
import { workoutExercises } from '@/db/repos/workoutExercises'
import { sets } from '@/db/repos/sets'
import { seedProgram } from '@/workouts/test-fixtures'

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
