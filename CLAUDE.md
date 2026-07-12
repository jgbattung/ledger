# Ledger - Project Instructions

Single-user, local-first workout PWA. Full spec: `PRD.md` (scope locked). Agent context: `.gsd/project-context.md`. Backlog: `backlog/` (prefix `LG`).

## Design Standards (anti-slop gate - MANDATORY)

These rules apply to every agent (Architect, Builder, QA, Integrator) and every story. They are acceptance criteria, not suggestions - QA fails a story that skips them.

1. **Before creating or modifying ANY UI component, screen, or layout: load the `impeccable` skill first** and apply it to the work. No exceptions for "small" components - buttons, banners, badges, and settings rows count.
2. **Before writing ANY chart, graph, heatmap, or data-visualization code: load the `dataviz` skill first** (this is in addition to `impeccable`). Applies to all Recharts work, the body-map, the consistency calendar, and dashboard stat tiles.
3. **All UI consumes the shared design system** established in LG-001 and documented in `.gsd/design-system.md` (tokens: type scale, spacing, color for light/dark). Never invent one-off styles, ad-hoc hex values, or per-screen spacing. If the system is missing something, extend `.gsd/design-system.md` deliberately - don't work around it.
4. **`taste-skill` is NOT used in this project.** It targets landing pages/portfolios; Ledger has no marketing surface.

Design context for all UI decisions:
- Mobile-first: Samsung Galaxy S23 Ultra, Chrome, installed PWA. Desktop is secondary.
- The core loop is in-gym set logging: one-handed use, big touch targets, speed over flourish. Never make logging slower to make it prettier.
- Light/dark/system themes are required (SET-1); every component must work in both.
- Offline is the normal state - no network-dependent UI states in core flows.

## Other project rules

- Weights persist in kg only; convert at the display boundary (PRD §3.13).
- All Dexie access goes through `src/db/repos/*`; components never touch tables directly.
- No estimated-max analytics (ANA-0), no supersets/drop sets (LOG-16), no equipment entity or plate math (LIB-4).
- App name comes from the single `APP_NAME` constant.
- On `git init`, add `backlog/` and `.gsd/` to `.git/info/exclude`.
