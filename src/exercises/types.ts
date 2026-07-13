/**
 * Record shape for the bundled exercise catalog (LG-004). Data is vendored
 * verbatim from `free-exercise-db` (https://github.com/yuhonas/free-exercise-db,
 * Unlicense/public domain), pinned commit b0eed061e1c832b3ed815fbaa4b45b3cdc14df49.
 * Fields stay loose strings; owning stories may tighten filter vocabularies
 * later (LG-005).
 */
export type Exercise = {
  id: string
  name: string
  force: string | null
  level: string
  mechanic: string | null
  equipment: string | null
  primaryMuscles: string[]
  secondaryMuscles: string[]
  instructions: string[]
  category: string
  images: string[]
}
