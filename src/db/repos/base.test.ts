import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/ledger'
import { resetDb } from '@/db/test-utils'
import { customExercises } from '@/db/repos/customExercises'

describe('createRepo conventions (via customExercises)', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('create stamps a UUID id, numeric createdAt/updatedAt, and deletedAt: null', async () => {
    const record = await customExercises.create({
      name: 'Bench Press',
      primaryMuscles: ['chest'],
      secondaryMuscles: ['triceps'],
    })

    expect(record.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    expect(typeof record.createdAt).toBe('number')
    expect(typeof record.updatedAt).toBe('number')
    expect(record.deletedAt).toBeNull()
  })

  it('update changes updatedAt only, leaving id/createdAt intact', async () => {
    const created = await customExercises.create({
      name: 'Squat',
      primaryMuscles: ['quads'],
      secondaryMuscles: [],
    })

    await new Promise((resolve) => setTimeout(resolve, 5))
    await customExercises.update(created.id, { name: 'Back Squat' })

    const updated = await customExercises.get(created.id)
    expect(updated?.id).toBe(created.id)
    expect(updated?.createdAt).toBe(created.createdAt)
    expect(updated?.updatedAt).toBeGreaterThan(created.updatedAt)
    expect(updated?.name).toBe('Back Squat')
  })

  it('softDelete sets deletedAt and hides the row from get() and list()', async () => {
    const created = await customExercises.create({
      name: 'Deadlift',
      primaryMuscles: ['hamstrings'],
      secondaryMuscles: ['back'],
    })

    await customExercises.softDelete(created.id)

    expect(await customExercises.get(created.id)).toBeUndefined()
    const list = await customExercises.list()
    expect(list.find((r) => r.id === created.id)).toBeUndefined()
  })

  it('softDelete stamps deletedAt and bumps updatedAt (replicates as an update)', async () => {
    const created = await customExercises.create({
      name: 'Row',
      primaryMuscles: ['back'],
      secondaryMuscles: ['biceps'],
    })

    await new Promise((resolve) => setTimeout(resolve, 5))
    await customExercises.softDelete(created.id)

    // Read the raw row directly, since get() intentionally hides soft-deleted rows.
    const raw = await db.customExercises.get(created.id)
    expect(typeof raw?.deletedAt).toBe('number')
    expect(raw?.updatedAt).toBeGreaterThan(created.updatedAt)
  })

  it('update ignores caller attempts to overwrite id or createdAt', async () => {
    const created = await customExercises.create({
      name: 'Curl',
      primaryMuscles: ['biceps'],
      secondaryMuscles: [],
    })

    await customExercises.update(created.id, {
      name: 'Hammer Curl',
      // Callers must not be able to rewrite immutable base fields.
      id: 'hacked-id',
      createdAt: 0,
    } as Partial<Parameters<typeof customExercises.update>[1]> & { id: string; createdAt: number })

    const updated = await customExercises.get(created.id)
    expect(updated?.id).toBe(created.id)
    expect(updated?.createdAt).toBe(created.createdAt)
    expect(updated?.name).toBe('Hammer Curl')
    // The bogus id did not create a second row.
    expect(await db.customExercises.get('hacked-id')).toBeUndefined()
  })

  it('create/update/softDelete each leave a matching syncState row', async () => {
    const created = await customExercises.create({
      name: 'Overhead Press',
      primaryMuscles: ['shoulders'],
      secondaryMuscles: ['triceps'],
    })
    let dirty = await db.syncState.get(['customExercises', created.id])
    expect(dirty).toBeDefined()

    await db.syncState.clear()
    await customExercises.update(created.id, { name: 'Standing Press' })
    dirty = await db.syncState.get(['customExercises', created.id])
    expect(dirty).toBeDefined()

    await db.syncState.clear()
    await customExercises.softDelete(created.id)
    dirty = await db.syncState.get(['customExercises', created.id])
    expect(dirty).toBeDefined()
  })
})
