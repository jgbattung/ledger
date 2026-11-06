import type { Page } from '@playwright/test';

export type SeedDay = { name: string; exercises: string[] };

/** The six-day program from the LG-021 alignment mockups. */
export const PPL_SIX: SeedDay[] = [
  { name: 'Push A', exercises: ['barbell-bench-press', 'cable-lateral-raise'] },
  { name: 'Pull A', exercises: ['pull-up', 'bent-over-barbell-row', 'face-pull'] },
  { name: 'Legs A', exercises: ['barbell-squat', 'romanian-deadlift'] },
  { name: 'Rest', exercises: [] },
  { name: 'Push B', exercises: ['incline-dumbbell-press'] },
  { name: 'Pull B', exercises: ['chin-up'] },
];

/**
 * Seeds an active program with complete targets straight into the app's
 * IndexedDB (raw rows, same shapes the repos write), then reloads. Workout
 * completion cannot be driven through the UI yet (LG-010/LG-022), so this is
 * also how done workout days are produced.
 */
export async function seedActiveProgram(
  page: Page,
  opts: { name?: string; days?: SeedDay[]; doneDays?: string[] } = {},
) {
  const name = opts.name ?? 'Push Pull Legs';
  const days = opts.days ?? PPL_SIX;
  const doneDays = opts.doneDays ?? [];
  await page.goto('/workout');
  await page.getByRole('heading', { name: 'Workout', exact: true }).waitFor();
  await page.evaluate(
    async ({ name, days, doneDays }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('ledger');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const t = Date.now();
      const base = { createdAt: t, updatedAt: t, deletedAt: null };
      const programId = crypto.randomUUID();
      const rows: [string, Record<string, unknown>][] = [];
      const dayIds = days.map(() => crypto.randomUUID());
      const completedDayIds = days.flatMap((day, i) => (doneDays.includes(day.name) ? [dayIds[i]] : []));
      const firstUndone = dayIds.findIndex((id) => !completedDayIds.includes(id));
      rows.push([
        'programs',
        {
          id: programId,
          ...base,
          name,
          isActive: true,
          isArchived: false,
          currentDayIndex: Math.max(firstUndone, 0),
          completedDayIds,
          currentCycleIndex: 0,
        },
      ]);
      days.forEach((day, i) => {
        rows.push(['programDays', { id: dayIds[i], ...base, programId, orderIndex: i, name: day.name }]);
        day.exercises.forEach((exerciseId, j) => {
          rows.push([
            'programExercises',
            {
              id: crypto.randomUUID(),
              ...base,
              programDayId: dayIds[i],
              orderIndex: j,
              exerciseRef: { source: 'db', exerciseId },
              workingSets: 3,
              repMin: 8,
              repMax: 12,
            },
          ]);
        });
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['programs', 'programDays', 'programExercises'], 'readwrite');
        for (const [store, row] of rows) tx.objectStore(store).put(row);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { name, days, doneDays },
  );
  await page.reload();
}
