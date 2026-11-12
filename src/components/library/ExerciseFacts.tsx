import { formatFilterValue } from '@/exercises/filtering'
import type { ExerciseDetail } from '@/exercises/detail'

const list = (values: string[]) => values.map(formatFilterValue).join(', ')

/**
 * Hairline fact rows (design-system 12c): Primary, Secondary, Equipment, Type.
 * A row without a value is not rendered.
 */
export function ExerciseFacts({
  detail,
}: {
  detail: Pick<
    ExerciseDetail,
    'primaryMuscles' | 'secondaryMuscles' | 'equipment' | 'category' | 'mechanic'
  >
}) {
  const type = [detail.category, detail.mechanic]
    .filter((part): part is string => Boolean(part))
    .map(formatFilterValue)
    .join(' · ')
  const rows: [string, string][] = [
    ['Primary', list(detail.primaryMuscles)],
    ['Secondary', list(detail.secondaryMuscles)],
    ['Equipment', detail.equipment ? formatFilterValue(detail.equipment) : ''],
    ['Type', type],
  ]
  const present = rows.filter(([, value]) => value !== '')
  if (present.length === 0) return null

  return (
    <dl className="mx-4">
      {present.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 border-b border-border py-3">
          <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
          <dd className="text-right text-base">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
