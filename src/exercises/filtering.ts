/**
 * Pure, dataset-derived search/filter logic for the exercise library
 * (LG-005). No React, no Dexie - operates entirely over the in-memory
 * catalog from `catalog.ts`. Filter vocabularies (muscles/categories/
 * equipment) are derived from the bundled dataset at runtime so
 * re-curating `exercises.json` never desyncs the UI.
 *
 * Search (LG-047 baseline; LG-048 builds ranking/fuzziness on top): the
 * query is normalized (lowercase, hyphens/slashes -> space, collapse
 * whitespace) and matched as a substring against the canonical name and
 * every alias, normalized the same way.
 */
import { getAllExercises } from './catalog'
import type { Exercise, Muscle } from './types'

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

/** Lowercase, `[-/]` -> space, collapse whitespace, trim. Applied to both
 * the query and every candidate name/alias so hyphen/spacing variants
 * ("pull-up", "pull ups") match regardless of which side has the dash. */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

type IndexedExercise = { exercise: Exercise; normalizedNames: string[] }

let searchIndex: IndexedExercise[] | null = null

function getSearchIndex(): IndexedExercise[] {
  if (!searchIndex) {
    searchIndex = getAllExercises().map((exercise) => ({
      exercise,
      normalizedNames: [exercise.name, ...exercise.aliases].map(normalize),
    }))
  }
  return searchIndex
}

export function filterExercises(query: string, filters: LibraryFilters): Exercise[] {
  const normalizedQuery = normalize(query)

  return getSearchIndex()
    .filter(({ exercise, normalizedNames }) => {
      if (normalizedQuery && !normalizedNames.some((n) => n.includes(normalizedQuery))) return false
      if (filters.muscle && !exercise.primaryMuscles.includes(filters.muscle as Muscle))
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
