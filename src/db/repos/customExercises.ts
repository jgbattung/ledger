import { db } from '@/db/ledger'
import { createRepo } from '@/db/repos/base'
import type { CustomExercise } from '@/db/types'

export const customExercises = createRepo<CustomExercise>(db.customExercises, 'customExercises')
