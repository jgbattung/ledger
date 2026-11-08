/** Appears once every set is checked (AC22): a 56px primary Finish workout. */
export function FinishBar({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="shrink-0 border-t border-border bg-background px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <button
        type="button"
        onClick={onFinish}
        className="flex h-touch-primary w-full items-center justify-center rounded-lg bg-primary text-base font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Finish workout
      </button>
    </div>
  )
}
