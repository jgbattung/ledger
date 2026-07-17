# Exercise curation pipeline (LG-047)

`src/exercises/exercises.json` is **generated** output. Never hand-edit it.

- `seed/free-exercise-db.json` - the pinned raw seed, vendored from
  [`free-exercise-db`](https://github.com/yuhonas/free-exercise-db) (Unlicense),
  pinned commit `b0eed061e1c832b3ed815fbaa4b45b3cdc14df49`. 873 entries.
- `keeps.ts` - every kept seed entry: canonical name, aliases, owned muscle/equipment
  mapping, category, mechanic.
- `drops.ts` - every dropped seed entry: reason code.
- `additions.ts` - net-new entries (AC staples, variant families) not present in the seed.
- `curate.ts` - pure `buildCatalog(seed, decisions)` plus a CLI.

## Usage

```
npm run curate
```

Regenerates `src/exercises/exercises.json` (sorted by name) and `REVIEW.md` in this
directory. To change the catalog: edit the decision files above, then re-run.

See `.gsd/exercise-model.md` for the full schema/taxonomy/curation contract.
