import { db } from '@/db/ledger'
import { newId, now } from '@/db/ids'
import { createRepo } from '@/db/repos/base'
import { markDirty } from '@/db/repos/syncState'
import { workouts } from '@/db/repos/workouts'
import { BLANK_SET, prefillFor } from '@/workouts/model'
import type { ExerciseRef, WorkoutExercise } from '@/db/types'

const baseRepo = createRepo<WorkoutExercise>(db.workoutExercises, 'workoutExercises')

export type SwapMode = 'keep' | 'reset'

export type InsertPosition =
  | { kind: 'start' }
  | { kind: 'after'; workoutExerciseId: string }
  | { kind: 'end' }

/** Thrown when removing the only exercise left in a workout. */
export class LastExerciseError extends Error {
  constructor() {
    super('A workout needs at least one exercise')
    this.name = 'LastExerciseError'
  }
}

const sameRef = (a: ExerciseRef, b: ExerciseRef) =>
  a.source === b.source && a.exerciseId === b.exerciseId

async function liveRows(workoutId: string): Promise<WorkoutExercise[]> {
  const rows = await db.workoutExercises.where('workoutId').equals(workoutId).toArray()
  return rows.filter((row) => row.deletedAt == null).sort((a, b) => a.orderIndex - b.orderIndex)
}

async function requireInProgress(workoutId: string): Promise<void> {
  const workout = await db.workouts.get(workoutId)
  if (!workout || workout.deletedAt != null) throw new Error('Workout not found')
  if (workout.status !== 'in_progress') throw new Error('Workout is not in progress')
}

/** Rewrites orderIndex 0..n-1 on the rows whose index changed (new rows arrive already numbered). */
async function renumber(rows: WorkoutExercise[], timestamp: number): Promise<void> {
  for (const [index, row] of rows.entries()) {
    if (row.orderIndex === index) continue
    await db.workoutExercises.put({ ...row, orderIndex: index, updatedAt: timestamp })
    await markDirty('workoutExercises', row.id)
  }
}

export const workoutExercises = {
  ...baseRepo,

  /** Live exercises of a workout in order. */
  async listByWorkout(workoutId: string): Promise<WorkoutExercise[]> {
    const rows = await db.workoutExercises.where('workoutId').equals(workoutId).toArray()
    return rows.filter((row) => row.deletedAt == null).sort((a, b) => a.orderIndex - b.orderIndex)
  },

  /**
   * Adds exercises to an in-progress workout at `position` (LOG-11), in pick
   * order. Each new row has no snapshot and no `swappedFrom`, and starts with
   * as many working sets as its last session (1 blank set with no history),
   * pre-filled row by row. Returns the new ids in pick order.
   */
  async insert(workoutId: string, refs: ExerciseRef[], position: InsertPosition): Promise<string[]> {
    return db.transaction('rw', db.workouts, db.workoutExercises, db.sets, db.syncState, async () => {
      await requireInProgress(workoutId)
      if (refs.length === 0) throw new Error('Pick at least one exercise')
      const existing = await liveRows(workoutId)
      for (const [i, ref] of refs.entries()) {
        if (
          existing.some((row) => sameRef(row.exerciseRef, ref)) ||
          refs.slice(0, i).some((other) => sameRef(other, ref))
        ) {
          throw new Error('Exercise is already in this workout')
        }
      }
      let at = existing.length
      if (position.kind === 'start') at = 0
      if (position.kind === 'after') {
        const anchor = existing.findIndex((row) => row.id === position.workoutExerciseId)
        if (anchor < 0) throw new Error('Exercise not found')
        at = anchor + 1
      }

      const timestamp = now()
      const created: WorkoutExercise[] = refs.map((exerciseRef, i) => ({
        id: newId(),
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
        workoutId,
        orderIndex: at + i,
        exerciseRef,
      }))
      const ordered = [...existing.slice(0, at), ...created, ...existing.slice(at)]
      await renumber(ordered, timestamp)
      for (const row of created) {
        await db.workoutExercises.put(row)
        await markDirty('workoutExercises', row.id)
        const previous = await workouts.previousSets(row.exerciseRef, workoutId)
        for (let i = 0; i < Math.max(previous.length, 1); i += 1) {
          const setId = newId()
          await db.sets.put({
            id: setId,
            createdAt: timestamp,
            updatedAt: timestamp,
            deletedAt: null,
            workoutExerciseId: row.id,
            orderIndex: i,
            type: 'working',
            ...BLANK_SET,
            ...prefillFor(previous, i),
          })
          await markDirty('sets', setId)
        }
      }
      return created.map((row) => row.id)
    })
  },

  /**
   * Removes an exercise from this workout only (soft delete of the row and its
   * sets). The last remaining exercise cannot be removed.
   */
  async remove(id: string): Promise<void> {
    await db.transaction('rw', db.workouts, db.workoutExercises, db.sets, db.syncState, async () => {
      const row = await db.workoutExercises.get(id)
      if (!row || row.deletedAt != null) throw new Error('Exercise not found')
      await requireInProgress(row.workoutId)
      const live = await liveRows(row.workoutId)
      if (live.length <= 1) throw new LastExerciseError()

      const timestamp = now()
      await db.workoutExercises.put({ ...row, deletedAt: timestamp, updatedAt: timestamp })
      await markDirty('workoutExercises', id)
      const setRows = await db.sets.where('workoutExerciseId').equals(id).toArray()
      for (const set of setRows.filter((item) => item.deletedAt == null)) {
        await db.sets.put({ ...set, deletedAt: timestamp, updatedAt: timestamp })
        await markDirty('sets', set.id)
      }
      await renumber(
        live.filter((item) => item.id !== id),
        timestamp,
      )
    })
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
          const { partialReps: _partial, unilateral: _unilateral, ...kept } = set
          const reset = { ...kept, ...BLANK_SET, ...prefillFor(previous, index), updatedAt: timestamp }
          await db.sets.put(reset)
          await markDirty('sets', set.id)
        }
      }
    })
  },
}
