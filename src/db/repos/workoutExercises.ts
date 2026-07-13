import { db } from '@/db/ledger'
import { createRepo } from '@/db/repos/base'
import type { WorkoutExercise } from '@/db/types'

export const workoutExercises = createRepo<WorkoutExercise>(db.workoutExercises, 'workoutExercises')
