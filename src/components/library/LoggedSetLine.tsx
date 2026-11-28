import { PartialDivider } from '@/components/session/SetRow'
import type { Set as SetRecord } from '@/db/types'
import { useUnit } from '@/settings/SettingsProvider'
import { formatPrevious, formatSides } from '@/workouts/model'

/**
 * One logged set as a read-only line (design-system 12d): weight x reps with the
 * 10d partial divider, or both sides of an L/R set, and the RIR label. Shared by
 * the exercise History tab and the workout summary. Renders an `li`.
 */
export function LoggedSetLine({ set }: { set: SetRecord }) {
  const unit = useUnit()
  const logged = formatPrevious(set, unit)
  const sides = formatSides(set, unit)
  return (
    <li className="flex items-baseline justify-between gap-2 py-0.5 text-base tabular-nums">
      {sides ? (
        <span>
          {sides.map((side, index) => (
            <span key={side.side}>
              {index > 0 ? (
                <>
                  {' '}
                  <span aria-hidden="true" className="px-0.5 text-muted-foreground">
                    ·
                  </span>{' '}
                </>
              ) : null}
              <span className="text-[13px] font-semibold text-muted-foreground">{side.side}</span>{' '}
              {side.text}
              {side.partial ? (
                <>
                  <PartialDivider />
                  {side.partial}
                </>
              ) : null}
            </span>
          ))}
        </span>
      ) : (
        <span>
          {logged.text}
          {logged.partial ? (
            <>
              <PartialDivider />
              {logged.partial}
            </>
          ) : null}
        </span>
      )}
      <span className="shrink-0 text-[13px] text-muted-foreground">{logged.rir}</span>
    </li>
  )
}
