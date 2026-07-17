/**
 * Pure, dataset-derived search/filter logic for the exercise library
 * (LG-005). No React, no Dexie - operates entirely over the in-memory
 * catalog from `catalog.ts`. Filter vocabularies (muscles/categories/
 * equipment) are derived from the bundled dataset at runtime so
 * re-vendoring `exercises.json` never desyncs the UI.
 */
import { getAllExercises } from './catalog'
import type { Exercise } from './types'

export type LibraryFilters = {
  muscle: string | null
  category: string | null
  equipment: string | null
}

export type FilterOptions = {
  muscles: string[]
  categories: string[]
  equipment: string[]
}

let filterOptions: FilterOptions | null = null

export function getFilterOptions(): FilterOptions {
  if (!filterOptions) {
    const muscles = new Set<string>()
    const categories = new Set<string>()
    const equipment = new Set<string>()

    for (const exercise of getAllExercises()) {
      for (const muscle of exercise.primaryMuscles) {
        muscles.add(muscle)
      }
      categories.add(exercise.category)
      if (exercise.equipment) {
        equipment.add(exercise.equipment)
      }
    }

    filterOptions = {
      muscles: [...muscles].sort(),
      categories: [...categories].sort(),
      equipment: [...equipment].sort(),
    }
  }
  return filterOptions
}

type IndexedExercise = { exercise: Exercise; nameLower: string }

let searchIndex: IndexedExercise[] | null = null

function getSearchIndex(): IndexedExercise[] {
  if (!searchIndex) {
    searchIndex = getAllExercises().map((exercise) => ({
      exercise,
      nameLower: exercise.name.toLowerCase(),
    }))
  }
  return searchIndex
}

export function filterExercises(query: string, filters: LibraryFilters): Exercise[] {
  const normalizedQuery = query.trim().toLowerCase()

  return getSearchIndex()
    .filter(({ exercise, nameLower }) => {
      if (normalizedQuery && !nameLower.includes(normalizedQuery)) return false
      if (filters.muscle && !(exercise.primaryMuscles as string[]).includes(filters.muscle))
        return false
      if (filters.category && exercise.category !== filters.category) return false
      if (filters.equipment && exercise.equipment !== filters.equipment) return false
      return true
    })
    .map(({ exercise }) => exercise)
}

/** Display-only Title-case formatting for filter values. Never feed the
 * result back into `filterExercises` - matching always uses raw dataset
 * values. */
export function formatFilterValue(value: string): string {
  return value
    .split(' ')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ')
}
