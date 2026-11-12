import { useRef, useState } from 'react'
import { exerciseImageUrl } from '@/exercises/catalog'
import { cn } from '@/lib/utils'

function altFor(index: number, total: number): string {
  if (total === 2) return index === 0 ? 'Start position' : 'End position'
  return `Demo photo ${index + 1} of ${total}`
}

/**
 * Demo photos as a native scroll-snap pager (design-system 12b). Edge to edge,
 * `object-contain` on `bg-muted` so portrait photos are never cropped. Nothing
 * renders without photos (no placeholder block) and one photo has no dots.
 */
export function ExerciseMedia({ images }: { images: string[] }) {
  const scroller = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)

  if (images.length === 0) return null

  const onScroll = () => {
    const el = scroller.current
    if (!el || el.clientWidth === 0) return
    setCurrent(Math.min(images.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))))
  }

  return (
    <div>
      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto bg-muted [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((path, index) => (
          <img
            key={path}
            src={exerciseImageUrl(path)}
            alt={altFor(index, images.length)}
            loading={index === 0 ? 'eager' : 'lazy'}
            decoding="async"
            className="aspect-[3/2] w-full shrink-0 snap-center object-contain"
          />
        ))}
      </div>
      {images.length > 1 ? (
        <div aria-hidden="true" className="flex justify-center gap-1.5 pt-2">
          {images.map((path, index) => (
            <span
              key={path}
              className={cn('size-1.5 rounded-full', index === current ? 'bg-foreground' : 'bg-border')}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
