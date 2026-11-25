import { canCheck } from '@/workouts/model'
import type { Set as SetRecord, Workout, WorkoutExercise } from '@/db/types'

type SessionLike = {
  workout: Workout
  exercises: { exercise: WorkoutExercise; sets: SetRecord[] }[]
}

/** What the edit page holds in memory: exercises and sets in display order. */
export type WorkoutEditDraft = {
  notes?: string
  exercises: { exercise: WorkoutExercise; sets: SetRecord[] }[]
}

type Stamps = 'createdAt' | 'updatedAt' | 'deletedAt'

/**
 * One row write. The repo adds the timestamps: `updatedAt` on every write,
 * `createdAt` on a create and `deletedAt` on a soft delete. In `update`, a
 * field whose value is `undefined` is removed from the row.
 */
export type EditWrite =
  | { table: 'workouts'; op: 'update'; id: string; fields: Partial<Pick<Workout, 'notes'>> }
  | { table: 'workoutExercises'; op: 'create'; row: Omit<WorkoutExercise, Stamps> }
  | {
      table: 'workoutExercises'
      op: 'update'
      id: string
      fields: Partial<Pick<WorkoutExercise, 'orderIndex' | 'notes'>>
    }
  | { table: 'workoutExercises'; op: 'delete'; id: string }
  | { table: 'sets'; op: 'create'; row: Omit<SetRecord, Stamps> }
  | { table: 'sets'; op: 'update'; id: string; fields: Partial<SetRecord> }
  | { table: 'sets'; op: 'delete'; id: string }

const LOGGED_FIELDS = ['weight', 'reps', 'partialReps', 'unilateral', 'rir', 'rirIsPlus'] as const

/** Structural equality that ignores key order and keys holding `undefined`. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = new Set([...Object.keys(left), ...Object.keys(right)])
  for (const key of keys) if (!same(left[key], right[key])) return false
  return true
}

const blank = (value: string | undefined) => (value === '' ? undefined : value)

/**
 * The writes that turn the stored finished workout into the draft. Unchanged
 * rows produce no write. Draft sets without reps are dropped, the rest are
 * renumbered 0..n-1, and new sets are stamped `completedAt = finishedAt`.
 */
export function planEdit(
  stored: SessionLike,
  draft: WorkoutEditDraft,
  finishedAt: number,
): EditWrite[] {
  const writes: EditWrite[] = []
  const workoutId = stored.workout.id

  if (blank(draft.notes) !== blank(stored.workout.notes)) {
    writes.push({
      table: 'workouts',
      op: 'update',
      id: workoutId,
      fields: { notes: blank(draft.notes) },
    })
  }

  const draftIds = new Set(draft.exercises.map((entry) => entry.exercise.id))
  for (const { exercise, sets } of stored.exercises) {
    if (draftIds.has(exercise.id)) continue
    writes.push({ table: 'workoutExercises', op: 'delete', id: exercise.id })
    for (const set of sets) writes.push({ table: 'sets', op: 'delete', id: set.id })
  }

  const storedById = new Map(stored.exercises.map((entry) => [entry.exercise.id, entry]))
  for (const [position, entry] of draft.exercises.entries()) {
    const { exercise } = entry
    const existing = storedById.get(exercise.id)

    if (!existing) {
      writes.push({
        table: 'workoutExercises',
        op: 'create',
        row: {
          id: exercise.id,
          workoutId,
          orderIndex: position,
          exerciseRef: exercise.exerciseRef,
          ...(blank(exercise.notes) !== undefined && { notes: exercise.notes }),
        },
      })
    } else {
      const fields: Partial<Pick<WorkoutExercise, 'orderIndex' | 'notes'>> = {}
      if (existing.exercise.orderIndex !== position) fields.orderIndex = position
      if (blank(existing.exercise.notes) !== blank(exercise.notes)) fields.notes = blank(exercise.notes)
      if (Object.keys(fields).length > 0) {
        writes.push({ table: 'workoutExercises', op: 'update', id: exercise.id, fields })
      }
    }

    const kept = entry.sets.filter(canCheck)
    const keptIds = new Set(kept.map((set) => set.id))
    const storedSets = new Map((existing?.sets ?? []).map((set) => [set.id, set]))

    for (const set of existing?.sets ?? []) {
      if (!keptIds.has(set.id)) writes.push({ table: 'sets', op: 'delete', id: set.id })
    }
    for (const [index, set] of kept.entries()) {
      const before = storedSets.get(set.id)
      if (!before) {
        const { createdAt: _c, updatedAt: _u, deletedAt: _d, ...row } = set
        writes.push({
          table: 'sets',
          op: 'create',
          row: { ...row, workoutExerciseId: exercise.id, orderIndex: index, completedAt: finishedAt },
        })
        continue
      }
      const fields: Partial<SetRecord> = {}
      for (const key of LOGGED_FIELDS) {
        if (!same(before[key], set[key])) (fields as Record<string, unknown>)[key] = set[key]
      }
      if (before.orderIndex !== index) fields.orderIndex = index
      if (Object.keys(fields).length > 0) {
        writes.push({ table: 'sets', op: 'update', id: set.id, fields })
      }
    }
  }

  return writes
}
