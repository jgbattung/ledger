import type { ExerciseRef } from '@/db/types'
import type { WorkoutSession } from '@/db/repos'
import { getExerciseById } from '@/exercises/catalog'
import type { Muscle } from '@/exercises/types'
import { getCustomExercise } from '@/stores/customExerciseStore'
import { workoutElapsedMs } from '@/workouts/model'

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
