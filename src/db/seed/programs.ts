import { newId } from '@/db/ids'
import type { ExerciseRef } from '@/db/types'
import type { DraftDay, DraftExercise, ProgramDraft } from '@/programs/model'

export const PPL_NAME = 'PPL-R-UL'
export const FBEOD_NAME = 'FBEOD'
export const ARCHIVED_NAME = 'Old 5x5'
export const DRAFT_NAME = 'Arm Day (draft)'

export const PUSH_DAY = 'Push'
export const PULL_DAY = 'Pull'
export const LEGS_DAY = 'Legs'

/** Main compounds rest 3:00, secondary compounds 2:00, isolations 1:30. */
const MAIN = 180
const SECONDARY = 120
const ISOLATION = 90

function lift(
  exerciseId: string,
  workingSets: number,
  repMin: number,
  repMax: number,
  rirTarget: number,
  restSeconds: number,
  source: ExerciseRef['source'] = 'db',
): DraftExercise {
  return {
    id: newId(),
    exerciseRef: { source, exerciseId },
    workingSets,
    repMin,
    repMax,
    rirTarget,
    restSeconds,
  }
}

/** An exercise added to a day but never configured (blank targets). */
function unconfigured(exerciseId: string): DraftExercise {
  return { id: newId(), exerciseRef: { source: 'db', exerciseId } }
}

function day(name: string, exercises: DraftExercise[] = []): DraftDay {
  return { id: newId(), name, exercises }
}

function draft(name: string, days: DraftDay[]): ProgramDraft {
  return { id: newId(), isNew: true, name, isActive: false, isArchived: false, days }
}

/**
 * The four seeded programs. Exercise ids were looked up in
 * `src/exercises/exercises.json`; never guess or hand-write new ones.
 * `custom.ssbSquatId` adds the seeded custom SSB Squat to the Legs day.
 */
export function buildSeedDrafts(custom: { ssbSquatId?: string } = {}): ProgramDraft[] {
  const ppl = draft(PPL_NAME, [
    day(PUSH_DAY, [
      lift('barbell-bench-press', 3, 5, 8, 1, MAIN),
      lift('incline-dumbbell-press', 3, 8, 10, 1, SECONDARY),
      lift('dumbbell-shoulder-press', 3, 8, 10, 1, SECONDARY),
      lift('cable-lateral-raise', 3, 12, 15, 0, ISOLATION),
      lift('triceps-pushdown', 3, 10, 12, 0, ISOLATION),
      lift('cable-rope-overhead-triceps-extension', 2, 10, 12, 0, ISOLATION),
    ]),
    day(PULL_DAY, [
      lift('pull-up', 3, 6, 10, 1, MAIN),
      lift('bent-over-barbell-row', 3, 6, 8, 1, MAIN),
      lift('lat-pulldown', 3, 10, 12, 1, SECONDARY),
      lift('face-pull', 3, 12, 15, 0, ISOLATION),
      lift('barbell-curl', 3, 8, 10, 0, ISOLATION),
      lift('hammer-curls', 2, 10, 12, 0, ISOLATION),
    ]),
    day(LEGS_DAY, [
      lift('barbell-squat', 3, 5, 8, 2, MAIN),
      ...(custom.ssbSquatId ? [lift(custom.ssbSquatId, 3, 5, 8, 2, MAIN, 'custom')] : []),
      lift('romanian-deadlift', 3, 8, 10, 1, MAIN),
      lift('leg-press', 3, 10, 12, 1, SECONDARY),
      lift('seated-leg-curl', 3, 10, 12, 0, ISOLATION),
      lift('leg-extensions', 2, 12, 15, 0, ISOLATION),
      lift('standing-calf-raises', 3, 10, 15, 0, ISOLATION),
    ]),
    day('Rest'),
    day('Upper', [
      lift('incline-barbell-bench-press', 3, 6, 8, 1, MAIN),
      lift('seated-cable-rows', 3, 8, 10, 1, SECONDARY),
      lift('barbell-shoulder-press', 3, 6, 8, 1, MAIN),
      lift('chin-up', 3, 6, 10, 1, MAIN),
      lift('side-lateral-raise', 3, 12, 15, 0, ISOLATION),
    ]),
    day('Lower', [
      lift('barbell-deadlift', 3, 3, 5, 2, MAIN),
      lift('front-barbell-squat', 3, 6, 8, 1, MAIN),
      lift('dumbbell-lunges', 3, 8, 10, 1, SECONDARY),
      lift('lying-leg-curls', 3, 10, 12, 0, ISOLATION),
      lift('seated-calf-raise', 3, 10, 15, 0, ISOLATION),
    ]),
  ])

  const fbeod = draft(FBEOD_NAME, [
    day('Full Body A', [
      lift('barbell-squat', 3, 5, 8, 2, MAIN),
      lift('barbell-bench-press', 3, 5, 8, 1, MAIN),
      lift('bent-over-barbell-row', 3, 6, 8, 1, MAIN),
      lift('cable-lateral-raise', 2, 12, 15, 0, ISOLATION),
      lift('barbell-curl', 2, 8, 10, 0, ISOLATION),
    ]),
    day('Rest'),
    day('Full Body B', [
      lift('romanian-deadlift', 3, 8, 10, 1, MAIN),
      lift('barbell-shoulder-press', 3, 6, 8, 1, MAIN),
      lift('lat-pulldown', 3, 8, 10, 1, SECONDARY),
      lift('leg-press', 2, 10, 12, 1, SECONDARY),
      lift('triceps-pushdown', 2, 10, 12, 0, ISOLATION),
    ]),
    day('Rest'),
  ])

  const archived = draft(ARCHIVED_NAME, [
    day('A', [
      lift('barbell-squat', 5, 5, 5, 1, MAIN),
      lift('barbell-bench-press', 5, 5, 5, 1, MAIN),
      lift('bent-over-barbell-row', 5, 5, 5, 1, MAIN),
    ]),
    day('B', [
      lift('barbell-squat', 5, 5, 5, 1, MAIN),
      lift('barbell-shoulder-press', 5, 5, 5, 1, MAIN),
      lift('barbell-deadlift', 1, 5, 5, 1, MAIN),
    ]),
  ])

  // Hammer curls has no targets at all, so the activation gate (LG-052) trips.
  const incomplete = draft(DRAFT_NAME, [
    day('Arms', [
      lift('barbell-curl', 3, 8, 10, 0, ISOLATION),
      lift('triceps-pushdown', 3, 10, 12, 0, ISOLATION),
      unconfigured('hammer-curls'),
    ]),
  ])

  return [ppl, fbeod, archived, incomplete]
}

export type Progression = { startKg: number; incrementKg: number }

/**
 * Starting load and double-progression step per exercise (kg, multiples of
 * 0.5; dumbbell loads are per hand). Bodyweight movements stay at 0 and 0.
 * Covers every exercise used by PPL-R-UL and FBEOD, plus the one swap target.
 */
export const PROGRESSION: Record<string, Progression> = {
  'barbell-bench-press': { startKg: 70, incrementKg: 2.5 },
  'incline-dumbbell-press': { startKg: 24, incrementKg: 2 },
  'dumbbell-shoulder-press': { startKg: 20, incrementKg: 2 },
  'cable-lateral-raise': { startKg: 6, incrementKg: 1 },
  'triceps-pushdown': { startKg: 30, incrementKg: 2.5 },
  'cable-rope-overhead-triceps-extension': { startKg: 25, incrementKg: 2.5 },
  'pull-up': { startKg: 0, incrementKg: 0 },
  'bent-over-barbell-row': { startKg: 65, incrementKg: 2.5 },
  'lat-pulldown': { startKg: 60, incrementKg: 2.5 },
  'wide-grip-lat-pulldown': { startKg: 55, incrementKg: 2.5 },
  'face-pull': { startKg: 25, incrementKg: 2.5 },
  'barbell-curl': { startKg: 30, incrementKg: 2.5 },
  'hammer-curls': { startKg: 12, incrementKg: 1 },
  'barbell-squat': { startKg: 90, incrementKg: 2.5 },
  'romanian-deadlift': { startKg: 90, incrementKg: 2.5 },
  'leg-press': { startKg: 160, incrementKg: 5 },
  'seated-leg-curl': { startKg: 45, incrementKg: 2.5 },
  'leg-extensions': { startKg: 50, incrementKg: 2.5 },
  'standing-calf-raises': { startKg: 80, incrementKg: 2.5 },
  'incline-barbell-bench-press': { startKg: 55, incrementKg: 2.5 },
  'seated-cable-rows': { startKg: 55, incrementKg: 2.5 },
  'barbell-shoulder-press': { startKg: 40, incrementKg: 2.5 },
  'chin-up': { startKg: 0, incrementKg: 0 },
  'side-lateral-raise': { startKg: 8, incrementKg: 1 },
  'barbell-deadlift': { startKg: 120, incrementKg: 5 },
  'front-barbell-squat': { startKg: 70, incrementKg: 2.5 },
  'dumbbell-lunges': { startKg: 18, incrementKg: 2 },
  'lying-leg-curls': { startKg: 35, incrementKg: 2.5 },
  'seated-calf-raise': { startKg: 40, incrementKg: 2.5 },
}
