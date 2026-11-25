/** Shared class strings for the set table and the number pad (design-system 10a, 10c). */

/** Full class names so Tailwind can see them (design-system 10c). */
export const RIR_FILL = [
  'bg-rir-0',
  'bg-rir-1',
  'bg-rir-2',
  'bg-rir-3',
  'bg-rir-4',
  'bg-rir-5',
  'bg-rir-6',
] as const

export const ROW_GRID = 'grid grid-cols-[32px_minmax(0,1fr)_64px_64px_44px] items-center gap-x-1.5'

/** The no-check grid of the edit page (design-system 15a): 68px cells, 8px right inset for the RIR badge. */
export const EDIT_ROW_GRID = 'grid grid-cols-[32px_minmax(0,1fr)_68px_68px] items-center gap-x-1.5 pr-2'
