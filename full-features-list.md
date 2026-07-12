# Ledger — Full Feature List

> **Working name:** Ledger (a workout is a ledger of sets). Not final — rename freely.
> **What it is:** A personal, self-owned clone of MacroFactor Workouts (MFWO), stripped to the
> features Ji actually uses. Built as a **local-first Progressive Web App (PWA)**.
> **Status:** Feature list for review. PRD comes *after* this file is confirmed.

---

## 0. Product summary & principles

- **Goal:** Replace the MFWO half of the paid bundle with an app Ji owns and runs himself, keeping only the parts he uses and fixing the analytics that MFWO does poorly.
- **User:** Single user (Ji). No multi-user, no social, no sharing in v1.
- **Design principles:**
  - Fast, frictionless in-gym logging (the core loop must be flawless).
  - Show **actual performance data**, never estimated/derived maxes.
  - No "coaching" — the app records and visualizes; it does not tell you what to lift.
  - Offline-first: works with zero signal.
- **Platform:** PWA — responsive web app that is installable to the home screen, runs fullscreen, works offline, and can fire notifications (rest timer) with the screen off.
- **Data model:** **Local-first.** IndexedDB is the source of truth; the app is fully usable offline. Architected so **cloud sync (last-write-wins per record)** can be added in a later phase without a rewrite. No account required in v1.

---

## 1. Exercise Library

- **Source dataset:** `free-exercise-db` (~800 exercises, public-domain / Unlicense). Bundled as static JSON + images, so it works fully offline with no API.
  - Fields used: name, primary muscles, secondary muscles, category, mechanic, instructions/cues, images.
- **No equipment system.** `equipment` is kept only as a **display-only tag** for search/filter. There is **no equipment entity, no gym profiles, no plate calculator, no equipment CRUD.**
- **Browse & search** the full library.
- **Filter** by muscle group, category, and (optionally) the equipment tag.
- **Exercise detail page:** primary/secondary muscles, instructions/cues, demo images.
- **Custom exercises:** create, edit, delete (name, muscle groups, optional equipment tag, notes).
- **Favorites:** mark exercises for quick access.
- **Per-exercise history:** every past set ever logged for that movement.
- **Smart defaults:** last used weight/reps carry forward when re-logging an exercise.

---

## 2. Program Builder

A program is a reusable, multi-day training plan you log against.

- **Rotating-sequence model (supports asynchronous / non-weekly programs).** A program is an **ordered list of days that repeats when you finish it** — *not* mapped to calendar weekdays. Day 1 → Day 2 → … → Day N, then loops back to Day 1, regardless of what day of the week it is. Any cycle length works (5, 6, 7, 8+ days). **Rest days are entries in the sequence.**
  - Example (8-day async): Push → Pull → Legs → Shoulders&Arms → Rest → Upper → Lower → Rest → (repeat).
- **Create a program** with multiple days/sessions (e.g. Upper/Lower, PPL).
- **Add exercises** to each day.
- **Per-exercise configuration (set in the builder):**
  - **Sets** (number of working sets)
  - **Rep target — Min and Max** (two separate fields, MFWO-style)
  - **RIR target** (default 0)
  - **Rest time** (per-exercise; falls back to global default 3:00 if unset)
  - **Warm-up set count** (per-exercise; falls back to global default if unset)
  - **Notes** (per-exercise)
- **Reorder** exercises and days (drag/drop).
- **Per-week periodization (cycles):** optionally set different targets (sets/reps/RIR) across weeks.
- **Deload weeks:** mark a cycle as a deload.
- **Duplicate** a program or a single day.
- **Templates:** save / edit / archive / delete programs.
- **Active program:** mark one program active so "today's workout" pre-loads.
- **Notes** at the program and day level.

---

## 3. Workout Logging (core loop)

- **Start a workout** from: the active program, a saved template, or a **blank/ad-hoc** session.
- **Per-set logging:** weight, reps, **RIR (0–6+ scale, default 0)**.
- **Partial reps** tracking.
- **Separate left/right weights and reps** (unilateral tracking).
- Add / remove sets on the fly mid-workout.
- Mark set complete (check-off); edit any logged set.
- **Per-exercise notes** and **per-workout notes**.
- **Swap an exercise** mid-workout (keep or reset targets).
- **Add an unplanned exercise** mid-workout.
- **Smart warm-up suggestions** (see §5).
- **Workout summary** on finish: total sets, total volume, duration, any new records hit.
- **Edit a past/finished workout.**
- **Discard / resume** an in-progress workout.
- **Units toggle** (kg / lb).

**Explicitly NOT included** (Ji doesn't use them): supersets, drop sets, myoreps, failure sets.

---

## 4. Rest Timer

- Auto-starts after logging a set.
- **Duration:** global default **3:00**, overridable **per-exercise in the Program Builder**.
- Notification/alert when rest ends — works with the screen off (PWA notification).
- Controls: skip, add time, adjust.

---

## 5. Smart Warm-ups

- **Warm-up set count is configured per-exercise in the Program Builder** (primary location), with:
  - a **global default in Settings** for anything unspecified, and
  - an **inline override during logging** for blank/ad-hoc workouts not tied to a program.
- **Generation logic (simple, no equipment math):** given the first working-set weight and N warm-up sets, ramp as percentages of the working weight (e.g. 3 sets → ~50% / 70% / 85%), rounded to the nearest 2.5. Displays computed warm-up weights; no plate calculator needed.

---

## 6. Analytics & Insights

Deliberately diverges from MFWO — drops the estimated-max stuff Ji finds useless.

- **Records tracker (replaces MFWO's 1RM PR tracker).** Built only from actual logged sets — nothing estimated:
  - Heaviest weight ever lifted (per exercise).
  - Best set by weight × reps (per exercise).
  - **Rep-max grid from real data, capped at 1–12 reps:** the best weight actually hit for each rep count (1 through 12).
- **Volume tracker:** number of **working sets per muscle group**, shown as weekly totals and as an **average per week over a selectable window** (e.g. last 4 / 8 / 12 weeks). Also offers a **rolling-average view (last N days)**, which suits asynchronous programs better than fixed calendar weeks. Sets-per-muscle is the primary metric (tonnage optional, later).
- **Muscle-group body-map:** heat-style body map of volume per muscle group ("Levels"-style).
- **Workout history list:** searchable/browsable by date and program. High priority — Ji's main tool for tracking progression.
- **Consistency calendar:** GitHub-contributions-style **calendar heatmap** of worked-out vs. rest days, plus weekly frequency.
- **Per-exercise progress chart (key deviation):** plots **actual lifted weight and reps over time**, never estimated maxes.
  - Default view: the **top working set per session** as a **dual-axis line chart** — weight on the primary axis, reps on the secondary — so trends like "weight up, reps slightly down" are readable at a glance.
  - Toggle the tracked set: top set / all sets / per-session volume.
- **Dashboard:** customizable widgets — choose which of the above to surface.

**Dropped from MFWO:** estimated 1RM / 3RM / 10RM anywhere, and any progress chart based on derived maxes.

---

## 6.5. Shareable Workout Card (Hevy / Strava style)

- After finishing a workout, generate a **shareable PNG** of the session summary.
- **Two templates:** a clean "stats card" and a "photo background" version where you pick a photo and the stats overlay on top (semi-transparent).
- Fully **client-side** (canvas / `html-to-image`) — no server.
- On mobile, hand off to Instagram Stories / other apps via the **Web Share API**.
- **Card contents (toggleable):** workout name/type, date, duration, total sets, total volume, exercise count, any records hit that session, muscle groups trained, and a small Ledger watermark.

---

## 7. Body Metrics & Progress Photos

- Log **bodyweight** over time (chart).
- **Custom body measurements** (waist, arms, chest, etc.).
- **Progress photos** (front/side/back), date-stamped.
- **Photo comparison** view (side-by-side across dates).
- Trend charts for weight & measurements.

---

## 8. Data, Settings & Platform

- **Local-first storage** (IndexedDB) — full offline use; source of truth.
- **Data safety / backup (no cloud in v1):**
  - Call `navigator.storage.persist()` to reduce browser eviction risk.
  - Install as a PWA (home screen) for durable storage (also avoids iOS Safari's 7-day eviction).
  - **Automatic periodic JSON backup written into this `personal-projects` folder**, which OneDrive syncs to the cloud — free off-device backup with no sync infrastructure.
  - Manual export/restore any time.
- **Data export/import** (JSON/CSV) and manual backup/restore.
- **Architecture ready for phase-2 cloud sync** (last-write-wins).
- **PWA install** — home screen, fullscreen, offline, notifications.
- **Settings:**
  - Default RIR: **0**
  - Default rest: **3:00**
  - Default warm-up set count (global)
  - Units (kg/lb)
  - Theme (light/dark)
  - **Analytics week starts on** (Mon/Sun) — affects *only* how the volume chart and consistency calendar bucket data into weeks. Does **not** affect program structure (programs are async rotating sequences, see §2).
- Backup reminder / manual backup.

---

## 9. Explicitly cut from MFWO

Smart auto-progression, auto program generation, supersets / drop sets / myoreps / failure sets,
plate calculator, gym profiles & equipment management, estimated 1RM/3RM/10RM analytics,
Jeff Nippard program import, spreadsheet import, nutrition integration, wearable / Apple Health sync,
multi-user / social / sharing.

---

## 10. Tech Stack (LOCKED)

- **Language/UI:** React + TypeScript
- **Build/PWA:** Vite + `vite-plugin-pwa` (service worker, offline caching, installable manifest)
- **Local database:** **Dexie.js** (IndexedDB wrapper) — source of truth, offline-first
- **State management:** Zustand
- **Routing:** React Router
- **Styling/components:** Tailwind CSS + shadcn/ui
- **Charts:** Recharts
- **Share-card export:** `html-to-image` (client-side PNG)
- **Dates:** date-fns
- **Exercise data:** `free-exercise-db` JSON + images, bundled as a static asset
- **Phase-2 cloud sync (future, not v1):** Supabase (Postgres + Auth), last-write-wins per record

All free/open-source and local-first friendly.

---

## 11. Decided defaults & minor confirmations

- **Equipment tag:** kept as a **display-only search/filter tag** from `free-exercise-db`. No equipment entity/CRUD.
- **Plate calculator:** dropped (depended on equipment inventory).
- **Estimated 1RM/3RM/10RM:** dropped everywhere.
- Dashboard default widget layout: to be proposed in the PRD.
