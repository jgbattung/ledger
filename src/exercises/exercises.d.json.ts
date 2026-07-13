/**
 * Type declaration for the static JSON import of the bundled exercise
 * catalog. Vendored from `free-exercise-db`
 * (https://github.com/yuhonas/free-exercise-db, Unlicense/public domain),
 * pinned commit b0eed061e1c832b3ed815fbaa4b45b3cdc14df49.
 *
 * Declared here (relying on `allowArbitraryExtensions`) instead of enabling
 * `resolveJsonModule`, which would make tsc infer a huge literal type from
 * the ~1MB `exercises.json` file.
 */
import type { Exercise } from './types'

declare const exercises: Exercise[]
export default exercises
