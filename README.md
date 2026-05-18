# 2d-tile-engine

Grid arcade engine for MS-style tile games: level runtime, run state, input, and tile-id utilities.

## Layout

| Path | Role |
|------|------|
| `engine/` | Core types, `levelRuntime`, `RunSession`, loaders, Phaser `GameEngine` |
| `tile-engine/` | MS object codes → spritesheet frame mapping |
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

## Remote

```bash
git remote -v
# origin → https://github.com/danm7/2d-tile-engine
```
