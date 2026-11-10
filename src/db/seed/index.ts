import { set as setTime, startOfDay, subDays } from 'date-fns'
import { db } from '@/db/ledger'
import { newId, now } from '@/db/ids'
import { programs } from '@/db/repos/programs'
import { buildHistory } from '@/db/seed/history'
import {
  ARCHIVED_NAME,
  FBEOD_NAME,
  PPL_NAME,
  PULL_DAY,
  PUSH_DAY,
  buildSeedDrafts,
} from '@/db/seed/programs'
import { createRng } from '@/db/seed/rng'
import type { Rng } from '@/db/seed/rng'
import type { SeedHistory } from '@/db/seed/history'
import type { BodyMetric, ExerciseMeta, SyncStateRow } from '@/db/types'

const SEED_RUN_KEY = 'ledger-seed-run'
const REST_TIMER_KEY = 'ledger-rest-timer'

const BODYWEIGHT_WEEKS = 13
const FAVORITE_EXERCISE_IDS = [
  'barbell-bench-press',
  'barbell-squat',
  'barbell-deadlift',
  'pull-up',
  'romanian-deadlift',
]

/** Clears every table, including settings and the syncState outbox. */
export async function clearDatabase(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()))
  })
}

/** Weekly bodyweight entries, the last one yesterday, drifting 78.5 -> 80 kg. */
function buildBodyMetrics(anchor: number, rng: Rng): BodyMetric[] {
  const today = startOfDay(anchor)
  return Array.from({ length: BODYWEIGHT_WEEKS }, (_, week): BodyMetric => {
    const daysBack = 1 + 7 * (BODYWEIGHT_WEEKS - 1 - week)
    const measuredAt = setTime(subDays(today, daysBack), { hours: 7, minutes: 30 }).getTime()
    const drift = 78.5 + (1.5 * week) / (BODYWEIGHT_WEEKS - 1)
    const noise = (rng.next() - 0.5) * 0.6
    return {
      id: newId(),
      createdAt: measuredAt,
      updatedAt: measuredAt,
      deletedAt: null,
      type: 'bodyweight',
      value: Math.round((drift + noise) * 10) / 10,
      measuredAt,
    }
  })
}

/** One row per exercise seen in history; `lastUsed` from its latest finished set. */
function buildExerciseMeta(history: SeedHistory): ExerciseMeta[] {
  const finished = new Set(
    history.workouts.filter((workout) => workout.status === 'finished').map((w) => w.id),
  )
  const exerciseByWorkoutExercise = new Map<string, string>()
  const seen = new Set<string>()
  for (const row of history.workoutExercises) {
    seen.add(row.exerciseRef.exerciseId)
    if (finished.has(row.workoutId)) {
      exerciseByWorkoutExercise.set(row.id, row.exerciseRef.exerciseId)
    }
  }

  const latest = new Map<string, { weight: number; reps: number; at: number }>()
  for (const set of history.sets) {
    const exerciseId = exerciseByWorkoutExercise.get(set.workoutExerciseId)
    if (!exerciseId || set.completedAt === undefined) continue
    const current = latest.get(exerciseId)
    if (!current || set.completedAt > current.at) {
      latest.set(exerciseId, { weight: set.weight, reps: set.reps, at: set.completedAt })
    }
  }

  const timestamp = now()
  return [...seen].map((exerciseId): ExerciseMeta => {
    const last = latest.get(exerciseId)
    return {
      id: newId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      source: 'db',
      exerciseId,
      isFavorite: FAVORITE_EXERCISE_IDS.includes(exerciseId),
      ...(last ? { lastUsed: { weight: last.weight, reps: last.reps, unit: 'kg', at: last.at } } : {}),
    }
  })
}

/**
 * Seeds an empty database: programs through the real repo (so the targets
 * gate and pass logic run), then back-dated history, bodyweight and exercise
 * meta as raw rows with the same `syncState` dirty marks repo writes leave.
 * Settings are not written; `settings.getOrInit()` creates PRD defaults.
 *
 * All-or-nothing: everything runs inside one `rw` transaction over every
 * table (the repo calls nest inside it), so a failure or a closed tab rolls
 * back every seeded row. Keep the body Dexie-only: any other awaited promise
 * would let the transaction commit early.
 */
export function seedDatabase(anchor: number = Date.now()): Promise<void> {
  return db.transaction('rw', db.tables, async () => {
    const drafts = buildSeedDrafts()
    const byName = (name: string) => {
      const found = drafts.find((draft) => draft.name === name)
      if (!found) throw new Error(`Seed program missing: ${name}`)
      return found
    }
    const ppl = byName(PPL_NAME)
    const fbeod = byName(FBEOD_NAME)
    const archived = byName(ARCHIVED_NAME)
    const dayId = (name: string) => {
      const found = ppl.days.find((day) => day.name === name)
      if (!found) throw new Error(`Seed day missing: ${name}`)
      return found.id
    }

    for (const draft of drafts) await programs.saveTree(draft)
    await programs.archive(archived.id)
    await programs.setActive(ppl.id)
    await programs.completeDay(ppl.id, dayId(PUSH_DAY))
    await programs.completeDay(ppl.id, dayId(PULL_DAY))

    const pplTree = await programs.loadTree(ppl.id)
    const fbeodTree = await programs.loadTree(fbeod.id)
    if (!pplTree || !fbeodTree) throw new Error('Seed programs were not saved')

    const rng = createRng()
    const history = buildHistory({ trees: { ppl: pplTree, fbeod: fbeodTree }, anchor, rng })
    const bodyMetrics = buildBodyMetrics(anchor, rng)
    const exerciseMeta = buildExerciseMeta(history)

    const dirtyAt = now()
    const dirty = (table: string, rows: { id: string }[]): SyncStateRow[] =>
      rows.map((row) => ({ table, recordId: row.id, dirtyAt }))

    await db.workouts.bulkPut(history.workouts)
    await db.workoutExercises.bulkPut(history.workoutExercises)
    await db.sets.bulkPut(history.sets)
    await db.bodyMetrics.bulkPut(bodyMetrics)
    await db.exerciseMeta.bulkPut(exerciseMeta)
    await db.syncState.bulkPut([
      ...dirty('workouts', history.workouts),
      ...dirty('workoutExercises', history.workoutExercises),
      ...dirty('sets', history.sets),
      ...dirty('bodyMetrics', bodyMetrics),
      ...dirty('exerciseMeta', exerciseMeta),
    ])
  })
}

/**
 * Called before first render in seed modes. `fresh` wipes and reseeds once
 * per dev-server start (tracked by `runId`); otherwise seeds only an empty
 * database, so data persists across reloads and server restarts.
 *
 * Both paths are all-or-nothing: the wipe or emptiness check and the seed
 * share one transaction, so a failed seed leaves the previous data intact and
 * a second tab's check waits for the first tab's seed and then sees data.
 * The run id is stored only after the transaction commits.
 */
export async function ensureSeeded(options: { fresh: boolean; runId: string }): Promise<void> {
  if (options.fresh && localStorage.getItem(SEED_RUN_KEY) !== options.runId) {
    await db.transaction('rw', db.tables, async () => {
      await clearDatabase()
      await seedDatabase()
    })
    localStorage.removeItem(REST_TIMER_KEY)
    localStorage.setItem(SEED_RUN_KEY, options.runId)
    return
  }
  await db.transaction('rw', db.tables, async () => {
    if ((await db.programs.count()) === 0 && (await db.workouts.count()) === 0) {
      await seedDatabase()
    }
  })
}
