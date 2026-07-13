import { db } from '@/db/ledger'
import { createRepo } from '@/db/repos/base'
import type { ExerciseMeta, ExerciseRef } from '@/db/types'

const baseRepo = createRepo<ExerciseMeta>(db.exerciseMeta, 'exerciseMeta')

/**
 * `exerciseMeta` is keyed by ExerciseRef rather than by id alone, so it
 * exposes ref-based lookup/upsert on top of the base repo's create/update.
 */
export const exerciseMeta = {
  ...baseRepo,

  async getByRef(ref: ExerciseRef): Promise<ExerciseMeta | undefined> {
    const record = await db.exerciseMeta.get({ source: ref.source, exerciseId: ref.exerciseId })
    return record && record.deletedAt == null ? record : undefined
  },

  async upsertByRef(
    ref: ExerciseRef,
    patch: Partial<Omit<ExerciseMeta, 'id' | 'createdAt' | 'source' | 'exerciseId'>>,
  ): Promise<ExerciseMeta> {
    const existing = await this.getByRef(ref)

    if (existing) {
      await baseRepo.update(existing.id, patch)
      const updated = await baseRepo.get(existing.id)
      return updated as ExerciseMeta
    }

    return baseRepo.create({
      source: ref.source,
      exerciseId: ref.exerciseId,
      isFavorite: false,
      ...patch,
    })
  },
}
