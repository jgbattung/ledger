import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shareImage } from '@/lib/shareImage'

// navigator.share/canShare and object URLs are browser boundaries jsdom lacks.
const FILENAME = 'ledger-push-2026-11-18.png'
const blob = new Blob(['png'], { type: 'image/png' })

let downloads: { href: string; download: string }[]

function stubShare(share?: (data: ShareData) => Promise<void>) {
  vi.stubGlobal('navigator', {
    ...navigator,
    canShare: share ? () => true : undefined,
    share,
  })
}

describe('shareImage', () => {
  beforeEach(() => {
    downloads = []
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:card', revokeObjectURL: () => {} })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push({ href: this.getAttribute('href') ?? '', download: this.download })
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shares the PNG as a file when the browser can share files, without downloading', async () => {
    const shared: ShareData[] = []
    stubShare(async (data) => {
      shared.push(data)
    })
    await shareImage(blob, FILENAME)
    expect(shared).toHaveLength(1)
    const files = shared[0].files ?? []
    expect(files.map((file) => [file.name, file.type])).toEqual([[FILENAME, 'image/png']])
    expect(downloads).toEqual([])
  })

  it('downloads the PNG when the browser cannot share files', async () => {
    stubShare()
    await shareImage(blob, FILENAME)
    expect(downloads).toEqual([{ href: 'blob:card', download: FILENAME }])
  })

  it('stays silent when the user cancels the share sheet', async () => {
    stubShare(() => Promise.reject(new DOMException('cancelled', 'AbortError')))
    await expect(shareImage(blob, FILENAME)).resolves.toBeUndefined()
    expect(downloads).toEqual([])
  })

  it('falls back to the download when sharing fails for any other reason', async () => {
    stubShare(() => Promise.reject(new DOMException('no activation', 'NotAllowedError')))
    await shareImage(blob, FILENAME)
    expect(downloads).toEqual([{ href: 'blob:card', download: FILENAME }])
  })
})
