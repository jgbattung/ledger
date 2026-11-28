import { describe, expect, it } from 'vitest'
import type { WorkoutSession } from '@/db/repos'
import type { ExerciseRef, Set as SetRecord, Workout, WorkoutExercise } from '@/db/types'
import type { Muscle } from '@/exercises/types'
import { formatDuration, formatSetRuns, summarizeWorkout } from '@/workouts/summary'

const base = { createdAt: 0, updatedAt: 0, deletedAt: null }
const DONE = 1_000

function set(fields: Partial<SetRecord> & Pick<SetRecord, 'weight' | 'reps'>): SetRecord {
  return {
    ...base,
    id: crypto.randomUUID(),
    workoutExerciseId: 'we',
    orderIndex: 0,
    type: 'working',
    rir: 0,
    rirIsPlus: false,
    completedAt: DONE,
    ...fields,
  }
}

function entry(exerciseId: string, sets: SetRecord[]) {
  const exercise: WorkoutExercise = {
    ...base,
    id: crypto.randomUUID(),
    workoutId: 'w',
    orderIndex: 0,
    exerciseRef: { source: 'db', exerciseId },
  }
  return { exercise, sets }
}

function session(
  exercises: WorkoutSession['exercises'],
  timing: Partial<Workout> = { startedAt: 0, finishedAt: 3_600_000 },
): WorkoutSession {
  const workout: Workout = { ...base, id: 'w', name: 'Push', status: 'finished', startedAt: 0, ...timing }
  return { workout, exercises }
}

const MUSCLES: Record<string, Muscle[]> = {
  bench: ['chest'],
  fly: ['chest', 'front delts'],
  raise: ['side delts'],
}
const musclesOf = (ref: ExerciseRef) => MUSCLES[ref.exerciseId] ?? []

describe('summarizeWorkout', () => {
  it('counts only checked working sets', () => {
    const result = summarizeWorkout(
      session([
        entry('bench', [
          set({ type: 'warmup', weight: 40, reps: 10 }),
          set({ weight: 80, reps: 8 }),
          set({ weight: 80, reps: 8, completedAt: undefined }),
          set({ weight: 80, reps: 7 }),
        ]),
        entry('raise', [set({ weight: 10, reps: 12 })]),
      ]),
      musclesOf,
      0,
    )
    expect(result.workingSets).toBe(3)
  })

  it('sums weight x reps of working sets: warm-ups, unchecked sets and partials add nothing, an L/R set counts once at its aggregate', () => {
    const result = summarizeWorkout(
      session([
        entry('bench', [
          set({ type: 'warmup', weight: 40, reps: 10 }),
          set({ weight: 80, reps: 8, partialReps: 2 }),
          set({ weight: 80, reps: 8, completedAt: undefined }),
        ]),
        entry('raise', [
          set({
            weight: 22,
            reps: 10,
            unilateral: { leftWeight: 20, leftReps: 12, rightWeight: 22, rightReps: 10 },
          }),
        ]),
      ]),
      musclesOf,
      0,
    )
    expect(result.volumeKg).toBe(80 * 8 + 22 * 10)
  })

  it('measures duration without the paused time', () => {
    const result = summarizeWorkout(
      session([], { startedAt: 1_000, finishedAt: 1_000 + 3_600_000, pausedMs: 600_000 }),
      musclesOf,
      99_999_999,
    )
    expect(result.durationMs).toBe(3_000_000)
  })

  it('adds one per working set to each primary muscle of its exercise', () => {
    const result = summarizeWorkout(
      session([
        entry('bench', [
          set({ weight: 80, reps: 8 }),
          set({ weight: 80, reps: 8 }),
          set({ type: 'warmup', weight: 40, reps: 10 }),
        ]),
        entry('fly', [set({ weight: 14, reps: 12 })]),
        entry('raise', [set({ weight: 10, reps: 12, completedAt: undefined })]),
      ]),
      musclesOf,
      0,
    )
    expect(result.setsByMuscle).toEqual({ chest: 3, 'front delts': 1 })
  })
})

describe('formatSetRuns', () => {
  it('collapses consecutive same-weight sets into one run and keeps partials separate', () => {
    expect(
      formatSetRuns([
        set({ type: 'warmup', weight: 40, reps: 10 }),
        set({ weight: 80, reps: 8 }),
        set({ weight: 80, reps: 8 }),
        set({ weight: 80, reps: 7, partialReps: 2 }),
      ], 'kg'),
    ).toEqual({
      runs: [{ weight: '80', reps: [{ full: '8' }, { full: '8' }, { full: '7', partial: '2' }] }],
    })
  })

  it('starts a new run on each weight change', () => {
    expect(
      formatSetRuns([
        set({ weight: 30, reps: 10 }),
        set({ weight: 32, reps: 8 }),
        set({ weight: 34, reps: 6 }),
      ], 'kg'),
    ).toEqual({
      runs: [
        { weight: '30', reps: [{ full: '10' }] },
        { weight: '32', reps: [{ full: '8' }] },
        { weight: '34', reps: [{ full: '6' }] },
      ],
    })
  })

  it('prefixes L/R sets and shows the aggregate side', () => {
    expect(
      formatSetRuns([
        set({
          weight: 0,
          reps: 0,
          unilateral: { leftWeight: 20, leftReps: 12, rightWeight: 22, rightReps: 10, rightPartialReps: 2 },
        }),
      ], 'kg'),
    ).toEqual({ prefix: 'L/R ', runs: [{ weight: '22', reps: [{ full: '10', partial: '2' }] }] })
  })
})

describe('formatDuration', () => {
  it('shows hours and minutes, minutes alone under an hour, and 0m under a minute', () => {
    expect(formatDuration(64 * 60_000 + 59_000)).toBe('1h 4m')
    expect(formatDuration(48 * 60_000 + 30_000)).toBe('48m')
    expect(formatDuration(59_000)).toBe('0m')
  })
})
