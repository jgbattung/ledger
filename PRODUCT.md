# Product

## Register

product

## Users

Exactly one user: Ji. Primary context is mid-workout in a gym - phone in one hand, possibly
sweaty, between sets, in variable lighting (often dim; dark mode is first-class). Device is a
Samsung Galaxy S23 Ultra running the installed PWA in Chrome, frequently with no network.
Secondary context is desktop Chrome for review and planning. The job to be done: log sets fast,
follow a program, and see real progress built from actual logged performance.

## Product Purpose

Ledger is a personal, single-user, local-first workout tracker - a self-owned clone of
MacroFactor Workouts stripped to the features Ji actually uses. IndexedDB is the source of
truth; the app works fully offline forever, with Supabase sync added last as invisible
background replication. Success = logging a set is never slower than pen and paper, and
analytics reflect only real logged sets (never estimated 1RM).

## Brand Personality

Restrained, fast, utilitarian. The tool disappears into the task. Confidence comes from
precision (tabular numbers, exact spacing, instant response), not decoration. Emotional goal:
calm competence - the app never demands attention it hasn't earned.

## Anti-references

- Neon fitness-app defaults (electric green/red on black, aggressive gradients, "beast mode"
  energy). Ledger's brand anchor is a deliberate cobalt/indigo.
- Social-fitness gamification (streak confetti, badges, share prompts mid-workout).
- Dashboard-first SaaS chrome: hero metric cards, decorative charts, dense stat tiles as
  wallpaper.
- Desktop-first affordances on mobile: dropdown selects, hover-dependent controls, small
  click targets.

## Design Principles

1. **Never make logging slower to make it prettier.** Speed of the core loop beats every
   aesthetic consideration.
2. **One-handed by default.** Primary actions live in thumb reach (bottom nav, bottom sheets);
   touch targets >=44px, primary log actions >=56px.
3. **Offline is the normal state.** No network-dependent UI states in core flows; no spinners
   waiting on a connection that isn't coming.
4. **One design system, no one-off styles.** Every screen consumes the tokens in
   `.gsd/design-system.md` / `src/index.css`; extend the system deliberately or not at all.
5. **Earned familiarity.** Standard affordances, consistent component vocabulary across
   screens; delight is saved for moments (a PR toast), never pages.

## Accessibility & Inclusion

- Contrast enforced: body text >=4.5:1, large/bold text >=3:1, placeholders >=4.5:1 - verified
  per pairing in both themes (see design-system.md for the audit trail).
- Light/dark/system themes required; every component verified in both.
- `prefers-reduced-motion` honored on every animation (crossfade or instant fallback).
- Full keyboard operability and correct ARIA roles on custom controls (radiogroup segmented
  controls, dialog sheets), even though the primary input is touch.
