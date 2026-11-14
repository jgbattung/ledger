import { set as setTime, startOfDay, subDays } from 'date-fns'
import { newId } from '@/db/ids'
import type { Progression } from '@/db/seed/programs'
import type { ProgramTree } from '@/db/repos/programs'
import type {
  CustomExercise,
  Set as SetRow,
  Workout,
  WorkoutExercise,
} from '@/db/types'

export const SSB_SQUAT_NAME = 'SSB Squat'
export const DELETED_CUSTOM_NAME = 'Zercher Squat'

/** The SSB Squat joins PPL-R-UL's Legs day this many days before the anchor,
 * so it carries a few weeks of history rather than all twelve. */
export const SSB_SINCE_DAYS = 28

/** Days before the anchor of the two sessions that logged the deleted exercise. */
const DELETED_SESSION_OFFSETS = [-40, -33]

export const SSB_PROGRESSION: Progression = { startKg: 80, incrementKg: 2.5 }

export type SeedCustom = {
  rows: CustomExercise[]
  ssbSquat: CustomExercise
  deleted: CustomExercise
  /** Loads for the custom exercises that appear in generated history (the SSB Squat). */
  progression: Record<string, Progression>
}

/**
 * Two custom exercises as raw rows: a live SSB Squat (used by PPL-R-UL's Legs
 * day) and a soft-deleted Zercher Squat that only past workouts still use.
 * Dates derive from `anchor`; only the ids are random, like every seeded row.
 */
export function buildCustomExercises(anchor: number): SeedCustom {
  const created = subDays(startOfDay(anchor), 35).getTime()
  const ssbSquat: CustomExercise = {
    id: newId(),
    createdAt: created,
    updatedAt: created,
    deletedAt: null,
    name: SSB_SQUAT_NAME,
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes', 'lower back'],
    equipmentTag: 'barbell',
    mechanic: 'compound',
  }
  const removedAt = subDays(startOfDay(anchor), 25).getTime()
  const deleted: CustomExercise = {
    id: newId(),
    createdAt: created,
    updatedAt: removedAt,
    deletedAt: removedAt,
    name: DELETED_CUSTOM_NAME,
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes', 'abs'],
    equipmentTag: 'barbell',
    mechanic: 'compound',
    notes: 'Bar in the elbow crease',
  }
  return {
    rows: [ssbSquat, deleted],
    ssbSquat,
    deleted,
    progression: {
      [ssbSquat.id]: SSB_PROGRESSION,
    },
  }
}

/**
 * Two finished morning sessions that logged the deleted custom exercise, filed
 * under the archived program (no live program holds it). Fixed loads, no rng.
 */
export function buildDeletedCustomHistory(input: {
  deleted: CustomExercise
  archived: ProgramTree
  anchor: number
}): { workouts: Workout[]; workoutExercises: WorkoutExercise[]; sets: SetRow[] } {
  const { deleted, archived, anchor } = input
  const day = archived.days[0].day
  const today = startOfDay(anchor)
  const workouts: Workout[] = []
  const workoutExercises: WorkoutExercise[] = []
  const sets: SetRow[] = []

  DELETED_SESSION_OFFSETS.forEach((offset, session) => {
    const startedAt = setTime(subDays(today, -offset), { hours: 7, minutes: 15 }).getTime()
    const workout: Workout = {
      id: newId(),
      createdAt: startedAt,
      updatedAt: startedAt,
      deletedAt: null,
      programId: archived.program.id,
      programDayId: day.id,
      programName: archived.program.name,
      name: day.name,
      startedAt,
      status: 'finished',
      cycleIndexAtTime: 0,
      finishedAt: startedAt + 52 * 60_000,
    }
    workouts.push(workout)
    const workoutExercise: WorkoutExercise = {
      id: newId(),
      createdAt: startedAt,
      updatedAt: startedAt,
      deletedAt: null,
      workoutId: workout.id,
      orderIndex: 0,
      exerciseRef: { source: 'custom', exerciseId: deleted.id },
      targetsSnapshot: { workingSets: 3, repMin: 6, repMax: 8, rirTarget: 1, restSeconds: 180 },
    }
    workoutExercises.push(workoutExercise)
    for (let setIndex = 0; setIndex < 3; setIndex++) {
      const completedAt = startedAt + (8 + setIndex * 7) * 60_000
      sets.push({
        id: newId(),
        createdAt: completedAt,
        updatedAt: completedAt,
        deletedAt: null,
        workoutExerciseId: workoutExercise.id,
        orderIndex: setIndex,
        type: 'working',
        weight: 60 + session * 2.5,
        reps: 8 - setIndex,
        rir: setIndex === 2 ? 0 : 1,
        rirIsPlus: false,
        completedAt,
      })
    }
  })

  return { workouts, workoutExercises, sets }
}
