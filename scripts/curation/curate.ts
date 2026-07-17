/**
 * Ledger exercise curation pipeline (LG-047). Pure `buildCatalog()` plus a
 * CLI that regenerates `src/exercises/exercises.json` and `REVIEW.md` from
 * the pinned `free-exercise-db` seed and the decision files in this
 * directory (`keeps.ts`, `drops.ts`, `additions.ts`). Never hand-edit the
 * generated JSON - edit the decision files and re-run `npm run curate`.
 *
 * Runs directly under Node 22 (native TS type stripping) - no tsx/ts-node.
 * See `.gsd/exercise-model.md` for the schema/taxonomy/curation contract.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Category, Equipment, Exercise, Mechanic, Muscle } from '../../src/exercises/types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

export type SeedExercise = {
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

export type KeepDecision = {
  name: string
  aliases: string[]
  primaryMuscles: Muscle[]
  secondaryMuscles: Muscle[]
  equipment: Equipment
  category: Category
  mechanic: Mechanic
}

export type DropReason =
  | 'stretch'
  | 'cardio'
  | 'plyometric'
  | 'strongman-event'
  | 'novelty-junk'
  | 'neck'
  | 'scope-trim'
  | `duplicate-of:${string}`

export type Addition = {
  name: string
  aliases: string[]
  primaryMuscles: Muscle[]
  secondaryMuscles: Muscle[]
  equipment: Equipment
  category: Category
  mechanic: Mechanic
  instructions: string[]
  images: string[]
  rationale: string
}

export type Decisions = {
  keeps: Record<string, KeepDecision>
  drops: Record<string, DropReason>
  additions: Addition[]
}

const MUSCLES: Muscle[] = [
  'chest',
  'lats',
  'upper back',
  'lower back',
  'traps',
  'front delts',
  'side delts',
  'rear delts',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'abductors',
  'calves',
]

const EQUIPMENT: Equipment[] = [
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'smith machine',
  'bodyweight',
  'band',
  'kettlebell',
  'ez bar',
  'other',
]

const CATEGORIES: Category[] = ['strength', 'cardio', 'mobility']
const MECHANICS: Mechanic[] = ['compound', 'isolation']

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Root of the repo (two levels up from scripts/curation/). Used to resolve
 * declared image paths against public/exercises/. */
const REPO_ROOT = join(__dirname, '..', '..')

export function buildCatalog(
  seed: SeedExercise[],
  decisions: Decisions,
): { exercises: Exercise[]; review: string } {
  const { keeps, drops, additions } = decisions
  const errors: string[] = []

  // 1. Every seed id in exactly one of keeps/drops.
  const seedIds = new Set(seed.map((e) => e.id))
  for (const id of seedIds) {
    const inKeeps = id in keeps
    const inDrops = id in drops
    if (inKeeps && inDrops) errors.push(`seed id "${id}" appears in both keeps and drops`)
    if (!inKeeps && !inDrops) errors.push(`seed id "${id}" has no keep/drop verdict`)
  }
  for (const id of Object.keys(keeps)) {
    if (!seedIds.has(id)) errors.push(`keeps references unknown seed id "${id}"`)
  }
  for (const id of Object.keys(drops)) {
    if (!seedIds.has(id)) errors.push(`drops references unknown seed id "${id}"`)
  }
  if (errors.length > 0) {
    throw new Error(`buildCatalog: seed coverage errors:\n${errors.map((e) => `  - ${e}`).join('\n')}`)
  }

  const seedById = new Map(seed.map((e) => [e.id, e]))
  const exercises: Exercise[] = []

  for (const [seedId, decision] of Object.entries(keeps)) {
    const seedEntry = seedById.get(seedId)
    if (!seedEntry) {
      errors.push(`keeps["${seedId}"] has no matching seed entry`)
      continue
    }
    exercises.push({
      id: slugify(decision.name),
      name: decision.name,
      aliases: decision.aliases,
      primaryMuscles: decision.primaryMuscles,
      secondaryMuscles: decision.secondaryMuscles,
      equipment: decision.equipment,
      category: decision.category,
      mechanic: decision.mechanic,
      instructions: seedEntry.instructions,
      images: seedEntry.images,
    })
  }

  for (const addition of additions) {
    exercises.push({
      id: slugify(addition.name),
      name: addition.name,
      aliases: addition.aliases,
      primaryMuscles: addition.primaryMuscles,
      secondaryMuscles: addition.secondaryMuscles,
      equipment: addition.equipment,
      category: addition.category,
      mechanic: addition.mechanic,
      instructions: addition.instructions,
      images: addition.images,
    })
  }

  // 2. Per-entry validations: taxonomy membership, mechanic, unique ids/names,
  //    alias collisions, image paths.
  const idsSeen = new Map<string, string>()
  const namesSeen = new Map<string, string>()
  const aliasIndex = new Map<string, string>() // normalized name/alias -> owning entry name

  for (const exercise of exercises) {
    if (idsSeen.has(exercise.id)) {
      errors.push(`duplicate id "${exercise.id}" ("${exercise.name}" / "${idsSeen.get(exercise.id)}")`)
    } else {
      idsSeen.set(exercise.id, exercise.name)
    }

    if (namesSeen.has(exercise.name)) {
      errors.push(`duplicate canonical name "${exercise.name}"`)
    } else {
      namesSeen.set(exercise.name, exercise.name)
    }

    if (exercise.primaryMuscles.length === 0) {
      errors.push(`"${exercise.name}" has no primary muscles`)
    }
    for (const m of [...exercise.primaryMuscles, ...exercise.secondaryMuscles]) {
      if (!MUSCLES.includes(m)) errors.push(`"${exercise.name}" has unknown muscle "${m}"`)
    }
    if (!EQUIPMENT.includes(exercise.equipment)) {
      errors.push(`"${exercise.name}" has unknown equipment "${exercise.equipment}"`)
    }
    if (!CATEGORIES.includes(exercise.category)) {
      errors.push(`"${exercise.name}" has unknown category "${exercise.category}"`)
    }
    if (!exercise.mechanic || !MECHANICS.includes(exercise.mechanic)) {
      errors.push(`"${exercise.name}" has invalid/null mechanic "${exercise.mechanic}"`)
    }

    for (const alias of [exercise.name, ...exercise.aliases]) {
      const key = normalize(alias)
      const owner = aliasIndex.get(key)
      if (owner && owner !== exercise.name) {
        errors.push(
          `alias collision: "${alias}" (normalized "${key}") is claimed by both "${owner}" and "${exercise.name}"`,
        )
      } else {
        aliasIndex.set(key, exercise.name)
      }
    }

    for (const imagePath of exercise.images) {
      const fullPath = join(REPO_ROOT, 'public', 'exercises', imagePath)
      if (!existsSync(fullPath)) {
        errors.push(`"${exercise.name}" declares missing image path "${imagePath}"`)
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`buildCatalog: validation errors:\n${errors.map((e) => `  - ${e}`).join('\n')}`)
  }

  exercises.sort((a, b) => a.name.localeCompare(b.name))

  const review = buildReview(exercises, seed, drops, additions)
  return { exercises, review }
}

function buildReview(
  exercises: Exercise[],
  seed: SeedExercise[],
  drops: Record<string, DropReason>,
  additions: Addition[],
): string {
  const seedById = new Map(seed.map((e) => [e.id, e]))
  const kept = exercises.filter((e) => !additions.some((a) => a.name === e.name))

  const byMuscle = new Map<string, Exercise[]>()
  for (const exercise of kept) {
    const key = exercise.primaryMuscles[0] ?? 'unclassified'
    if (!byMuscle.has(key)) byMuscle.set(key, [])
    byMuscle.get(key)!.push(exercise)
  }

  const byReason = new Map<string, string[]>()
  for (const [seedId, reason] of Object.entries(drops)) {
    const base = reason.split(':')[0]
    if (!byReason.has(base)) byReason.set(base, [])
    byReason.get(base)!.push(seedById.get(seedId)?.name ?? seedId)
  }

  const lines: string[] = []
  lines.push('# Exercise curation review (LG-047)')
  lines.push('')
  lines.push(
    `Seed: ${seed.length} entries. Kept: ${kept.length}. Dropped: ${Object.keys(drops).length}. Added: ${additions.length}. Final catalog: ${exercises.length}.`,
  )
  lines.push('')
  lines.push('## Kept (by primary muscle)')
  lines.push('')
  for (const [muscle, list] of [...byMuscle.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`### ${muscle} (${list.length})`)
    for (const e of [...list].sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`- ${e.name}`)
    }
    lines.push('')
  }
  lines.push('## Removed (by reason)')
  lines.push('')
  for (const [reason, names] of [...byReason.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`### ${reason} (${names.length})`)
    for (const name of [...names].sort()) {
      lines.push(`- ${name}`)
    }
    lines.push('')
  }
  lines.push('## Added (net-new)')
  lines.push('')
  for (const a of [...additions].sort((x, y) => x.name.localeCompare(y.name))) {
    lines.push(`- **${a.name}** - ${a.rationale}`)
  }
  lines.push('')

  return lines.join('\n')
}

async function main() {
  const seedPath = join(__dirname, 'seed', 'free-exercise-db.json')
  const seed: SeedExercise[] = JSON.parse(readFileSync(seedPath, 'utf-8'))

  const { default: keeps } = await import('./keeps.ts')
  const { default: drops } = await import('./drops.ts')
  const { default: additions } = await import('./additions.ts')

  const { exercises, review } = buildCatalog(seed, { keeps, drops, additions })

  const outputPath = join(REPO_ROOT, 'src', 'exercises', 'exercises.json')
  writeFileSync(outputPath, `${JSON.stringify(exercises, null, 2)}\n`)

  const reviewPath = join(__dirname, 'REVIEW.md')
  writeFileSync(reviewPath, review)

  console.log(`Wrote ${exercises.length} exercises to ${outputPath}`)
  console.log(`Wrote review to ${reviewPath}`)
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url)
if (isMain) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
