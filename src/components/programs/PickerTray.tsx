import { useEffect, useRef } from 'react'
import { Dumbbell, X } from 'lucide-react'
import { exerciseImageUrl } from '@/exercises/catalog'
import type { Exercise } from '@/exercises/types'

/**
 * Horizontally scrolling tray of the picker's current selection, in add order.
 * Each chip has a 30px thumbnail and a 30px x with a 44px hit area; the tray
 * scrolls to the newest chip as the selection grows.
 */
export function PickerTray({
  selected,
  onDeselect,
}: {
  selected: Exercise[]
  onDeselect: (exerciseId: string) => void
}) {
  const trayRef = useRef<HTMLUListElement>(null)
  const count = selected.length

  useEffect(() => {
    const tray = trayRef.current
    if (tray && count > 0) tray.scrollTo?.({ left: tray.scrollWidth })
  }, [count])

  return (
    <ul
      ref={trayRef}
      aria-label="Selected exercises"
      className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {selected.map((exercise) => (
        <li
          key={exercise.id}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-muted pr-0.5 pl-[3px] text-[13px] font-medium"
        >
          {exercise.images.length > 0 ? (
            <img
              src={exerciseImageUrl(exercise.images[0])}
              alt=""
              className="size-[30px] shrink-0 rounded-full bg-background object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-background"
            >
              <Dumbbell className="size-4 text-muted-foreground" />
            </span>
          )}
          <span className="max-w-24 truncate">{exercise.name}</span>
          <button
            type="button"
            aria-label={`Remove ${exercise.name} from selection`}
            onClick={() => onDeselect(exercise.id)}
            className="relative flex size-[30px] shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none after:absolute after:-inset-[7px] after:content-[''] focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )
}
