import type { ReactNode } from 'react'
import { useSettings } from '@/settings/SettingsProvider'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Stepper, formatSeconds } from '@/components/ui/stepper'
import { cn } from '@/lib/utils'
import type { Theme, Unit, WeekStart } from '@/db/types'

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' },
]

const WEEK_START_OPTIONS: { value: WeekStart; label: string }[] = [
  { value: 'mon', label: 'Mon' },
  { value: 'sun', label: 'Sun' },
]

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-6">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="mt-2 divide-y divide-border border-y border-border">{children}</div>
    </section>
  )
}

function SettingsRow({
  label,
  helper,
  control,
}: {
  label: string
  helper?: string
  control: ReactNode
}) {
  return (
    <div className="flex min-h-touch-primary items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-base">{label}</p>
        {helper ? <p className="mt-0.5 text-sm text-muted-foreground">{helper}</p> : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="flex min-h-touch-primary items-center justify-between gap-4 py-3">
      <div className="h-4 w-32 animate-pulse rounded-sm bg-muted" />
      <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
    </div>
  )
}

function SkeletonSection({ title, rows }: { title: string; rows: number }) {
  return (
    <section className="mt-8 first:mt-6">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="mt-2 divide-y divide-border border-y border-border">
        {Array.from({ length: rows }, (_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </section>
  )
}

export function SettingsPage() {
  const { settings, updateSettings } = useSettings()

  return (
    <div>
      <h1 className="text-2xl font-semibold">Settings</h1>

      {settings === null ? (
        <>
          <SkeletonSection title="Logging defaults" rows={3} />
          <SkeletonSection title="Units & display" rows={2} />
          <SkeletonSection title="Analytics" rows={1} />
        </>
      ) : (
        <>
          <SettingsSection title="Logging defaults">
            <SettingsRow
              label="Default RIR"
              control={
                <Stepper
                  value={settings.defaultRir}
                  onValueChange={(v) => updateSettings({ defaultRir: v })}
                  min={0}
                  max={5}
                  step={1}
                  decrementLabel="Decrease default RIR"
                  incrementLabel="Increase default RIR"
                />
              }
            />
            <SettingsRow
              label="Default rest"
              control={
                <Stepper
                  value={settings.defaultRestSeconds}
                  onValueChange={(v) => updateSettings({ defaultRestSeconds: v })}
                  min={30}
                  max={600}
                  step={15}
                  formatValue={formatSeconds}
                  decrementLabel="Decrease default rest"
                  incrementLabel="Increase default rest"
                />
              }
            />
            <SettingsRow
              label="Warm-up sets"
              control={
                <Stepper
                  value={settings.defaultWarmupSetCount}
                  onValueChange={(v) => updateSettings({ defaultWarmupSetCount: v })}
                  min={0}
                  max={5}
                  step={1}
                  decrementLabel="Decrease warm-up sets"
                  incrementLabel="Increase warm-up sets"
                />
              }
            />
          </SettingsSection>

          <SettingsSection title="Units & display">
            <SettingsRow
              label="Units"
              helper="Display only — data is always stored in kg"
              control={
                <SegmentedControl
                  value={settings.unit}
                  onValueChange={(v) => updateSettings({ unit: v })}
                  options={UNIT_OPTIONS}
                  aria-label="Units"
                  className={cn('w-32')}
                />
              }
            />
            <SettingsRow
              label="Theme"
              control={
                <SegmentedControl
                  value={settings.theme}
                  onValueChange={(v) => updateSettings({ theme: v })}
                  options={THEME_OPTIONS}
                  aria-label="Theme"
                  className={cn('w-48')}
                />
              }
            />
          </SettingsSection>

          <SettingsSection title="Analytics">
            <SettingsRow
              label="Week starts on"
              helper="Affects analytics grouping only"
              control={
                <SegmentedControl
                  value={settings.weekStartsOn}
                  onValueChange={(v) => updateSettings({ weekStartsOn: v })}
                  options={WEEK_START_OPTIONS}
                  aria-label="Week starts on"
                  className={cn('w-32')}
                />
              }
            />
          </SettingsSection>
        </>
      )}
    </div>
  )
}
