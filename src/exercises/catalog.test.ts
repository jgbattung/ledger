import { describe, it, expect } from 'vitest'
import { getAllExercises, getExerciseById, exerciseImageUrl } from './catalog'

describe('catalog', () => {
  it('getAllExercises returns all 873 bundled exercises', () => {
    expect(getAllExercises().length).toBe(873)
  })

  it('getExerciseById returns the record with all consumed fields populated', () => {
    const exercise = getExerciseById('Barbell_Squat')
    expect(exercise).toBeDefined()
    expect(exercise?.name).toBeTruthy()
    expect(exercise?.primaryMuscles.length).toBeGreaterThan(0)
    expect(exercise?.secondaryMuscles).toBeInstanceOf(Array)
    expect(exercise?.category).toBeTruthy()
    expect(exercise?.instructions.length).toBeGreaterThan(0)
    expect(exercise?.images.length).toBeGreaterThan(0)
  })

  it('getExerciseById returns undefined for an unknown id', () => {
    expect(getExerciseById('not-a-real-exercise-id')).toBeUndefined()
  })

  it('ids are unique and non-empty across the whole set', () => {
    const ids = getAllExercises().map((e) => e.id)
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('exerciseImageUrl builds a base-relative path', () => {
    expect(exerciseImageUrl('Barbell_Squat/0.jpg')).toBe('/exercises/Barbell_Squat/0.jpg')
  })
})
