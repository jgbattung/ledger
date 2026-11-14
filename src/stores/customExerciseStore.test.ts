import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/ledger'
import { resetDb } from '@/db/test-utils'
import { customExercises } from '@/db/repos/customExercises'
import {
  getCustomExercise,
  selectLive,
  useCustomExerciseStore,
  type CustomExerciseInput,
} from '@/stores/customExerciseStore'

const input = (name: string): CustomExerciseInput => ({
  name,
  primaryMuscles: ['quads'],
  secondaryMuscles: ['glutes'],
  equipmentTag: 'barbell',
  mechanic: 'compound',
})

const live = () => selectLive(useCustomExerciseStore.getState())

describe('customExerciseStore', () => {
  beforeEach(async () => {
    await resetDb()
    useCustomExerciseStore.setState({ byId: {}, hydrated: false })
  })

  it('hydrate loads live and deleted rows', async () => {
    const a = await customExercises.create(input('Alpha'))
    const b = await customExercises.create(input('Beta'))
    await customExercises.softDelete(b.id)

    await useCustomExerciseStore.getState().hydrate()

    const state = useCustomExerciseStore.getState()
    expect(state.hydrated).toBe(true)
    expect(Object.keys(state.byId).sort()).toEqual([a.id, b.id].sort())
    expect(live().map((r) => r.name)).toEqual(['Alpha'])
  })

  it('create persists to Dexie and appears in selectLive', async () => {
    const row = await useCustomExerciseStore.getState().create(input('SSB Squat'))

    expect((await db.customExercises.get(row.id))?.name).toBe('SSB Squat')
    expect(live().map((r) => r.id)).toEqual([row.id])
  })

  it('update changes both Dexie and state', async () => {
    const row = await useCustomExerciseStore.getState().create(input('SSB Squat'))
    await useCustomExerciseStore
      .getState()
      .update(row.id, { ...input('Safety Squat'), mechanic: 'isolation' })

    expect((await db.customExercises.get(row.id))?.name).toBe('Safety Squat')
    expect(getCustomExercise(row.id)).toMatchObject({
      name: 'Safety Squat',
      mechanic: 'isolation',
    })
  })

  it('remove soft deletes, drops from selectLive and keeps it for lookups', async () => {
    const row = await useCustomExerciseStore.getState().create(input('SSB Squat'))
    await useCustomExerciseStore.getState().remove(row.id)

    expect((await db.customExercises.get(row.id))?.deletedAt).toEqual(expect.any(Number))
    expect(live()).toEqual([])
    expect(getCustomExercise(row.id)).toMatchObject({
      name: 'SSB Squat',
      deletedAt: expect.any(Number),
    })
  })

  it('selectLive is name ordered (case-insensitive) and memoised', async () => {
    for (const name of ['zebra curl', 'Apple Press', 'mango Row']) {
      await useCustomExerciseStore.getState().create(input(name))
    }
    expect(live().map((r) => r.name)).toEqual(['Apple Press', 'mango Row', 'zebra curl'])
    expect(live()).toBe(live())
  })
})
