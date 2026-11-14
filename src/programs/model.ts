import { newId } from '@/db/ids'
import { getExerciseById } from '@/exercises/catalog'
import { formatSeconds } from '@/lib/format'
import { getCustomExercise } from '@/stores/customExerciseStore'
import type { ExerciseRef } from '@/db/types'
import type { ProgramTree } from '@/db/repos/programs'

/**
 * In-memory shapes for the program editor. Every row carries its final id
 * from the start (`newId()` for new rows), so `programs.saveTree` can upsert
 * by id.
 */
export type DraftExercise = {
  id: string
  exerciseRef: ExerciseRef
  workingSets?: number
  repMin?: number
  repMax?: number
  rirTarget?: number
  restSeconds?: number
  warmupSetCount?: number
  notes?: string
}

export type ExerciseTargets = Pick<
  DraftExercise,
  'workingSets' | 'repMin' | 'repMax' | 'rirTarget' | 'restSeconds' | 'warmupSetCount' | 'notes'
>

export type DraftDay = {
  id: string
  name: string
  notes?: string
  exercises: DraftExercise[]
}

export type ProgramDraft = {
  id: string
  isNew: boolean
  name: string
  notes?: string
  isActive: boolean
  isArchived: boolean
  days: DraftDay[]
}

export const NEW_PROGRAM_NAME = 'New program'

/** A day with zero exercises is a rest day (Q8). Derived, never stored. */
export function isRestDay(day: { exercises: unknown[] }): boolean {
  return day.exercises.length === 0
}

/** Number of non-rest days. */
export function countWorkouts(days: { exercises: unknown[] }[]): number {
  return days.filter((day) => !isRestDay(day)).length
}

export type DayPassState = 'done' | 'next' | 'upcoming'

/** Per-day state for the current pass. Ids not in `days` are ignored. */
export function passState(
  days: { id: string }[],
  completedDayIds: readonly string[] | undefined,
): { states: DayPassState[]; nextIndex: number; doneCount: number } {
  if (days.length === 0) return { states: [], nextIndex: -1, doneCount: 0 }
  const completed = new Set(completedDayIds ?? [])
  const done = days.map((day) => completed.has(day.id))
  const doneCount = done.filter(Boolean).length
  // A full set should never be persisted (see `normalizePass`); guard anyway.
  const nextIndex = doneCount === days.length ? 0 : done.indexOf(false)
  const full = doneCount === days.length
  const states = days.map((_, i): DayPassState => {
    if (i === nextIndex) return 'next'
    return !full && done[i] ? 'done' : 'upcoming'
  })
  return { states, nextIndex, doneCount }
}

/** Canonical persisted form after any change. */
export function normalizePass(
  dayIds: string[],
  completedDayIds: readonly string[],
): { completedDayIds: string[]; currentDayIndex: number; passCompleted: boolean } {
  if (dayIds.length === 0) return { completedDayIds: [], currentDayIndex: 0, passCompleted: false }
  const completed = new Set(completedDayIds)
  const kept = dayIds.filter((id) => completed.has(id))
  if (kept.length === dayIds.length) {
    return { completedDayIds: [], currentDayIndex: 0, passCompleted: true }
  }
  return {
    completedDayIds: kept,
    currentDayIndex: dayIds.findIndex((id) => !completed.has(id)),
    passCompleted: false,
  }
}

/** The undone day the user lands on after `fromIndex` is done (wraps; new pass -> 0). */
export function dayAfter(
  dayIds: string[],
  completedDayIds: readonly string[],
  fromIndex: number,
): number {
  const completed = new Set(completedDayIds)
  if (dayIds[fromIndex] !== undefined) completed.add(dayIds[fromIndex])
  for (let step = 1; step <= dayIds.length; step++) {
    const index = (fromIndex + step) % dayIds.length
    if (!completed.has(dayIds[index])) return index
  }
  return 0
}

/**
 * The first workout (non-rest) day at or after the pass's up-next day,
 * wrapping. Null when the program has no workout day.
 */
export function nextWorkoutDay<T extends { id: string; exercises: unknown[] }>(
  days: T[],
  completedDayIds: readonly string[] | undefined,
): T | null {
  const { nextIndex } = passState(days, completedDayIds)
  if (nextIndex === -1) return null
  for (let step = 0; step < days.length; step++) {
    const day = days[(nextIndex + step) % days.length]
    if (!isRestDay(day)) return day
  }
  return null
}

export function nextDayName(days: unknown[]): string {
  return `Day ${days.length + 1}`
}

export function emptyDraft(): ProgramDraft {
  return {
    id: newId(),
    isNew: true,
    name: NEW_PROGRAM_NAME,
    isActive: false,
    isArchived: false,
    days: [{ id: newId(), name: 'Day 1', exercises: [] }],
  }
}

export function programTreeToDraft(tree: ProgramTree): ProgramDraft {
  const { program } = tree
  return {
    id: program.id,
    isNew: false,
    name: program.name,
    notes: program.notes,
    isActive: program.isActive,
    isArchived: program.isArchived,
    days: [...tree.days]
      .sort((a, b) => a.day.orderIndex - b.day.orderIndex)
      .map(({ day, exercises }) => ({
        id: day.id,
        name: day.name,
        notes: day.notes,
        exercises: [...exercises]
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((exercise) => ({
            id: exercise.id,
            exerciseRef: exercise.exerciseRef,
            workingSets: exercise.workingSets,
            repMin: exercise.repMin,
            repMax: exercise.repMax,
            rirTarget: exercise.rirTarget,
            restSeconds: exercise.restSeconds,
            warmupSetCount: exercise.warmupSetCount,
            notes: exercise.notes,
          })),
      })),
  }
}

/** Display name for a ref. Custom refs read the in-memory store, deleted rows
 * included, so a deleted exercise keeps its real name. */
export function exerciseName(ref: ExerciseRef): string {
  if (ref.source === 'db') return getExerciseById(ref.exerciseId)?.name ?? 'Custom exercise'
  return getCustomExercise(ref.exerciseId)?.name ?? 'Custom exercise'
}

/** True only for a custom ref whose row has been soft-deleted. */
export function isDeletedExercise(ref: ExerciseRef): boolean {
  return ref.source === 'custom' && getCustomExercise(ref.exerciseId)?.deletedAt != null
}

/** An exercise is activatable once sets and both rep bounds are set (LG-052). */
export function hasRequiredTargets(e: {
  workingSets?: number
  repMin?: number
  repMax?: number
}): boolean {
  return e.workingSets !== undefined && e.repMin !== undefined && e.repMax !== undefined
}

/** First exercise (day order, then exercise order) missing required targets. */
export function firstIncompleteExercise(draft: {
  days: DraftDay[]
}): { dayId: string; exerciseId: string } | null {
  for (const day of draft.days) {
    for (const exercise of day.exercises) {
      if (!hasRequiredTargets(exercise)) return { dayId: day.id, exerciseId: exercise.id }
    }
  }
  return null
}

/** Row summary such as "3 × 8–12 · RIR 0 · rest 2:30"; null while incomplete. */
export function formatTargets(e: ExerciseTargets): string | null {
  if (!hasRequiredTargets(e)) return null
  const reps = e.repMin === e.repMax ? `${e.repMin}` : `${e.repMin}–${e.repMax}`
  let out = `${e.workingSets} × ${reps} · RIR ${e.rirTarget ?? 0}`
  if (e.restSeconds !== undefined) out += ` · rest ${formatSeconds(e.restSeconds)}`
  return out
}

/**
 * Timer-style rest entry: digits fill `mm ss` from the right, last 4 digits
 * kept ("230" -> 2:30 -> 150, "90" -> 0:90 -> 90).
 */
export function restDigitsToSeconds(digits: string): number | undefined {
  const kept = digits.replace(/\D/g, '').slice(-4)
  if (kept === '') return undefined
  const padded = kept.padStart(4, '0')
  return Number(padded.slice(0, 2)) * 60 + Number(padded.slice(2))
}

/** Inverse of `restDigitsToSeconds` for seeding the field (150 -> "230"). */
export function secondsToRestDigits(seconds: number | undefined): string {
  if (seconds === undefined) return ''
  const digits = String(Math.floor(seconds / 60) * 100 + (seconds % 60))
  return digits
}
