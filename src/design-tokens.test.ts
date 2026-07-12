// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

/**
 * Design-token contract, verified against the *built* CSS (AC-8). This closes
 * the gap a class-name assertion cannot: it proves the touch-target utilities
 * resolve to real pixels (44/56px) and that the contrast-nudged brand token
 * (`--primary` at lightness 0.54) actually ships. Requires `npm run build`.
 */

const root = path.resolve(import.meta.dirname, '..')
const assetsDir = path.join(root, 'dist', 'assets')
const hasBuild = existsSync(assetsDir)

function builtCss(): string {
  const file = readdirSync(assetsDir).find((f) => /^index-.*\.css$/.test(f))
  if (!file) throw new Error('No built index CSS found in dist/assets')
  return readFileSync(path.join(assetsDir, file), 'utf-8')
}

describe.skipIf(!hasBuild)('built design tokens (dist/)', () => {
  const css = hasBuild ? builtCss() : ''

  it('defines the 44px and 56px touch-target tokens', () => {
    expect(css).toContain('--touch-min:44px')
    expect(css).toContain('--touch-primary:56px')
  })

  it('wires the touch utilities to those tokens (real min-height, not just a class)', () => {
    expect(css).toContain('.min-h-touch-primary{min-height:var(--touch-primary)}')
    expect(css).toContain('.min-h-touch-min{min-height:var(--touch-min)}')
  })

  it('ships the contrast-nudged primary brand token at lightness 0.54', () => {
    // WCAG nudge recorded in design-system.md: 0.578 -> 0.54 for >=4.5:1 on white.
    expect(css).toMatch(/--primary:oklch\(54% \.13 241\.7\)/)
  })
})
