import { newId } from '@/db/ids'
import { programs } from '@/db/repos/programs'
import type { DraftExercise, ProgramDraft } from '@/programs/model'

const ref = (exerciseId: string) => ({ source: 'db' as const, exerciseId })
export const COMPLETE = { workingSets: 3, repMin: 8, repMax: 10, rirTarget: 1, restSeconds: 90 }

export function exercise(exerciseId: string, targets: Partial<DraftExercise> = COMPLETE): DraftExercise {
  return { id: newId(), exerciseRef: ref(exerciseId), ...targets }
}

export type Seeded = { draft: ProgramDraft; programId: string; pushId: string; pullId: string }

export async function seedProgram(
  pushExercises: DraftExercise[] = [exercise('bench'), exercise('fly', { workingSets: 2, repMin: 12, repMax: 12 })],
): Promise<Seeded> {
  const draft: ProgramDraft = {
    id: newId(),
    isNew: true,
    name: 'PPL',
    isActive: false,
    isArchived: false,
    days: [
      { id: newId(), name: 'Push', exercises: pushExercises },
      { id: newId(), name: 'Pull', exercises: [exercise('row')] },
      { id: newId(), name: 'Rest', exercises: [] },
    ],
  }
  await programs.saveTree(draft)
  return { draft, programId: draft.id, pushId: draft.days[0].id, pullId: draft.days[1].id }
}

