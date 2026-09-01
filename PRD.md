# Ledger — Product Requirements Document

> **Name:** Ledger (confirmed). Still keep it in one config constant, `APP_NAME`.
> **Status:** Implementation-ready. Scope is locked per `full-features-list.md` plus one addition: **Supabase sync is pulled into v1** (§5.10, M7). Do not add other features. No open questions.
> **Executor:** Claude Code agent workflow. Requirements are numbered `<MODULE>-<n>` and each must be individually verifiable.

---

## 1. Overview

### 1.1 Vision
A personal, single-user, self-owned clone of MacroFactor Workouts (MFWO), stripped to the features Ji actually uses, with analytics rebuilt around **actual logged performance** instead of estimated maxes. Local-first PWA; Ji owns the data and the runtime.

### 1.2 Goals
- Replace the MFWO half of Ji's paid bundle.
- Flawless, fast in-gym logging loop (the core loop is the product).
- Analytics built exclusively from real logged sets — never estimated 1RM/3RM/10RM.
- Fully usable offline with zero signal; the local database is always authoritative.
- Cloud sync (Supabase, v1): off-device backup and phone↔laptop continuity. Sync is opportunistic background work — the app never waits on the network.

### 1.3 Non-goals (v1)
- No multi-user, no social features. (There is one private Supabase account for sync — a one-time login per device, nothing more.)
- No coaching, auto-progression, or program generation — the app records and visualizes only.
- No supersets, drop sets, myoreps, or failure sets.
- No plate calculator, gym profiles, or equipment entity/CRUD.
- No estimated-max analytics anywhere.
- No spreadsheet/Jeff Nippard import, nutrition integration, or wearable sync.
- No realtime or collaborative sync — background last-write-wins sync only (§5.10).

### 1.4 Target user
Exactly one: Ji. Design decisions default to his stated preferences (RIR 0, rest 3:00, async rotating programs). No settings exist to serve hypothetical other users.

**Primary device: Samsung Galaxy S23 Ultra, Chrome, installed PWA.** Secondary: desktop Chrome. Android Chrome is the first-class test target for notifications (TIM-2), the share sheet (SHARE-4), storage persistence, and sync behavior.

---

## 2. Architecture

### 2.1 Local-first data flow
- **IndexedDB (via Dexie.js) is the single source of truth.** All reads and writes go through Dexie; there is no server round-trip anywhere in v1.
- UI state (active workout in progress, timers, form state) lives in **Zustand** stores; durable domain data lives only in Dexie. On app start, Zustand hydrates from Dexie (e.g., resume an in-progress workout).
- All Dexie access goes through a **repository layer** (`src/db/repos/*`) — components never touch Dexie tables directly. This is the seam the sync engine (§2.3) plugs into.

### 2.2 PWA / offline / service worker
- Vite + `vite-plugin-pwa` generates the service worker and manifest.
- **Precache** the entire app shell plus the bundled `free-exercise-db` JSON and its images (cache-first). The app must fully function with the network disabled from first load onward.
- Installable manifest: standalone display, portrait orientation, theme-colored, icons at required sizes.
- Rest-timer completion uses the Notification API (with permission prompt at first timer use), so alerts fire with the screen off in the installed PWA.
- `navigator.storage.persist()` is requested on first launch to reduce eviction risk.

### 2.3 Cloud sync architecture (v1 — built last, M7)
Sync is a background replication layer between Dexie and Supabase. It must never change how the app behaves offline: every feature works identically with the network permanently off (only the data stays single-device).

- **Record shape:** every record carries `id` (UUIDv4, generated client-side), `createdAt`, `updatedAt` (ms epoch). `updatedAt` is set on every local write. No auto-increment primary keys anywhere.
- **Deletes are soft deletes** (`deletedAt` nullable timestamp) on all user-data tables; queries filter `deletedAt == null`. Soft deletes replicate like any other update, so deletions propagate across devices. Hard-purge only via explicit "erase data" in Settings (local only; remote wipe is a separate confirm).
- **Change tracking (outbox):** the repository layer marks every written record dirty (`syncState` table, §3.14). The sync engine drains the outbox when online.
- **Push:** upsert dirty records to Supabase Postgres (tables mirror §3), keyed by `id`.
- **Pull:** fetch remote records with `updated_at > lastPulledAt` per table; apply locally.
- **Conflict resolution:** last-write-wins per record by comparing `updatedAt`; the loser is discarded. Acceptable for a single user on two devices.
- **Blobs:** progress photos upload to Supabase Storage (path = photo `id`); the Postgres row stores the storage path. Blob download is lazy/on-demand on the second device.
- **Triggers:** sync runs on app start, on regaining connectivity (`online` event), after workout finish, and via manual "Sync now" in Settings. Never blocks the UI.
- **Auth:** one Supabase account (email + password), login once per device, session persisted. All tables protected by RLS scoped to that user id.
- **Environments:** two Supabase projects — `ledger-test` (used for all development and the pre-launch testing months) and `ledger-prod`. The active environment is a build-time env var; test builds are visibly badged.

---

## 3. Data model (Dexie schema)

Database name: `ledger`. All tables keyed on `id` (UUID string). All entities include `createdAt`, `updatedAt`, `deletedAt?`. Fields below are the required minimum; the implementer may add derived/index fields.

### 3.1 `exercises` (bundled, read-only at runtime)
The `free-exercise-db` JSON is bundled as a static asset and loaded into memory (not necessarily into Dexie; implementer's choice, but IDs must be stable — use the dataset's `id`/slug). Fields consumed: `name`, `primaryMuscles[]`, `secondaryMuscles[]`, `category`, `mechanic`, `instructions[]`, `images[]`, `equipment` (display-only tag).

### 3.2 `customExercises`
`name`, `primaryMuscles[]`, `secondaryMuscles[]`, `equipmentTag?` (free text, display-only), `notes?`.
Custom and bundled exercises share one union type `ExerciseRef = { source: 'db' | 'custom', exerciseId }` used everywhere an exercise is referenced.

### 3.3 `exerciseMeta`
Per-exercise user state, keyed by ExerciseRef: `isFavorite`, `lastUsed?: { weight, reps, unit, at }` (smart defaults carry-forward).

### 3.4 `programs`
`name`, `notes?`, `isActive` (max one active; enforce in repo layer), `isArchived`, `currentDayIndex` (position in the rotating sequence, 0-based), `currentCycleIndex` (completed-rotation counter; increments when the last day of a pass finishes), `targetCycleCount?` (planned number of cycles/weeks; drives the completion UI). No per-cycle target overrides exist.

### 3.5 `programDays`
`programId`, `orderIndex`, `name`, `isRestDay`, `notes?`.
**The ordered list of programDays is the rotating sequence.** Day 1 → … → Day N → Day 1. No weekday mapping exists anywhere in the schema. Rest days are real entries.

### 3.6 `programExercises`
`programDayId`, `orderIndex`, `exerciseRef`, `workingSets` (int), `repMin` (int), `repMax` (int), `rirTarget` (int, default 0), `restSeconds?` (fallback: global default 180), `warmupSetCount?` (fallback: global default), `notes?`.

### 3.7 `workouts`
`programId`, `programDayId`, `name`, `startedAt`, `finishedAt?`, `status: 'in_progress' | 'finished' | 'discarded'`, `notes?`, `cycleIndexAtTime?` (which cycle the workout was logged in). Every workout originates from a program day (no ad-hoc), so both refs are always set.

### 3.8 `workoutExercises`
`workoutId`, `orderIndex`, `exerciseRef`, `notes?`, `targetsSnapshot?` (copy of programExercise targets at start — so later program edits don't rewrite history), `swappedFrom?: ExerciseRef`.

### 3.9 `sets`
`workoutExerciseId`, `orderIndex`, `type: 'warmup' | 'working'`,
`weight` (number, stored **in kg** always; display converts), `reps` (int),
`rir` (int 0–6, plus `rirIsPlus` boolean for "6+"), `partialReps?` (int),
`unilateral?: { leftWeight, leftReps, rightWeight, rightReps }` (when present, `weight`/`reps` hold the display aggregate — see LOG-6),
`completedAt?` (null until checked off).

### 3.10 `bodyMetrics`
`type: 'bodyweight' | 'custom'`, `customName?` (e.g. "waist"), `value` (kg or cm, stored metric), `measuredAt`.

### 3.11 `photos`
`pose: 'front' | 'side' | 'back'`, `takenAt`, `blob` (image Blob in IndexedDB), `thumbnailBlob?`.

### 3.12 `settings` (single row, id = 'settings')
`defaultRir: 0`, `defaultRestSeconds: 180`, `defaultWarmupSetCount: 2` (confirmed default), `unit: 'kg' | 'lb'` , `theme: 'light' | 'dark' | 'system'`, `weekStartsOn: 'mon' | 'sun'` (analytics bucketing only), `dashboardWidgets: WidgetConfig[]`, `backup: { lastExportAt? }`, `sync: { autoSyncEnabled, lastSyncedAt?, lastPulledAt: Record<table, timestamp> }`.
Settings sync across devices like any other record, except device-local fields (`lastPulledAt`, auth session) which stay local.

### 3.13 Unit rule (global)
All weights persist in kg with full precision. Conversion to lb happens only at the display/input boundary. Changing the unit toggle never mutates stored data.

### 3.14 `syncState` (local-only, never replicated)
Outbox for the sync engine: `table`, `recordId`, `dirtyAt`. A row exists while a record has un-pushed local changes; cleared on successful push.

---

## 4. Tech stack (LOCKED — do not substitute)

| Choice | Rationale (one line) |
|---|---|
| React + TypeScript | Typed component UI; the agent workflow and shadcn/ui assume it. |
| Vite + `vite-plugin-pwa` | Fast builds; generates service worker, manifest, offline precache. |
| Dexie.js | Ergonomic IndexedDB wrapper; source of truth, offline-first. |
| Zustand | Minimal global state for the live-workout session and timers. |
| React Router | Client-side routing for the PWA's pages. |
| Tailwind CSS + shadcn/ui | Fast, consistent styling with accessible prebuilt components. |
| Recharts | All charts (progress, volume, trends). |
| `html-to-image` | Client-side PNG generation for the share card. |
| date-fns | Date math incl. configurable week-start bucketing. |
| `free-exercise-db` JSON + images | ~800 public-domain exercises bundled statically; zero API. |
| Supabase (Postgres + Auth + Storage) | v1 cloud sync & off-device backup; last-write-wins per record; RLS single-user. |

---

## 5. Feature requirements by module

Conventions: "MUST" requirements are v1 acceptance criteria. Each requirement is testable in isolation. IDs are stable — do not renumber when editing.

### 5.1 Exercise Library (LIB)

- **LIB-1** — The app bundles `free-exercise-db` (~800 exercises) as static JSON + images; the full library browses and searches with the network disabled. *Accept: airplane-mode fresh launch of installed PWA shows full library with images.*
- **LIB-2** — Library list supports text search on exercise name (case-insensitive, substring), returning results in <100 ms for the bundled set. *Accept: typing "curl" filters list live.*
- **LIB-3** — Library supports filters: primary muscle group, category, and equipment tag; filters combine (AND) and combine with search. *Accept: filter Chest + Barbell shows only matching exercises.*
- **LIB-4** — Equipment is a **display-only tag** used for search/filter. There is no equipment entity, no CRUD, no gym profiles, no plate math anywhere in the app. *Accept: code search finds no equipment mutation path.*
- **LIB-5** — Exercise detail page shows: name, primary muscles, secondary muscles, category/mechanic, instructions/cues, and demo images. *Accept: open any bundled exercise; all populated fields render.*
- **LIB-6** — Custom exercises: create, edit, delete with fields name (required), primary muscles (≥1 required), optional secondary muscles, optional equipment tag, mechanic (compound/isolation), optional notes; category defaults to `strength`. Custom exercises appear in the library alongside bundled ones and are selectable everywhere an exercise can be chosen. *Accept: create "SSB Squat", find it via search, add it to a program, log it.*
- **LIB-7** — Deleting a custom exercise soft-deletes it; historical sets logged against it remain intact and its history stays viewable from those workouts. *Accept: delete a logged custom exercise; past workout still renders it.*
- **LIB-8** — Favorites: any exercise (bundled or custom) can be toggled favorite; a Favorites filter/section surfaces them first in pickers. *Accept: favorite an exercise; it appears in the Favorites group of the program-builder picker.*
- **LIB-9** — Per-exercise history: from the exercise detail page, view every past logged set for that exercise, grouped by workout, newest first. *Accept: log sets across two workouts; history shows both sessions.*
- **LIB-10** — Smart defaults: when logging an exercise, weight/reps fields pre-fill from the most recent logged working set of that exercise (per `exerciseMeta.lastUsed`). *Accept: log 100×8; next session the first set pre-fills 100×8.*

### 5.2 Program Builder (PROG)

- **PROG-1** — A program is an **ordered list of days that repeats when finished** (Day 1 → … → Day N → Day 1). Nothing in the program model or UI references calendar weekdays. Any cycle length ≥1 is allowed. *Accept: create an 8-day program; after logging Day 8's workout, "today's workout" is Day 1.*
- **PROG-2** — Rest days are entries in the sequence: a day can be flagged `isRestDay`; rest days contain no exercises and advance the rotation when acknowledged/skipped past. *Accept: sequence Push→Rest→Pull; after Push, the app shows Rest as today; advancing shows Pull.*
- **PROG-3** — Create/edit a program with name, optional notes, and any number of days; each day has a name, optional notes, and an ordered exercise list. *Accept: build PPL with per-day names and notes.*
- **PROG-4** — Per-exercise configuration in the builder: working **sets** (int ≥1), **rep min** and **rep max** (two fields, min ≤ max), **RIR target** (default 0), **rest time** (optional; falls back to global 3:00), **warm-up set count** (optional; falls back to global default), **notes**. *Accept: all seven fields save and round-trip.*
- **PROG-5** — Reorder exercises within a day and reorder days within a program via drag-and-drop (with an accessible fallback, e.g. up/down buttons). *Accept: drag Day 3 to position 1; order persists after reload.*
- **PROG-6** — Cycles are a **completed-rotation counter**, not periodization: one cycle = one full pass through all days; the count increments when the last day of a pass finishes. **No per-cycle target overrides** — an exercise's targets are identical every cycle. A program sets a **target cycle count** (planned number of cycles); reaching it shows a completion state. **Naming:** a program of exactly 7 days labels this "Weeks"; any other length labels it "Cycles". *Accept: finish the last day of a pass → cycle counter increments; next pass shows the same targets; hitting the target count shows completion.*
- **PROG-7** — *(Removed — out of scope.)* Deload cycles no longer exist; with no per-cycle target variation there is no deload concept. (ID retained to keep PROG numbering stable.)
- **PROG-8** — Duplicate a whole program or a single day (deep copy with new IDs, name suffixed "copy"). *Accept: duplicate a day; editing the copy leaves the original unchanged.*
- **PROG-9** — Programs support save, edit, archive, unarchive, delete (soft). Archived programs are hidden from active pickers but visible under an Archived section. *Accept: archive a program; it leaves the main list and can be restored.*
- **PROG-10** — Exactly zero or one program is **active** at a time; activating one deactivates the previous. The active program's current rotation day pre-loads as "today's workout" on the home screen. *Accept: activate program B while A is active; A deactivates; home shows B's current day.*
- **PROG-11** — The rotation pointer (`currentDayIndex`) advances when a workout for that day is finished (or a rest day is acknowledged), and can also be manually set ("jump to day"). *Accept: finish Day 2's workout; pointer moves to Day 3; manually jump back to Day 1.*

### 5.3 Workout Logging — core loop (LOG)

- **LOG-1** — Start a workout from: (a) the active program's current day (one tap from home), or (b) any day of any saved program. There is no blank/ad-hoc path — every workout originates from a program day. *Accept: both entry points create an in-progress workout.*
- **LOG-2** — Per-set logging fields: weight, reps, **RIR on a 0–6+ scale defaulting to 0** ("6+" is a distinct selectable value). *Accept: log a set with RIR 6+; it round-trips.*
- **LOG-3** — Partial reps: a set can record an integer count of partial reps in addition to full reps; displayed as e.g. "8 + 2 partials". *Accept: log 8 reps + 2 partials; summary and history show both.*
- **LOG-4** — Unilateral logging: a set can be toggled to left/right mode capturing separate left and right weight and reps. *Accept: log L 20×12 / R 20×10; both persist and display.*
- **LOG-5** — Program-day workouts pre-populate exercises with their target sets, showing rep range and RIR target per set; targets are a snapshot taken at workout start. *Accept: edit the program mid-workout; the in-progress workout's targets don't change.*
- **LOG-6** — For analytics, a unilateral set counts as **one set**; its "weight" for records/charts is the max of left/right weight and its "reps" the corresponding side's reps. *Accept: L 20×12 / R 22×10 contributes 22×10.*
- **LOG-7** — Add or remove sets on the fly for any exercise mid-workout. *Accept: planned 3 sets; add a 4th and delete the 2nd.*
- **LOG-8** — Each set has a complete check-off; checking a set stamps `completedAt` and triggers the rest timer (TIM-1). Any logged set (checked or not) is editable in place. *Accept: check a set, then edit its reps; edit persists.*
- **LOG-9** — Per-exercise notes and per-workout notes are editable during the workout and saved with it. *Accept: both note types round-trip to history.*
- **LOG-10** — Swap an exercise mid-workout for another (via the library picker), choosing **keep targets** or **reset targets**; the original is recorded as `swappedFrom`. *Accept: swap bench→DB press keeping targets; sets retain rep range; history notes the swap.*
- **LOG-11** — Add an unplanned exercise mid-workout to any position. *Accept: append cable curls to a program-day workout; they save with the workout.*
- **LOG-12** — Finish shows a **workout summary**: total working sets, total volume (Σ weight×reps of working sets, in current unit), duration (start→finish), and any records hit (per REC computation) this session. *Accept: finish a PR workout; summary lists the new record.*
- **LOG-13** — Edit any past/finished workout: add/remove/edit exercises, sets, and notes; analytics recompute accordingly. *Accept: fix a typo'd 1000 kg set; records update.*
- **LOG-14** — In-progress workout survives app kill/reload (persisted continuously to Dexie) and can be **resumed** or **discarded**. Only one workout may be in progress at a time. *Accept: force-close mid-workout; reopen; banner offers resume/discard.*
- **LOG-15** — Units toggle (kg/lb) converts all displayed weights app-wide; stored values are unaffected (see 3.13). *Accept: toggle to lb; 100 kg set shows 220.5 lb; toggle back shows 100 kg exactly.*
- **LOG-16** — Supersets, drop sets, myoreps, and failure sets do not exist: no UI, no data fields, no set types beyond `warmup`/`working`. *Accept: code/type search confirms absence.*

### 5.4 Rest Timer (TIM)

- **TIM-1** — Timer auto-starts when a set is checked complete, using the exercise's configured rest (programExercise.restSeconds) or the global default 3:00. *Accept: check a set on an exercise with 2:00 rest; timer starts at 2:00.*
- **TIM-2** — When the timer ends, a notification fires that works with the screen off in the installed PWA (Notification API; permission requested at first timer use; graceful in-app fallback if denied). *Accept: lock phone; notification arrives at 0:00.*
- **TIM-3** — Timer controls: skip, +time increments (e.g. +30 s), and free adjust; a visible countdown persists across in-app navigation. *Accept: add 30 s twice; countdown reflects it on another screen.*
- **TIM-4** — Timer end-time is computed from a stored wall-clock timestamp (not a running interval), so backgrounding/reloading keeps it accurate. *Accept: reload mid-countdown; remaining time is correct.*

### 5.5 Smart Warm-ups (WARM)

- **WARM-1** — Warm-up set count resolves in priority order: (1) per-exercise value from the Program Builder, (2) global default in Settings, (3) inline override during logging (always available). *Accept: all three sources drive the generated count.*
- **WARM-2** — Given the first working-set weight W and count N, warm-up weights are generated per the ramp algorithm in §6.1, displayed as suggested warm-up sets above the working sets. *Accept: W=100, N=3 → 50/70/85.*
- **WARM-3** — Warm-up sets are logged with `type: 'warmup'`, are check-off-able, and are **excluded** from volume analytics, records, and progress charts. *Accept: a heavy typo'd warm-up never appears in records.*
- **WARM-4** — Suggested warm-up weights are editable before/while logging; regeneration occurs if the first working weight changes before any warm-up is checked. *Accept: change W 100→110 pre-logging; suggestions update.*
- **WARM-5** — No equipment/plate math is involved; rounding is to the nearest 2.5 (current display unit). *Accept: no plate UI exists; values end in .0/.5.*

### 5.6 Analytics & Insights (ANA / REC)

Global rule — **ANA-0 (amended — scoped E1RM exception)**: **E1RM (estimated 1-rep max) is the single permitted derived metric.** It is read-only and computed by the **Epley formula** `weight × (1 + reps/30)` from actual logged **working** sets of **≤ 12 reps only** (above 12 reps the estimate is unreliable and is not computed). No **other** derived max (3RM/10RM or any non-Epley formula) may appear anywhere. **Records (REC-1) and the rep-max grid (REC-2) remain actual-sets-only** — E1RM never feeds them. All other analytics values remain traceable to a logged set. *Accept: the only derived-max code is a single documented Epley E1RM feeding the ANA-9 trend + its in-workout readout; a search finds no Brzycki/other formulas, and records/rep-max grid contain no derived value.* (Originally a blanket ban; scoped open deliberately when E1RM gained a use — plateau detection via consecutive-session E1RM decline.)

- **REC-1** — Records tracker per exercise, from actual working sets only: (a) heaviest weight ever lifted, (b) best set by weight×reps product. Each record links to its source workout. *Accept: values match hand-computed maxima; tapping opens the workout.*
- **REC-2** — **Rep-max grid capped at 1–12:** for each rep count r = 1…12, show the best actual weight ever lifted for at least r reps, per the derivation in §6.2 (real sets only, nothing estimated). Rows with no qualifying set show "—". Sets of >12 reps qualify only for rows 1–12. *Accept: grid matches §6.2 hand-computation on fixture data.*
- **REC-3** — New records are detected at workout finish (comparing against pre-workout bests) and surfaced in the summary (LOG-12) and share card (SHARE-5). *Accept: beat a 5RM; summary says so; grid updates.*
- **ANA-1** — Volume tracker: **working sets per muscle group** (primary muscle of each exercise; secondary muscles excluded from v1 counts), shown as (a) weekly totals bucketed by the week-start setting, and (b) average per week over a selectable window of 4/8/12 weeks. *Accept: totals match hand-count on fixture data; window switch recomputes.*
- **ANA-2** — Volume tracker also offers a **rolling-average view (last N days, N selectable, default 7)** independent of calendar weeks, suited to async programs. *Accept: N=10 shows sets/10-day-window trend line.*
- **ANA-3** — Muscle-group body-map: heat-style front/back body diagram coloring each muscle group by working-set volume in the selected window ("Levels"-style). *Accept: legs-only fixture data colors only leg regions.*
- **ANA-4** — Workout history list: reverse-chronological, searchable by text and filterable by program; each entry opens the full logged workout (read + edit per LOG-13). This view is high priority — first-class navigation item. *Accept: filter by program shows only its workouts.*
- **ANA-5** — Consistency calendar: GitHub-style heatmap of workout days across the year, plus a weekly-frequency stat (workouts per week, honoring week-start setting). *Accept: heatmap cells match workout dates; frequency matches hand-count.*
- **ANA-6** — Per-exercise progress chart, default view: **top working set per session** as **two stacked small-multiple line panels sharing one time axis** — weight (top panel) and that set's reps (bottom panel) over time. (Amended from "dual-axis": the mandatory `dataviz` design gate forbids two y-scales on one chart; dual-panel keeps both metrics with honest, independent scales.) Top set = highest weight; ties broken by higher reps. *Accept: fixture with weight↑/reps↓ renders both trends legibly in separate panels.*
- **ANA-7** — Progress chart toggle: top set / all sets (scatter or multi-line) / per-session volume (Σ weight×reps for that exercise) / **E1RM trend** (ANA-9). Estimated max is limited to the E1RM mode per the ANA-0 exception; no other derived max. *Accept: all four modes render from the same data.*
- **ANA-8** — Dashboard with customizable widgets: user picks and orders which analytics surface (records, volume, body-map, consistency, recent history, a chosen exercise's progress chart, bodyweight trend). Default layout: today's workout card, consistency calendar, weekly volume, recent records. *Accept: widget add/remove/reorder persists across reloads.*
- **ANA-9** — **E1RM (estimated 1RM) tracking**, per the ANA-0 exception (Epley, working sets ≤ 12 reps, read-only). A session's E1RM = the highest Epley value among that session's qualifying ≤12-rep working sets for the exercise. Two surfaces: **(a) analytics** — an **E1RM trend line** as a mode of the per-exercise progress chart (ANA-6/7), for spotting plateau (consecutive-session E1RM decline signals switching to a movement-pattern variation); **(b) in-workout** — a small read-only E1RM on the focused exercise showing **today's best-set E1RM vs the previous session's**, as a live push/plateau cue. Never feeds records or the rep-max grid (ANA-0). *Accept: log 100×5, then 100×6 next session → session E1RM rises and the trend reflects it; a 100×15 set contributes no E1RM.*

### 5.7 Shareable Workout Card (SHARE)

- **SHARE-1** — After finishing a workout (and from any past workout), generate a shareable **PNG** entirely client-side via `html-to-image`; no network involved. *Accept: airplane mode; PNG generates.*
- **SHARE-2** — Two templates: (a) clean **stats card**, (b) **photo background** — user picks a photo from their device and stats overlay it with a semi-transparent scrim. *Accept: both templates produce correct PNGs.*
- **SHARE-3** — Card contents, individually toggleable: workout name/type, date, duration, total sets, total volume, exercise count, records hit that session, muscle groups trained, small Ledger watermark. Toggle state persists. *Accept: disable volume; regenerated PNG omits it; next card remembers.*
- **SHARE-4** — On supporting mobile browsers, share via **Web Share API** (files) to Instagram Stories etc.; fallback is PNG download. *Accept: share sheet opens on Android/iOS PWA; desktop downloads.*
- **SHARE-5** — Records hit in the session (REC-3) render as a highlighted line on the card when enabled. *Accept: PR session card shows the record.*

### 5.8 Body Metrics & Progress Photos (BODY)

- **BODY-1** — Log bodyweight entries (value + datetime, editable/deletable); line chart over time with range selector. *Accept: entries chart correctly; edits reflect.*
- **BODY-2** — Custom measurements: user-defined names (waist, arms, chest, …); log values over time; per-measurement trend chart. *Accept: create "waist", log 3 entries, view its chart.*
- **BODY-3** — Progress photos: capture/upload, tagged front/side/back, date-stamped, stored as Blobs in IndexedDB, browsable in a date-sorted gallery, deletable. *Accept: photos persist offline across reloads.*
- **BODY-4** — Photo comparison view: pick any two photos (any poses/dates) side-by-side with dates shown. *Accept: compare Jan-front vs Jun-front.*

### 5.9 Data, Settings & Platform (DATA / SET)

- **DATA-1** — `navigator.storage.persist()` requested on first launch; result surfaced in Settings ("storage: persisted / best-effort"). *Accept: Settings shows the status.*
- **DATA-2** — PWA installability: valid manifest + service worker; installed app launches fullscreen/standalone and works fully offline from first post-install launch. *Accept: Lighthouse PWA installable check passes; airplane-mode launch works.*
- **DATA-3** — **Off-device backup = Supabase sync** (§5.10). The folder-based auto-backup originally planned is dropped: Android Chrome (Ji's primary device) does not support the File System Access API, and Ji's OneDrive is not syncing on his devices. Manual JSON export (DATA-4) remains the sync-independent safety net. *Accept: no File System Access API code exists; backup story = SYNC-* + DATA-4.*
- **DATA-4** — Manual export any time: full backup as **JSON** (complete, restorable) and **CSV** (workouts/sets flat table, for analysis). *Accept: both files download with correct contents.*
- **DATA-5** — Import/restore from a Ledger JSON backup, with a preview (record counts, export date) and explicit confirm; restore replaces current data atomically (all-or-nothing). *Accept: export → wipe → import reproduces identical state.*
- **DATA-6** — Backup reminder: if the last successful sync **and** the last manual export are both >7 days old, show a non-blocking banner. *Accept: banner appears on stale fixture; clears after a sync or an export.*
- **SET-1** — Settings screen exposes exactly: default RIR (0), default rest (3:00), default warm-up set count (2), units kg/lb, theme light/dark/system, analytics week-start Mon/Sun, sync (account, status, last synced, Sync now, auto-sync toggle), manual export/import, storage-persistence status, erase-all-data (double-confirm). *Accept: each setting persists and takes effect.*
- **SET-2** — Week-start setting affects **only** analytics bucketing (volume weekly view, consistency weekly frequency). It has no effect on programs, rotation, or logging. *Accept: toggling Mon↔Sun changes chart buckets; program day order unchanged.*

### 5.10 Cloud Sync (SYNC) — v1, built as M7

Architecture per §2.3. Sync must be invisible when offline: every prior requirement passes with the network permanently disabled.

- **SYNC-1** — One-time login per device (Supabase Auth, email + password); session persists across restarts. The app is fully usable before/without login — sync features simply stay off. *Accept: fresh install works logged-out; login enables sync without data loss.*
- **SYNC-2** — Supabase Postgres tables mirror the Dexie schema (§3.2–3.12), keyed by client UUID, with RLS restricting all rows to Ji's user id. *Accept: anon/other-user requests are rejected; authed requests round-trip.*
- **SYNC-3** — Push: every local write marks the record dirty (§3.14); the engine upserts dirty records when online and clears them on success. Failures retry with backoff; the outbox survives app restarts. *Accept: log a workout in airplane mode; on reconnect it appears in Supabase unprompted.*
- **SYNC-4** — Pull: per table, fetch records with `updated_at > lastPulledAt` and apply locally; `lastPulledAt` advances only on success. *Accept: edit on device A; device B shows it after its next sync.*
- **SYNC-5** — Conflicts resolve last-write-wins per record by `updatedAt`; no merge UI, no user prompt. *Accept: edit the same workout offline on both devices; the later edit wins everywhere after both sync.*
- **SYNC-6** — Soft deletes replicate as updates, so deletions propagate across devices; `syncState` itself never replicates. *Accept: delete a program on A; it disappears from B after sync.*
- **SYNC-7** — Progress photo blobs upload to Supabase Storage (path = photo id); rows carry the path; blobs download lazily on other devices. *Accept: photo taken on phone becomes viewable on laptop.*
- **SYNC-8** — Sync triggers: app start, `online` event, workout finish, manual "Sync now". Sync never blocks the UI or delays set logging. *Accept: set check-off latency is identical with sync mid-flight.*
- **SYNC-9** — Settings show sync status (last synced, pending-change count, errors) and a Sync now button. *Accept: airplane mode shows pending count >0; reconnect drains it to 0.*
- **SYNC-10** — Two environments: `ledger-test` (all development + the pre-launch testing months) and `ledger-prod`, selected by build-time env var; test builds show a visible "TEST" badge. A documented path exists to start prod clean or seed it from a JSON export (DATA-5). *Accept: badge in test build; env swap requires no code change.*

---

## 6. Key algorithms

### 6.1 Warm-up ramp generation
Input: first working-set weight `W` (display unit), warm-up count `N ≥ 1`.
Percentages by N (of W):
- N=1 → [60%]
- N=2 → [50%, 75%]
- N=3 → [50%, 70%, 85%]
- N=4 → [40%, 55%, 70%, 85%]
- N≥5 → linear interpolation from 40% to 85% inclusive across N steps.

Each weight = `round(W × pct / 2.5) × 2.5` (nearest 2.5 in the current display unit). Suggested reps are informational and fixed per position (e.g. 10/8/5/3 pattern, last warm-up lowest); implementer may tune copy. No equipment math.

### 6.2 Rep-max grid (1–12) from real sets
For exercise E and each rep count `r` in 1..12:
`grid[r] = max(weight of any working set s of E where s.reps ≥ r)`, considering unilateral sets per LOG-6, excluding warm-ups and soft-deleted data.
Consequences (intentional): the grid is monotonically non-increasing as r grows; a 100×8 set fills rows 1–8 at ≥100. Rows with no qualifying set render "—". Each cell links to its source set's workout.

### 6.3 Volume aggregation
A **working set** = `type == 'working'` (checked or edited-in on finished workouts) in a finished workout. Each working set credits **1 set** to the exercise's **primary muscle group(s)** (if the dataset lists multiple primaries, credit each; do not credit secondaries in v1).
- **Weekly view:** bucket by ISO week adjusted to the week-start setting (date-fns `startOfWeek(weekStartsOn)`), using the workout's `startedAt`.
- **Weekly average:** total sets in window (last 4/8/12 weeks) ÷ number of weeks.
- **Rolling view:** for each day d, sum sets in `[d − N + 1, d]`; plot the series (N user-selectable, default 7).

### 6.4 Records computation
Maintain per-exercise bests derived on read (or cached and invalidated on any set write to that exercise): heaviest weight; best weight×reps product; rep-max grid (§6.2). "New record" at finish = any best strictly exceeded by this workout's sets vs. bests computed **excluding** this workout. Editing past workouts (LOG-13) invalidates caches.

---

## 7. Milestones / build order

Sequential phases for the coding agent; each phase must build, pass its tests, and be usable before the next starts.

1. **M1 — Foundation & Library:** project scaffold (Vite/TS/Tailwind/shadcn/Router/Zustand), Dexie schema + repository layer (§3), bundled exercise data, Library module (LIB-1…10), Settings skeleton (SET-1 fields, no backup yet).
2. **M2 — Program Builder:** PROG-1…11; save/activate programs, rotation model + advancement. Pulled ahead of the logging loop: with no ad-hoc path, a workout can only start from a program day, so the builder must exist first.
3. **M3 — Logging core loop:** program-driven workouts end-to-end (LOG-1a/b, LOG-5, LOG-2…16 incl. swap), rest timer (TIM-1…4), warm-ups (WARM-1…5), workout summary (records stubbed).
4. **M4 — Analytics:** REC-1…3 + ANA-0…8, incl. history list, dashboard, body-map. Body metrics & photos (BODY-1…4).
5. **M5 — Sharing:** SHARE-1…5.
6. **M6 — Data safety & PWA polish:** DATA-1, DATA-2, DATA-4…6, full offline audit, notification polish (Android Chrome first), theme, install UX, erase-data.
7. **M7 — Supabase sync:** SYNC-1…10 against `ledger-test`, behind the repository layer. The app must be fully shippable at end of M6; M7 adds replication only. Extended real-world testing happens on `ledger-test` during the months before Ji adopts the app; prod cutover per SYNC-10.
