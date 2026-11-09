import { Flag, Pause, Play, StickyNote, Timer, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const ROW =
  'flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50'

function MenuRow({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: ReactNode
  label: string
  onClick?: () => void
  destructive?: boolean
}) {
  return (
    <li className="border-t border-border">
      <button
        type="button"
        onClick={onClick}
        className={cn(ROW, destructive && 'text-destructive')}
      >
        <span className={cn('shrink-0', !destructive && 'text-muted-foreground')}>{icon}</span>
        <span className="flex-1">{label}</span>
      </button>
    </li>
  )
}

/** The Ongoing Workout menu: a bottom sheet in the shared 8b row style. */
export function WorkoutMenuSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  onFinish,
  onNote,
  paused,
  onTogglePause,
  onMinimize,
  onDiscard,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle: string
  onFinish: () => void
  onNote: () => void
  paused: boolean
  onTogglePause: () => void
  onMinimize: () => void
  onDiscard: () => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <div className="min-w-0">
            <SheetTitle className="truncate">{title}</SheetTitle>
            <SheetDescription className="truncate text-xs">{subtitle}</SheetDescription>
          </div>
        </SheetHeader>
        <ul className="overflow-y-auto">
          <MenuRow icon={<Flag className="size-4" />} label="Finish workout" onClick={onFinish} />
          <MenuRow icon={<StickyNote className="size-4" />} label="Workout note" onClick={onNote} />
          <MenuRow
            icon={paused ? <Play className="size-4" /> : <Pause className="size-4" />}
            label={paused ? 'Resume timer' : 'Pause timer'}
            onClick={onTogglePause}
          />
          <MenuRow icon={<Timer className="size-4" />} label="Minimize" onClick={onMinimize} />
          <MenuRow
            icon={<Trash2 className="size-4" />}
            label="Discard workout"
            destructive
            onClick={onDiscard}
          />
        </ul>
      </SheetContent>
    </Sheet>
  )
}
