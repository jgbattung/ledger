import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/ledger'
import { resetDb } from '@/db/test-utils'
import { exerciseMeta } from '@/db/repos/exerciseMeta'
import type { ExerciseRef } from '@/db/types'

const ref: ExerciseRef = { source: 'db', exerciseId: 'bench-press' }

describe('exerciseMeta repo', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('upsertByRef creates then updates the same row by ExerciseRef, marking dirty each time', async () => {
    const created = await exerciseMeta.upsertByRef(ref, { isFavorite: true })
    expect(created.source).toBe('db')
    expect(created.exerciseId).toBe('bench-press')
    expect(created.isFavorite).toBe(true)

    let dirty = await db.syncState.get(['exerciseMeta', created.id])
    expect(dirty).toBeDefined()

    await db.syncState.clear()
    const updated = await exerciseMeta.upsertByRef(ref, {
      lastUsed: { weight: 60, reps: 8, unit: 'kg', at: Date.now() },
    })

    expect(updated.id).toBe(created.id)
    expect(updated.isFavorite).toBe(true)
    expect(updated.lastUsed?.weight).toBe(60)

    dirty = await db.syncState.get(['exerciseMeta', created.id])
    expect(dirty).toBeDefined()

    const all = await exerciseMeta.list()
    expect(all.filter((row) => row.exerciseId === ref.exerciseId)).toHaveLength(1)

    const fetched = await exerciseMeta.getByRef(ref)
    expect(fetched?.id).toBe(created.id)
  })
})
