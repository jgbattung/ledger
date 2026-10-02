/**
 * The "Soon" pill shared by SoonRow and drawer rows that are approved but
 * unbuilt. Muted text on the muted surface - never dimmed below the 4.5:1 floor.
 */
export function SoonPill() {
  return (
    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      Soon
    </span>
  )
}

/**
 * The shared contract for an approved-but-unbuilt row, used by both the
 * quick-action sheet and the More menu.
 *
 * It is a genuinely `disabled` button, not a div that swallows taps: it leaves
 * the tab order and is announced as unavailable. The label stays at
 * `text-muted-foreground`, which is contrast-verified >=4.5:1 in both themes -
 * the state is carried by the "Soon" pill, never by dimming below that floor.
 * A row like this never navigates, never toasts, and never promises a date.
 */
export function SoonRow({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      className="flex min-h-touch-primary w-full items-center justify-between gap-4 py-3 text-left"
    >
      <span className="text-base text-muted-foreground">{label}</span>
      <SoonPill />
    </button>
  )
}
