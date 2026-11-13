import { useEffect, useState, type KeyboardEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CircleSlash, SlidersHorizontal } from 'lucide-react'
import { BackLink } from '@/components/BackLink'
import { DeletedPill } from '@/components/library/DeletedPill'
import { ExerciseActionsSheet } from '@/components/library/ExerciseActionsSheet'
import { ExerciseHistory } from '@/components/library/ExerciseHistory'
import { ExerciseFacts } from '@/components/library/ExerciseFacts'
import { ExerciseMedia } from '@/components/library/ExerciseMedia'
import { ConfirmSheet } from '@/components/ui/confirm-sheet'
import { programs } from '@/db/repos'
import { loadExerciseDetail, type ExerciseDetail } from '@/exercises/detail'
import { useGoBack } from '@/lib/useGoBack'
import { cn } from '@/lib/utils'
import { useCustomExerciseStore } from '@/stores/customExerciseStore'

type Tab = 'info' | 'history'
const TABS: { id: Tab; label: string }[] = [
  { id: 'info', label: 'Info' },
  { id: 'history', label: 'History' },
]
const tabId = (tab: Tab) => `exercise-tab-${tab}`
const panelId = (tab: Tab) => `exercise-panel-${tab}`

function InfoPanel({ detail }: { detail: ExerciseDetail }) {
  return (
    <>
      <ExerciseMedia images={detail.images} />
      <ExerciseFacts detail={detail} />
      {detail.instructions.length > 0 ? (
        <section>
          <h2 className="px-4 pt-6 pb-1.5 text-lg font-semibold">Instructions</h2>
          <ol className="px-4 pb-8">
            {detail.instructions.map((step, index) => (
              <li key={index} className="grid grid-cols-[20px_minmax(0,1fr)] gap-2 py-1.5">
                <span className="text-sm leading-relaxed text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                <span className="text-base leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {detail.notes ? (
        <section>
          <h2 className="px-4 pt-6 pb-1.5 text-lg font-semibold">Notes</h2>
          <p className="px-4 pb-8 text-base leading-relaxed whitespace-pre-wrap">{detail.notes}</p>
        </section>
      ) : null}
    </>
  )
}

function deleteDescription(programNames: string[]): string {
  const base = 'It leaves the library and the pickers. Your logged sets are kept.'
  if (programNames.length === 0) return base
  const count = programNames.length
  return `${base} It stays in ${count} ${count === 1 ? 'program' : 'programs'} (${programNames.join(', ')}) until you remove it there.`
}

/** One page for any exercise, bundled or custom: Info and History tabs plus the actions drawer. */
export function ExerciseDetailPage() {
  const { source, exerciseId } = useParams()
  const goBack = useGoBack('/more/library')
  const [searchParams, setSearchParams] = useSearchParams()
  const [detail, setDetail] = useState<ExerciseDetail | null | undefined>(undefined)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [deleteNames, setDeleteNames] = useState<string[] | null>(null)
  const navigate = useNavigate()
  const tab: Tab = searchParams.get('tab') === 'history' ? 'history' : 'info'

  useEffect(() => {
    let cancelled = false
    if (source !== 'db' && source !== 'custom') {
      setDetail(null)
      return
    }
    setDetail(undefined)
    void loadExerciseDetail({ source, exerciseId: exerciseId ?? '' }).then((loaded) => {
      if (!cancelled) setDetail(loaded ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [source, exerciseId])

  const openDelete = async () => {
    if (!detail) return
    setActionsOpen(false)
    setDeleteNames(await programs.namesUsingExercise(detail.ref))
  }

  const confirmDelete = async () => {
    if (!detail) return
    await useCustomExerciseStore.getState().remove(detail.ref.exerciseId)
    setDeleteNames(null)
    // The page stays and re-renders as deleted (Deleted pill, History, Duplicate only).
    setDetail((await loadExerciseDetail(detail.ref)) ?? null)
  }

  const select = (next: Tab) => {
    setSearchParams(
      (params) => {
        const updated = new URLSearchParams(params)
        if (next === 'info') updated.delete('tab')
        else updated.set('tab', next)
        return updated
      },
      { replace: true },
    )
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = TABS.findIndex((t) => t.id === tab)
    const last = TABS.length - 1
    let target: number
    if (event.key === 'ArrowRight') target = current === last ? 0 : current + 1
    else if (event.key === 'ArrowLeft') target = current === 0 ? last : current - 1
    else if (event.key === 'Home') target = 0
    else if (event.key === 'End') target = last
    else return
    event.preventDefault()
    select(TABS[target].id)
    document.getElementById(tabId(TABS[target].id))?.focus()
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[52px] shrink-0 items-center justify-between gap-2 px-4">
        <BackLink onBack={goBack} label="Back" />
        {detail ? (
          <button
            type="button"
            aria-label="Exercise actions"
            onClick={() => setActionsOpen(true)}
            className="flex size-touch-min shrink-0 items-center justify-end rounded-md text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <SlidersHorizontal className="size-5" aria-hidden="true" />
          </button>
        ) : null}
      </header>

      {detail === null ? (
        <div className="px-4 pt-24 text-center">
          <div className="mx-auto mb-3.5 flex size-13 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CircleSlash className="size-6" aria-hidden="true" />
          </div>
          <p className="text-lg font-semibold">Exercise not found</p>
          <p className="mt-1.5 text-sm text-muted-foreground">It may have been removed from the library.</p>
        </div>
      ) : detail ? (
        <>
          <div className="shrink-0 px-4 pt-0.5 pb-2.5">
            <h1 className="text-2xl font-semibold text-balance">
              {detail.name}
              {detail.isCustom ? (
                <span className="ml-1.5 inline-block rounded-full border border-border px-2 py-px align-[3px] text-xs font-medium text-muted-foreground">
                  Custom
                </span>
              ) : null}
              {detail.deleted ? <DeletedPill className="align-[3px]" /> : null}
            </h1>
            {detail.aliases.length > 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Also known as {detail.aliases.join(', ')}
              </p>
            ) : null}
          </div>

          <div
            role="tablist"
            aria-label="Exercise"
            onKeyDown={onKeyDown}
            className="grid shrink-0 grid-cols-2 border-b border-border"
          >
            {TABS.map(({ id, label }) => {
              const selected = id === tab
              return (
                <button
                  key={id}
                  id={tabId(id)}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={selected ? panelId(id) : undefined}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => select(id)}
                  className={cn(
                    '-mb-px flex h-touch-min items-center justify-center border-b-2 text-[15px] font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    selected
                      ? 'border-foreground text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div
            key={tab}
            role="tabpanel"
            id={panelId(tab)}
            aria-labelledby={tabId(tab)}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            {tab === 'info' ? <InfoPanel detail={detail} /> : <ExerciseHistory exerciseRef={detail.ref} />}
          </div>

          <ExerciseActionsSheet
            open={actionsOpen}
            onOpenChange={setActionsOpen}
            name={detail.name}
            isCustom={detail.isCustom}
            deleted={detail.deleted}
            onEdit={() => {
              setActionsOpen(false)
              navigate(`/exercises/custom/${detail.ref.exerciseId}/edit`)
            }}
            onDuplicate={() => {
              setActionsOpen(false)
              navigate(`/exercises/new?from=${detail.ref.source}:${detail.ref.exerciseId}`)
            }}
            onDelete={() => void openDelete()}
          />
          <ConfirmSheet
            open={deleteNames !== null}
            onOpenChange={(open) => {
              if (!open) setDeleteNames(null)
            }}
            title={`Delete ${detail.name}?`}
            description={deleteDescription(deleteNames ?? [])}
            confirmLabel="Delete exercise"
            cancelLabel="Keep it"
            tone="destructive"
            onConfirm={() => void confirmDelete()}
          />
        </>
      ) : null}
    </div>
  )
}
