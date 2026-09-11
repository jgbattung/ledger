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

  it('ships the --fab-raise layout token', () => {
    expect(css).toContain('--fab-raise:14px')
  })
})

/**
 * `--fab-raise` (LG-049) has exactly two consumers that must agree: BottomNav
 * raises the FAB by it, and AppShell reserves the same distance in <main>'s
 * bottom padding. If either stops reading the token and hard-codes a number,
 * they drift and the last row of a scrolled list slides under the FAB - the
 * silent failure the token exists to prevent. Nothing else enforced this.
 */
describe('--fab-raise consumer coupling', () => {
  const read = (p: string) => readFileSync(path.join(root, p), 'utf-8')

  it('is defined once in index.css and exposed as a spacing utility', () => {
    const css = read('src/index.css')
    expect(css).toMatch(/--fab-raise:\s*14px/)
    expect(css).toMatch(/--spacing-fab-raise:\s*var\(--fab-raise\)/)
  })

  it('BottomNav raises the FAB via the token, not a literal offset', () => {
    const nav = read('src/components/BottomNav.tsx')
    // Isolate the FAB's own element - the <nav> legitimately uses bottom-0 to
    // pin the bar to the viewport, which is unrelated to the raise.
    const fab = nav.slice(nav.indexOf('aria-label="Quick actions"'))
    const fabEnd = fab.indexOf('</button>')
    const fabMarkup = fab.slice(0, fabEnd)

    expect(fabMarkup, 'the FAB must be raised with bottom-fab-raise').toContain('bottom-fab-raise')
    // A literal offset here would silently decouple it from AppShell's padding.
    expect(fabMarkup, 'the FAB must not hard-code its raise').not.toMatch(/bottom-(\d|\[)/)
  })

  it("AppShell reserves the same raise in <main>'s bottom padding", () => {
    const shell = read('src/routes/AppShell.tsx')
    expect(shell).toContain('var(--fab-raise)')
    expect(shell).toContain('var(--touch-primary)')
    expect(shell).toContain('env(safe-area-inset-bottom)')
  })
})

/**
 * `env(safe-area-inset-*)` resolves to 0 unless the viewport opts in with
 * `viewport-fit=cover`. Three separate files spend that inset to clear the
 * Android gesture bar, and one meta tag switches all three on or off - with no
 * visible symptom on desktop or in a headless browser, where the inset is 0
 * either way. Removing it would silently put the bar and the FAB under the
 * gesture strip on the primary target device (S23 Ultra, installed PWA).
 */
describe('safe-area inset opt-in', () => {
  const read = (p: string) => readFileSync(path.join(root, p), 'utf-8')

  it('index.html opts into the safe-area insets with viewport-fit=cover', () => {
    const html = read('index.html')
    const viewport = html.match(/<meta\s+name="viewport"[^>]*>/)?.[0] ?? ''
    expect(viewport, 'a viewport meta tag must exist').not.toBe('')
    expect(viewport, 'viewport must opt into safe-area insets').toContain('viewport-fit=cover')
  })

  it.each([
    ['src/components/BottomNav.tsx', 'the bottom bar pads itself past the gesture bar'],
    ['src/routes/AppShell.tsx', "<main>'s bottom padding clears the bar and the FAB"],
    ['src/components/ui/sheet.tsx', 'the sheet pads its own bottom edge'],
  ])('%s spends the inset (%s)', (file) => {
    expect(read(file)).toContain('env(safe-area-inset-bottom)')
  })
})
