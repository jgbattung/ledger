import { useRef, useState, type RefObject } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

type TextFieldSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  label: string
  initialValue?: string
  /** Multi-line notes field: Enter inserts a newline and an empty value is allowed (clears). */
  multiline?: boolean
  submitLabel: string
  onSubmit: (value: string) => void
}

const FIELD =
  'w-full rounded-md border border-transparent bg-muted px-3 text-base text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

/** Single text input in a bottom sheet (program name, notes, day rename). */
export function TextFieldSheet({
  open,
  onOpenChange,
  title,
  label,
  initialValue = '',
  multiline = false,
  submitLabel,
  onSubmit,
}: TextFieldSheetProps) {
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          fieldRef.current?.focus()
        }}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        {/* Mounted only while open (Radix unmounts closed content), so state
            re-seeds from `initialValue` every time the sheet opens. */}
        <TextFieldForm
          fieldRef={fieldRef}
          label={label}
          initialValue={initialValue}
          multiline={multiline}
          submitLabel={submitLabel}
          onSubmit={(value) => {
            onSubmit(value)
            onOpenChange(false)
          }}
        />
      </SheetContent>
    </Sheet>
  )
}

function TextFieldForm({
  fieldRef,
  label,
  initialValue,
  multiline,
  submitLabel,
  onSubmit,
}: {
  fieldRef: RefObject<(HTMLInputElement & HTMLTextAreaElement) | null>
  label: string
  initialValue: string
  multiline: boolean
  submitLabel: string
  onSubmit: (value: string) => void
}) {
  const [value, setValue] = useState(initialValue)
  const trimmed = value.trim()
  const canSubmit = multiline || trimmed.length > 0

  return (
    <form
      className="flex flex-col gap-3 px-4 pb-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (canSubmit) onSubmit(trimmed)
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        {multiline ? (
          <textarea
            ref={fieldRef}
            value={value}
            rows={4}
            onChange={(event) => setValue(event.target.value)}
            className={cn(FIELD, 'min-h-touch-min resize-none py-3')}
          />
        ) : (
          <input
            ref={fieldRef}
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className={cn(FIELD, 'min-h-touch-min')}
          />
        )}
      </label>
      <button
        type="submit"
        disabled={!canSubmit}
        className="flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:bg-muted disabled:text-muted-foreground disabled:hover:bg-muted"
      >
        {submitLabel}
      </button>
    </form>
  )
}
