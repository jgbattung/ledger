import { describe, it, expect } from 'vitest'
import { getAllExercises, getExerciseById, exerciseImageUrl } from './catalog'

describe('catalog', () => {
  it('getAllExercises returns the full curated dataset', () => {
    // Count is dataset-derived, never hardcoded - LG-047 curation reviews
    // change this number over time.
    expect(getAllExercises().length).toBeGreaterThan(0)
  })

  it('getExerciseById returns the record with all consumed fields populated', () => {
    const sampleId = getAllExercises()[0].id
    const exercise = getExerciseById(sampleId)
    expect(exercise).toBeDefined()
    expect(exercise?.name).toBeTruthy()
    expect(exercise?.primaryMuscles.length).toBeGreaterThan(0)
    expect(exercise?.secondaryMuscles).toBeInstanceOf(Array)
    expect(exercise?.category).toBeTruthy()
    expect(exercise?.equipment).toBeTruthy()
    expect(exercise?.mechanic).toBeTruthy()
    expect(exercise?.instructions.length).toBeGreaterThan(0)
    // images may be empty (net-new additions render a placeholder, LG-047).
    expect(exercise?.images).toBeInstanceOf(Array)
  })

  it('getExerciseById returns undefined for an unknown id', () => {
    expect(getExerciseById('not-a-real-exercise-id')).toBeUndefined()
  })

  it('ids are unique, non-empty, and kebab-case across the whole set', () => {
    const ids = getAllExercises().map((e) => e.id)
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id))).toBe(true)
  })

  it('exerciseImageUrl builds a base-relative path', () => {
    const sample = getAllExercises().find((e) => e.images.length > 0)!
    expect(exerciseImageUrl(sample.images[0])).toBe(`/exercises/${sample.images[0]}`)
  })
})
