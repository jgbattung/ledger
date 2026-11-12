import { useLayoutEffect, type RefObject } from 'react'
import { useLocation } from 'react-router-dom'

/** In-memory only: a reload starts at the top, which is what a reload should do. */
const positions = new Map<string, number>()

function scrollParent(node: HTMLElement | null): HTMLElement | null {
  for (let el = node?.parentElement ?? null; el; el = el.parentElement) {
    const overflowY = getComputedStyle(el).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') return el
  }
  return null
}

/**
 * Keeps the scroll offset of the nearest scrollable ancestor of `ref` per
 * history entry (`location.key`), so Back from a page opened out of a long
 * list lands where the user left. Needed because the app shell's `<main>`
 * scrolls, not the window, so the router's own scroll restoration does not
 * apply. The offset is recorded as it changes (the shell can already be torn
 * down by the time an unmount cleanup runs) and restored before first paint.
 */
export function useScrollRestore(ref: RefObject<HTMLElement | null>) {
  const { key } = useLocation()

  useLayoutEffect(() => {
    const scroller = scrollParent(ref.current)
    if (!scroller) return
    const saved = positions.get(key)
    if (saved !== undefined) scroller.scrollTop = saved
    const onScroll = () => positions.set(key, scroller.scrollTop)
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
    }
  }, [key, ref])
}
