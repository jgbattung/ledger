import * as React from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Bottom-anchored sheet (LG-005). The project's standard mobile picker for
 * option sets too large for `SegmentedControl`. Built on the installed
 * `radix-ui` unified package's `Dialog` namespace - not the per-package
 * `@radix-ui/react-dialog`. Bottom-only: no side variants, no size system.
 */

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-black/50',
        'data-[state=open]:motion-safe:animate-in data-[state=open]:motion-safe:fade-in',
        'data-[state=closed]:motion-safe:animate-out data-[state=closed]:motion-safe:fade-out',
        'motion-safe:duration-200 motion-safe:ease-out-app',
        className,
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <SheetOverlay />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex max-h-[70svh] flex-col',
          'rounded-t-xl border-t border-border bg-card text-card-foreground',
          'pb-[env(safe-area-inset-bottom)]',
          'data-[state=open]:motion-safe:animate-in data-[state=open]:motion-safe:slide-in-from-bottom',
          'data-[state=closed]:motion-safe:animate-out data-[state=closed]:motion-safe:slide-out-to-bottom',
          'motion-safe:duration-200 motion-safe:ease-out-app',
          'outline-none',
          className,
        )}
        {...props}
      >
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25" />
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function SheetHeader({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex shrink-0 items-center justify-between gap-4 px-4 py-3', className)}
      {...props}
    >
      {children}
      <SheetClose
        aria-label="Close"
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-md',
          'text-muted-foreground outline-none transition-colors hover:text-foreground',
          'focus-visible:ring-[3px] focus-visible:ring-ring/50',
        )}
      >
        <X className="size-5" />
      </SheetClose>
    </div>
  )
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-base font-medium', className)}
      {...props}
    />
  )
}

export { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose }
