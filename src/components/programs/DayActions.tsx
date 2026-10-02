import { useId, useState, type ComponentType } from 'react'
import { ArrowUpDown, Copy, Moon, Pencil, Trash2 } from 'lucide-react'
import { ConfirmSheet } from '@/components/ui/confirm-sheet'
import { TextFieldSheet } from '@/components/ui/text-field-sheet'
import { cn } from '@/lib/utils'
import { isRestDay } from '@/programs/model'
import type { DraftDay } from '@/programs/model'

type ChipProps = {
  label: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>
  onClick?: () => void
  /** Approved but owned by a later story: dashed, muted, genuinely disabled. */
  soon?: boolean
  destructive?: boolean
  disabled?: boolean
}

/** 36px visual chip inside a 44px hit area. */
function Chip({ label, icon: Icon, onClick, soon, destructive, disabled }: ChipProps) {
  const hintId = useId()
  return (
    <>
    <button
      type="button"
      disabled={soon || disabled}
      onClick={onClick}
      aria-describedby={soon ? hintId : undefined}
      className="group flex h-touch-min shrink-0 items-center outline-none"
    >
      <span
        className={cn(
          'flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50',
          soon
            ? 'border-dashed border-border text-muted-foreground'
            : destructive
              ? 'border-border text-destructive'
              : 'border-border text-foreground group-hover:bg-accent',
          disabled && !soon && 'text-muted-foreground',
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </span>
    </button>
      {soon ? (
        <span id={hintId} className="sr-only">
          Coming soon
        </span>
      ) : null}
    </>
  )
}

/**
 * The five day action chips: Rename, Re-order (soon), Duplicate (soon),
 * Change to Rest, Remove. Rest days hide Change to Rest and Re-order.
 */
export function DayActions({
  day,
  isOnlyDay,
  onRename,
  onChangeToRest,
  onRemove,
}: {
  day: DraftDay
  isOnlyDay: boolean
  onRename: (name: string) => void
  onChangeToRest: () => void
  onRemove: () => void
}) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [restOpen, setRestOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const rest = isRestDay(day)
  const count = day.exercises.length
  const exercisesLabel = `${count} ${count === 1 ? 'exercise' : 'exercises'}`

  return (
    <>
      <div className="-mr-4 mt-2 flex gap-2 overflow-x-auto pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip label="Rename" icon={Pencil} onClick={() => setRenameOpen(true)} />
        {rest ? null : <Chip label="Re-order" icon={ArrowUpDown} soon />}
        <Chip label="Duplicate" icon={Copy} soon />
        {rest ? null : <Chip label="Change to Rest" icon={Moon} onClick={() => setRestOpen(true)} />}
        <Chip
          label="Remove"
          icon={Trash2}
          destructive
          disabled={isOnlyDay}
          onClick={() => (rest ? onRemove() : setRemoveOpen(true))}
        />
      </div>

      <TextFieldSheet
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename day"
        label="Day name"
        initialValue={day.name}
        submitLabel="Save"
        onSubmit={onRename}
      />
      <ConfirmSheet
        open={restOpen}
        onOpenChange={setRestOpen}
        tone="neutral"
        title={`Change ${day.name} to a rest day?`}
        description={`Its ${exercisesLabel} will be removed.`}
        confirmLabel="Change to Rest"
        cancelLabel="Cancel"
        onConfirm={() => {
          setRestOpen(false)
          onChangeToRest()
        }}
      />
      <ConfirmSheet
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        tone="destructive"
        title={`Remove ${day.name}?`}
        description={`The day and its ${exercisesLabel} are removed from this program.`}
        confirmLabel="Remove day"
        cancelLabel="Keep it"
        onConfirm={() => {
          setRemoveOpen(false)
          onRemove()
        }}
      />
    </>
  )
}
