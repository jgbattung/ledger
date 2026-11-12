import { describe, it, expect } from 'vitest'
import { getAllExercises } from './catalog'
import { getFilterOptions, filterExercises, formatFilterValue, normalize } from './filtering'
import type { LibraryFilters } from './filtering'
import type { Muscle } from './types'

const noFilters: LibraryFilters = { muscle: null, category: null, equipment: null }
const datasetSize = getAllExercises().length

describe('getFilterOptions', () => {
  const options = getFilterOptions()
  const all = getAllExercises()

  it('vocabulary sizes match the distinct values present in the dataset', () => {
    const muscles = new Set(all.flatMap((e) => e.primaryMuscles))
    const categories = new Set(all.map((e) => e.category))
    const equipment = new Set(all.map((e) => e.equipment))
    expect(options.muscles.length).toBe(muscles.size)
    expect(options.categories.length).toBe(categories.size)
    expect(options.equipment.length).toBe(equipment.size)
  })

  it('each vocabulary is alphabetically sorted', () => {
    expect(options.muscles).toEqual([...options.muscles].sort())
    expect(options.categories).toEqual([...options.categories].sort())
    expect(options.equipment).toEqual([...options.equipment].sort())
  })

  it('contains no null/empty entries', () => {
    for (const list of [options.muscles, options.categories, options.equipment]) {
      for (const value of list) {
        expect(value).toBeTruthy()
        expect(typeof value).toBe('string')
      }
    }
  })
})

describe('normalize', () => {
  it('lowercases, folds hyphens/slashes to spaces, and collapses whitespace', () => {
    expect(normalize('Pull-Up')).toBe('pull up')
    expect(normalize('Pull-Ups')).toBe('pull ups')
    expect(normalize('3/4 Sit-Up')).toBe('3 4 sit up')
    expect(normalize('  Wide   Grip  Cable Row ')).toBe('wide grip cable row')
    expect(normalize('Press (Seated)')).toBe('press seated')
  })
})

describe('filterExercises - search', () => {
  it('empty query and empty filters returns the full dataset', () => {
    expect(filterExercises('', noFilters).length).toBe(datasetSize)
  })

  it('is case-insensitive', () => {
    const upper = filterExercises('CURL', noFilters)
    const lower = filterExercises('curl', noFilters)
    expect(upper.length).toBeGreaterThan(0)
    expect(upper.map((e) => e.id)).toEqual(lower.map((e) => e.id))
  })

  it('matches mid-word substrings', () => {
    const results = filterExercises('arbell', noFilters)
    expect(results.length).toBeGreaterThan(0)
    // Every result carries the fragment in some word (or the space-free form)
    // of its name or an alias - the substring tier. This also pins that the
    // typo tier adds no result lacking the fragment for this query.
    expect(
      results.every((e) =>
        [e.name, ...e.aliases].some((n) => normalize(n).replace(/ /g, '').includes('arbell')),
      ),
    ).toBe(true)
  })

  it('whitespace-only query returns the full dataset', () => {
    expect(filterExercises('   ', noFilters).length).toBe(datasetSize)
  })

  it('AC alias accept: "pull ups" resolves the Pull-Up entry', () => {
    const results = filterExercises('pull ups', noFilters)
    expect(results.some((e) => e.name === 'Pull-Up')).toBe(true)
  })

  it('matches hyphen/spacing variants of a multi-word name', () => {
    const hyphenated = filterExercises('wide-grip cable row', noFilters)
    const spaced = filterExercises('wide grip cable row', noFilters)
    const squished = filterExercises('widegrip cable row', noFilters)
    expect(hyphenated.some((e) => e.name === 'Wide Grip Cable Row')).toBe(true)
    expect(spaced.some((e) => e.name === 'Wide Grip Cable Row')).toBe(true)
    // "widegrip" (no separator) matches through the substring tier against
    // the space-free form of the name ("widegripcablerow").
    expect(squished.some((e) => e.name === 'Wide Grip Cable Row')).toBe(true)
  })

  it('matches against aliases, not just the canonical name', () => {
    const results = filterExercises('machine hamstring curl', noFilters)
    expect(results.some((e) => e.name === 'Seated Leg Curl')).toBe(true)
  })
})

describe('filterExercises - facets', () => {
  it('filters by muscle alone', () => {
    const expected = getAllExercises().filter((e) => e.primaryMuscles.includes('chest'))
    const results = filterExercises('', { ...noFilters, muscle: 'chest' })
    expect(results.length).toBe(expected.length)
    expect(results.every((e) => e.primaryMuscles.includes('chest'))).toBe(true)
  })

  it('filters by category alone', () => {
    const expected = getAllExercises().filter((e) => e.category === 'strength')
    const results = filterExercises('', { ...noFilters, category: 'strength' })
    expect(results.length).toBe(expected.length)
    expect(results.every((e) => e.category === 'strength')).toBe(true)
  })

  it('filters by equipment alone', () => {
    const expected = getAllExercises().filter((e) => e.equipment === 'dumbbell')
    const results = filterExercises('', { ...noFilters, equipment: 'dumbbell' })
    expect(results.length).toBe(expected.length)
    expect(results.every((e) => e.equipment === 'dumbbell')).toBe(true)
  })

  it('AND-combines a muscle + equipment facet (LIB-3 accept)', () => {
    const expected = getAllExercises().filter(
      (e) => e.primaryMuscles.includes('chest') && e.equipment === 'barbell',
    )
    const results = filterExercises('', { muscle: 'chest', category: null, equipment: 'barbell' })
    expect(results.length).toBe(expected.length)
    expect(results.length).toBeGreaterThan(0)
    expect(
      results.every((e) => e.primaryMuscles.includes('chest') && e.equipment === 'barbell'),
    ).toBe(true)
  })

  it('combines search with facet filters', () => {
    const searchOnly = filterExercises('press', noFilters)
    const results = filterExercises('press', { ...noFilters, equipment: 'barbell' })
    // The facet narrows the search result set without changing which
    // exercises match the query, nor their relative ranking.
    const expectedIds = searchOnly.filter((e) => e.equipment === 'barbell').map((e) => e.id)
    expect(results.length).toBeGreaterThan(0)
    expect(results.map((e) => e.id)).toEqual(expectedIds)
    expect(results.every((e) => e.equipment === 'barbell')).toBe(true)
  })

  it('preserves dataset order', () => {
    const all = getAllExercises()
    const results = filterExercises('', { ...noFilters, category: 'strength' })
    const expectedOrder = all.filter((e) => e.category === 'strength').map((e) => e.id)
    expect(results.map((e) => e.id)).toEqual(expectedOrder)
  })
})

describe('formatFilterValue', () => {
  it('title-cases single words', () => {
    expect(formatFilterValue('chest')).toBe('Chest')
  })

  it('title-cases each word in multi-word values', () => {
    expect(formatFilterValue('upper back')).toBe('Upper Back')
    expect(formatFilterValue('smith machine')).toBe('Smith Machine')
  })
})

describe('filterExercises - token search (LG-048)', () => {
  const ids = (query: string) => filterExercises(query, noFilters).map((e) => e.id)
  const words = (e: { name: string; aliases: string[] }) =>
    new Set([e.name, ...e.aliases].flatMap((n) => normalize(n).split(' ')))

  it('AC1: word order does not change the result', () => {
    const a = filterExercises('incline close grip bench', noFilters)
    const b = filterExercises('bench close grip incline', noFilters)
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id))
    expect(a.some((e) => e.name === 'Incline Close Grip Bench Press')).toBe(true)
  })

  it('AC2: "pull ups", "pull-ups" and "pullups" all find Pull-Up', () => {
    for (const q of ['pull ups', 'pull-ups', 'pullups']) {
      expect(filterExercises(q, noFilters).some((e) => e.name === 'Pull-Up')).toBe(true)
    }
  })

  it('AC3: a word that exists only in an alias still matches', () => {
    const results = filterExercises('machine hamstring curl', noFilters)
    const seatedLegCurl = results.find((e) => e.name === 'Seated Leg Curl')
    expect(seatedLegCurl).toBeDefined()
    expect(words({ name: seatedLegCurl!.name, aliases: [] }).has('hamstring')).toBe(false)
  })

  it('AC3: "rdl" resolves Romanian Deadlift through its alias', () => {
    expect(filterExercises('rdl', noFilters).some((e) => e.name === 'Romanian Deadlift')).toBe(
      true,
    )
  })

  it('AC4: "cable row" narrows "cable" and every result matches both words', () => {
    const cable = filterExercises('cable', noFilters)
    const cableRow = filterExercises('cable row', noFilters)
    expect(cableRow.length).toBeGreaterThan(0)
    expect(cableRow.length).toBeLessThan(cable.length)
    for (const e of cableRow) {
      const w = [...words(e)]
      expect(w.some((t) => t.includes('cable'))).toBe(true)
      expect(w.some((t) => t.includes('row'))).toBe(true)
    }
  })

  it('AC5: "dumbell press" finds dumbbell presses', () => {
    const results = filterExercises('dumbell press', noFilters)
    expect(results.length).toBeGreaterThan(0)
    for (const e of results) {
      const w = [...words(e)]
      expect(w.some((t) => t.startsWith('dumbbell'))).toBe(true)
      expect(w.some((t) => t.startsWith('press'))).toBe(true)
    }
  })

  it('AC5: "benhc press" (adjacent swap) finds a Bench Press entry', () => {
    expect(filterExercises('benhc press', noFilters).some((e) => e.name.includes('Bench Press'))).toBe(
      true,
    )
  })

  it('typo tolerance works while the word is still being typed', () => {
    expect(
      filterExercises('dumbel', noFilters).some((e) => e.name.toLowerCase().includes('dumbbell')),
    ).toBe(true)
  })

  it('pools words across the name and aliases', () => {
    const results = filterExercises('seated hamstring curl', noFilters)
    expect(results.some((e) => e.name === 'Seated Leg Curl')).toBe(true)
  })

  it('folds simple plurals: "rows" and "curls" are non-empty and include the singular matches', () => {
    for (const [plural, singular] of [
      ['rows', 'row'],
      ['curls', 'curl'],
    ]) {
      const results = ids(plural)
      expect(results.length).toBeGreaterThan(0)
      const exact = getAllExercises().filter((e) => words(e).has(singular))
      expect(exact.length).toBeGreaterThan(0)
      for (const e of exact) expect(results).toContain(e.id)
    }
  })

  it('does not apply typo tolerance to short words (under 5 letters)', () => {
    // "bak" would be one edit from "back" but is below the typo threshold.
    for (const e of filterExercises('bak', noFilters)) {
      expect([...words(e)].some((t) => t.includes('bak'))).toBe(true)
    }
  })

  it('ranks exact-word matches ahead of substring and typo matches', () => {
    const results = filterExercises('press', noFilters)
    const hasExact = (e: { name: string; aliases: string[] }) => words(e).has('press')
    const firstWeak = results.findIndex((e) => !hasExact(e))
    expect(results.some(hasExact)).toBe(true)
    expect(firstWeak).toBeGreaterThan(0)
    expect(results.slice(firstWeak).some(hasExact)).toBe(false)
  })

  it('"bench press" ranks entries with both exact words first', () => {
    const results = filterExercises('bench press', noFilters)
    const both = (e: { name: string; aliases: string[] }) => {
      const w = words(e)
      return w.has('bench') && w.has('press')
    }
    const lastBoth = results.map(both).lastIndexOf(true)
    expect(lastBoth).toBeGreaterThanOrEqual(0)
    expect(results.slice(0, lastBoth + 1).every(both)).toBe(true)
  })

  it('a nonsense query returns nothing', () => {
    expect(filterExercises('zzzzqq', noFilters)).toEqual([])
  })

  it('search stays AND-combined with facet filters', () => {
    const results = filterExercises('curl', { ...noFilters, muscle: 'biceps' })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((e) => e.primaryMuscles.includes('biceps'))).toBe(true)
  })
})

describe('filterExercises - token search edge cases (LG-048 QA)', () => {
  const all = getAllExercises()
  const ids = (query: string, filters: LibraryFilters = noFilters) =>
    filterExercises(query, filters).map((e) => e.id)
  const names = (e: { name: string; aliases: string[] }) => [e.name, ...e.aliases].map(normalize)
  const words = (e: { name: string; aliases: string[] }) =>
    new Set(names(e).flatMap((n) => n.split(' ')))
  /** Catalog-order ids of exercises that a word reaches without the typo tier. */
  const cheapIds = (q: string) =>
    all
      .filter(
        (e) =>
          [...words(e)].some((t) => t.startsWith(q) || (q.length >= 3 && t.includes(q))) ||
          (q.length >= 3 && names(e).some((n) => n.replace(/ /g, '').includes(q))),
      )
      .map((e) => e.id)

  it('AC1 sweep: every multi-word name typed in reverse word order still finds its exercise', () => {
    for (const e of all) {
      const nameWords = normalize(e.name).split(' ')
      if (nameWords.length < 2) continue
      expect(ids([...nameWords].reverse().join(' ')), e.name).toContain(e.id)
    }
  })

  it('AC1: order independence also holds for prefix and typo words', () => {
    for (const [a, b] of [
      ['dumbell press', 'press dumbell'],
      ['lat pull', 'pull lat'],
      ['sqaut barbell', 'barbell sqaut'],
    ]) {
      expect(ids(a)).toEqual(ids(b))
      expect(ids(a).length).toBeGreaterThan(0)
    }
  })

  it('AC2 sweep: every name is found by its hyphenated, spaced and joined spellings', () => {
    for (const e of all) {
      const nameWords = normalize(e.name).split(' ')
      for (const q of [nameWords.join('-'), nameWords.join(' '), nameWords.join('')]) {
        expect(ids(q), `${e.name} via "${q}"`).toContain(e.id)
      }
    }
  })

  it('punctuation around and between words is ignored', () => {
    expect(ids('row,')).toEqual(ids('row'))
    expect(ids('  ROW  ')).toEqual(ids('row'))
    expect(ids('(row)')).toEqual(ids('row'))
    expect(ids('cable / row')).toEqual(ids('cable row'))
  })

  it('a punctuation-only query behaves like an empty query (full catalog, catalog order)', () => {
    const catalogOrder = all.map((e) => e.id)
    for (const q of ['!!!', '--', '()', ' / ', '.,;']) {
      expect(ids(q), q).toEqual(catalogOrder)
    }
  })

  it('a single letter is a prefix match on any word, never a mid-word match', () => {
    const results = ids('b')
    expect(results.length).toBeGreaterThan(0)
    expect(results.length).toBeLessThan(all.length)
    expect([...results].sort()).toEqual(
      all.filter((e) => [...words(e)].some((t) => t.startsWith('b'))).map((e) => e.id).sort(),
    )
  })

  it('a numeric query matches only words that start with those digits', () => {
    for (const q of ['3', '45', '3/4']) {
      const qWords = normalize(q).split(' ')
      const expected = all
        .filter((e) => qWords.every((w) => [...words(e)].some((t) => t.startsWith(w))))
        .map((e) => e.id)
      expect([...ids(q)].sort(), q).toEqual(expected.sort())
    }
  })

  it('substring threshold: 3 letters match mid-word, 2 letters do not', () => {
    const umb = filterExercises('umb', noFilters)
    expect(umb.length).toBeGreaterThan(0)
    expect(umb.every((e) => names(e).some((n) => n.replace(/ /g, '').includes('umb')))).toBe(true)
    expect(umb.some((e) => words(e).has('dumbbell'))).toBe(true)
    // "mb" sits inside "dumbbell" but is below the substring threshold, so
    // only words that start with "mb" could match.
    expect([...ids('mb')].sort()).toEqual(
      all.filter((e) => [...words(e)].some((t) => t.startsWith('mb'))).map((e) => e.id).sort(),
    )
  })

  it('typo threshold: one edit is tolerated at 5 letters but not at 4', () => {
    // 5 letters: adjacent swap of "squat", and a swap inside "bench".
    const sqaut = ids('sqaut')
    for (const e of all.filter((x) => words(x).has('squat'))) expect(sqaut).toContain(e.id)
    expect(filterExercises('benhc', noFilters).some((e) => words(e).has('bench'))).toBe(true)
    // 4 letters: one edit away from "squat"/"bench"/"curl", but below the typo
    // threshold, so only the cheaper tiers can contribute.
    for (const q of ['sqat', 'benh', 'cutl']) {
      expect([...ids(q)].sort(), q).toEqual(cheapIds(q).sort())
    }
  })

  it('first-letter rule: a typo in the first letter is never tolerated', () => {
    // Each is one edit from a real word ("squat", "dumbbell", "press") but
    // changes or moves the first letter.
    for (const q of ['qsuat', 'xquat', 'bumbbell', 'rpess']) {
      expect([...ids(q)].sort(), q).toEqual(cheapIds(q).sort())
    }
  })

  it('plural fold applies at 4 letters ("rdls" -> "rdl", "dips" -> "dip")', () => {
    expect(filterExercises('rdls', noFilters).some((e) => e.name === 'Romanian Deadlift')).toBe(
      true,
    )
    const dips = ids('dips')
    const dipOwners = all.filter((e) => words(e).has('dip'))
    expect(dipOwners.length).toBeGreaterThan(0)
    for (const e of dipOwners) expect(dips).toContain(e.id)
  })

  it('plural fold covers "-es" plurals in both directions (shared stem)', () => {
    const presses = filterExercises('presses', noFilters)
    expect(presses.length).toBeGreaterThan(1)
    expect(presses.some((e) => e.name.includes('Bench Press'))).toBe(true)
    const pressOwners = all.filter((e) => words(e).has('press'))
    for (const e of pressOwners) expect(presses.map((x) => x.id)).toContain(e.id)

    const benches = filterExercises('benches', noFilters)
    expect(benches.length).toBeGreaterThan(0)
    expect(benches.every((e) => words(e).has('bench') || cheapIds('benches').includes(e.id))).toBe(
      true,
    )

    // "flys" reaches every entry that has the word "flyes" (shared stem "fly").
    // It does not reach the singular "flye" (no shared stem), which "flyes"
    // does, so the sets are not identical.
    const flys = ids('flys')
    const flyesOwners = all.filter((e) => words(e).has('flyes'))
    expect(flyesOwners.length).toBeGreaterThan(0)
    for (const e of flyesOwners) expect(flys).toContain(e.id)
    for (const id of flys) expect(ids('flyes')).toContain(id)
  })

  it('plural fold sweep: every catalog plural and its singular find each other', () => {
    const vocab = new Set(all.flatMap((e) => [...words(e)]))
    const ownersOf = (w: string) => all.filter((e) => words(e).has(w)).map((e) => e.id)
    let pairs = 0
    for (const plural of vocab) {
      if (plural.length < 4) continue
      for (const suffix of ['s', 'es']) {
        if (!plural.endsWith(suffix)) continue
        const singular = plural.slice(0, -suffix.length)
        if (singular.length < 3 || !vocab.has(singular)) continue
        pairs++
        const fromPlural = ids(plural)
        for (const id of ownersOf(singular)) expect(fromPlural, `${plural} -> ${singular}`).toContain(id)
        const fromSingular = ids(singular)
        for (const id of ownersOf(plural)) expect(fromSingular, `${singular} -> ${plural}`).toContain(id)
      }
    }
    expect(pairs).toBeGreaterThan(0)
  })

  it('a plural-fold match stays in the typo tier, below exact matches', () => {
    // "presses" is an exact word for some entries and a folded match for
    // every "press" entry: the exact owners must lead the list.
    const results = filterExercises('presses', noFilters)
    const exactCount = results.filter((e) => words(e).has('presses')).length
    expect(exactCount).toBeGreaterThan(0)
    expect(exactCount).toBeLessThan(results.length)
    expect(results.slice(0, exactCount).every((e) => words(e).has('presses'))).toBe(true)
  })

  it('a 3-letter query ending in "s" gets no plural fold', () => {
    expect([...ids('abs')].sort()).toEqual(cheapIds('abs').sort())
  })

  it('a repeated word gives the same result as the word once', () => {
    expect(ids('press press')).toEqual(ids('press'))
    expect(ids('cable cable row')).toEqual(ids('cable row'))
  })

  it('ranking ties keep catalog order', () => {
    const catalogIndex = new Map(all.map((e, i) => [e.id, i]))
    // Every exact "press" match scores the same, so that leading block must
    // be in catalog order.
    const press = filterExercises('press', noFilters)
    const exactBlock = press.filter((e) => words(e).has('press')).map((e) => e.id)
    expect(press.slice(0, exactBlock.length).map((e) => e.id)).toEqual(exactBlock)
    expect(exactBlock).toEqual(
      [...exactBlock].sort((a, b) => catalogIndex.get(a)! - catalogIndex.get(b)!),
    )
    // "sqaut" reaches every result through the typo tier only: one tie.
    const sqaut = ids('sqaut')
    expect(sqaut).toEqual([...sqaut].sort((a, b) => catalogIndex.get(a)! - catalogIndex.get(b)!))
  })

  it('results are deterministic across repeated and interleaved calls', () => {
    const first = ids('dumbell press')
    ids('cable row')
    ids('')
    ids('b')
    expect(ids('dumbell press')).toEqual(first)
    expect(filterExercises('', noFilters).map((e) => e.id)).toEqual(all.map((e) => e.id))
  })

  it('search combined with each facet narrows the search result without reordering it', () => {
    const options = getFilterOptions()
    const facetCases: { filters: LibraryFilters; keep: (e: (typeof all)[number]) => boolean }[] = [
      {
        filters: { ...noFilters, muscle: options.muscles[0] },
        keep: (e) => e.primaryMuscles.includes(options.muscles[0] as Muscle),
      },
      {
        filters: { ...noFilters, category: options.categories[0] },
        keep: (e) => e.category === options.categories[0],
      },
      {
        filters: { ...noFilters, equipment: 'dumbbell' },
        keep: (e) => e.equipment === 'dumbbell',
      },
      {
        filters: { muscle: 'chest', category: options.categories[0], equipment: 'barbell' },
        keep: (e) =>
          e.primaryMuscles.includes('chest') &&
          e.category === options.categories[0] &&
          e.equipment === 'barbell',
      },
    ]
    for (const q of ['press', 'dumbell press', 'row cable', 'sqaut']) {
      const unfiltered = filterExercises(q, noFilters)
      for (const { filters, keep } of facetCases) {
        expect(ids(q, filters), `${q} + ${JSON.stringify(filters)}`).toEqual(
          unfiltered.filter(keep).map((e) => e.id),
        )
      }
    }
  })

  it('a facet that excludes every search match returns nothing', () => {
    // Squat variations never list biceps as a primary muscle.
    expect(ids('sqaut', { ...noFilters, muscle: 'biceps' })).toEqual([])
    expect(ids('zzzzqq', { ...noFilters, equipment: 'dumbbell' })).toEqual([])
  })
})

describe('perf (LIB-2 bound)', () => {
  it('filterExercises averages under 100ms per call over 100 calls', () => {
    const start = performance.now()
    for (let i = 0; i < 100; i++) {
      filterExercises('curl', { muscle: 'biceps', category: null, equipment: null })
      filterExercises('dumbell pres incline', noFilters)
    }
    const elapsed = performance.now() - start
    expect(elapsed / 100).toBeLessThan(100)
  })

  it('a query that falls through to the typo tier on every word stays under the bound', () => {
    // "pqqqqq" misses exact/prefix/substring everywhere, so the typo tier runs
    // against every word of every exercise: the slowest path per query word.
    const start = performance.now()
    for (let i = 0; i < 100; i++) {
      filterExercises('pqqqqq', noFilters)
      filterExercises('sqaut barbel benhc', noFilters)
    }
    const elapsed = performance.now() - start
    expect(elapsed / 100).toBeLessThan(100)
  })
})
