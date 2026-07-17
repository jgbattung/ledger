import { describe, it, expect } from 'vitest'
import { getAllExercises } from './catalog'
import { getFilterOptions, filterExercises, formatFilterValue, normalize } from './filtering'
import type { LibraryFilters } from './filtering'

const noFilters: LibraryFilters = { muscle: null, category: null, equipment: null }
const datasetSize = getAllExercises().length

describe('getFilterOptions', () => {
  const options = getFilterOptions()
  const all = getAllExercises()

  it('vocabulary sizes match the distinct values present in the dataset', () => {
    const muscles = new Set(all.flatMap((e) => e.primaryMuscles))
    const categories = new Set(all.map((e) => e.category))
    const equipment = new Set(all.map((e) => e.equipment))
    expect(options.muscles.length).toBe(muscles.size)
    expect(options.categories.length).toBe(categories.size)
    expect(options.equipment.length).toBe(equipment.size)
  })

  it('each vocabulary is alphabetically sorted', () => {
    expect(options.muscles).toEqual([...options.muscles].sort())
    expect(options.categories).toEqual([...options.categories].sort())
    expect(options.equipment).toEqual([...options.equipment].sort())
  })

  it('contains no null/empty entries', () => {
    for (const list of [options.muscles, options.categories, options.equipment]) {
      for (const value of list) {
        expect(value).toBeTruthy()
        expect(typeof value).toBe('string')
      }
    }
  })
})

describe('normalize', () => {
  it('lowercases, folds hyphens/slashes to spaces, and collapses whitespace', () => {
    expect(normalize('Pull-Up')).toBe('pull up')
    expect(normalize('Pull-Ups')).toBe('pull ups')
    expect(normalize('3/4 Sit-Up')).toBe('3 4 sit up')
    expect(normalize('  Wide   Grip  Cable Row ')).toBe('wide grip cable row')
  })
})

describe('filterExercises - search', () => {
  it('empty query and empty filters returns the full dataset', () => {
    expect(filterExercises('', noFilters).length).toBe(datasetSize)
  })

  it('is case-insensitive', () => {
    const upper = filterExercises('CURL', noFilters)
    const lower = filterExercises('curl', noFilters)
    expect(upper.length).toBeGreaterThan(0)
    expect(upper.map((e) => e.id)).toEqual(lower.map((e) => e.id))
  })

  it('matches mid-word substrings', () => {
    const results = filterExercises('arbell', noFilters)
    expect(results.length).toBeGreaterThan(0)
    // Matches can come from the canonical name or any alias (e.g. "Bulgarian
    // Split Squat" via its "One Leg Barbell Squat" alias) - the contract is
    // name-or-aliases, not name-only.
    expect(
      results.every((e) => [e.name, ...e.aliases].some((n) => normalize(n).includes('arbell'))),
    ).toBe(true)
  })

  it('whitespace-only query returns the full dataset', () => {
    expect(filterExercises('   ', noFilters).length).toBe(datasetSize)
  })

  it('AC alias accept: "pull ups" resolves the Pull-Up entry', () => {
    const results = filterExercises('pull ups', noFilters)
    expect(results.some((e) => e.name === 'Pull-Up')).toBe(true)
  })

  it('matches hyphen/spacing variants of a multi-word name', () => {
    const hyphenated = filterExercises('wide-grip cable row', noFilters)
    const spaced = filterExercises('wide grip cable row', noFilters)
    const squished = filterExercises('widegrip cable row', noFilters)
    expect(hyphenated.some((e) => e.name === 'Wide Grip Cable Row')).toBe(true)
    expect(spaced.some((e) => e.name === 'Wide Grip Cable Row')).toBe(true)
    // "widegrip" (no separator) is not a substring match by design - only
    // hyphen/slash/space variants normalize to the same token.
    expect(squished.some((e) => e.name === 'Wide Grip Cable Row')).toBe(false)
  })

  it('matches against aliases, not just the canonical name', () => {
    const results = filterExercises('machine hamstring curl', noFilters)
    expect(results.some((e) => e.name === 'Seated Leg Curl')).toBe(true)
  })
})

describe('filterExercises - facets', () => {
  it('filters by muscle alone', () => {
    const expected = getAllExercises().filter((e) => e.primaryMuscles.includes('chest'))
    const results = filterExercises('', { ...noFilters, muscle: 'chest' })
    expect(results.length).toBe(expected.length)
    expect(results.every((e) => e.primaryMuscles.includes('chest'))).toBe(true)
  })

  it('filters by category alone', () => {
    const expected = getAllExercises().filter((e) => e.category === 'strength')
    const results = filterExercises('', { ...noFilters, category: 'strength' })
    expect(results.length).toBe(expected.length)
    expect(results.every((e) => e.category === 'strength')).toBe(true)
  })

  it('filters by equipment alone', () => {
    const expected = getAllExercises().filter((e) => e.equipment === 'dumbbell')
    const results = filterExercises('', { ...noFilters, equipment: 'dumbbell' })
    expect(results.length).toBe(expected.length)
    expect(results.every((e) => e.equipment === 'dumbbell')).toBe(true)
  })

  it('AND-combines a muscle + equipment facet (LIB-3 accept)', () => {
    const expected = getAllExercises().filter(
      (e) => e.primaryMuscles.includes('chest') && e.equipment === 'barbell',
    )
    const results = filterExercises('', { muscle: 'chest', category: null, equipment: 'barbell' })
    expect(results.length).toBe(expected.length)
    expect(results.length).toBeGreaterThan(0)
    expect(
      results.every((e) => e.primaryMuscles.includes('chest') && e.equipment === 'barbell'),
    ).toBe(true)
  })

  it('combines search with facet filters', () => {
    const expected = getAllExercises().filter(
      (e) => normalize(e.name).includes('press') && e.equipment === 'barbell',
    )
    const results = filterExercises('press', { ...noFilters, equipment: 'barbell' })
    expect(results.length).toBe(expected.length)
    expect(
      results.every((e) => normalize(e.name).includes('press') && e.equipment === 'barbell'),
    ).toBe(true)
  })

  it('preserves dataset order', () => {
    const all = getAllExercises()
    const results = filterExercises('', { ...noFilters, category: 'strength' })
    const expectedOrder = all.filter((e) => e.category === 'strength').map((e) => e.id)
    expect(results.map((e) => e.id)).toEqual(expectedOrder)
  })
})

describe('formatFilterValue', () => {
  it('title-cases single words', () => {
    expect(formatFilterValue('chest')).toBe('Chest')
  })

  it('title-cases each word in multi-word values', () => {
    expect(formatFilterValue('upper back')).toBe('Upper Back')
    expect(formatFilterValue('smith machine')).toBe('Smith Machine')
  })
})

describe('perf (LIB-2 bound)', () => {
  it('filterExercises averages under 100ms per call over 100 calls', () => {
    const start = performance.now()
    for (let i = 0; i < 100; i++) {
      filterExercises('curl', { muscle: 'biceps', category: null, equipment: null })
    }
    const elapsed = performance.now() - start
    expect(elapsed / 100).toBeLessThan(100)
  })
})
