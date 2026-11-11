/**
 * Pure, dataset-derived search/filter logic for the exercise library
 * (LG-005). No React, no Dexie - operates entirely over the in-memory
 * catalog from `catalog.ts`. Filter vocabularies (muscles/categories/
 * equipment) are derived from the bundled dataset at runtime so
 * re-curating `exercises.json` never desyncs the UI.
 *
 * Search (LG-048): the query is normalized (lowercase, every run of
 * non-alphanumeric characters -> one space) and split into words. Each word
 * is matched against the pooled words of an exercise's canonical name and
 * aliases (see the search index below); all words must match, in any order.
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

/** Lowercase, every run of non-alphanumeric characters -> one space, trim.
 * Applied to both the query and every candidate name/alias so hyphen,
 * punctuation and spacing variants ("pull-up", "pull ups", "press (seated)")
 * compare equal regardless of which side has the separator. */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

type IndexedExercise = {
  exercise: Exercise
  /** Distinct words across the normalized name and all aliases (pooled). */
  tokens: string[]
  /** Each normalized name/alias with spaces removed ("pullups"). */
  joined: string[]
}

let searchIndex: IndexedExercise[] | null = null

function getSearchIndex(): IndexedExercise[] {
  if (!searchIndex) {
    searchIndex = getAllExercises().map((exercise) => {
      const names = [exercise.name, ...exercise.aliases].map(normalize)
      return {
        exercise,
        tokens: [...new Set(names.flatMap((n) => n.split(' ')))],
        joined: names.map((n) => n.replace(/ /g, '')),
      }
    })
  }
  return searchIndex
}

export function filterExercises(query: string, filters: LibraryFilters): Exercise[] {
  const joinedQuery = normalize(query).replace(/ /g, '')

  return getSearchIndex()
    .filter(({ exercise, joined }) => {
      if (joinedQuery && !joined.some((n) => n.includes(joinedQuery))) return false
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
