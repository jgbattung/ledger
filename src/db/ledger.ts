import Dexie from 'dexie'
import type { Table } from 'dexie'
import type {
  BodyMetric,
  CustomExercise,
  ExerciseMeta,
  Photo,
  Program,
  ProgramDay,
  ProgramExercise,
  Set,
  Settings,
  SyncStateRow,
  Workout,
  WorkoutExercise,
} from '@/db/types'

/**
 * The `ledger` Dexie database. Schema v1 declares every table from PRD
 * §3.2-3.12 plus the local-only `syncState` outbox (§3.14). `exercises`
 * (§3.1) is bundled read-only JSON, not a Dexie table (LG-004).
 *
 * Components never touch these tables directly - all access goes through
 * `src/db/repos/*`.
 */
export class Ledger extends Dexie {
  customExercises!: Table<CustomExercise, string>
  exerciseMeta!: Table<ExerciseMeta, string>
  programs!: Table<Program, string>
  programDays!: Table<ProgramDay, string>
  programExercises!: Table<ProgramExercise, string>
  workouts!: Table<Workout, string>
  workoutExercises!: Table<WorkoutExercise, string>
  sets!: Table<Set, string>
  bodyMetrics!: Table<BodyMetric, string>
  photos!: Table<Photo, string>
  settings!: Table<Settings, string>
  syncState!: Table<SyncStateRow, [string, string]>

  constructor() {
    super('ledger')
    this.version(1).stores({
      customExercises: 'id, deletedAt',
      exerciseMeta: 'id, [source+exerciseId], deletedAt',
      programs: 'id, deletedAt',
      programDays: 'id, programId, deletedAt',
      programExercises: 'id, programDayId, deletedAt',
      workouts: 'id, status, startedAt, deletedAt',
      workoutExercises: 'id, workoutId, deletedAt',
      sets: 'id, workoutExerciseId, deletedAt',
      bodyMetrics: 'id, deletedAt',
      photos: 'id, deletedAt',
      settings: 'id',
      syncState: '[table+recordId], table',
    })
  }
}

export const db = new Ledger()
