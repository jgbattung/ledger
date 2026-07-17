/**
 * Ledger-owned exercise schema (LG-047). `exercises.json` is a generated,
 * checked-in artifact of the curation pipeline in `scripts/curation/` -
 * never hand-edit it; edit the decision files and run `npm run curate`.
 * `free-exercise-db` is a curation seed only. See `.gsd/exercise-model.md`
 * for the full schema reference, taxonomy, and variation model.
 */

/** Owned muscle taxonomy (19 values, granular splits per exercise-model.md). */
export type Muscle =
  | 'chest'
  | 'lats'
  | 'upper back'
  | 'lower back'
  | 'traps'
  | 'front delts'
  | 'side delts'
  | 'rear delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'adductors'
  | 'abductors'
  | 'calves'

/** Owned equipment taxonomy (10 values). Display/filter tag only - no
 * equipment entity or mutation path (LIB-4). */
export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'smith machine'
  | 'bodyweight'
  | 'band'
  | 'kettlebell'
  | 'ez bar'
  | 'other'

export type Category = 'strength' | 'cardio' | 'mobility'
export type Mechanic = 'compound' | 'isolation'

export type Exercise = {
  id: string // permanent kebab-case slug of the canonical name
  name: string // canonical display name
  aliases: string[] // alternate names for search; may be empty
  primaryMuscles: Muscle[]
  secondaryMuscles: Muscle[]
  equipment: Equipment
  category: Category
  mechanic: Mechanic
  instructions: string[]
  images: string[] // paths under public/exercises/; may be empty (UI placeholder)
}
