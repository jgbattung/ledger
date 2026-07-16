/** Filter facets exposed via chips + the bottom sheet (LG-005). */
export type Facet = 'muscle' | 'category' | 'equipment'

export const FACET_LABELS: Record<Facet, string> = {
  muscle: 'Muscle',
  category: 'Category',
  equipment: 'Equipment',
}
