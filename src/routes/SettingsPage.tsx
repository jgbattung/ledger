import { Button } from '@/components/ui/button'
import { useTheme } from '@/settings/SettingsProvider'
import type { Theme } from '@/db/types'
import { cn } from '@/lib/utils'

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export function SettingsPage() {
  const { theme, setTheme } = useTheme()

  return (
    <div>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-muted-foreground">App preferences will live here.</p>

      <div className="mt-6">
        <h2 className="text-sm font-medium text-muted-foreground">Theme</h2>
        <div className="mt-2 flex gap-2">
          {THEME_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={theme === option.value ? 'default' : 'outline'}
              className={cn('min-h-touch-min')}
              onClick={() => setTheme(option.value)}
              aria-pressed={theme === option.value}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
