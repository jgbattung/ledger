/**
 * Record shapes for the `ledger` Dexie database (PRD §3). Every synced
 * record mixes in `BaseRecord` (client UUID id, ms-epoch timestamps, soft
 * delete). Weights are always plain `number` in kg - unit conversion is a
 * display-boundary concern, not a data-layer one (PRD §3.13).
 */

/** Reference to an exercise, which may live in the Ledger-owned read-only
 * JSON catalog (`source: 'db'`, LG-047 - curated dataset, permanent IDs)
 * or in the user's `customExercises` table. */
export type ExerciseRef = {
  source: 'db' | 'custom'
  exerciseId: string
}

/** Fields present on every synced (non-syncState) record. */
export type BaseRecord = {
  id: string
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export type WorkoutStatus = 'in_progress' | 'finished' | 'discarded'
export type SetType = 'warmup' | 'working'
export type BodyMetricType = 'bodyweight' | 'custom'
export type PhotoPose = 'front' | 'side' | 'back'
export type Unit = 'kg' | 'lb'
export type Theme = 'light' | 'dark' | 'system'
export type WeekStart = 'mon' | 'sun'

export type CustomExercise = BaseRecord & {
  name: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  equipmentTag?: string
  notes?: string
}

export type ExerciseMeta = BaseRecord & {
  source: ExerciseRef['source']
  exerciseId: string
  isFavorite: boolean
  lastUsed?: {
    weight: number
    reps: number
    unit: Unit
    at: number
  }
}

/** Per-cycle overrides for a program; owning stories (later) tighten this. */
export type CycleConfig = Record<string, unknown>

export type Program = BaseRecord & {
  name: string
  notes?: string
  isActive: boolean
  isArchived: boolean
  currentDayIndex: number
  cycles?: CycleConfig[]
  currentCycleIndex: number
}

export type ProgramDay = BaseRecord & {
  programId: string
  orderIndex: number
  name: string
  isRestDay: boolean
  notes?: string
}

export type ProgramExercise = BaseRecord & {
  programDayId: string
  orderIndex: number
  exerciseRef: ExerciseRef
  workingSets: number
  repMin: number
  repMax: number
  rirTarget: number
  restSeconds?: number
  warmupSetCount?: number
  notes?: string
}

export type Workout = BaseRecord & {
  programId?: string
  programDayId?: string
  name: string
  startedAt: number
  finishedAt?: number
  status: WorkoutStatus
  notes?: string
  cycleIndexAtTime?: number
}

export type WorkoutExercise = BaseRecord & {
  workoutId: string
  orderIndex: number
  exerciseRef: ExerciseRef
  notes?: string
  targetsSnapshot?: unknown
  swappedFrom?: ExerciseRef
}

export type Set = BaseRecord & {
  workoutExerciseId: string
  orderIndex: number
  type: SetType
  weight: number
  reps: number
  rir: number
  rirIsPlus: boolean
  partialReps?: number
  unilateral?: {
    leftWeight: number
    leftReps: number
    rightWeight: number
    rightReps: number
  }
  completedAt?: number
}

export type BodyMetric = BaseRecord & {
  type: BodyMetricType
  customName?: string
  value: number
  measuredAt: number
}

export type Photo = BaseRecord & {
  pose: PhotoPose
  takenAt: number
  blob: Blob
  thumbnailBlob?: Blob
}

/** Widget configuration for the dashboard; owning story (later) tightens this. */
export type WidgetConfig = Record<string, unknown>

export type Settings = BaseRecord & {
  id: 'settings'
  defaultRir: number
  defaultRestSeconds: number
  defaultWarmupSetCount: number
  unit: Unit
  theme: Theme
  weekStartsOn: WeekStart
  dashboardWidgets: WidgetConfig[]
  backup: {
    lastExportAt?: number
  }
  sync: {
    autoSyncEnabled: boolean
    lastSyncedAt?: number
    lastPulledAt: Record<string, number>
  }
}

/** Local-only outbox row for the future sync engine (M7). Never replicated,
 * never soft-deleted, and carries no id/timestamps/deletedAt of its own. */
export type SyncStateRow = {
  table: string
  recordId: string
  dirtyAt: number
}
