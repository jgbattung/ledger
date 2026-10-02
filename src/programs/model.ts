import { newId } from '@/db/ids'
import { getExerciseById } from '@/exercises/catalog'
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

/** Custom exercises do not exist yet (LG-007), so they get a fixed label. */
export function exerciseName(ref: ExerciseRef): string {
  if (ref.source === 'db') return getExerciseById(ref.exerciseId)?.name ?? 'Custom exercise'
  return 'Custom exercise'
}
