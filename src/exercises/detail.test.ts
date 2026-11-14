import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb } from '@/db/test-utils'
import { resetAndHydrateCustomExercises } from '@/test/customExercises'
import { useCustomExerciseStore } from '@/stores/customExerciseStore'
import { getExerciseById } from '@/exercises/catalog'
import { exercisePath, loadExerciseDetail } from '@/exercises/detail'
import type { ExerciseRef } from '@/db/types'

const db = (exerciseId: string): ExerciseRef => ({ source: 'db', exerciseId })

describe('loadExerciseDetail', () => {
  beforeEach(async () => {
    await resetDb()
    await resetAndHydrateCustomExercises()
  })

  it('maps every field of a bundled exercise', async () => {
    const source = getExerciseById('barbell-deadlift')!
    const detail = await loadExerciseDetail(db('barbell-deadlift'))
    expect(detail).toEqual({
      ref: db('barbell-deadlift'),
      name: source.name,
      isCustom: false,
      aliases: source.aliases,
      primaryMuscles: source.primaryMuscles,
      secondaryMuscles: source.secondaryMuscles,
      equipment: source.equipment,
      category: source.category,
      mechanic: source.mechanic,
      instructions: source.instructions,
      images: source.images,
      deleted: false,
    })
    expect(detail!.aliases.length).toBeGreaterThan(0)
    expect(detail!.images).toHaveLength(2)
    expect(detail!.instructions.length).toBeGreaterThan(0)
  })

  it('returns empty images and secondary muscles when the exercise has none', async () => {
    const detail = await loadExerciseDetail(db('cable-lateral-raise'))
    expect(detail?.images).toEqual([])
    expect(detail?.secondaryMuscles).toEqual([])
  })

  it('maps a custom exercise created through the repo', async () => {
    const row = await useCustomExerciseStore.getState().create({
      name: 'Sandbag Carry',
      primaryMuscles: ['forearms'],
      secondaryMuscles: ['abs'],
      equipmentTag: 'other',
      mechanic: 'compound',
      notes: 'Hug it high',
    })
    const ref: ExerciseRef = { source: 'custom', exerciseId: row.id }
    expect(await loadExerciseDetail(ref)).toEqual({
      ref,
      name: 'Sandbag Carry',
      isCustom: true,
      aliases: [],
      primaryMuscles: ['forearms'],
      secondaryMuscles: ['abs'],
      equipment: 'other',
      category: 'strength',
      mechanic: 'compound',
      instructions: [],
      images: [],
      notes: 'Hug it high',
      deleted: false,
    })
  })

  it('returns a soft-deleted custom exercise flagged deleted, with mechanic and category mapped', async () => {
    const row = await useCustomExerciseStore.getState().create({
      name: 'Gone',
      primaryMuscles: ['quads'],
      secondaryMuscles: [],
      mechanic: 'isolation',
    })
    await useCustomExerciseStore.getState().remove(row.id)
    expect(await loadExerciseDetail({ source: 'custom', exerciseId: row.id })).toMatchObject({
      name: 'Gone',
      isCustom: true,
      deleted: true,
      mechanic: 'isolation',
      category: 'strength',
    })
  })

  it('returns undefined for an unknown id', async () => {
    expect(await loadExerciseDetail(db('no-such-exercise'))).toBeUndefined()
    expect(await loadExerciseDetail({ source: 'custom', exerciseId: 'nope' })).toBeUndefined()
  })

  it('returns undefined for an invalid source', async () => {
    const ref = { source: 'web', exerciseId: 'barbell-deadlift' } as unknown as ExerciseRef
    expect(await loadExerciseDetail(ref)).toBeUndefined()
  })
})

describe('exercisePath', () => {
  it('builds the route for both sources', () => {
    expect(exercisePath(db('barbell-deadlift'))).toBe('/exercises/db/barbell-deadlift')
    expect(exercisePath({ source: 'custom', exerciseId: 'abc' })).toBe('/exercises/custom/abc')
  })
})
