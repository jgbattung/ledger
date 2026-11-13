/**
 * One view model for the exercise detail page (LG-006). A bundled (`db`)
 * and a custom exercise both resolve into `ExerciseDetail`, so the page has
 * a single layout by construction. Optional fields are left empty, never
 * invented; the UI omits what is empty.
 */
import { getExerciseById } from '@/exercises/catalog'
import { getCustomExercise } from '@/stores/customExerciseStore'
import type { ExerciseRef } from '@/db/types'

export type ExerciseDetail = {
  ref: ExerciseRef
  name: string
  isCustom: boolean
  aliases: string[]
  primaryMuscles: string[]
  secondaryMuscles: string[]
  /** Catalog equipment, or the custom exercise's equipment tag. */
  equipment?: string
  /** Catalog value, or always `strength` for a custom exercise. */
  category?: string
  /** Catalog value, or the custom exercise's mechanic when set. */
  mechanic?: string
  /** Catalog only. */
  instructions: string[]
  /** Catalog only (paths under public/exercises/). */
  images: string[]
  /** Custom only. */
  notes?: string
  /** A soft-deleted custom exercise; always false for a bundled one. */
  deleted: boolean
}

export function exercisePath(ref: ExerciseRef): string {
  return `/exercises/${ref.source}/${ref.exerciseId}`
}

export async function loadExerciseDetail(ref: ExerciseRef): Promise<ExerciseDetail | undefined> {
  if (ref.source === 'db') {
    const exercise = getExerciseById(ref.exerciseId)
    if (!exercise) return undefined
    return {
      ref,
      name: exercise.name,
      isCustom: false,
      aliases: exercise.aliases,
      primaryMuscles: exercise.primaryMuscles,
      secondaryMuscles: exercise.secondaryMuscles,
      equipment: exercise.equipment,
      category: exercise.category,
      mechanic: exercise.mechanic,
      instructions: exercise.instructions,
      images: exercise.images,
      deleted: false,
    }
  }
  if (ref.source === 'custom') {
    // Deleted rows still resolve: the page keeps showing history for them.
    const row = getCustomExercise(ref.exerciseId)
    if (!row) return undefined
    return {
      ref,
      name: row.name,
      isCustom: true,
      aliases: [],
      primaryMuscles: row.primaryMuscles,
      secondaryMuscles: row.secondaryMuscles,
      equipment: row.equipmentTag,
      category: 'strength',
      mechanic: row.mechanic,
      instructions: [],
      images: [],
      notes: row.notes,
      deleted: row.deletedAt != null,
    }
  }
  return undefined
}
