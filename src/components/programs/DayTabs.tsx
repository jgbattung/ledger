import { useEffect, useRef } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DraftDay } from '@/programs/model'
import { dayPanelId, dayTabId } from './dayIds'

/**
 * Horizontally scrollable day tabs with a trailing "+ Day". The selected tab
 * carries the ink underline; the others are muted. The selected tab is scrolled
 * into view whenever the selection changes (a new day is appended off-screen).
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

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Days"
      className="flex overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
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
