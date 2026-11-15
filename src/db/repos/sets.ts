import { db } from '@/db/ledger'
import { now } from '@/db/ids'
import { createRepo } from '@/db/repos/base'
import { markDirty } from '@/db/repos/syncState'
import { workouts } from '@/db/repos/workouts'
import {
  BLANK_SET,
  canCheck,
  fromUnilateral,
  toUnilateral,
  unilateralAggregate,
} from '@/workouts/model'
import type { Set as SetRecord } from '@/db/types'

const baseRepo = createRepo<SetRecord>(db.sets, 'sets')

export type SetFields = Partial<
  Pick<SetRecord, 'weight' | 'reps' | 'partialReps' | 'unilateral' | 'rir' | 'rirIsPlus'>
>

async function liveSets(workoutExerciseId: string): Promise<SetRecord[]> {
  const rows = await db.sets.where('workoutExerciseId').equals(workoutExerciseId).toArray()
  return rows.filter((set) => set.deletedAt == null).sort((a, b) => a.orderIndex - b.orderIndex)
}

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
        const last = existing[existing.length - 1]
        const exercise = await db.workoutExercises.get(workoutExerciseId)
        const previous = exercise
          ? await workouts.previousSets(exercise.exerciseRef, exercise.workoutId)
          : []
        const sameRow = previous[existing.length]
        const unilateralMode = last ? last.unilateral != null : sameRow?.unilateral != null
        const rir = { rir: last?.rir ?? BLANK_SET.rir, rirIsPlus: last?.rirIsPlus ?? BLANK_SET.rirIsPlus }
        if (unilateralMode) {
          const sides = sameRow?.unilateral ?? {
            leftWeight: last?.unilateral?.leftWeight ?? last?.weight ?? BLANK_SET.weight,
            leftReps: 0,
            rightWeight: last?.unilateral?.rightWeight ?? last?.weight ?? BLANK_SET.weight,
            rightReps: 0,
          }
          const unilateral = {
            leftWeight: sides.leftWeight,
            leftReps: sides.leftReps,
            rightWeight: sides.rightWeight,
            rightReps: sides.rightReps,
          }
          const { weight, reps } = unilateralAggregate(unilateral)
          return baseRepo.create({
            workoutExerciseId,
            orderIndex: last ? last.orderIndex + 1 : 0,
            type: 'working',
            weight,
            reps,
            ...rir,
            unilateral,
          })
        }
        return baseRepo.create({
          workoutExerciseId,
          orderIndex: last ? last.orderIndex + 1 : 0,
          type: 'working',
          weight: sameRow?.weight ?? last?.weight ?? BLANK_SET.weight,
          reps: sameRow?.reps ?? 0,
          ...rir,
        })
      },
    )
  },

  /** Writes only the logged fields of a set. */
  async patch(id: string, fields: SetFields): Promise<void> {
    const patch: SetFields = {}
    if ('weight' in fields) patch.weight = fields.weight
    if ('reps' in fields) patch.reps = fields.reps
    if ('partialReps' in fields) patch.partialReps = fields.partialReps
    if ('unilateral' in fields) patch.unilateral = fields.unilateral
    if ('rir' in fields) patch.rir = fields.rir
    if ('rirIsPlus' in fields) patch.rirIsPlus = fields.rirIsPlus
    await baseRepo.update(id, patch)
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

  /**
   * Switches every live set of the exercise to or from L/R in one
   * transaction. Sets already in the target mode are left alone. `pending`
   * holds not-yet-written patches (by set id) from before the toggle; they are
   * applied first so the conversion sees the latest typed values.
   */
  async setUnilateral(
    workoutExerciseId: string,
    on: boolean,
    pending: ReadonlyMap<string, SetFields> = new Map(),
  ): Promise<void> {
    await db.transaction('rw', db.sets, db.syncState, async () => {
      const timestamp = now()
      for (const live of await liveSets(workoutExerciseId)) {
        const patch = pending.get(live.id)
        const set = patch ? { ...live, ...patch } : live
        const inMode = (set.unilateral != null) === on
        if (inMode && !patch) continue
        const next = inMode ? set : on ? toUnilateral(set) : fromUnilateral(set)
        await db.sets.put({ ...next, updatedAt: timestamp })
        await markDirty('sets', set.id)
      }
    })
  },
}
