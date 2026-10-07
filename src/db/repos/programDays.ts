import { db } from '@/db/ledger'
import { createRepo } from '@/db/repos/base'
import type { ProgramDay } from '@/db/types'

const baseRepo = createRepo<ProgramDay>(db.programDays, 'programDays')

export const programDays = {
  ...baseRepo,

  async listByProgram(programId: string): Promise<ProgramDay[]> {
    const rows = await db.programDays.where('programId').equals(programId).toArray()
    return rows.filter((day) => day.deletedAt == null).sort((a, b) => a.orderIndex - b.orderIndex)
  },
}
