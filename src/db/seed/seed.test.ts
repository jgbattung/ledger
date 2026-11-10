import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { differenceInCalendarDays, startOfDay } from 'date-fns'
import { db } from '@/db/ledger'
import { resetDb } from '@/db/test-utils'
import { programs, settings, workouts } from '@/db/repos'
import { getExerciseById } from '@/exercises/catalog'
import { hasRequiredTargets } from '@/programs/model'
import { buildHistory } from '@/db/seed/history'
import { clearDatabase, ensureSeeded, seedDatabase } from '@/db/seed'
import {
  ARCHIVED_NAME,
  DRAFT_NAME,
  FBEOD_NAME,
  LEGS_DAY,
  PPL_NAME,
  PROGRESSION,
  PULL_DAY,
  PUSH_DAY,
} from '@/db/seed/programs'
import { createRng } from '@/db/seed/rng'
import type { Program } from '@/db/types'

const ANCHOR = new Date(2026, 10, 10, 15, 0).getTime()

async function programByName(name: string): Promise<Program> {
  const found = (await db.programs.toArray()).find((program) => program.name === name)
  if (!found) throw new Error(`No program named ${name}`)
  return found
}

beforeEach(async () => {
  await resetDb()
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('rng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    const first = Array.from({ length: 10 }, () => a.next())
    const second = Array.from({ length: 10 }, () => b.next())
    expect(first).toEqual(second)
    expect(first.every((value) => value >= 0 && value < 1)).toBe(true)
  })

  it('keeps int inside its inclusive bounds', () => {
    const rng = createRng()
    const values = Array.from({ length: 500 }, () => rng.int(2, 4))
    expect(Math.min(...values)).toBe(2)
    expect(Math.max(...values)).toBe(4)
  })

  it('gives different sequences for different seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next())
  })
})

describe('seedDatabase programs', () => {
  it('leaves exactly one active program, PPL-R-UL, with Push and Pull ticked', async () => {
    await seedDatabase(ANCHOR)
    const active = (await db.programs.toArray()).filter((program) => program.isActive)
    expect(active.map((program) => program.name)).toEqual([PPL_NAME])

    const tree = await programs.loadTree(active[0].id)
    const dayId = (name: string) => tree!.days.find(({ day }) => day.name === name)!.day.id
    expect(tree!.days.map(({ day }) => day.name)).toEqual([
      PUSH_DAY,
      PULL_DAY,
      LEGS_DAY,
      'Rest',
      'Upper',
      'Lower',
    ])
    expect(active[0].completedDayIds).toEqual([dayId(PUSH_DAY), dayId(PULL_DAY)])
    expect(active[0].currentDayIndex).toBe(2)
  })

  it('seeds four live programs: active, inactive, archived and an incomplete draft', async () => {
    await seedDatabase(ANCHOR)
    const live = await programs.listLive()
    expect(live.map((program) => program.name).sort()).toEqual(
      [ARCHIVED_NAME, DRAFT_NAME, FBEOD_NAME, PPL_NAME].sort(),
    )

    const archived = await programByName(ARCHIVED_NAME)
    expect(archived.isArchived).toBe(true)
    expect(archived.isActive).toBe(false)

    const fbeod = await programByName(FBEOD_NAME)
    expect(fbeod.isActive).toBe(false)
    expect(fbeod.isArchived).toBe(false)

    const draft = await programByName(DRAFT_NAME)
    expect(draft.isActive).toBe(false)
    expect(draft.isArchived).toBe(false)

    const exercisesOf = async (name: string) => {
      const tree = await programs.loadTree((await programByName(name)).id)
      return tree!.days.flatMap(({ exercises }) => exercises)
    }
    expect((await exercisesOf(DRAFT_NAME)).some((e) => !hasRequiredTargets(e))).toBe(true)
    for (const name of [PPL_NAME, FBEOD_NAME, ARCHIVED_NAME]) {
      expect((await exercisesOf(name)).every(hasRequiredTargets)).toBe(true)
    }
  })

  it('gives the program days the spec exercise counts and no repeats within a day', async () => {
    await seedDatabase(ANCHOR)
    const ppl = await programs.loadTree((await programByName(PPL_NAME)).id)
    for (const { day, exercises } of ppl!.days) {
      const ids = exercises.map((e) => e.exerciseRef.exerciseId)
      expect(new Set(ids).size).toBe(ids.length)
      if (['Push', 'Pull', 'Legs'].includes(day.name)) expect(ids).toHaveLength(6)
      if (day.name === 'Rest') expect(ids).toHaveLength(0)
    }
    const fbeod = await programs.loadTree((await programByName(FBEOD_NAME)).id)
    expect(fbeod!.days.map(({ day }) => day.name)).toEqual([
      'Full Body A',
      'Rest',
      'Full Body B',
      'Rest',
    ])
  })
})

describe('seedDatabase exercise ids', () => {
  it('resolves every exercise id through the catalog', async () => {
    await seedDatabase(ANCHOR)
    const ids = new Set<string>()
    for (const row of await db.programExercises.toArray()) ids.add(row.exerciseRef.exerciseId)
    for (const row of await db.workoutExercises.toArray()) {
      ids.add(row.exerciseRef.exerciseId)
      if (row.swappedFrom) ids.add(row.swappedFrom.exerciseId)
    }
    for (const row of await db.exerciseMeta.toArray()) ids.add(row.exerciseId)
    for (const id of Object.keys(PROGRESSION)) ids.add(id)

    expect(ids.size).toBeGreaterThan(20)
    for (const id of ids) expect(getExerciseById(id), id).toBeDefined()
  })
})

describe('seedDatabase history', () => {
  it('has no in-progress workout and exactly one discarded one', async () => {
    await seedDatabase(ANCHOR)
    const all = await db.workouts.toArray()
    expect(all.filter((w) => w.status === 'in_progress')).toHaveLength(0)
    const discarded = all.filter((w) => w.status === 'discarded')
    expect(discarded).toHaveLength(1)
    expect(discarded[0].finishedAt).toBeUndefined()
  })

  it('spans about 12 weeks: 14 FBEOD workouts first, then PPL-R-UL up to yesterday', async () => {
    await seedDatabase(ANCHOR)
    const all = (await db.workouts.toArray()).sort((a, b) => a.startedAt - b.startedAt)
    const fbeod = all.filter((w) => w.programName === FBEOD_NAME)
    const ppl = all.filter((w) => w.programName === PPL_NAME)
    expect(fbeod).toHaveLength(14)
    expect(all.slice(0, 14)).toEqual(fbeod)
    expect(all.at(-2)!.name).toBe(PUSH_DAY)
    expect(all.at(-1)!.name).toBe(PULL_DAY)

    const midnight = new Date(ANCHOR)
    midnight.setHours(0, 0, 0, 0)
    expect(all.at(-1)!.startedAt).toBeLessThan(midnight.getTime())
    expect(all.at(-1)!.startedAt).toBeGreaterThan(midnight.getTime() - 24 * 3_600_000)
    expect(all[0].startedAt).toBeLessThan(midnight.getTime() - 83 * 24 * 3_600_000)
    // 9 six-day passes + Push + Pull = 47 slots, minus 3 missed, one of which is the discarded.
    expect(ppl).toHaveLength(45)
  })

  it('has one swapped exercise, paused time, notes and partial reps', async () => {
    await seedDatabase(ANCHOR)
    const swapped = (await db.workoutExercises.toArray()).filter((row) => row.swappedFrom)
    expect(swapped).toHaveLength(1)
    expect(swapped[0].swappedFrom!.exerciseId).not.toBe(swapped[0].exerciseRef.exerciseId)

    const all = await db.workouts.toArray()
    expect(all.some((w) => (w.pausedMs ?? 0) > 0 && w.pausedAt === null)).toBe(true)
    expect(all.some((w) => w.notes)).toBe(true)
    expect((await db.sets.toArray()).some((set) => set.partialReps !== undefined)).toBe(true)
  })

  it('gives every finished workout a later finish time and at least one set', async () => {
    await seedDatabase(ANCHOR)
    const exercises = await db.workoutExercises.toArray()
    const allSets = await db.sets.toArray()
    const finished = (await db.workouts.toArray()).filter((w) => w.status === 'finished')
    expect(finished.length).toBeGreaterThan(50)

    for (const workout of finished) {
      expect(workout.finishedAt!).toBeGreaterThan(workout.startedAt)
      const ownIds = new Set(exercises.filter((e) => e.workoutId === workout.id).map((e) => e.id))
      const own = allSets.filter((set) => ownIds.has(set.workoutExerciseId))
      expect(own.length).toBeGreaterThan(0)
      for (const set of own) {
        expect(set.completedAt!).toBeGreaterThan(workout.startedAt)
        expect(set.completedAt!).toBeLessThan(workout.finishedAt!)
      }
    }
  })

  it('writes only completed working sets with valid reps and kg loads', async () => {
    await seedDatabase(ANCHOR)
    const allSets = await db.sets.toArray()
    expect(allSets.length).toBeGreaterThan(500)
    for (const set of allSets) {
      expect(set.type).toBe('working')
      expect(set.reps).toBeGreaterThanOrEqual(1)
      expect(set.completedAt).toBeDefined()
      expect(set.weight).toBeGreaterThanOrEqual(0)
      expect((set.weight * 2) % 1).toBe(0)
      expect(set.rirIsPlus).toBe(false)
    }
  })

  it('populates the Previous column for the up-next Legs day', async () => {
    await seedDatabase(ANCHOR)
    const ppl = await programs.loadTree((await programByName(PPL_NAME)).id)
    const legs = ppl!.days.find(({ day }) => day.name === LEGS_DAY)!
    for (const exercise of legs.exercises) {
      const previous = await workouts.previousSets(exercise.exerciseRef, 'none')
      expect(previous.length, exercise.exerciseRef.exerciseId).toBeGreaterThan(0)
    }
  })

  it('applies double progression: a lift ends heavier than it started', async () => {
    await seedDatabase(ANCHOR)
    const bench = (await db.workoutExercises.toArray()).filter(
      (row) => row.exerciseRef.exerciseId === 'barbell-bench-press',
    )
    const allSets = await db.sets.toArray()
    const weights = bench.flatMap((row) =>
      allSets.filter((set) => set.workoutExerciseId === row.id).map((set) => set.weight),
    )
    expect(Math.max(...weights)).toBeGreaterThan(Math.min(...weights))
  })
})

describe('seedDatabase supporting data', () => {
  it('writes 13 weekly bodyweight entries drifting from about 78.5 to 80 kg', async () => {
    await seedDatabase(ANCHOR)
    const rows = (await db.bodyMetrics.toArray()).sort((a, b) => a.measuredAt - b.measuredAt)
    expect(rows).toHaveLength(13)
    for (const row of rows) {
      expect(row.type).toBe('bodyweight')
      expect(row.value).toBeGreaterThan(77.5)
      expect(row.value).toBeLessThan(81)
      expect(Math.round(row.value * 10) / 10).toBe(row.value)
    }
    expect(rows.at(-1)!.value).toBeGreaterThan(rows[0].value)
    expect(rows[1].measuredAt - rows[0].measuredAt).toBeGreaterThan(6 * 24 * 3_600_000)
  })

  it('writes exercise meta with five favorites and lastUsed values in kg', async () => {
    await seedDatabase(ANCHOR)
    const meta = await db.exerciseMeta.toArray()
    const usedIds = new Set((await db.workoutExercises.toArray()).map((e) => e.exerciseRef.exerciseId))
    expect(new Set(meta.map((m) => m.exerciseId))).toEqual(usedIds)
    expect(meta.filter((m) => m.isFavorite)).toHaveLength(5)
    for (const row of meta) {
      expect(row.source).toBe('db')
      expect(row.lastUsed?.unit).toBe('kg')
    }
  })

  it('does not write a settings row', async () => {
    await seedDatabase(ANCHOR)
    expect(await db.settings.count()).toBe(0)
  })

  it('marks every seeded record dirty in syncState', async () => {
    await seedDatabase(ANCHOR)
    const tables = [
      'programs',
      'programDays',
      'programExercises',
      'workouts',
      'workoutExercises',
      'sets',
      'bodyMetrics',
      'exerciseMeta',
    ] as const
    const dirty = new Set((await db.syncState.toArray()).map((r) => `${r.table}:${r.recordId}`))
    for (const table of tables) {
      const rows = await db.table(table).toArray()
      expect(rows.length, table).toBeGreaterThan(0)
      for (const row of rows) expect(dirty.has(`${table}:${row.id}`), `${table}:${row.id}`).toBe(true)
    }
  })
})

describe('buildHistory', () => {
  it('is deterministic for the same trees, anchor and a fresh rng', async () => {
    await seedDatabase(ANCHOR)
    const trees = {
      ppl: (await programs.loadTree((await programByName(PPL_NAME)).id))!,
      fbeod: (await programs.loadTree((await programByName(FBEOD_NAME)).id))!,
    }
    const strip = (value: unknown) =>
      JSON.stringify(value, (key, v) =>
        ['id', 'workoutId', 'workoutExerciseId'].includes(key) ? undefined : v,
      )
    const first = buildHistory({ trees, anchor: ANCHOR, rng: createRng() })
    const second = buildHistory({ trees, anchor: ANCHOR, rng: createRng() })
    expect(strip(second)).toBe(strip(first))
    expect(first.workouts.length).toBeGreaterThan(50)
  })
})

describe('ensureSeeded', () => {
  it('seeds an empty database, then writes nothing on a non-empty one', async () => {
    await ensureSeeded({ fresh: false, runId: 'a' })
    const before = (await db.programs.toArray()).map((p) => p.id).sort()
    const workoutCount = await db.workouts.count()
    expect(before).toHaveLength(4)

    await ensureSeeded({ fresh: false, runId: 'b' })
    expect((await db.programs.toArray()).map((p) => p.id).sort()).toEqual(before)
    expect(await db.workouts.count()).toBe(workoutCount)
  })

  it('does not touch existing user data in non-fresh mode', async () => {
    await programs.create({
      name: 'Mine',
      isActive: false,
      isArchived: false,
      currentDayIndex: 0,
      currentCycleIndex: 0,
    })
    await ensureSeeded({ fresh: false, runId: 'a' })
    expect(await db.programs.count()).toBe(1)
    expect(await db.workouts.count()).toBe(0)
  })

  it('wipes and reseeds once per run id in fresh mode', async () => {
    await ensureSeeded({ fresh: true, runId: 'run-1' })
    const first = (await db.programs.toArray()).map((p) => p.id).sort()
    expect(first).toHaveLength(4)
    expect(localStorage.getItem('ledger-seed-run')).toBe('run-1')

    // Same run id: a reload, so nothing is replaced.
    await ensureSeeded({ fresh: true, runId: 'run-1' })
    expect((await db.programs.toArray()).map((p) => p.id).sort()).toEqual(first)

    // New run id: a server restart, so the data is replaced.
    await ensureSeeded({ fresh: true, runId: 'run-2' })
    const second = (await db.programs.toArray()).map((p) => p.id).sort()
    expect(second).toHaveLength(4)
    expect(second.some((id) => first.includes(id))).toBe(false)
    expect(localStorage.getItem('ledger-seed-run')).toBe('run-2')
  })

  it('clears a stale rest timer when it reseeds', async () => {
    localStorage.setItem('ledger-rest-timer', '{"workoutId":"x"}')
    await ensureSeeded({ fresh: true, runId: 'run-1' })
    expect(localStorage.getItem('ledger-rest-timer')).toBeNull()
  })

  it('does not seed when only workouts exist (programs empty)', async () => {
    await workouts.create({ name: 'Quick session', startedAt: ANCHOR, status: 'finished', finishedAt: ANCHOR + 60_000 })
    await ensureSeeded({ fresh: false, runId: 'a' })
    expect(await db.programs.count()).toBe(0)
    expect(await db.workouts.count()).toBe(1)
  })

  it('does not seed when only soft-deleted programs exist', async () => {
    const mine = await programs.create({
      name: 'Mine',
      isActive: false,
      isArchived: false,
      currentDayIndex: 0,
      currentCycleIndex: 0,
    })
    await programs.softDelete(mine.id)
    await ensureSeeded({ fresh: false, runId: 'a' })
    expect(await db.programs.count()).toBe(1)
    expect(await db.workouts.count()).toBe(0)
  })

  it('never records a run id in non-fresh mode', async () => {
    await ensureSeeded({ fresh: false, runId: 'a' })
    expect(localStorage.getItem('ledger-seed-run')).toBeNull()
  })

  it('keeps user changes on a fresh-mode reload with the same run id', async () => {
    await ensureSeeded({ fresh: true, runId: 'run-1' })
    await programs.create({
      name: 'Mine',
      isActive: false,
      isArchived: false,
      currentDayIndex: 0,
      currentCycleIndex: 0,
    })
    const restTimer = '{"workoutId":"x"}'
    localStorage.setItem('ledger-rest-timer', restTimer)

    await ensureSeeded({ fresh: true, runId: 'run-1' })
    expect((await db.programs.toArray()).map((p) => p.name)).toContain('Mine')
    expect(await db.programs.count()).toBe(5)
    expect(localStorage.getItem('ledger-rest-timer')).toBe(restTimer)
  })

  it('reseeds an emptied database even when the run id is already stored', async () => {
    localStorage.setItem('ledger-seed-run', 'run-1')
    await ensureSeeded({ fresh: true, runId: 'run-1' })
    expect(await db.programs.count()).toBe(4)
    expect(await db.workouts.count()).toBeGreaterThan(50)
    expect(localStorage.getItem('ledger-seed-run')).toBe('run-1')
  })

  it('wipes user data, settings and the outbox on a new run id', async () => {
    await ensureSeeded({ fresh: true, runId: 'run-1' })
    await programs.create({
      name: 'Mine',
      isActive: false,
      isArchived: false,
      currentDayIndex: 0,
      currentCycleIndex: 0,
    })
    await settings.getOrInit()
    const outboxBefore = await db.syncState.count()

    await ensureSeeded({ fresh: true, runId: 'run-2' })
    const names = (await db.programs.toArray()).map((p) => p.name).sort()
    expect(names).toEqual([ARCHIVED_NAME, DRAFT_NAME, FBEOD_NAME, PPL_NAME].sort())
    expect(await db.settings.count()).toBe(0)
    // Only the new seed's marks remain, so the outbox does not grow per restart.
    expect(await db.syncState.count()).toBeLessThan(outboxBefore)
  })

  it('leaves the fresh seed in place when a later plain dev:seed boots', async () => {
    await ensureSeeded({ fresh: true, runId: 'run-1' })
    const ids = (await db.programs.toArray()).map((p) => p.id).sort()
    await ensureSeeded({ fresh: false, runId: 'run-9' })
    expect((await db.programs.toArray()).map((p) => p.id).sort()).toEqual(ids)
    expect(localStorage.getItem('ledger-seed-run')).toBe('run-1')
  })

  it('does not record the run id when seeding fails, so the next load retries', async () => {
    vi.spyOn(programs, 'setActive').mockRejectedValueOnce(new Error('boom'))
    await expect(ensureSeeded({ fresh: true, runId: 'run-1' })).rejects.toThrow('boom')
    expect(localStorage.getItem('ledger-seed-run')).toBeNull()
    vi.restoreAllMocks()

    await ensureSeeded({ fresh: true, runId: 'run-1' })
    expect(await db.programs.count()).toBe(4)
    expect((await db.programs.toArray()).filter((p) => p.isActive)).toHaveLength(1)
    expect(localStorage.getItem('ledger-seed-run')).toBe('run-1')
  })
})

describe('seedDatabase integrity', () => {
  it('links every workout to a real program day of its program', async () => {
    await seedDatabase(ANCHOR)
    const days = new Map((await db.programDays.toArray()).map((day) => [day.id, day]))
    const programsById = new Map((await db.programs.toArray()).map((p) => [p.id, p]))
    for (const workout of await db.workouts.toArray()) {
      const day = days.get(workout.programDayId!)
      expect(day, workout.id).toBeDefined()
      expect(day!.programId).toBe(workout.programId)
      expect(day!.name).toBe(workout.name)
      expect(programsById.get(workout.programId!)!.name).toBe(workout.programName)
    }
    const workoutIds = new Set((await db.workouts.toArray()).map((w) => w.id))
    const exerciseIds = new Set((await db.workoutExercises.toArray()).map((e) => e.id))
    for (const row of await db.workoutExercises.toArray()) expect(workoutIds.has(row.workoutId)).toBe(true)
    for (const row of await db.sets.toArray()) expect(exerciseIds.has(row.workoutExerciseId)).toBe(true)
  })

  it('has no orphan syncState rows and one row per record', async () => {
    await seedDatabase(ANCHOR)
    const outbox = await db.syncState.toArray()
    let records = 0
    for (const table of new Set(outbox.map((row) => row.table))) {
      const ids = new Set((await db.table(table).toArray()).map((row: { id: string }) => row.id))
      records += ids.size
      for (const row of outbox.filter((r) => r.table === table)) {
        expect(ids.has(row.recordId), `${table}:${row.recordId}`).toBe(true)
      }
    }
    expect(outbox).toHaveLength(records)
    expect(outbox.every((row) => typeof row.dirtyAt === 'number')).toBe(true)
  })

  it('takes exercise meta lastUsed from the latest finished set, never the discarded workout', async () => {
    await seedDatabase(ANCHOR)
    const finished = new Set(
      (await db.workouts.toArray()).filter((w) => w.status === 'finished').map((w) => w.id),
    )
    const exerciseOf = new Map(
      (await db.workoutExercises.toArray())
        .filter((row) => finished.has(row.workoutId))
        .map((row) => [row.id, row.exerciseRef.exerciseId]),
    )
    const latest = new Map<string, { weight: number; reps: number; at: number }>()
    for (const set of await db.sets.toArray()) {
      const id = exerciseOf.get(set.workoutExerciseId)
      if (!id) continue
      const current = latest.get(id)
      if (!current || set.completedAt! > current.at) {
        latest.set(id, { weight: set.weight, reps: set.reps, at: set.completedAt! })
      }
    }
    const meta = await db.exerciseMeta.toArray()
    expect(new Set(meta.map((m) => m.exerciseId)).size).toBe(meta.length)
    for (const row of meta) {
      expect(row.lastUsed, row.exerciseId).toEqual({ ...latest.get(row.exerciseId)!, unit: 'kg' })
    }
    expect(meta.filter((m) => m.isFavorite).map((m) => m.exerciseId).sort()).toEqual(
      ['barbell-bench-press', 'barbell-deadlift', 'barbell-squat', 'pull-up', 'romanian-deadlift'],
    )
  })

  it('spaces bodyweight entries a calendar week apart, the last one yesterday morning', async () => {
    await seedDatabase(ANCHOR)
    const rows = (await db.bodyMetrics.toArray()).sort((a, b) => a.measuredAt - b.measuredAt)
    const today = startOfDay(ANCHOR)
    expect(differenceInCalendarDays(rows.at(-1)!.measuredAt, today)).toBe(-1)
    expect(differenceInCalendarDays(rows[0].measuredAt, today)).toBe(-85)
    for (let i = 1; i < rows.length; i++) {
      expect(differenceInCalendarDays(rows[i].measuredAt, rows[i - 1].measuredAt)).toBe(7)
    }
    for (const row of rows) {
      const at = new Date(row.measuredAt)
      expect([at.getHours(), at.getMinutes()]).toEqual([7, 30])
      expect(row.createdAt).toBe(row.measuredAt)
    }
  })

  it('is deterministic end to end for a given anchor, apart from ids and write times', async () => {
    const snapshot = async () => {
      const strip = (value: unknown) =>
        JSON.stringify(value, (key, v) =>
          [
            'id',
            'workoutId',
            'workoutExerciseId',
            'programId',
            'programDayId',
            'createdAt',
            'updatedAt',
          ].includes(key)
            ? undefined
            : v,
        )
      const byTime = <T extends { createdAt: number }>(rows: T[]) =>
        [...rows].sort((a, b) => a.createdAt - b.createdAt)
      return strip({
        workouts: byTime(await db.workouts.toArray()),
        sets: byTime(await db.sets.toArray()).map((s) => [s.weight, s.reps, s.rir, s.completedAt]),
        bodyMetrics: byTime(await db.bodyMetrics.toArray()),
        exerciseMeta: (await db.exerciseMeta.toArray()).sort((a, b) =>
          a.exerciseId.localeCompare(b.exerciseId),
        ),
      })
    }
    await seedDatabase(ANCHOR)
    const first = await snapshot()
    await resetDb()
    await seedDatabase(ANCHOR)
    expect(await snapshot()).toBe(first)
  })

  it('never calls Math.random while seeding', async () => {
    const random = vi.spyOn(Math, 'random')
    await seedDatabase(ANCHOR)
    expect(random).not.toHaveBeenCalled()
  })
})

describe('clearDatabase', () => {
  it('empties every table', async () => {
    await seedDatabase(ANCHOR)
    await clearDatabase()
    for (const table of db.tables) expect(await table.count(), table.name).toBe(0)
  })
})
