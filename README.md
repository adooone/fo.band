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

A paper sky over an ink forest, and the edge between them is one continuous line, as if
drawn without lifting the pencil. It runs along a wavy ground of hills, highest in the
middle under the band's mark, and at
every tree it climbs the outline, goes over the crown and comes back down: round and
oval crowns on short trunks, soft spruces, none taller than a third of the mark. On load
the page is a blank sheet: a pencil draws the skyline, hills and trees, from left to
right while the land is poured in from below like water into a glass, sloshing side
to side; then the trees grow into the
drawing from the middle outward and the clouds swell, and last, with the text, the far
hills rise. Opened straight into a section, the forest
morphs out of a flat line instead: the hills swell, the line bulges into mounds and
each mound grows into its tree, from the middle outward. Then the f sprouts like a fern
(`sprout.ts`): its outline is bound to its centreline, so it can break ground with a
rounded tip, stretch up with its tip coiled like a fiddlehead, unfurl into the frond of
the mark and put out the crossbar as two leaves, ending exactly on the Figma shape. The
o rises beside it as the sun. The mark lives on the same canvas and its
outline breathes. Trees lean with a drifting wind and gusts, the ground breathes.
Three paths lead out of the forest, on the edges of the screen, with the arrow keys and
with swipes, and every page is the same forest in another pose, never a slide: left to
«Music», where the scene draws in to the forest floor, the trees turn into mushrooms and
a stump grows into a record player (after the back of Jethro Tull's «Songs from the
Wood»: its cut face, with growth rings, is the record); down to «About», where the
forest sinks into the ground, the horizon is drawn up into a thin strip
of sky along the top, the mark riding up on it, small, in the middle; right to «Art», where the forest sinks, the camera
dives into the land until the screen is all ink, and the ink's edge is drawn in from
the right into a tree trunk on the left, leaving a white field for the work. The f is
part of the skyline, so it morphs like a tree: on music it sinks into the ground and
the stump grows up in its place, while the o sinks behind the horizon. The change to
music is marked by a pencil line that traces the skyline once and fades, as if the new picture
were being drawn over the old.

In dev (or with `?tune` in the URL) a swatch under the mark picks the ink
by hand; the pick stays in that browser and its hex shows beside it, ready to become
the default (`INK` and `--color-ink`).

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
