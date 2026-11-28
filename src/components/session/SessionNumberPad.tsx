import { useEffect } from 'react'
import { NumberPad } from '@/components/session/NumberPad'
import { useUnit } from '@/settings/SettingsProvider'
import { useSessionStore } from '@/stores/sessionStore'

/** The number pad bound to the live workout's session store. */
export function SessionNumberPad() {
  const pad = useSessionStore((state) => state.pad)
  const activeSet = useSessionStore((state) =>
    state.pad
      ? state.exercises.flatMap((entry) => entry.sets).find((row) => row.id === state.pad?.setId)
      : undefined,
  )
  const unit = useUnit()
  useEffect(() => {
    useSessionStore.getState().syncPadUnit(unit)
  }, [unit, pad])
  return (
    <NumberPad
      pad={pad}
      activeSet={activeSet}
      onKey={(key) => useSessionStore.getState().padKey(key)}
      onRir={(setId, rir, plus) => useSessionStore.getState().setRir(setId, rir, plus)}
      onNext={() => useSessionStore.getState().padNext()}
      onClose={() => useSessionStore.getState().closePad()}
    />
  )
}
