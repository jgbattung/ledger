import type { Muscle } from '@/exercises/types'

/** Which half of the body the muscle step page shows a muscle under. */
export type BodyHalf = 'upper' | 'lower'

/** The body view that shows a muscle: front or back. */
export type BodyView = 'front' | 'back'

/** Upper/Lower grouping used by the muscle step page (design-system 13e).
 * Every one of the 19 muscles appears exactly once. */
export const MUSCLE_GROUPS: Record<BodyHalf, { label: string; muscles: Muscle[] }[]> = {
  upper: [
    { label: 'Chest', muscles: ['chest'] },
    { label: 'Back', muscles: ['lats', 'upper back', 'lower back', 'traps'] },
    { label: 'Shoulders', muscles: ['front delts', 'side delts', 'rear delts'] },
    { label: 'Arms', muscles: ['biceps', 'triceps', 'forearms'] },
    { label: 'Core', muscles: ['abs', 'obliques'] },
  ],
  lower: [
    { label: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'adductors', 'abductors', 'calves'] },
  ],
}

/** Every muscle, in the order the step page lists them. */
export const ALL_MUSCLES: Muscle[] = [...MUSCLE_GROUPS.upper, ...MUSCLE_GROUPS.lower].flatMap(
  (group) => group.muscles,
)

/** Which half a muscle belongs to (and so which crop its figure uses). */
export const MUSCLE_CROP: Record<Muscle, BodyHalf> = Object.fromEntries(
  (Object.entries(MUSCLE_GROUPS) as [BodyHalf, { muscles: Muscle[] }[]][]).flatMap(
    ([half, groups]) => groups.flatMap((group) => group.muscles.map((m) => [m, half] as const)),
  ),
) as Record<Muscle, BodyHalf>

/** The one body view that draws each muscle. */
export const MUSCLE_VIEW: Record<Muscle, BodyView> = {
  chest: 'front',
  'front delts': 'front',
  'side delts': 'front',
  biceps: 'front',
  forearms: 'front',
  abs: 'front',
  obliques: 'front',
  quads: 'front',
  adductors: 'front',
  traps: 'back',
  'rear delts': 'back',
  'upper back': 'back',
  lats: 'back',
  'lower back': 'back',
  triceps: 'back',
  glutes: 'back',
  hamstrings: 'back',
  abductors: 'back',
  calves: 'back',
}
