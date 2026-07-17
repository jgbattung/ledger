/**
 * Unit tests for the curation pipeline's pure `buildCatalog()` (LG-047).
 * `scripts/curation/` sits outside `src/` (like `tests/e2e/`) so it isn't
 * covered by the app's tsc project or bundled into the app - this test
 * imports it directly to exercise the pipeline logic. Uses a tiny synthetic
 * seed, independent of the real 873-entry dataset.
 */
import { describe, expect, it } from 'vitest'
import { buildCatalog } from '../../scripts/curation/curate.ts'
import type { Addition, Decisions, SeedExercise } from '../../scripts/curation/curate.ts'

function seedEntry(overrides: Partial<SeedExercise> = {}): SeedExercise {
  return {
    id: 'Some_Exercise',
    name: 'Some Exercise',
    force: 'push',
    level: 'beginner',
    mechanic: 'compound',
    equipment: 'barbell',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    instructions: ['Do the thing.'],
    category: 'strength',
    images: [],
    ...overrides,
  }
}

function baseDecisions(): Decisions {
  return {
    keeps: {
      Some_Exercise: {
        name: 'Some Exercise',
        aliases: [],
        primaryMuscles: ['chest'],
        secondaryMuscles: [],
        equipment: 'barbell',
        category: 'strength',
        mechanic: 'compound',
      },
    },
    drops: {},
    additions: [],
  }
}

describe('buildCatalog', () => {
  it('produces correctly shaped, sorted output from a tiny synthetic seed', () => {
    const seed = [
      seedEntry({ id: 'B_Move', name: 'B Move' }),
      seedEntry({ id: 'A_Move', name: 'A Move' }),
    ]
    const decisions: Decisions = {
      keeps: {
        B_Move: {
          name: 'B Move',
          aliases: ['Bee Move'],
          primaryMuscles: ['chest'],
          secondaryMuscles: ['triceps'],
          equipment: 'barbell',
          category: 'strength',
          mechanic: 'compound',
        },
        A_Move: {
          name: 'A Move',
          aliases: [],
          primaryMuscles: ['lats'],
          secondaryMuscles: [],
          equipment: 'cable',
          category: 'strength',
          mechanic: 'isolation',
        },
      },
      drops: {},
      additions: [],
    }

    const { exercises } = buildCatalog(seed, decisions)
    expect(exercises.map((e) => e.name)).toEqual(['A Move', 'B Move'])
    expect(exercises[1]).toEqual({
      id: 'b-move',
      name: 'B Move',
      aliases: ['Bee Move'],
      primaryMuscles: ['chest'],
      secondaryMuscles: ['triceps'],
      equipment: 'barbell',
      category: 'strength',
      mechanic: 'compound',
      instructions: ['Do the thing.'],
      images: [],
    })
  })

  it('appends additions verbatim alongside keeps', () => {
    const seed = [seedEntry()]
    const decisions = baseDecisions()
    const addition: Addition = {
      name: 'Zzz Addition',
      aliases: [],
      primaryMuscles: ['glutes'],
      secondaryMuscles: [],
      equipment: 'other',
      category: 'strength',
      mechanic: 'isolation',
      instructions: ['Step one.'],
      images: [],
      rationale: 'test addition',
    }
    decisions.additions = [addition]

    const { exercises, review } = buildCatalog(seed, decisions)
    expect(exercises.map((e) => e.name)).toEqual(['Some Exercise', 'Zzz Addition'])
    expect(review).toContain('Zzz Addition')
    expect(review).toContain('test addition')
  })

  it('produces byte-identical output across two consecutive calls', () => {
    const seed = [seedEntry()]
    const decisions = baseDecisions()
    const first = buildCatalog(seed, decisions)
    const second = buildCatalog(seed, decisions)
    expect(second).toEqual(first)
  })

  it('throws when a seed id has no keep/drop verdict', () => {
    const seed = [seedEntry(), seedEntry({ id: 'Other', name: 'Other' })]
    const decisions = baseDecisions()
    expect(() => buildCatalog(seed, decisions)).toThrow(/no keep\/drop verdict/)
  })

  it('throws when a seed id appears in both keeps and drops', () => {
    const seed = [seedEntry()]
    const decisions = baseDecisions()
    decisions.drops = { Some_Exercise: 'novelty-junk' }
    expect(() => buildCatalog(seed, decisions)).toThrow(/both keeps and drops/)
  })

  it('throws on a duplicate id (two kept entries sharing a canonical name slug)', () => {
    const seed = [seedEntry(), seedEntry({ id: 'Dup', name: 'Dup Source' })]
    const decisions = baseDecisions()
    decisions.keeps.Dup = {
      name: 'Some Exercise',
      aliases: [],
      primaryMuscles: ['chest'],
      secondaryMuscles: [],
      equipment: 'barbell',
      category: 'strength',
      mechanic: 'compound',
    }
    expect(() => buildCatalog(seed, decisions)).toThrow(/duplicate/i)
  })

  it('throws on an alias collision with another entry\'s name/alias', () => {
    const seed = [seedEntry(), seedEntry({ id: 'Other', name: 'Other Exercise' })]
    const decisions = baseDecisions()
    decisions.keeps.Other = {
      name: 'Other Exercise',
      aliases: ['Some Exercise'],
      primaryMuscles: ['lats'],
      secondaryMuscles: [],
      equipment: 'cable',
      category: 'strength',
      mechanic: 'compound',
    }
    expect(() => buildCatalog(seed, decisions)).toThrow(/alias collision/)
  })

  it('throws on an unknown muscle value', () => {
    const seed = [seedEntry()]
    const decisions = baseDecisions()
    // @ts-expect-error deliberately invalid taxonomy value for the test
    decisions.keeps.Some_Exercise.primaryMuscles = ['neck']
    expect(() => buildCatalog(seed, decisions)).toThrow(/unknown muscle/)
  })

  it('throws when mechanic is null/missing', () => {
    const seed = [seedEntry()]
    const decisions = baseDecisions()
    // @ts-expect-error deliberately invalid null mechanic for the test
    decisions.keeps.Some_Exercise.mechanic = null
    expect(() => buildCatalog(seed, decisions)).toThrow(/mechanic/)
  })

  it('throws when a declared image path does not exist on disk', () => {
    const seed = [seedEntry({ images: ['Not_A_Real_Exercise/0.jpg'] })]
    const decisions = baseDecisions()
    expect(() => buildCatalog(seed, decisions)).toThrow(/missing image path/)
  })
})
