import { addMinutes, set as setTime, startOfDay, subDays } from 'date-fns'
import { newId } from '@/db/ids'
import { getExerciseById } from '@/exercises/catalog'
import { toTargetsSnapshot } from '@/workouts/model'
import { PROGRESSION } from '@/db/seed/programs'
import type { Rng } from '@/db/seed/rng'
import type { ProgramTree } from '@/db/repos/programs'
import type { ExerciseRef, Set as SetRow, Workout, WorkoutExercise } from '@/db/types'

export type SeedHistory = {
  workouts: Workout[]
  workoutExercises: WorkoutExercise[]
  sets: SetRow[]
}

type Slot = {
  /** Whole days before the local start of the anchor day (negative). */
  offset: number
  tree: ProgramTree
  dayIndex: number
}

type LiftState = { kg: number; level: number | null }

const FBEOD_FIRST_OFFSET = -84
const FBEOD_DAYS = 28
const PPL_FIRST_OFFSET = -56
/** Nine full six-day passes, then Push at -2 and Pull at -1. */
const PPL_DAYS = 56
const MISSED_WORKOUTS = 3

/** Programmed exercise and the exercise actually performed in its place. */
const SWAP_PROGRAMMED = 'lat-pulldown'
const SWAP_PERFORMED = 'wide-grip-lat-pulldown'
const SWAP_ON_PULL_NUMBER = 4

const NOTES = [
  'Felt strong today',
  'Slept badly, kept the effort moderate',
  'Left shoulder a little tight on pressing',
  'Gym was packed, moved fast',
  'Good pump, easy warm-up',
  'Low energy but got it done',
]

function ref(exerciseId: string): ExerciseRef {
  return { source: 'db', exerciseId }
}

function buildSlots(trees: { ppl: ProgramTree; fbeod: ProgramTree }): Slot[] {
  const slots: Slot[] = []
  for (let i = 0; i < FBEOD_DAYS; i++) {
    slots.push({
      offset: FBEOD_FIRST_OFFSET + i,
      tree: trees.fbeod,
      dayIndex: i % trees.fbeod.days.length,
    })
  }
  for (let i = 0; i < PPL_DAYS; i++) {
    slots.push({
      offset: PPL_FIRST_OFFSET + i,
      tree: trees.ppl,
      dayIndex: i % trees.ppl.days.length,
    })
  }
  return slots.filter((slot) => slot.tree.days[slot.dayIndex].exercises.length > 0)
}

/**
 * Pure generator for about 12 weeks of workout history. It never reads the
 * clock or touches Dexie: all dates derive from `anchor` and all variation
 * from `rng`, so a given anchor and a fresh rng always give the same output.
 */
export function buildHistory(input: {
  trees: { ppl: ProgramTree; fbeod: ProgramTree }
  anchor: number
  rng: Rng
}): SeedHistory {
  const { trees, anchor, rng } = input
  const today = startOfDay(anchor)
  const slots = buildSlots(trees)

  // Missed slots: 3 PPL-R-UL workout slots, never the last two (Push at -2
  // and Pull at -1 match the seeded pass state). The middle one is the
  // discarded workout.
  const pplSlots = slots.filter((slot) => slot.tree === trees.ppl)
  const candidates = pplSlots.slice(0, -2)
  const missed = new Set<Slot>()
  while (missed.size < MISSED_WORKOUTS) missed.add(rng.pick(candidates))
  const missedInOrder = candidates.filter((slot) => missed.has(slot))
  const discardedSlot = missedInOrder[1]

  const swapSlot = pplSlots
    .filter((slot) => !missed.has(slot) && slot.tree.days[slot.dayIndex].day.name === 'Pull')
    .at(SWAP_ON_PULL_NUMBER)

  const lifts = new Map<string, LiftState>()
  function liftState(exerciseId: string): LiftState {
    let state = lifts.get(exerciseId)
    if (!state) {
      const progression = PROGRESSION[exerciseId]
      if (!progression) throw new Error(`No progression entry for ${exerciseId}`)
      state = { kg: progression.startKg, level: null }
      lifts.set(exerciseId, state)
    }
    return state
  }

  const workouts: Workout[] = []
  const workoutExercises: WorkoutExercise[] = []
  const sets: SetRow[] = []

  for (const slot of slots) {
    const isMissed = missed.has(slot)
    if (isMissed && slot !== discardedSlot) continue

    const { day, exercises } = slot.tree.days[slot.dayIndex]
    const discarded = slot === discardedSlot
    const date = setTime(subDays(today, -slot.offset), { hours: 18 })
    const startedAt = addMinutes(date, rng.int(-45, 60)).getTime()
    const activeMs = rng.int(50, 80) * 60_000 + rng.int(0, 59_999)
    const paused = !discarded && rng.chance(1 / 6)
    const pausedMs = paused ? rng.int(2, 6) * 60_000 : 0
    const finishedAt = startedAt + activeMs + pausedMs
    const note = !discarded && rng.chance(1 / 5) ? rng.pick(NOTES) : undefined

    const workout: Workout = {
      id: newId(),
      createdAt: startedAt,
      updatedAt: startedAt,
      deletedAt: null,
      programId: slot.tree.program.id,
      programDayId: day.id,
      programName: slot.tree.program.name,
      name: day.name,
      startedAt,
      status: discarded ? 'discarded' : 'finished',
      cycleIndexAtTime: 0,
      ...(discarded ? {} : { finishedAt }),
      ...(note ? { notes: note } : {}),
      ...(paused ? { pausedAt: null, pausedMs } : {}),
    }
    workouts.push(workout)

    // Completed sets of this workout, in order, to spread across its window.
    const pending: { row: SetRow; windowIndex: number }[] = []
    const swapHere = slot === swapSlot

    for (const [exerciseIndex, programmed] of exercises.entries()) {
      const swapped = swapHere && programmed.exerciseRef.exerciseId === SWAP_PROGRAMMED
      const performedRef = swapped ? ref(SWAP_PERFORMED) : programmed.exerciseRef
      const performedId = performedRef.exerciseId

      const workoutExercise: WorkoutExercise = {
        id: newId(),
        createdAt: startedAt,
        updatedAt: startedAt,
        deletedAt: null,
        workoutId: workout.id,
        orderIndex: exerciseIndex,
        exerciseRef: performedRef,
        targetsSnapshot: toTargetsSnapshot(programmed),
        ...(swapped ? { swappedFrom: programmed.exerciseRef } : {}),
      }
      workoutExercises.push(workoutExercise)

      // A discarded workout was abandoned early: two sets on the first lift.
      const setCount = discarded
        ? exerciseIndex === 0
          ? 2
          : 0
        : (programmed.workingSets ?? 3)
      if (setCount === 0) continue

      const repMin = programmed.repMin ?? 8
      const repMax = programmed.repMax ?? 10
      const state = liftState(performedId)
      const level = Math.min(repMax, Math.max(repMin, state.level ?? repMin))
      const isolation = getExerciseById(performedId)?.mechanic === 'isolation'

      let loss = 0
      for (let setIndex = 0; setIndex < setCount; setIndex++) {
        // Every set hits the top of the range once the lift is ready to go up.
        if (level < repMax && setIndex > 0) loss = Math.min(2, loss + rng.int(0, 1))
        const last = setIndex === setCount - 1
        const row: SetRow = {
          id: newId(),
          createdAt: startedAt,
          updatedAt: startedAt,
          deletedAt: null,
          workoutExerciseId: workoutExercise.id,
          orderIndex: setIndex,
          type: 'working',
          weight: state.kg,
          reps: Math.max(1, level - loss),
          rir: last ? 0 : rng.int(1, 2),
          rirIsPlus: false,
          ...(!discarded && last && isolation && rng.chance(0.05)
            ? { partialReps: rng.int(1, 3) }
            : {}),
        }
        pending.push({ row, windowIndex: pending.length })
        sets.push(row)
      }

      if (discarded) continue

      // Double progression: climb the rep range, then add load.
      const progression = PROGRESSION[performedId]
      if (level >= repMax) {
        if (progression.incrementKg > 0) {
          state.kg += progression.incrementKg
          state.level = repMin
        } else {
          state.level = repMax
        }
      } else {
        state.level = rng.chance(0.85) ? level + 1 : level
      }
    }

    // Stamp completion times strictly inside (startedAt, finishedAt).
    const total = pending.length
    for (const { row, windowIndex } of pending) {
      const span = discarded ? 12 * 60_000 : activeMs + pausedMs
      const fraction = 0.04 + (0.9 * (windowIndex + 1)) / total
      const completedAt = startedAt + Math.floor(span * fraction) + rng.int(0, 20_000)
      row.completedAt = completedAt
      row.createdAt = completedAt
      row.updatedAt = completedAt
    }
  }

  return { workouts, workoutExercises, sets }
}
