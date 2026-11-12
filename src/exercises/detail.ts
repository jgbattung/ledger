/**
 * One view model for the exercise detail page (LG-006). A bundled (`db`)
 * and a custom exercise both resolve into `ExerciseDetail`, so the page has
 * a single layout by construction. Optional fields are left empty, never
 * invented; the UI omits what is empty.
 */
import { customExercises } from '@/db/repos'
import { getExerciseById } from '@/exercises/catalog'
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
  /** Catalog only. */
  category?: string
  /** Catalog only. */
  mechanic?: string
  /** Catalog only. */
  instructions: string[]
  /** Catalog only (paths under public/exercises/). */
  images: string[]
  /** Custom only. */
  notes?: string
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
    }
  }
  if (ref.source === 'custom') {
    const row = await customExercises.get(ref.exerciseId)
    if (!row) return undefined
    return {
      ref,
      name: row.name,
      isCustom: true,
      aliases: [],
      primaryMuscles: row.primaryMuscles,
      secondaryMuscles: row.secondaryMuscles,
      equipment: row.equipmentTag,
      instructions: [],
      images: [],
      notes: row.notes,
    }
  }
  return undefined
}
