import { format } from 'date-fns'
import { toBlob } from 'html-to-image'
import { APP_NAME } from '@/config/app'

/** The share card is laid out at 360x640 CSS px and exported at 3x: 1080x1920. */
export const CARD_WIDTH = 360
export const CARD_HEIGHT = 640
const PIXEL_RATIO = 3

/**
 * Renders the real, unscaled card node to a PNG. No `backgroundColor`, so a
 * transparent card (Sticker) keeps its alpha channel. Fonts are precached by
 * the service worker; waiting on `document.fonts.ready` makes html-to-image
 * embed Inter instead of a fallback. Nothing here touches the network.
 */
export async function renderCardPng(node: HTMLElement): Promise<Blob> {
  await document.fonts.ready
  const blob = await toBlob(node, {
    pixelRatio: PIXEL_RATIO,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    cacheBust: false,
  })
  if (!blob) throw new Error('Could not render the share image')
  return blob
}

/** Feature detection only (no UA sniffing): can this browser share a PNG file? */
export function canShareFiles(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [new File([], 'x.png', { type: 'image/png' })] })
  )
}

/** Saves the blob through a temporary download link. */
export function downloadImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/**
 * Opens the system share sheet with the PNG when the browser can share files,
 * otherwise downloads it. A cancelled share (AbortError) is silent; any other
 * share failure, including a lapsed user activation (NotAllowedError), falls
 * back to the download. Call it inside the click handler's chain.
 */
export async function shareImage(blob: Blob, filename: string): Promise<void> {
  if (!canShareFiles()) {
    downloadImage(blob, filename)
    return
  }
  try {
    await navigator.share({ files: [new File([blob], filename, { type: 'image/png' })] })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    downloadImage(blob, filename)
  }
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** `ledger-push-2026-11-18.png` from the app name, the workout name and its start date. */
export function shareFilename(workout: { name: string; startedAt: number }): string {
  const parts = [APP_NAME.toLowerCase(), slug(workout.name), format(workout.startedAt, 'yyyy-MM-dd')]
  return `${parts.filter(Boolean).join('-')}.png`
}
