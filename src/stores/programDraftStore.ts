import { create } from 'zustand'
import { newId } from '@/db/ids'
import { programs } from '@/db/repos'
import { emptyDraft, nextDayName, programTreeToDraft } from '@/programs/model'
import type { DraftDay, DraftExercise, ProgramDraft } from '@/programs/model'
import type { ExerciseRef } from '@/db/types'

/**
 * In-memory program editor draft. Not persisted: the draft only reaches
 * Dexie through `commit`, which hands it to `programs.saveTree`.
 */
type PersistedFlags = Pick<ProgramDraft, 'isActive' | 'isArchived'>

type ProgramDraftState = {
  draft: ProgramDraft | null
  /** JSON snapshot of the draft at load/commit, for dirty checks. */
  baseline: string
  selectedDayId: string | null
  namePromptOpen: boolean

  startNew: () => void
  /** Resolves false when the program does not exist (or is deleted). */
  load: (id: string) => Promise<boolean>
  setName: (name: string) => void
  setNotes: (notes: string) => void
  addDay: () => void
  renameDay: (dayId: string, name: string) => void
  setDayNotes: (dayId: string, notes: string) => void
  removeDay: (dayId: string) => void
  changeDayToRest: (dayId: string) => void
  selectDay: (dayId: string) => void
  addExercises: (dayId: string, refs: ExerciseRef[]) => void
  removeExercise: (dayId: string, exerciseId: string) => void
  closeNamePrompt: () => void
  commit: (opts?: { activate?: boolean }) => Promise<void>
  applyPersistedFlags: (patch: Partial<PersistedFlags>) => void
  reset: () => void
}

const INITIAL = {
  draft: null,
  baseline: '',
  selectedDayId: null,
  namePromptOpen: false,
} as const

const snapshot = (draft: ProgramDraft | null) => JSON.stringify(draft)

const refKey = (ref: ExerciseRef) => `${ref.source}:${ref.exerciseId}`

/** Replaces one day by id; no-op when the day does not exist. */
function mapDay(
  draft: ProgramDraft | null,
  dayId: string,
  fn: (day: DraftDay) => DraftDay,
): ProgramDraft | null {
  if (!draft || !draft.days.some((day) => day.id === dayId)) return draft
  return { ...draft, days: draft.days.map((day) => (day.id === dayId ? fn(day) : day)) }
}

export const useProgramDraftStore = create<ProgramDraftState>((set, get) => ({
  ...INITIAL,

  startNew: () => {
    const draft = emptyDraft()
    set({
      draft,
      baseline: snapshot(draft),
      selectedDayId: draft.days[0].id,
      namePromptOpen: true,
    })
  },

  load: async (id) => {
    const tree = await programs.loadTree(id)
    if (!tree) return false
    const draft = programTreeToDraft(tree)
    set({
      draft,
      baseline: snapshot(draft),
      selectedDayId: draft.days[0]?.id ?? null,
      namePromptOpen: false,
    })
    return true
  },

  setName: (name) => set(({ draft }) => ({ draft: draft && { ...draft, name } })),

  // Empty notes are stored as absent so clearing a field never reads as dirty.
  setNotes: (notes) =>
    set(({ draft }) => ({ draft: draft && { ...draft, notes: notes || undefined } })),

  addDay: () =>
    set(({ draft }) => {
      if (!draft) return {}
      const day: DraftDay = { id: newId(), name: nextDayName(draft.days), exercises: [] }
      return { draft: { ...draft, days: [...draft.days, day] }, selectedDayId: day.id }
    }),

  renameDay: (dayId, name) =>
    set(({ draft }) => ({ draft: mapDay(draft, dayId, (day) => ({ ...day, name })) })),

  setDayNotes: (dayId, notes) =>
    set(({ draft }) => ({ draft: mapDay(draft, dayId, (day) => ({ ...day, notes: notes || undefined })) })),

  removeDay: (dayId) =>
    set(({ draft, selectedDayId }) => {
      if (!draft || draft.days.length <= 1) return {}
      const index = draft.days.findIndex((day) => day.id === dayId)
      if (index === -1) return {}
      const days = draft.days.filter((day) => day.id !== dayId)
      const neighbour = days[Math.min(index, days.length - 1)]
      return {
        draft: { ...draft, days },
        selectedDayId: selectedDayId === dayId ? neighbour.id : selectedDayId,
      }
    }),

  changeDayToRest: (dayId) =>
    set(({ draft }) => ({ draft: mapDay(draft, dayId, (day) => ({ ...day, exercises: [] })) })),

  selectDay: (dayId) =>
    set(({ draft }) =>
      draft?.days.some((day) => day.id === dayId) ? { selectedDayId: dayId } : {},
    ),

  addExercises: (dayId, refs) =>
    set(({ draft }) => ({
      draft: mapDay(draft, dayId, (day) => {
        const present = new Set(day.exercises.map((e) => refKey(e.exerciseRef)))
        const added: DraftExercise[] = []
        for (const ref of refs) {
          if (present.has(refKey(ref))) continue
          present.add(refKey(ref))
          added.push({ id: newId(), exerciseRef: ref })
        }
        return { ...day, exercises: [...day.exercises, ...added] }
      }),
    })),

  removeExercise: (dayId, exerciseId) =>
    set(({ draft }) => ({
      draft: mapDay(draft, dayId, (day) => ({
        ...day,
        exercises: day.exercises.filter((e) => e.id !== exerciseId),
      })),
    })),

  closeNamePrompt: () => set({ namePromptOpen: false }),

  commit: async (opts = {}) => {
    const { draft } = get()
    if (!draft) return
    const activate = opts.activate ?? false
    await programs.saveTree(draft, { activate })
    // Only the saved snapshot becomes the baseline, so an edit made while
    // the save was in flight still reads as dirty.
    const saved: ProgramDraft = {
      ...draft,
      isNew: false,
      isActive: activate ? true : draft.isActive,
    }
    set(({ draft: current }) => ({
      draft:
        current && current.id === saved.id
          ? { ...current, isNew: false, isActive: saved.isActive }
          : current,
      baseline: snapshot(saved),
    }))
  },

  applyPersistedFlags: (patch) =>
    set(({ draft, baseline }) => {
      if (!draft) return {}
      return {
        draft: { ...draft, ...patch },
        baseline: baseline ? JSON.stringify({ ...JSON.parse(baseline), ...patch }) : baseline,
      }
    }),

  reset: () => set({ ...INITIAL }),
}))

/** True when the draft differs from what was last loaded or saved. */
export const selectIsDirty = (state: ProgramDraftState): boolean =>
  state.draft !== null && snapshot(state.draft) !== state.baseline
