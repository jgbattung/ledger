import { db } from '@/db/ledger'
import { createRepo } from '@/db/repos/base'
import type { Workout } from '@/db/types'

export const workouts = createRepo<Workout>(db.workouts, 'workouts')
