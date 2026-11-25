# ingress-events-core

Core TypeScript library and visual/event assets for Ingress Events (`@ingress-shards/ingress-events-core`).

## Stack & Commands
- **Stack:** TypeScript + Yarn 4 (`corepack yarn`). **Never** use `npm`.
- **Validate:** `yarn validate` (clean, generate schemas/geocodes, typecheck, lint, test, build).
- **Build & local sibling sync:** `yarn build` compiles `dist/` and automatically runs `scripts/sync-to-siblings.js` into local consumer `node_modules`.

## Repo Conventions
- **Typing:** Strict TypeScript; avoid `any`.
- **Dates & time:** Use `temporal-polyfill/fns` functional imports (tree-shakeable); avoid native `Date`.
- **Naming:** `kebab-case` folders, `PascalCase` source files under `src/`, `index.ts` for barrels.
- **Releases:** `semantic-release` on `main` publishes to GitHub Packages; keep `package.json` version at `0.0.0-semantically-released`.
- **Dependencies:** Never use Yarn `portal:` or local link protocols; publish and consume via strict SemVer.
- **Shared AI Kit (optional):** Organization-wide rules, skills, and command guardrails live in `https://github.com/ingress-shards/ingress-events-ai-kit` (see its README for Antigravity and Claude Code setup).
