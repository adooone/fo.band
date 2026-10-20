# fo.band

Monorepo for the site of «Лісовий Оркестр» (Forest Orchestra), a virtual band: a React
site with a hand-drawn, calm motion design, a Bun API stub, and shared types.

## Apps

| App | Package | Port | Description |
|-----|---------|------|-------------|
| `apps/web` | `@fo/web` | 3300 | React 19 + Vite 8 site, Tailwind 4 |
| `apps/core` | `@fo/core` | 3301 | Bun + Hono API (health check for now) |
| `packages/types` | `@fo/types` | — | Types shared by web and core |

## Stack

- **Frontend** — React 19, Vite 8, TanStack Router, Tailwind CSS 4, simplex-noise
- **Backend** — Bun 1.4, Hono 4, Zod 4
- **Monorepo** — pnpm 12 workspaces, Turborepo 2
- **Tooling** — TypeScript 7, Biome 2 (lint + format), Vitest 5 / `bun test`, Husky + Commitlint
- **Project memory** — [Paper Camp](https://github.com/adooone/paper-camp) (`papercamp/`)

Node 24 is pinned through Volta (`volta.node`), Bun and pnpm through `package.json`
(`devDependencies.bun`, `packageManager`).

## The home page

«Річні кільця»: the screen is a dark-green cross-section of a trunk. Off-white growth
rings, spaced unevenly with a few tight years, are drawn as ink bands displaced by
slow travelling simplex noise (tiny amplitude, long wavelength). The outermost ring is
the bark: inside it the ground is a shade lighter, outside stays ink to the screen
edges. A soft wind wave crosses the picture every ten seconds, the name in the heart
breathes slowly, the pith beats at sixty a minute. Hovering lights the nearest ring;
the corner links light their section's ring. On portrait phones the trunk is fitted to
the width and the navigation is a strip at the bottom.

Everything animated shares one `requestAnimationFrame` loop (`src/lib/ticker.ts`) and a
clock clamped per frame, so a background tab or a long sleep never makes it race.

### Typography

KyivType Serif and Sans by Dmytro Rastvortsev, self-hosted from `apps/web/public/fonts`
(the same files the radio apps and sbjectv use). KyivType is distributed free of charge
for personal and commercial use; keep the family name and author credit if the fonts
are redistributed.

## Getting started

```bash
pnpm install

# Run everything in parallel
pnpm dev

# Or one app at a time
pnpm web:dev    # site on http://localhost:3300
pnpm core:dev   # API  on http://localhost:3301
```

Copy `apps/web/.env.example` and `apps/core/.env.example` to `.env` in the same folders
if you need to change ports or origins.

### Other commands

```bash
pnpm check-types   # TypeScript across all workspaces
pnpm lint          # Biome lint across all workspaces
pnpm lint:write    # Biome lint with auto-fix
pnpm format        # Biome format the whole repo
pnpm test          # Vitest (web) + bun test (core)
pnpm build         # Production build (web)
pnpm verify        # check-types + lint + test + build, same as CI

pnpm camp          # Paper Camp dashboard for this project
```

## Structure

```
fo.band/
├── apps/
│   ├── web/                    # React site
│   │   └── src/
│   │       ├── features/       # home/ (the living frame), nav/, sections/
│   │       ├── routes/         # TanStack Router route definitions
│   │       ├── lib/            # ticker (shared loop + clock), API client
│   │       ├── styles/         # Tailwind entry + theme tokens
│   │       └── tests/          # Vitest setup
│   └── core/                   # Bun + Hono API
│       └── src/
│           ├── routes/         # Hono sub-apps (health)
│           ├── app.ts          # App factory (used by tests)
│           ├── env.ts          # Zod-validated environment
│           └── index.ts        # Bun entry point
├── packages/
│   └── types/                  # @fo/types — shared TS types
├── papercamp/                  # Paper Camp corpus: ideas, plans, config
├── .github/workflows/ci.yml    # Types, lint, test, build on push and PRs
└── turbo.json, biome.json, tsconfig.base.json, pnpm-workspace.yaml
```

## Conventions

- Files are `kebab-case`; components are named arrow-function exports.
- Features live under `src/features/<name>/` with a barrel `index.ts`.
- Conventional commits (`feat:`, `fix:`, `chore:` …) with lowercase subjects — enforced
  by Commitlint on commit.
- The pre-commit hook runs `pnpm check-types` and `pnpm lint`.

## Deployment

`apps/web` deploys to Vercel as a static Vite app from the `fo-band` project on the
Adoo team (`croco-dendy-projects`), linked to this GitHub repo with root directory
`apps/web`:

- Production: https://fo-band.vercel.app (every push to `main`); no custom domain yet.
  `fo-band-croco-dendy-projects.vercel.app` is the team alias for the same deployment.
- Every other branch and PR gets its own `fo-band-git-<branch>-…vercel.app` URL
  (behind Vercel login).

`apps/web/vercel.json` rewrites all routes to `/` for client-side routing. Set `VITE_API_URL`
in the Vercel project (Settings → Environment Variables) once the API has a public URL.
`apps/core` runs anywhere Bun runs (`pnpm --filter @fo/core start`).
