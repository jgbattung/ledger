import type { ExerciseRef, Set as SetRecord, Unit } from '@/db/types'
import type { WorkoutSession } from '@/db/repos'
import { getExerciseById } from '@/exercises/catalog'
import type { Muscle } from '@/exercises/types'
import { getCustomExercise } from '@/stores/customExerciseStore'
import { formatReps, fromUnilateral, workoutElapsedMs } from '@/workouts/model'
import { formatWeight, toDisplay } from '@/workouts/units'

export type WorkoutSummary = {
  /** Checked working sets. */
  workingSets: number
  /** Sum of weight x reps of those sets, kg, full precision (round only for display). */
  volumeKg: number
  /** Active workout time (paused time excluded). */
  durationMs: number
  /** +1 per working set to each PRIMARY muscle of its exercise. */
  setsByMuscle: Partial<Record<Muscle, number>>
}

/** Primary muscles of a bundled or custom exercise; [] when it cannot be resolved. */
export function primaryMusclesOf(ref: ExerciseRef): Muscle[] {
  const exercise =
    ref.source === 'db' ? getExerciseById(ref.exerciseId) : getCustomExercise(ref.exerciseId)
  return exercise?.primaryMuscles ?? []
}

/**
 * Totals for one workout. A set counts when it is a checked working set
 * (warm-ups never count). L/R sets count once at their stored LOG-6
 * aggregate on `weight`/`reps`; partial reps never add volume.
 */
export function summarizeWorkout(
  session: WorkoutSession,
  musclesOf: (ref: ExerciseRef) => Muscle[],
  now: number,
): WorkoutSummary {
  let workingSets = 0
  let volumeKg = 0
  const setsByMuscle: Partial<Record<Muscle, number>> = {}

  for (const { exercise, sets } of session.exercises) {
    const counted = sets.filter((set) => set.type === 'working' && set.completedAt != null)
    if (counted.length === 0) continue
    workingSets += counted.length
    for (const set of counted) volumeKg += set.weight * set.reps
    for (const muscle of musclesOf(exercise.exerciseRef)) {
      setsByMuscle[muscle] = (setsByMuscle[muscle] ?? 0) + counted.length
    }
  }

  return {
    workingSets,
    volumeKg,
    durationMs: workoutElapsedMs(session.workout, session.workout.finishedAt ?? now),
    setsByMuscle,
  }
}

const volumeFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** "3,800": whole number with grouping. The unit is rendered separately. */
export function formatVolume(kg: number, unit: Unit): string {
  return volumeFormat.format(toDisplay(kg, unit))
}

/** "1h 4m", "48m", "0m": whole minutes, floored. */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60000)
  const hours = Math.floor(minutes / 60)
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`
}

export type HeatStep = 0 | 1 | 2 | 3

/** Map shading step for a muscle's working sets: 0, 1-3, 4-6, 7+. */
export function heatStep(sets: number): HeatStep {
  if (sets <= 0) return 0
  if (sets <= 3) return 1
  if (sets <= 6) return 2
  return 3
}

export type SetRuns = {
  /** "L/R " when the exercise is unilateral. */
  prefix?: string
  runs: { weight: string; reps: { full: string; partial?: string }[] }[]
}

/**
 * Share-card set lines. Checked working sets in order; consecutive sets with
 * the same weight (as displayed) form one run ("80 × 8, 8, 7|2"), a weight change starts a
 * new run (the card joins runs with " · "). Unilateral exercises use each
 * set's stored aggregate and get the "L/R " prefix. No unit.
 */
export function formatSetRuns(sets: SetRecord[], unit: Unit): SetRuns {
  const counted = sets.filter((set) => set.type === 'working' && set.completedAt != null)
  const result: SetRuns = { runs: [] }
  if (counted.some((set) => set.unilateral)) result.prefix = 'L/R '
  for (const original of counted) {
    const set = fromUnilateral(original)
    const weight = formatWeight(set.weight, unit)
    const reps = formatReps(set.reps, set.partialReps)
    const last = result.runs[result.runs.length - 1]
    if (last && last.weight === weight) last.reps.push(reps)
    else result.runs.push({ weight, reps: [reps] })
  }
  return result
}
