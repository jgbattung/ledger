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

/** Optimal-string-alignment distance (insert, delete, substitute, adjacent
 * swap). Returns 2 as soon as the distance is known to exceed 1, since the
 * caller only distinguishes "at most 1" from "more". */
function editDistanceWithinOne(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2
  const rows: number[][] = []
  for (let i = 0; i <= a.length; i++) {
    rows.push(new Array<number>(b.length + 1).fill(0))
    rows[i][0] = i
  }
  for (let j = 0; j <= b.length; j++) rows[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let d = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, rows[i - 2][j - 2] + 1)
      }
      rows[i][j] = d
      if (d < rowMin) rowMin = d
    }
    if (rowMin > 1) return 2
  }
  return rows[a.length][b.length]
}

/** A word's plural-fold stems: itself, minus a trailing "s", and minus a
 * trailing "es", keeping only stems of 3+ letters ("presses" -> "press",
 * "flys" and "flyes" both -> "fly"). */
function stems(word: string): string[] {
  const result = [word]
  if (word.endsWith('s')) result.push(word.slice(0, -1))
  if (word.endsWith('es')) result.push(word.slice(0, -2))
  return result.filter((stem) => stem.length >= 3)
}

/** One-typo tolerance for a query word `q` against a name word `t`.
 * Edit rule: 5+ letters, same first letter, at most one edit against a
 * prefix of `t` (so a half-typed word still matches). Plural fold: a 4+
 * letter query and `t` share a stem (see `stems`), in either direction. */
function isTypoMatch(q: string, t: string): boolean {
  if (q.length >= 4) {
    const tStems = stems(t)
    if (stems(q).some((stem) => tStems.includes(stem))) return true
  }
  if (q.length < 5 || q[0] !== t[0]) return false
  for (const len of [q.length - 1, q.length, q.length + 1]) {
    const prefix = t.slice(0, Math.min(Math.max(len, 1), t.length))
    if (editDistanceWithinOne(q, prefix) <= 1) return true
  }
  return false
}

/** Best match tier of one query word against one exercise: 4 exact, 3
 * prefix, 2 substring (3+ letters, also against the space-free names),
 * 1 typo, 0 none. Cheaper tiers run first and short-circuit. */
function scoreToken(q: string, { tokens, joined }: IndexedExercise): number {
  if (tokens.includes(q)) return 4
  if (tokens.some((t) => t.startsWith(q))) return 3
  if (q.length >= 3 && (tokens.some((t) => t.includes(q)) || joined.some((j) => j.includes(q)))) {
    return 2
  }
  if (tokens.some((t) => isTypoMatch(q, t))) return 1
  return 0
}

/** Search + facet filter. Every query word must match (AND, any order);
 * with a query, results are ranked by summed match tier (ties keep catalog
 * order), with no query they stay in catalog order. */
export function filterExercises(query: string, filters: LibraryFilters): Exercise[] {
  const normalizedQuery = normalize(query)
  const queryTokens = normalizedQuery ? normalizedQuery.split(' ') : []
  const matches: { exercise: Exercise; score: number }[] = []

  for (const entry of getSearchIndex()) {
    const { exercise } = entry
    if (filters.muscle && !exercise.primaryMuscles.includes(filters.muscle as Muscle)) continue
    if (filters.category && exercise.category !== filters.category) continue
    if (filters.equipment && exercise.equipment !== filters.equipment) continue

    let score = 0
    for (const q of queryTokens) {
      const tier = scoreToken(q, entry)
      if (tier === 0) {
        score = -1
        break
      }
      score += tier
    }
    if (score >= 0) matches.push({ exercise, score })
  }

  if (queryTokens.length > 0) matches.sort((a, b) => b.score - a.score)
  return matches.map(({ exercise }) => exercise)
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
