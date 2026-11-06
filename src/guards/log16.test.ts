// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { SetType } from '@/db/types'

/**
 * LOG-16 guard: sets are strictly warm-up or working. No superset, drop set,
 * myo-rep or failure-set concept may exist anywhere in `src/`.
 */

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false
const setTypeIsExact: Equals<SetType, 'warmup' | 'working'> = true

const FORBIDDEN = /super-?set|drop[ -]?set|myo-?rep|failure[ -]?set/i
const srcDir = path.resolve(import.meta.dirname, '..')
const self = path.resolve(import.meta.filename)

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(ts|tsx|css|json)$/.test(entry.name) && !entry.name.endsWith('.d.json.ts')
      ? [full]
      : []
  })
}

describe('LOG-16 guard', () => {
  it('SetType is exactly warmup | working', () => {
    expect(setTypeIsExact).toBe(true)
  })

  it('src contains no superset, drop set, myorep or failure-set concepts', () => {
    const offenders = sourceFiles(srcDir)
      .filter((file) => path.resolve(file) !== self)
      .filter((file) => FORBIDDEN.test(readFileSync(file, 'utf-8')))
    expect(offenders).toEqual([])
  })
})
