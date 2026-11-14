import { db } from '@/db/ledger'
import { createRepo } from '@/db/repos/base'
import type { CustomExercise } from '@/db/types'

export const customExercises = {
  ...createRepo<CustomExercise>(db.customExercises, 'customExercises'),

  /** Every row, soft-deleted included. Only the store's boot hydration
   * uses this: deleted exercises must keep resolving to their real name. */
  async listAll(): Promise<CustomExercise[]> {
    return db.customExercises.toArray()
  },
}
