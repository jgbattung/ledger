import { db } from '@/db/ledger'
import { createRepo } from '@/db/repos/base'
import type { ProgramDay } from '@/db/types'

export const programDays = createRepo<ProgramDay>(db.programDays, 'programDays')
