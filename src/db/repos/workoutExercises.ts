import { db } from '@/db/ledger'
import { now } from '@/db/ids'
import { createRepo } from '@/db/repos/base'
import { markDirty } from '@/db/repos/syncState'
import { workouts } from '@/db/repos/workouts'
import { BLANK_SET, prefillFor } from '@/workouts/model'
import type { ExerciseRef, WorkoutExercise } from '@/db/types'

const baseRepo = createRepo<WorkoutExercise>(db.workoutExercises, 'workoutExercises')

export type SwapMode = 'keep' | 'reset'

export const workoutExercises = {
  ...baseRepo,

  /** Live exercises of a workout in order. */
  async listByWorkout(workoutId: string): Promise<WorkoutExercise[]> {
    const rows = await db.workoutExercises.where('workoutId').equals(workoutId).toArray()
    return rows.filter((row) => row.deletedAt == null).sort((a, b) => a.orderIndex - b.orderIndex)
  },

  async setNotes(id: string, notes: string): Promise<void> {
    await baseRepo.update(id, { notes })
  },

  /**
   * Swaps the exercise (LOG-10). Only allowed while none of its sets are
   * checked. `swappedFrom` always holds the originally planned exercise.
   * `reset` also clears the targets snapshot and resets the set values, pre-filled
   * row by row from the new exercise's last session (LIB-10).
   */
  async swap(id: string, newRef: ExerciseRef, mode: SwapMode): Promise<void> {
    await db.transaction('rw', db.workoutExercises, db.sets, db.workouts, db.syncState, async () => {
      const existing = await db.workoutExercises.get(id)
      if (!existing || existing.deletedAt != null) throw new Error('Exercise not found')
      const rows = await db.sets.where('workoutExerciseId').equals(id).toArray()
      const live = rows.filter((set) => set.deletedAt == null)
      if (live.some((set) => set.completedAt != null)) {
        throw new Error('Cannot swap an exercise with checked sets')
      }

      const timestamp = now()
      const next: WorkoutExercise = {
        ...existing,
        swappedFrom: existing.swappedFrom ?? existing.exerciseRef,
        exerciseRef: newRef,
        updatedAt: timestamp,
      }
      if (mode === 'reset') delete next.targetsSnapshot
      await db.workoutExercises.put(next)
      await markDirty('workoutExercises', id)

      if (mode === 'reset') {
        const previous = await workouts.previousSets(newRef, existing.workoutId)
        const ordered = [...live].sort((a, b) => a.orderIndex - b.orderIndex)
        for (const [index, set] of ordered.entries()) {
          const reset = { ...set, ...BLANK_SET, ...prefillFor(previous, index), updatedAt: timestamp }
          delete reset.partialReps
          await db.sets.put(reset)
          await markDirty('sets', set.id)
        }
      }
    })
  },
}
