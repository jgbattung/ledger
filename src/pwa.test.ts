// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

/**
 * PWA installability contract (AC-5). Verifies the source brand icons exist at
 * the required sizes, and - when a production build is present in dist/ - that
 * the generated manifest declares standalone/portrait/theme-color and every
 * icon entry resolves to a real file. Run `npm run build` before `npm run test`
 * to exercise the built-manifest assertions.
 */

const root = path.resolve(import.meta.dirname, '..')

function pngSize(file: string) {
  const buf = readFileSync(file)
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

const SOURCE_ICONS = [
  { file: 'public/pwa-192x192.png', width: 192, height: 192 },
  { file: 'public/pwa-512x512.png', width: 512, height: 512 },
  { file: 'public/pwa-maskable-512x512.png', width: 512, height: 512 },
  { file: 'public/apple-touch-icon.png', width: 180, height: 180 },
]

describe('PWA source icons', () => {
  it.each(SOURCE_ICONS)('$file is a $width x $height PNG', ({ file, width, height }) => {
    const abs = path.join(root, file)
    expect(existsSync(abs)).toBe(true)
    expect(pngSize(abs)).toEqual({ width, height })
  })
})

const manifestPath = path.join(root, 'dist', 'manifest.webmanifest')
const hasBuild = existsSync(manifestPath)

describe.skipIf(!hasBuild)('PWA generated manifest (dist/)', () => {
  const manifest = hasBuild ? JSON.parse(readFileSync(manifestPath, 'utf-8')) : {}

  it('is a standalone, portrait, themed installable manifest', () => {
    expect(manifest.name).toBe('Ledger')
    expect(manifest.short_name).toBe('Ledger')
    expect(manifest.display).toBe('standalone')
    expect(manifest.orientation).toBe('portrait')
    expect(manifest.theme_color).toBe('#0075b3')
    expect(manifest.background_color).toBe('#ffffff')
  })

  it('declares 192, 512, and maskable-512 icons that all resolve to real files', () => {
    const icons: { src: string; sizes: string; purpose?: string }[] = manifest.icons
    expect(icons.map((i) => i.sizes)).toEqual(
      expect.arrayContaining(['192x192', '512x512']),
    )
    expect(icons.some((i) => i.purpose === 'maskable')).toBe(true)
    for (const icon of icons) {
      expect(existsSync(path.join(root, 'dist', icon.src))).toBe(true)
    }
  })

  it('emits a service worker for offline precache of the shell', () => {
    expect(existsSync(path.join(root, 'dist', 'sw.js'))).toBe(true)
  })
})
