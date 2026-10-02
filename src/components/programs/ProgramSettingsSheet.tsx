import { useState, type ComponentType, type ReactNode } from 'react'
import {
  Archive,
  ArchiveRestore,
  ArrowUpDown,
  ChevronRight,
  CirclePause,
  Copy,
  NotebookText,
  Pencil,
  Repeat,
  Trash2,
} from 'lucide-react'
import { SoonPill } from '@/components/SoonRow'
import { ConfirmSheet } from '@/components/ui/confirm-sheet'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { TextFieldSheet } from '@/components/ui/text-field-sheet'
import { programs } from '@/db/repos'
import { cn } from '@/lib/utils'
import type { ProgramDraft } from '@/programs/model'
import { selectIsDirty, useProgramDraftStore } from '@/stores/programDraftStore'

type Icon = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>

/** One 48px drawer row: 14px text, 16px muted leading icon (design-system 8b). */
function Row({
  icon: Icon,
  label,
  value,
  onClick,
  soon,
  danger,
}: {
  icon: Icon
  label: string
  value?: ReactNode
  onClick?: () => void
  soon?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      disabled={soon}
      onClick={onClick}
      className="flex min-h-12 w-full items-center gap-3 border-t border-border px-4 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
    >
      <Icon
        className={cn('size-4 shrink-0', danger ? 'text-destructive' : 'text-muted-foreground')}
        aria-hidden="true"
      />
      <span
        className={cn('min-w-0 flex-1', soon && 'text-muted-foreground', danger && 'text-destructive')}
      >
        {label}
      </span>
      {value ? (
        <span className="max-w-36 truncate text-muted-foreground">{value}</span>
      ) : null}
      {onClick && !danger && value !== undefined ? (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      ) : null}
      {soon ? <SoonPill /> : null}
    </button>
  )
}

type Panel = 'name' | 'notes' | 'archive' | 'delete' | null

/**
 * Program settings drawer. Name and notes edit the draft; deactivate, archive,
 * restore and delete are immediate repo operations that keep the draft's
 * persisted flags in sync without marking it dirty.
 */
export function ProgramSettingsSheet({
  open,
  onOpenChange,
  draft,
  onLeave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: ProgramDraft
  /** Called after archive/delete: the editor has nothing left to show. */
  onLeave: () => void
}) {
  const [panel, setPanel] = useState<Panel>(null)
  const dirty = useProgramDraftStore(selectIsDirty)
  const store = useProgramDraftStore.getState
  const saved = !draft.isNew
  const cyclesLabel = draft.days.length === 7 ? 'Number of weeks' : 'Number of cycles'

  const openPanel = (next: Panel) => {
    onOpenChange(false)
    setPanel(next)
  }

  const archive = async () => {
    // Pending edits are saved first so archiving never silently drops them.
    if (dirty) await store().commit()
    await programs.archive(draft.id)
    store().reset()
    onLeave()
  }

  const remove = async () => {
    await programs.softDeleteCascade(draft.id)
    store().reset()
    onLeave()
  }

  const deleteCopy = `${draft.isActive ? "It's your active program, so it'll be deactivated. " : ''}Workouts you've already logged from it stay in your history.`

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent aria-describedby={undefined} className="max-h-[85svh] overflow-y-auto">
          <SheetHeader className="py-1.5 pr-1 pl-4">
            <SheetTitle className="text-[15px]">Program settings</SheetTitle>
          </SheetHeader>
          <Row icon={Pencil} label="Name" value={draft.name} onClick={() => openPanel('name')} />
          <Row
            icon={NotebookText}
            label="Notes"
            value={draft.notes ?? ''}
            onClick={() => openPanel('notes')}
          />
          <Row icon={Repeat} label={cyclesLabel} soon />
          <Row icon={ArrowUpDown} label="Day order" soon />
          <Row icon={Copy} label="Duplicate program" soon />
          {saved && draft.isActive ? (
            <Row
              icon={CirclePause}
              label="Deactivate program"
              onClick={async () => {
                await programs.deactivate(draft.id)
                store().applyPersistedFlags({ isActive: false })
                onOpenChange(false)
              }}
            />
          ) : null}
          {saved && draft.isArchived ? (
            <Row
              icon={ArchiveRestore}
              label="Restore program"
              onClick={async () => {
                await programs.unarchive(draft.id)
                store().applyPersistedFlags({ isArchived: false })
                onOpenChange(false)
              }}
            />
          ) : null}
          {saved && !draft.isArchived ? (
            <Row
              icon={Archive}
              label="Archive program"
              onClick={() => {
                if (draft.isActive) openPanel('archive')
                else void archive()
              }}
            />
          ) : null}
          {saved ? (
            <Row icon={Trash2} label="Delete program" danger onClick={() => openPanel('delete')} />
          ) : null}
        </SheetContent>
      </Sheet>

      <TextFieldSheet
        open={panel === 'name'}
        onOpenChange={(next) => !next && setPanel(null)}
        title="Program name"
        label="Name"
        initialValue={draft.name}
        submitLabel="Save"
        onSubmit={(name) => store().setName(name)}
      />
      <TextFieldSheet
        open={panel === 'notes'}
        onOpenChange={(next) => !next && setPanel(null)}
        title="Program notes"
        label="Notes"
        initialValue={draft.notes ?? ''}
        multiline
        submitLabel="Save"
        onSubmit={(notes) => store().setNotes(notes)}
      />
      <ConfirmSheet
        open={panel === 'archive'}
        onOpenChange={(next) => !next && setPanel(null)}
        tone="neutral"
        title={`Archive ${draft.name}?`}
        description="It's your active program, so it'll be deactivated. You can restore it later."
        confirmLabel="Archive program"
        cancelLabel="Keep it"
        onConfirm={() => {
          setPanel(null)
          void archive()
        }}
      />
      <ConfirmSheet
        open={panel === 'delete'}
        onOpenChange={(next) => !next && setPanel(null)}
        tone="destructive"
        title={`Delete ${draft.name}?`}
        description={deleteCopy}
        confirmLabel="Delete program"
        cancelLabel="Keep it"
        onConfirm={() => {
          setPanel(null)
          void remove()
        }}
      />
    </>
  )
}
