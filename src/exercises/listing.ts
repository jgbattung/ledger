/**
 * The shape every exercise list (Library, both pickers, the picker tray)
 * renders: a bundled or a custom exercise with its `ExerciseRef`, so callers
 * never assume `source: 'db'`.
 */
import type { ExerciseRef } from '@/db/types'
import type { Category, Equipment, Mechanic, Muscle } from './types'

export type ListedExercise = {
  ref: ExerciseRef
  name: string
  aliases: string[]
  primaryMuscles: Muscle[]
  secondaryMuscles: Muscle[]
  equipment?: Equipment
  category: Category
  mechanic?: Mechanic
  images: string[]
  isCustom: boolean
}

/** Stable string key for a ref (`source:exerciseId`): list keys, selection sets. */
export function refKey(ref: ExerciseRef): string {
  return `${ref.source}:${ref.exerciseId}`
}
