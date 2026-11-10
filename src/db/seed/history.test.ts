import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { differenceInCalendarDays, startOfDay } from 'date-fns'
import { db } from '@/db/ledger'
import { resetDb } from '@/db/test-utils'
import { programs } from '@/db/repos'
import { getExerciseById } from '@/exercises/catalog'
import { toTargetsSnapshot } from '@/workouts/model'
import { buildHistory } from '@/db/seed/history'
import type { SeedHistory } from '@/db/seed/history'
import { seedDatabase } from '@/db/seed'
import { FBEOD_NAME, PPL_NAME, PROGRESSION, PULL_DAY, PUSH_DAY } from '@/db/seed/programs'
import { createRng } from '@/db/seed/rng'
import type { ProgramTree } from '@/db/repos/programs'
import type { Set as SetRow, Workout, WorkoutExercise } from '@/db/types'

const ANCHOR = new Date(2026, 10, 10, 15, 0).getTime()
const MINUTE = 60_000
/** Enough rng seeds to exercise the random branches (missed slots, swaps, partials). */
const SEEDS = Array.from({ length: 25 }, (_, i) => i + 1)

let trees: { ppl: ProgramTree; fbeod: ProgramTree }

beforeAll(async () => {
  await resetDb()
  await seedDatabase(ANCHOR)
  const all = await db.programs.toArray()
  const tree = async (name: string) =>
    (await programs.loadTree(all.find((program) => program.name === name)!.id))!
  trees = { ppl: await tree(PPL_NAME), fbeod: await tree(FBEOD_NAME) }
})

afterEach(() => {
  vi.restoreAllMocks()
})

function build(anchor = ANCHOR, seed?: number): SeedHistory {
  return buildHistory({ trees, anchor, rng: createRng(seed) })
}

/** Day offset of a timestamp relative to the local start of the anchor day. */
function offsetOf(anchor: number, at: number): number {
  return differenceInCalendarDays(at, startOfDay(anchor))
}

function strip(value: unknown): string {
  return JSON.stringify(value, (key, v) =>
    ['id', 'workoutId', 'workoutExerciseId'].includes(key) ? undefined : v,
  )
}

/** Each workout with its exercises (by orderIndex) and their sets (by orderIndex). */
function grouped(history: SeedHistory) {
  return history.workouts.map((workout) => {
    const exercises = history.workoutExercises
      .filter((row) => row.workoutId === workout.id)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((exercise) => ({
        exercise,
        sets: history.sets
          .filter((set) => set.workoutExerciseId === exercise.id)
          .sort((a, b) => a.orderIndex - b.orderIndex),
      }))
    return { workout, exercises }
  })
}

function treeOf(workout: Workout): ProgramTree {
  return workout.programId === trees.ppl.program.id ? trees.ppl : trees.fbeod
}

describe('buildHistory calendar', () => {
  const anchors: [string, number][] = [
    ['mid-afternoon', ANCHOR],
    ['just after midnight', new Date(2026, 10, 10, 0, 0, 0, 1).getTime()],
    ['just before midnight', new Date(2026, 10, 10, 23, 59, 59, 999).getTime()],
    ['the day after a US/EU autumn DST change', new Date(2026, 10, 2, 9, 0).getTime()],
    ['the day after a US spring DST change', new Date(2026, 2, 9, 9, 0).getTime()],
    ['New Year day', new Date(2027, 0, 1, 0, 0, 30).getTime()],
  ]

  it.each(anchors)('puts every workout on its program slot (%s)', (_label, anchor) => {
    const history = build(anchor)
    const offsets = history.workouts.map((w) => offsetOf(anchor, w.startedAt))

    // One workout per calendar day at most, 84 days back up to yesterday.
    expect(new Set(offsets).size).toBe(offsets.length)
    expect(Math.min(...offsets)).toBe(-84)
    expect(Math.max(...offsets)).toBe(-1)

    for (const workout of history.workouts) {
      const offset = offsetOf(anchor, workout.startedAt)
      const isFbeod = offset < -56
      const tree = isFbeod ? trees.fbeod : trees.ppl
      const index = isFbeod ? (offset + 84) % 4 : (offset + 56) % 6
      const { day } = tree.days[index]

      expect(workout.programId).toBe(tree.program.id)
      expect(workout.programName).toBe(tree.program.name)
      expect(workout.programDayId).toBe(day.id)
      expect(workout.name).toBe(day.name)
      expect(workout.cycleIndexAtTime).toBe(0)

      // Around 18:00 local (jitter -45..+60 min), never crossing into the next day.
      const started = new Date(workout.startedAt)
      const minutes = started.getHours() * 60 + started.getMinutes()
      expect(minutes).toBeGreaterThanOrEqual(17 * 60 + 15)
      expect(minutes).toBeLessThanOrEqual(19 * 60)
      if (workout.finishedAt !== undefined) {
        expect(offsetOf(anchor, workout.finishedAt)).toBe(offset)
      }
    }

    // Rest days never get a workout.
    expect(history.workouts.some((w) => w.name === 'Rest')).toBe(false)

    // The last two days match the seeded pass state: Push then Pull, both finished.
    const byTime = [...history.workouts].sort((a, b) => a.startedAt - b.startedAt)
    expect(byTime.at(-2)).toMatchObject({ name: PUSH_DAY, status: 'finished' })
    expect(offsetOf(anchor, byTime.at(-2)!.startedAt)).toBe(-2)
    expect(byTime.at(-1)).toMatchObject({ name: PULL_DAY, status: 'finished' })
    expect(offsetOf(anchor, byTime.at(-1)!.startedAt)).toBe(-1)
    expect(byTime.at(-1)!.finishedAt!).toBeLessThan(startOfDay(anchor).getTime())
  })

  it('depends only on the local anchor day, not the time of day', () => {
    const early = build(new Date(2026, 10, 10, 0, 0, 0, 0).getTime())
    const late = build(new Date(2026, 10, 10, 23, 59, 59, 999).getTime())
    expect(strip(late)).toBe(strip(early))
  })

  it('never reads the clock or the platform RNG', () => {
    const random = vi.spyOn(Math, 'random')
    const clock = vi.spyOn(Date, 'now')
    build()
    expect(random).not.toHaveBeenCalled()
    expect(clock).not.toHaveBeenCalled()
  })
})

describe.each(SEEDS)('buildHistory invariants (rng seed %i)', (seed) => {
  const history = () => build(ANCHOR, seed)

  it('misses exactly 3 PPL-R-UL slots, never the last two, one of them discarded', () => {
    const h = history()
    const ppl = h.workouts.filter((w) => w.programName === PPL_NAME)
    const fbeod = h.workouts.filter((w) => w.programName === FBEOD_NAME)
    expect(fbeod).toHaveLength(14)
    expect(fbeod.every((w) => w.status === 'finished')).toBe(true)

    // 47 workout slots; 2 produce nothing and 1 produces the discarded workout.
    expect(ppl).toHaveLength(45)
    const discarded = h.workouts.filter((w) => w.status === 'discarded')
    expect(discarded).toHaveLength(1)
    expect(discarded[0].programName).toBe(PPL_NAME)
    expect(offsetOf(ANCHOR, discarded[0].startedAt)).toBeLessThan(-2)
    expect(h.workouts.some((w) => w.status === 'in_progress')).toBe(false)

    const pplOffsets = new Set(ppl.map((w) => offsetOf(ANCHOR, w.startedAt)))
    const missing = []
    for (let offset = -56; offset <= -1; offset++) {
      const isRest = trees.ppl.days[(offset + 56) % 6].exercises.length === 0
      if (!isRest && !pplOffsets.has(offset)) missing.push(offset)
    }
    expect(missing).toHaveLength(2)
    expect(missing.every((offset) => offset < -2)).toBe(true)
  })

  it('discards one workout early: two sets on the first lift, no finish, pause or note', () => {
    const discarded = grouped(history()).find(({ workout }) => workout.status === 'discarded')!
    const { workout, exercises } = discarded
    expect(workout.finishedAt).toBeUndefined()
    expect(workout.notes).toBeUndefined()
    expect(workout.pausedMs).toBeUndefined()
    expect(exercises.length).toBe(treeOf(workout).days.find((d) => d.day.id === workout.programDayId)!.exercises.length)
    expect(exercises[0].sets).toHaveLength(2)
    expect(exercises.slice(1).every(({ sets }) => sets.length === 0)).toBe(true)
    for (const set of exercises[0].sets) {
      expect(set.completedAt!).toBeGreaterThan(workout.startedAt)
      expect(set.completedAt!).toBeLessThanOrEqual(workout.startedAt + 13 * MINUTE)
      expect(set.partialReps).toBeUndefined()
    }
  })

  it('swaps exactly one exercise on a finished Pull day', () => {
    const h = history()
    const swapped = h.workoutExercises.filter((row) => row.swappedFrom)
    expect(swapped).toHaveLength(1)
    const [row] = swapped
    const workout = h.workouts.find((w) => w.id === row.workoutId)!
    expect(workout).toMatchObject({ name: PULL_DAY, status: 'finished', programName: PPL_NAME })
    expect(row.swappedFrom).toEqual({ source: 'db', exerciseId: 'lat-pulldown' })
    expect(row.exerciseRef).toEqual({ source: 'db', exerciseId: 'wide-grip-lat-pulldown' })
    expect(h.sets.filter((set) => set.workoutExerciseId === row.id).length).toBeGreaterThan(0)
  })

  it('mirrors the programmed day: exercise order and targets snapshot', () => {
    for (const { workout, exercises } of grouped(history())) {
      const programmed = treeOf(workout).days.find((d) => d.day.id === workout.programDayId)!
      expect(exercises.map(({ exercise }) => exercise.orderIndex)).toEqual(
        programmed.exercises.map((_, index) => index),
      )
      exercises.forEach(({ exercise }, index) => {
        const target = programmed.exercises[index]
        expect(exercise.targetsSnapshot).toEqual(toTargetsSnapshot(target))
        expect(exercise.swappedFrom?.exerciseId ?? exercise.exerciseRef.exerciseId).toBe(
          target.exerciseRef.exerciseId,
        )
        expect(exercise.createdAt).toBe(workout.startedAt)
        expect(exercise.updatedAt).toBe(workout.startedAt)
      })
    }
  })

  it('stamps sets strictly in order inside the workout window', () => {
    for (const { workout, exercises } of grouped(history())) {
      const times = exercises.flatMap(({ sets }) => sets.map((set) => set.completedAt!))
      for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1])
      if (workout.status !== 'finished') continue
      expect(times[0]).toBeGreaterThan(workout.startedAt)
      expect(times.at(-1)!).toBeLessThan(workout.finishedAt!)
      for (const { sets } of exercises) {
        for (const set of sets) {
          expect(set.createdAt).toBe(set.completedAt)
          expect(set.updatedAt).toBe(set.completedAt)
        }
      }
    }
  })

  it('keeps finished workouts at 50-80 active minutes, with sane pause and notes', () => {
    for (const workout of history().workouts) {
      expect(workout.createdAt).toBe(workout.startedAt)
      expect(workout.updatedAt).toBe(workout.startedAt)
      if (workout.status !== 'finished') continue
      const pausedMs = workout.pausedMs ?? 0
      const active = workout.finishedAt! - workout.startedAt - pausedMs
      expect(active).toBeGreaterThanOrEqual(50 * MINUTE)
      expect(active).toBeLessThan(81 * MINUTE)
      if (workout.pausedMs !== undefined) {
        expect(workout.pausedAt).toBeNull()
        expect(pausedMs % MINUTE).toBe(0)
        expect(pausedMs).toBeGreaterThanOrEqual(2 * MINUTE)
        expect(pausedMs).toBeLessThanOrEqual(6 * MINUTE)
      }
      if (workout.notes !== undefined) expect(workout.notes.length).toBeGreaterThan(0)
    }
  })

  it('logs programmed set counts with reps, RIR and partials relative to targets', () => {
    for (const { workout, exercises } of grouped(history())) {
      if (workout.status !== 'finished') continue
      for (const { exercise, sets } of exercises) {
        const { workingSets, repMin, repMax } = exercise.targetsSnapshot!
        expect(sets).toHaveLength(workingSets!)
        const isolation = getExerciseById(exercise.exerciseRef.exerciseId)?.mechanic === 'isolation'
        sets.forEach((set, index) => {
          const last = index === sets.length - 1
          expect(set.type).toBe('working')
          expect(set.reps).toBeGreaterThanOrEqual(Math.max(1, repMin! - 2))
          expect(set.reps).toBeLessThanOrEqual(repMax!)
          expect(set.rir).toBe(last ? 0 : set.rir)
          if (!last) expect([1, 2]).toContain(set.rir)
          expect(set.rirIsPlus).toBe(false)
          if (set.partialReps !== undefined) {
            expect(last && isolation).toBe(true)
            expect(set.partialReps).toBeGreaterThanOrEqual(1)
            expect(set.partialReps).toBeLessThanOrEqual(3)
          }
        })
        // Later sets never gain reps within a session.
        for (let i = 1; i < sets.length; i++) expect(sets[i].reps).toBeLessThanOrEqual(sets[i - 1].reps)
      }
    }
  })

  it('progresses loads on the plate table: never negative, never down, one step at a time', () => {
    const sessions = new Map<string, { exercise: WorkoutExercise; sets: SetRow[] }[]>()
    const finished = grouped(history())
      .filter(({ workout }) => workout.status === 'finished')
      .sort((a, b) => a.workout.startedAt - b.workout.startedAt)
    for (const { exercises } of finished) {
      for (const entry of exercises) {
        const id = entry.exercise.exerciseRef.exerciseId
        sessions.set(id, [...(sessions.get(id) ?? []), entry])
      }
    }

    for (const [id, list] of sessions) {
      const { startKg, incrementKg } = PROGRESSION[id]
      let previous: { weight: number; topped: boolean } | undefined
      for (const { exercise, sets } of list) {
        const weight = sets[0].weight
        // One load per session, on the start + n * increment ladder.
        expect(sets.every((set) => set.weight === weight), id).toBe(true)
        expect(weight, id).toBeGreaterThanOrEqual(0)
        expect((weight * 2) % 1, id).toBe(0)
        if (incrementKg === 0) expect(weight, id).toBe(startKg)
        else expect(((weight - startKg) / incrementKg) % 1, id).toBe(0)

        if (previous) {
          // Load only goes up, by one step, after every set reached the top of the range.
          expect(weight, id).toBeGreaterThanOrEqual(previous.weight)
          if (weight > previous.weight) {
            expect(weight - previous.weight, id).toBe(incrementKg)
            expect(previous.topped, id).toBe(true)
          }
        }
        const repMax = exercise.targetsSnapshot!.repMax!
        previous = { weight, topped: sets.every((set) => set.reps === repMax) }
      }
    }
  })
})
