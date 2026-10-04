import { useEffect, useRef, type KeyboardEvent } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DraftDay } from '@/programs/model'
import { dayPanelId, dayTabId } from './dayIds'

/**
 * Horizontally scrollable day tabs with a trailing "+ Day". The selected tab
 * carries the ink underline; the others are muted. The selected tab is scrolled
 * into view whenever the selection changes (a new day is appended off-screen).
 * Follows the WAI-ARIA tabs pattern: roving tabindex, Arrow/Home/End keys with
 * automatic activation. "+ Day" sits outside the tablist, which may own only tabs.
 */
export function DayTabs({
  days,
  selectedId,
  onSelect,
  onAdd,
}: {
  days: DraftDay[]
  selectedId: string | null
  onSelect: (dayId: string) => void
  onAdd: () => void
}) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectedId) return
    const tab = listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(dayTabId(selectedId))}`)
    tab?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' })
  }, [selectedId, days.length])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = days.findIndex((d) => d.id === selectedId)
    if (current === -1) return
    const last = days.length - 1
    let target: number
    if (event.key === 'ArrowRight') target = current === last ? 0 : current + 1
    else if (event.key === 'ArrowLeft') target = current === 0 ? last : current - 1
    else if (event.key === 'Home') target = 0
    else if (event.key === 'End') target = last
    else return
    event.preventDefault()
    const id = days[target].id
    onSelect(id)
    document.getElementById(dayTabId(id))?.focus()
  }

  return (
    <div
      ref={listRef}
      className="flex overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div role="tablist" aria-label="Days" onKeyDown={onKeyDown} className="flex shrink-0">
        {days.map((day, index) => {
          const selected = day.id === selectedId
          return (
            <button
              key={day.id}
              id={dayTabId(day.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={dayPanelId(day.id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(day.id)}
              className={cn(
                '-mb-px flex h-touch-min shrink-0 items-center whitespace-nowrap border-b-2 px-2.5 text-[15px] font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
                index === 0 && 'pl-0',
                selected
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {day.name}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="flex h-touch-min shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 text-[15px] font-medium text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="flex size-[22px] items-center justify-center rounded-full bg-muted">
          <Plus className="size-4" aria-hidden="true" />
        </span>
        Day
      </button>
    </div>
  )
}
