import { db } from '@/db/ledger'
import { now } from '@/db/ids'
import { createRepo } from '@/db/repos/base'
import { markDirty } from '@/db/repos/syncState'
import { workouts } from '@/db/repos/workouts'
import { canCheck, nextSetFields } from '@/workouts/model'
import type { Set as SetRecord } from '@/db/types'

const baseRepo = createRepo<SetRecord>(db.sets, 'sets')

export type SetFields = Partial<
  Pick<SetRecord, 'weight' | 'reps' | 'partialReps' | 'unilateral' | 'rir' | 'rirIsPlus'>
>

async function liveSets(workoutExerciseId: string): Promise<SetRecord[]> {
  const rows = await db.sets.where('workoutExerciseId').equals(workoutExerciseId).toArray()
  return rows.filter((set) => set.deletedAt == null).sort((a, b) => a.orderIndex - b.orderIndex)
}

const LOGGED_FIELDS = ['weight', 'reps', 'partialReps', 'unilateral', 'rir', 'rirIsPlus'] as const

export const sets = {
  ...baseRepo,

  /** Live sets of a workout exercise in order. */
  listByWorkoutExercise: liveSets,

  /**
   * Appends a working set. `orderIndex` is the last live index + 1 (never the
   * row count, which collides after a removal); weight and RIR are copied
   * from the previous row and reps start blank. When last session has a row
   * at the new position, weight and reps come from it instead (LIB-10).
   */
  async add(workoutExerciseId: string): Promise<SetRecord> {
    return db.transaction(
      'rw',
      [db.sets, db.workouts, db.workoutExercises, db.syncState],
      async () => {
        const existing = await liveSets(workoutExerciseId)
        const exercise = await db.workoutExercises.get(workoutExerciseId)
        const previous = exercise
          ? await workouts.previousSets(exercise.exerciseRef, exercise.workoutId)
          : []
        return baseRepo.create({ workoutExerciseId, ...nextSetFields(existing, previous) })
      },
    )
  },

  /** Writes only the logged fields of a set. */
  async patch(id: string, fields: SetFields): Promise<void> {
    await sets.patchMany([[id, fields]])
  },

  /**
   * Writes the logged fields of several sets in one transaction, so a batch
   * (an L/R toggle, a flush) never lands half-applied. A field passed as
   * `undefined` is removed from the row, not stored as an undefined key.
   */
  async patchMany(entries: ReadonlyArray<readonly [string, SetFields]>): Promise<void> {
    if (entries.length === 0) return
    await db.transaction('rw', db.sets, db.syncState, async () => {
      const timestamp = now()
      for (const [id, fields] of entries) {
        const patch: SetFields = {}
        for (const key of LOGGED_FIELDS) if (key in fields) (patch as Record<string, unknown>)[key] = fields[key]
        await db.sets.update(id, { ...patch, updatedAt: timestamp })
        await markDirty('sets', id)
      }
    })
  },

  /** Stamps or clears `completedAt`. Completing needs at least one rep. */
  async setCompleted(id: string, completed: boolean): Promise<void> {
    await db.transaction('rw', db.sets, db.syncState, async () => {
      const set = await db.sets.get(id)
      if (!set || set.deletedAt != null) throw new Error('Set not found')
      if (completed && !canCheck(set)) throw new Error('A set needs at least 1 rep to be checked')
      const timestamp = now()
      const next = { ...set, updatedAt: timestamp }
      if (completed) next.completedAt = timestamp
      else delete next.completedAt
      await db.sets.put(next)
      await markDirty('sets', id)
    })
  },
}
