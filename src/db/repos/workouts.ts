import { db } from '@/db/ledger'
import { newId, now } from '@/db/ids'
import { createRepo } from '@/db/repos/base'
import { programs } from '@/db/repos/programs'
import { markDirty } from '@/db/repos/syncState'
import { BLANK_SET, toTargetsSnapshot } from '@/workouts/model'
import type { ExerciseRef, Set as SetRecord, Workout, WorkoutExercise } from '@/db/types'

const baseRepo = createRepo<Workout>(db.workouts, 'workouts')

export class WorkoutInProgressError extends Error {
  constructor() {
    super('A workout is already in progress')
    this.name = 'WorkoutInProgressError'
  }
}

export type WorkoutSession = {
  workout: Workout
  exercises: { exercise: WorkoutExercise; sets: SetRecord[] }[]
}

const byOrder = <T extends { orderIndex: number }>(a: T, b: T) => a.orderIndex - b.orderIndex

export const workouts = {
  ...baseRepo,

  async getInProgress(): Promise<Workout | undefined> {
    const rows = await db.workouts.where('status').equals('in_progress').toArray()
    return rows.find((row) => row.deletedAt == null)
  },

  /**
   * Starts a workout from a program day. Everything history needs is copied
   * at this moment (names, targets) so later program edits never reach it
   * (LOG-5). One transaction; one in-progress workout at a time.
   */
  async startFromProgramDay(programId: string, dayId: string): Promise<string> {
    return db.transaction(
      'rw',
      [
        db.programs,
        db.programDays,
        db.programExercises,
        db.workouts,
        db.workoutExercises,
        db.sets,
        db.syncState,
      ],
      async () => {
        const inProgress = await db.workouts.where('status').equals('in_progress').toArray()
        if (inProgress.some((row) => row.deletedAt == null)) throw new WorkoutInProgressError()

        const program = await db.programs.get(programId)
        if (!program || program.deletedAt != null) throw new Error('Program not found')
        if (program.isArchived) throw new Error('Archived programs cannot be started')
        const day = await db.programDays.get(dayId)
        if (!day || day.deletedAt != null || day.programId !== programId) {
          throw new Error('Day not found')
        }
        const sources = (await db.programExercises.where('programDayId').equals(dayId).toArray())
          .filter((row) => row.deletedAt == null)
          .sort(byOrder)
        if (sources.length === 0) throw new Error('A rest day cannot be started')

        const timestamp = now()
        const workoutId = newId()
        await db.workouts.put({
          id: workoutId,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
          programId,
          programDayId: dayId,
          name: day.name,
          programName: program.name,
          cycleIndexAtTime: program.currentCycleIndex,
          startedAt: timestamp,
          status: 'in_progress',
        })
        await markDirty('workouts', workoutId)

        for (const [index, source] of sources.entries()) {
          const exerciseId = newId()
          await db.workoutExercises.put({
            id: exerciseId,
            createdAt: timestamp,
            updatedAt: timestamp,
            deletedAt: null,
            workoutId,
            orderIndex: index,
            exerciseRef: source.exerciseRef,
            targetsSnapshot: toTargetsSnapshot(source),
          })
          await markDirty('workoutExercises', exerciseId)

          for (let setIndex = 0; setIndex < (source.workingSets ?? 1); setIndex += 1) {
            const setId = newId()
            await db.sets.put({
              id: setId,
              createdAt: timestamp,
              updatedAt: timestamp,
              deletedAt: null,
              workoutExerciseId: exerciseId,
              orderIndex: setIndex,
              type: 'working',
              ...BLANK_SET,
            })
            await markDirty('sets', setId)
          }
        }
        return workoutId
      },
    )
  },

  /** The workout with its live exercises and live sets, in order. */
  async loadSession(id: string): Promise<WorkoutSession | undefined> {
    const workout = await baseRepo.get(id)
    if (!workout) return undefined
    const exerciseRows = (await db.workoutExercises.where('workoutId').equals(id).toArray())
      .filter((row) => row.deletedAt == null)
      .sort(byOrder)
    const exercises = await Promise.all(
      exerciseRows.map(async (exercise) => ({
        exercise,
        sets: (await db.sets.where('workoutExerciseId').equals(exercise.id).toArray())
          .filter((set) => set.deletedAt == null)
          .sort(byOrder),
      })),
    )
    return { workout, exercises }
  },

  async setNotes(id: string, notes: string): Promise<void> {
    await baseRepo.update(id, { notes })
  },

  /**
   * Working sets of the newest finished workout that contains the exercise
   * (Previous column). Ignores discarded and in-progress workouts, soft
   * deleted rows and finished runs where the exercise logged nothing.
   */
  async previousSets(exerciseRef: ExerciseRef, excludeWorkoutId: string): Promise<SetRecord[]> {
    const finished = (await db.workouts.where('status').equals('finished').toArray())
      .filter((row) => row.deletedAt == null && row.id !== excludeWorkoutId)
      .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
    for (const workout of finished) {
      const matches = (await db.workoutExercises.where('workoutId').equals(workout.id).toArray())
        .filter(
          (row) =>
            row.deletedAt == null &&
            row.exerciseRef.source === exerciseRef.source &&
            row.exerciseRef.exerciseId === exerciseRef.exerciseId,
        )
        .sort(byOrder)
      for (const match of matches) {
        const logged = (await db.sets.where('workoutExerciseId').equals(match.id).toArray())
          .filter((set) => set.deletedAt == null && set.type === 'working')
          .sort(byOrder)
        if (logged.length > 0) return logged
      }
    }
    return []
  },

  /**
   * Finishes a workout: unchecked sets are soft-deleted, exercises are kept,
   * then the program day is ticked via `programs.completeDay` OUTSIDE this
   * transaction (the programs repo never shares one with workout tables). A
   * deleted program or removed day is not an error for the workout.
   */
  async finish(id: string): Promise<void> {
    const workout = await db.transaction(
      'rw',
      [db.workouts, db.workoutExercises, db.sets, db.syncState],
      async () => {
        const row = await db.workouts.get(id)
        if (!row || row.deletedAt != null) throw new Error('Workout not found')
        const timestamp = now()
        const exercises = await db.workoutExercises.where('workoutId').equals(id).toArray()
        for (const exercise of exercises) {
          if (exercise.deletedAt != null) continue
          const rows = await db.sets.where('workoutExerciseId').equals(exercise.id).toArray()
          for (const set of rows) {
            if (set.deletedAt != null || set.completedAt != null) continue
            await db.sets.update(set.id, { deletedAt: timestamp, updatedAt: timestamp })
            await markDirty('sets', set.id)
          }
        }
        await db.workouts.update(id, {
          status: 'finished',
          finishedAt: timestamp,
          updatedAt: timestamp,
        })
        await markDirty('workouts', id)
        return row
      },
    )

    if (workout.programId && workout.programDayId) {
      try {
        await programs.completeDay(workout.programId, workout.programDayId)
      } catch (error) {
        const message = error instanceof Error ? error.message : ''
        if (message !== 'Program not found' && message !== 'Day not found') throw error
      }
    }
  },

  /** Abandons the workout. Never ticks the program day. */
  async discard(id: string): Promise<void> {
    await baseRepo.update(id, { status: 'discarded' })
  },
}
