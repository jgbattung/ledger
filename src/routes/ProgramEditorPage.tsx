import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { SlidersHorizontal } from 'lucide-react'
import { BackLink } from '@/components/BackLink'
import { DayTabs, dayPanelId, dayTabId } from '@/components/programs/DayTabs'
import { DayNotes } from '@/components/programs/DayNotes'
import { TextFieldSheet } from '@/components/ui/text-field-sheet'
import { selectIsDirty, useProgramDraftStore } from '@/stores/programDraftStore'
import { cn } from '@/lib/utils'

const FOOTER_BUTTON =
  'flex h-12 items-center justify-center rounded-md text-base font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:bg-muted disabled:text-muted-foreground'

const store = useProgramDraftStore.getState

/**
 * Full-screen program editor (new and existing). Edits an in-memory draft; Save
 * and Activate commit the whole tree in one transaction.
 */
export function ProgramEditorPage() {
  const { programId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const draft = useProgramDraftStore((s) => s.draft)
  const selectedDayId = useProgramDraftStore((s) => s.selectedDayId)
  const namePromptOpen = useProgramDraftStore((s) => s.namePromptOpen)
  const dirty = useProgramDraftStore(selectIsDirty)

  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState(false)

  // Keep a draft that already matches this route (the return from the picker);
  // otherwise start a new one or load the saved program. Unknown ids bounce.
  useEffect(() => {
    const { draft: current, startNew, load } = store()
    const matches = programId ? current?.id === programId : current?.isNew === true
    if (matches) return
    if (!programId) {
      startNew()
      return
    }
    let cancelled = false
    void load(programId).then((found) => {
      if (!found && !cancelled) navigate('/workout', { replace: true })
    })
    return () => {
      cancelled = true
    }
  }, [programId, navigate])

  const routeMatches = draft && (programId ? draft.id === programId : draft.isNew)
  if (!draft || !routeMatches) return <div className="min-h-full" aria-busy="true" />

  const day = draft.days.find((d) => d.id === selectedDayId) ?? draft.days[0]
  const showActivate = !draft.isActive && !draft.isArchived

  const goBack = () => {
    if (location.key !== 'default') navigate(-1)
    else navigate('/workout', { replace: true })
  }

  const finish = async (activate: boolean) => {
    setBusy(true)
    setSaveError(false)
    try {
      await store().commit({ activate })
      store().reset()
      navigate('/workout', { replace: true })
    } catch {
      setSaveError(true)
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 px-4">
        <header className="flex h-[52px] items-center gap-2">
          <BackLink onBack={goBack} label="Back" />
          <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold">
            {draft.name}
          </h1>
          <button
            type="button"
            aria-label="Program settings"
            className="flex size-touch-min shrink-0 items-center justify-end rounded-md text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <SlidersHorizontal className="size-5" aria-hidden="true" />
          </button>
        </header>

        <DayTabs
          days={draft.days}
          selectedId={day.id}
          onSelect={(id) => store().selectDay(id)}
          onAdd={() => store().addDay()}
        />

        <div
          role="tabpanel"
          id={dayPanelId(day.id)}
          aria-labelledby={dayTabId(day.id)}
          className="pb-6"
        >
          <DayNotes
            key={day.id}
            value={day.notes ?? ''}
            onChange={(value) => store().setDayNotes(day.id, value)}
          />
        </div>
      </div>

      <footer className="sticky bottom-0 border-t border-border bg-background px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        {saveError ? (
          <p role="alert" className="pb-2 text-sm text-destructive">
            Couldn&apos;t save. Try again.
          </p>
        ) : null}
        <div className={cn('grid gap-2.5', showActivate ? 'grid-cols-[1fr_1.25fr]' : 'grid-cols-1')}>
          <button
            type="button"
            disabled={busy || (!dirty && !draft.isNew)}
            onClick={() => void finish(false)}
            className={cn(
              FOOTER_BUTTON,
              showActivate
                ? 'bg-secondary text-secondary-foreground hover:bg-accent'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            Save
          </button>
          {showActivate ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void finish(true)}
              className={cn(FOOTER_BUTTON, 'bg-primary text-primary-foreground hover:bg-primary/90')}
            >
              Activate
            </button>
          ) : null}
        </div>
      </footer>

      <TextFieldSheet
        open={namePromptOpen}
        onOpenChange={(open) => {
          if (!open) store().closeNamePrompt()
        }}
        title="Name your program"
        label="Program name"
        submitLabel="Continue"
        onSubmit={(name) => store().setName(name)}
      />
    </div>
  )
}
