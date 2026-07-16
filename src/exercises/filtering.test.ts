import { describe, it, expect } from 'vitest'
import { getAllExercises } from './catalog'
import { getFilterOptions, filterExercises, formatFilterValue } from './filtering'
import type { LibraryFilters } from './filtering'

const noFilters: LibraryFilters = { muscle: null, category: null, equipment: null }

describe('getFilterOptions', () => {
  const options = getFilterOptions()

  it('returns 17 muscles, 7 categories, 12 equipment values', () => {
    expect(options.muscles.length).toBe(17)
    expect(options.categories.length).toBe(7)
    expect(options.equipment.length).toBe(12)
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

describe('filterExercises - search', () => {
  it('empty query and empty filters returns all 873 exercises', () => {
    expect(filterExercises('', noFilters).length).toBe(873)
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
    expect(results.every((e) => e.name.toLowerCase().includes('arbell'))).toBe(true)
  })

  it('whitespace-only query returns all exercises', () => {
    expect(filterExercises('   ', noFilters).length).toBe(873)
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

  it('excludes null-equipment exercises from any equipment filter', () => {
    const results = filterExercises('', { ...noFilters, equipment: 'barbell' })
    expect(results.every((e) => e.equipment !== null)).toBe(true)
  })

  it('AND-combines Chest + Barbell (LIB-3 accept)', () => {
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
      (e) => e.name.toLowerCase().includes('press') && e.equipment === 'barbell',
    )
    const results = filterExercises('press', { ...noFilters, equipment: 'barbell' })
    expect(results.length).toBe(expected.length)
    expect(
      results.every((e) => e.name.toLowerCase().includes('press') && e.equipment === 'barbell'),
    ).toBe(true)
  })

  it('preserves dataset order', () => {
    const all = getAllExercises()
    const results = filterExercises('', { ...noFilters, category: 'cardio' })
    const expectedOrder = all.filter((e) => e.category === 'cardio').map((e) => e.id)
    expect(results.map((e) => e.id)).toEqual(expectedOrder)
  })
})

describe('formatFilterValue', () => {
  it('title-cases single words', () => {
    expect(formatFilterValue('chest')).toBe('Chest')
  })

  it('title-cases each word in multi-word values', () => {
    expect(formatFilterValue('body only')).toBe('Body Only')
    expect(formatFilterValue('e-z curl bar')).toBe('E-z Curl Bar')
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
