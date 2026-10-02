import { db } from '@/db/ledger'
import { createRepo } from '@/db/repos/base'
import type { ProgramExercise } from '@/db/types'

const baseRepo = createRepo<ProgramExercise>(db.programExercises, 'programExercises')

export const programExercises = {
  ...baseRepo,

  async listByDay(programDayId: string): Promise<ProgramExercise[]> {
    const rows = await db.programExercises.where('programDayId').equals(programDayId).toArray()
    return rows
      .filter((exercise) => exercise.deletedAt == null)
      .sort((a, b) => a.orderIndex - b.orderIndex)
  },
}
