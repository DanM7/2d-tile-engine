# 2d-tile-engine

Grid arcade engine for MS-style tile games: level runtime, run state, input, and tile-id utilities.

## Layout

| Path | Role |
|------|------|
| `engine/` | Core types, `levelRuntime`, `RunSession`, loaders, Phaser `GameEngine` |
| `tile-engine/` | MS object codes → spritesheet frame mapping |
| `engine/levelLayers.ts` | Compact layer JSON (`emptyPrefix` + `tiles`); expanded in `loadLevel()` |

**Schema owner:** `LevelData`, tile ids, and collectible helpers are defined here. **cc1-asset-extraction-pipeline** depends on this package and writes JSON into **chips-challenge-web** — it does not store game levels in the pipeline repo.
| `runtime/` | Reserved for shared bootstrap helpers (game shells live in web repo) |

## Setup

```bash
npm install
npm test
npm run build
```

## Related repos

- **[cc1-asset-extraction-pipeline](https://github.com/danm7/cc1-asset-extraction-pipeline)** — DAT/EXE → level JSON
- **[chips-challenge-web](https://github.com/danm7/chips-challenge-web)** — Phaser client (`file:../2d-tile-engine`)
  - MS gameplay checklist: `chips-challenge-web/docs/ms-cc1-rules.md`

## Remote

```bash
git remote -v
# origin → https://github.com/danm7/2d-tile-engine
```
