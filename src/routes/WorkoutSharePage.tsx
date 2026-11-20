import { useMemo, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Download, Share2 } from 'lucide-react'
import { BackLink } from '@/components/BackLink'
import { WorkoutShareCard, type ShareTemplate } from '@/components/summary/WorkoutShareCard'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { workoutPath } from '@/lib/paths'
import {
  canShareFiles,
  downloadImage,
  renderCardPng,
  shareFilename,
  shareImage,
} from '@/lib/shareImage'
import { useGoBack } from '@/lib/useGoBack'
import { primaryMusclesOf, summarizeWorkout } from '@/workouts/summary'
import { useWorkoutSession } from '@/workouts/useWorkoutSession'

const TEMPLATES: { value: ShareTemplate; label: string }[] = [
  { value: 'map', label: 'Map' },
  { value: 'sticker', label: 'Sticker' },
  { value: 'ledger', label: 'Ledger' },
]
const TEMPLATE_KEY = 'ledger-share-template'

/** The last template, remembered per device (a UI convenience, not history). */
function readTemplate(): ShareTemplate {
  try {
    const stored = localStorage.getItem(TEMPLATE_KEY)
    if (TEMPLATES.some((option) => option.value === stored)) return stored as ShareTemplate
  } catch {
    // Storage can be blocked; the default is fine.
  }
  return 'map'
}

/** Preview-only checkerboard behind the transparent Sticker, from tokens. */
const CHECKERBOARD =
  'repeating-conic-gradient(color-mix(in oklab, var(--foreground) 16%, var(--background)) 0 25%, color-mix(in oklab, var(--foreground) 7%, var(--background)) 0 50%) 0 0 / 20px 20px'

const FOOTER_BUTTON =
  'inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-md text-base font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50'

/**
 * Share preview (`/workouts/:workoutId/share`, design-system 14). The card on
 * the stage is the exact, unscaled node that gets exported, so the preview is
 * pixel-identical to the PNG. Save always downloads; Share shows only where the
 * browser can share files. Everything runs on the device, offline included.
 */
export function WorkoutSharePage() {
  const { workoutId } = useParams()
  const state = useWorkoutSession(workoutId)
  const goBack = useGoBack(workoutId ? workoutPath(workoutId) : '/')
  const [template, setTemplate] = useState<ShareTemplate>(readTemplate)
  const [busy, setBusy] = useState<'save' | 'share' | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const canShare = useMemo(canShareFiles, [])

  const session = state.status === 'ready' ? state.session : null
  const summary = useMemo(
    () => (session ? summarizeWorkout(session, primaryMusclesOf, Date.now()) : null),
    [session],
  )

  if (state.status === 'missing') return <Navigate to="/" replace />
  if (state.status === 'in_progress') return <Navigate to="/session" replace />
  if (!session || !summary) return null

  const pick = (next: ShareTemplate) => {
    setTemplate(next)
    try {
      localStorage.setItem(TEMPLATE_KEY, next)
    } catch {
      // Not remembered; nothing else depends on it.
    }
  }

  // Render first, then share inside the same click chain so the activation is still live.
  const run = async (mode: 'save' | 'share') => {
    const node = cardRef.current
    if (!node || busy) return
    setBusy(mode)
    try {
      const blob = await renderCardPng(node)
      const filename = shareFilename(session.workout)
      if (mode === 'save') downloadImage(blob, filename)
      else await shareImage(blob, filename)
    } catch {
      // Nothing destructive happened: the buttons re-enable and the page stays.
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[52px] shrink-0 items-center gap-2 px-4">
        <BackLink onBack={goBack} label="Back" />
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">Share workout</h1>
      </header>
      <div className="shrink-0 px-4 pb-2">
        <SegmentedControl
          aria-label="Card template"
          value={template}
          onValueChange={pick}
          options={TEMPLATES}
        />
      </div>
      <div className="flex min-h-0 flex-1 overflow-y-auto bg-muted px-3">
        <div
          className="m-auto shrink-0 overflow-hidden rounded-[14px] shadow-[0_8px_24px_oklch(0_0_0/0.25)]"
          style={template === 'sticker' ? { background: CHECKERBOARD } : undefined}
        >
          <WorkoutShareCard ref={cardRef} template={template} session={session} summary={summary} />
        </div>
      </div>
      <div className="flex shrink-0 gap-2 border-t border-border bg-background px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void run('save')}
          className={`${FOOTER_BUTTON} border border-border bg-background text-foreground hover:bg-muted`}
        >
          <Download className="size-5" aria-hidden="true" />
          {busy === 'save' ? 'Saving…' : 'Save image'}
        </button>
        {canShare ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void run('share')}
            className={`${FOOTER_BUTTON} bg-primary text-primary-foreground hover:bg-primary/90`}
          >
            <Share2 className="size-5" aria-hidden="true" />
            {busy === 'share' ? 'Sharing…' : 'Share'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
