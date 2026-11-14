import { db } from '@/db/ledger'
import { now } from '@/db/ids'
import { createRepo } from '@/db/repos/base'
import { programDays } from '@/db/repos/programDays'
import { programExercises } from '@/db/repos/programExercises'
import { markDirty } from '@/db/repos/syncState'
import { firstIncompleteExercise, hasRequiredTargets, normalizePass } from '@/programs/model'
import type { ProgramDraft } from '@/programs/model'
import type { BaseRecord, ExerciseRef, Program, ProgramDay, ProgramExercise } from '@/db/types'

const MISSING_TARGETS = 'Programs with missing targets cannot be activated'

const baseRepo = createRepo<Program>(db.programs, 'programs')

export type ProgramTree = {
  program: Program
  days: { day: ProgramDay; exercises: ProgramExercise[] }[]
}

/** Shallow-compare helper: `undefined` equals "absent", objects compare by JSON. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null && b == null) return true
  if (typeof a === 'object' && typeof b === 'object' && a && b) {
    return JSON.stringify(a) === JSON.stringify(b)
  }
  return false
}

function hasChanged<T extends BaseRecord>(existing: T, fields: Partial<T>): boolean {
  return (Object.keys(fields) as (keyof T)[]).some((key) => !sameValue(existing[key], fields[key]))
}

/**
 * Deactivates every active program except `keepId`. Runs inside the caller's
 * transaction (programs + syncState).
 */
async function deactivateOthers(keepId: string, timestamp: number): Promise<void> {
  // IndexedDB keys cannot be boolean, so a boolean-valued index cannot be
  // queried via where(); filter() scans instead.
  const active = await db.programs.filter((program) => program.isActive).toArray()
  for (const program of active) {
    if (program.id === keepId) continue
    await db.programs.update(program.id, { isActive: false, updatedAt: timestamp })
    await markDirty('programs', program.id)
  }
}

async function patchLiveProgram(id: string, patch: Partial<Program>): Promise<void> {
  await db.transaction('rw', db.programs, db.syncState, async () => {
    const program = await db.programs.get(id)
    if (!program || program.deletedAt != null) return
    await db.programs.update(id, { ...patch, updatedAt: now() })
    await markDirty('programs', id)
  })
}

/**
 * Applies `change` to a program's completed-day list inside one transaction.
 * No-ops (no write, no markDirty) when the list would not change.
 */
async function changePass(
  id: string,
  dayId: string,
  change: (completed: string[]) => string[] | null,
): Promise<void> {
  await db.transaction('rw', [db.programs, db.programDays, db.syncState], async () => {
    const program = await db.programs.get(id)
    if (!program || program.deletedAt != null) throw new Error('Program not found')
    const days = (await db.programDays.where('programId').equals(id).toArray())
      .filter((day) => day.deletedAt == null)
      .sort((a, b) => a.orderIndex - b.orderIndex)
    const dayIds = days.map((day) => day.id)
    if (!dayIds.includes(dayId)) throw new Error('Day not found')

    const next = change(program.completedDayIds ?? [])
    if (!next) return
    const pass = normalizePass(dayIds, next)
    if (pass.passCompleted) {
      // LG-024: increment currentCycleIndex here.
    }
    await db.programs.update(id, {
      completedDayIds: pass.completedDayIds,
      currentDayIndex: pass.currentDayIndex,
      updatedAt: now(),
    })
    await markDirty('programs', id)
  })
}

/**
 * Adds the single-active-program rule and the program-tree operations on top
 * of the base repo. Program operations never open a transaction that includes
 * workouts, workoutExercises or sets: logged history is never written here.
 */
export const programs = {
  ...baseRepo,

  async setActive(id: string): Promise<void> {
    await db.transaction(
      'rw',
      [db.programs, db.programDays, db.programExercises, db.syncState],
      async () => {
        const target = await db.programs.get(id)
        if (!target || target.deletedAt != null) throw new Error('Program not found')
        if (target.isArchived) throw new Error('Archived programs cannot be activated')

        const days = await db.programDays.where('programId').equals(id).toArray()
        const dayIds = days.filter((day) => day.deletedAt == null).map((day) => day.id)
        const exercises =
          dayIds.length > 0
            ? await db.programExercises.where('programDayId').anyOf(dayIds).toArray()
            : []
        if (!exercises.filter((e) => e.deletedAt == null).every(hasRequiredTargets)) {
          throw new Error(MISSING_TARGETS)
        }

        const timestamp = now()
        await deactivateOthers(id, timestamp)
        await db.programs.update(id, { isActive: true, updatedAt: timestamp })
        await markDirty('programs', id)
      },
    )
  },

  async deactivate(id: string): Promise<void> {
    await patchLiveProgram(id, { isActive: false })
  },

  async archive(id: string): Promise<void> {
    await patchLiveProgram(id, { isArchived: true, isActive: false })
  },

  async unarchive(id: string): Promise<void> {
    await patchLiveProgram(id, { isArchived: false })
  },

  /** Marks a day done in the current pass. Idempotent; finishing the pass starts a new one. */
  async completeDay(id: string, dayId: string): Promise<void> {
    await changePass(id, dayId, (completed) =>
      completed.includes(dayId) ? null : [...completed, dayId],
    )
  },

  /** Unticks a day in the current pass. Idempotent. */
  async uncompleteDay(id: string, dayId: string): Promise<void> {
    await changePass(id, dayId, (completed) =>
      completed.includes(dayId) ? completed.filter((d) => d !== dayId) : null,
    )
  },

  async listLive(): Promise<Program[]> {
    return baseRepo.list()
  },

  async loadTree(id: string): Promise<ProgramTree | undefined> {
    const program = await baseRepo.get(id)
    if (!program) return undefined
    const days = await programDays.listByProgram(id)
    return {
      program,
      days: await Promise.all(
        days.map(async (day) => ({ day, exercises: await programExercises.listByDay(day.id) })),
      ),
    }
  },

  async listTrees(): Promise<ProgramTree[]> {
    const live = await baseRepo.list()
    const trees = await Promise.all(live.map((program) => programs.loadTree(program.id)))
    return trees.filter((tree): tree is ProgramTree => tree !== undefined)
  },

  /** Names (alphabetical) of the non-deleted, non-archived programs that use an exercise. */
  async namesUsingExercise(ref: ExerciseRef): Promise<string[]> {
    const trees = await programs.listTrees()
    return trees
      .filter(
        (tree) =>
          !tree.program.isArchived &&
          tree.days.some((day) =>
            day.exercises.some(
              (e) => e.exerciseRef.source === ref.source && e.exerciseRef.exerciseId === ref.exerciseId,
            ),
          ),
      )
      .map((tree) => tree.program.name)
      .sort((a, b) => a.localeCompare(b))
  },

  /**
   * Persists a whole program draft in ONE transaction. Upserts by draft id
   * with `orderIndex` = array index, writes only rows whose persisted fields
   * changed, soft-deletes removed days/exercises and never writes `isRestDay`.
   */
  async saveTree(draft: ProgramDraft, opts: { activate?: boolean } = {}): Promise<string> {
    await db.transaction(
      'rw',
      [db.programs, db.programDays, db.programExercises, db.syncState],
      async () => {
        const timestamp = now()
        const existingProgram = await db.programs.get(draft.id)
        if (existingProgram && existingProgram.deletedAt != null) {
          throw new Error('Program not found')
        }
        if (opts.activate && (draft.isArchived || existingProgram?.isArchived)) {
          throw new Error('Archived programs cannot be activated')
        }
        if (opts.activate && firstIncompleteExercise(draft)) throw new Error(MISSING_TARGETS)

        // Program row. Flags on an existing row change only via the
        // lifecycle methods or `activate`, never from a possibly stale draft.
        if (!existingProgram) {
          await db.programs.put({
            id: draft.id,
            createdAt: timestamp,
            updatedAt: timestamp,
            deletedAt: null,
            name: draft.name,
            notes: draft.notes,
            isActive: false,
            isArchived: false,
            currentDayIndex: 0,
            completedDayIds: [],
            currentCycleIndex: 0,
          })
          await markDirty('programs', draft.id)
        } else if (hasChanged(existingProgram, { name: draft.name, notes: draft.notes })) {
          await db.programs.put({
            ...existingProgram,
            name: draft.name,
            notes: draft.notes,
            updatedAt: timestamp,
          })
          await markDirty('programs', draft.id)
        }

        if (opts.activate) {
          await deactivateOthers(draft.id, timestamp)
          await db.programs.update(draft.id, { isActive: true, updatedAt: timestamp })
          await markDirty('programs', draft.id)
        }

        // Days.
        const existingDays = await db.programDays.where('programId').equals(draft.id).toArray()
        const existingDayById = new Map(existingDays.map((day) => [day.id, day]))
        const draftDayIds = new Set(draft.days.map((day) => day.id))

        for (const [dayIndex, day] of draft.days.entries()) {
          const fields = {
            programId: draft.id,
            orderIndex: dayIndex,
            name: day.name,
            notes: day.notes,
            deletedAt: null,
          }
          const existing = existingDayById.get(day.id)
          if (!existing) {
            await db.programDays.put({ id: day.id, createdAt: timestamp, updatedAt: timestamp, ...fields })
            await markDirty('programDays', day.id)
          } else if (hasChanged(existing, fields)) {
            await db.programDays.put({ ...existing, ...fields, updatedAt: timestamp })
            await markDirty('programDays', day.id)
          }
        }

        // Exercises (including those of removed days).
        const existingDayIds = existingDays.map((day) => day.id)
        const existingExercises =
          existingDayIds.length > 0
            ? await db.programExercises.where('programDayId').anyOf(existingDayIds).toArray()
            : []
        const existingExerciseById = new Map(existingExercises.map((ex) => [ex.id, ex]))
        const draftExerciseIds = new Set<string>()

        for (const day of draft.days) {
          for (const [exerciseIndex, exercise] of day.exercises.entries()) {
            draftExerciseIds.add(exercise.id)
            const fields = {
              programDayId: day.id,
              orderIndex: exerciseIndex,
              exerciseRef: exercise.exerciseRef,
              workingSets: exercise.workingSets,
              repMin: exercise.repMin,
              repMax: exercise.repMax,
              rirTarget: exercise.rirTarget,
              restSeconds: exercise.restSeconds,
              warmupSetCount: exercise.warmupSetCount,
              notes: exercise.notes,
              deletedAt: null,
            }
            const existing = existingExerciseById.get(exercise.id)
            if (!existing) {
              await db.programExercises.put({
                id: exercise.id,
                createdAt: timestamp,
                updatedAt: timestamp,
                ...fields,
              })
              await markDirty('programExercises', exercise.id)
            } else if (hasChanged(existing, fields)) {
              await db.programExercises.put({ ...existing, ...fields, updatedAt: timestamp })
              await markDirty('programExercises', exercise.id)
            }
          }
        }

        for (const exercise of existingExercises) {
          if (exercise.deletedAt != null || draftExerciseIds.has(exercise.id)) continue
          await db.programExercises.update(exercise.id, { deletedAt: timestamp, updatedAt: timestamp })
          await markDirty('programExercises', exercise.id)
        }
        for (const day of existingDays) {
          if (day.deletedAt != null || draftDayIds.has(day.id)) continue
          await db.programDays.update(day.id, { deletedAt: timestamp, updatedAt: timestamp })
          await markDirty('programDays', day.id)
        }

        // Progress follows the day list: removed days drop out, reordering
        // moves the pointer, and removing the last undone day ends the pass.
        // A done rest day that gains exercises loses its tick: a workout tick
        // always means a logged workout. The reverse keeps the tick.
        const savedProgram = await db.programs.get(draft.id)
        if (savedProgram) {
          const daysWithExercises = new Set(
            existingExercises.filter((ex) => ex.deletedAt == null).map((ex) => ex.programDayId),
          )
          const becameWorkout = new Set(
            draft.days
              .filter(
                (day) =>
                  existingDayById.has(day.id) &&
                  !daysWithExercises.has(day.id) &&
                  day.exercises.length > 0,
              )
              .map((day) => day.id),
          )
          const pass = normalizePass(
            draft.days.map((day) => day.id),
            (savedProgram.completedDayIds ?? []).filter((id) => !becameWorkout.has(id)),
          )
          if (pass.passCompleted) {
            // LG-024: increment currentCycleIndex here.
          }
          if (
            !sameValue(savedProgram.completedDayIds ?? [], pass.completedDayIds) ||
            savedProgram.currentDayIndex !== pass.currentDayIndex
          ) {
            await db.programs.update(draft.id, {
              completedDayIds: pass.completedDayIds,
              currentDayIndex: pass.currentDayIndex,
              updatedAt: timestamp,
            })
            await markDirty('programs', draft.id)
          }
        }
      },
    )
    return draft.id
  },

  /** Soft-deletes the program, its days and exercises. Never touches workout history. */
  async softDeleteCascade(id: string): Promise<void> {
    await db.transaction(
      'rw',
      [db.programs, db.programDays, db.programExercises, db.syncState],
      async () => {
        const program = await db.programs.get(id)
        if (!program || program.deletedAt != null) return
        const timestamp = now()

        const days = await db.programDays.where('programId').equals(id).toArray()
        const dayIds = days.map((day) => day.id)
        const exercises =
          dayIds.length > 0
            ? await db.programExercises.where('programDayId').anyOf(dayIds).toArray()
            : []

        for (const exercise of exercises) {
          if (exercise.deletedAt != null) continue
          await db.programExercises.update(exercise.id, { deletedAt: timestamp, updatedAt: timestamp })
          await markDirty('programExercises', exercise.id)
        }
        for (const day of days) {
          if (day.deletedAt != null) continue
          await db.programDays.update(day.id, { deletedAt: timestamp, updatedAt: timestamp })
          await markDirty('programDays', day.id)
        }
        await db.programs.update(id, { deletedAt: timestamp, updatedAt: timestamp, isActive: false })
        await markDirty('programs', id)
      },
    )
  },
}
