import { db } from '@/db/ledger'
import { createRepo } from '@/db/repos/base'
import type { ProgramExercise } from '@/db/types'

export const programExercises = createRepo<ProgramExercise>(db.programExercises, 'programExercises')
