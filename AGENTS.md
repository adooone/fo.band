# Agent instructions for fo.band

This file is the source of truth for how AI assistants should work in this repository.
Project memory (ideas, plans, decisions) lives in `papercamp/` — read it at the start of
a session and keep it honest as you work (see `.claude/skills/paper-camp/SKILL.md`).

fo.band is the site of «Лісовий Оркестр», a virtual band. The home page is a calm,
hand-drawn motion piece: a paper sky over an ink forest silhouette, with the band's
mark (an f sprout and an o sun) growing out of the clearing. Talk to the user in Ukrainian.

## Codebase map

- `apps/web/` — React 19 site (Vite 8, Tailwind 4, TanStack Router).
  `src/router.tsx` is the route table; `src/routes/` holds route definitions;
  `src/features/<name>/` holds pages and their components. `home/` is the living
  frame: `forest-renderer.ts` plants the forest and draws it on a canvas as one
  skyline (hilly ground, grass ripple, and every tree's outline spliced into the same
  line, morphing out of mounds), plus the mark with a breathing outline
  (`logo-paths.ts` from Figma with the f's spine, flattened by `path-outline.ts`;
  `sprout.ts` grows the f along its spine), `forest.tsx` wires
  it to the shared loop, `tuner.tsx` is the slider panel (dev or `?tune`) whose values
  live in localStorage and whose defaults are `DEFAULT_OPTIONS` / `DEFAULT_MARK`, `corner-link.tsx` the corner labels, `sky-title.tsx`
  a section's title, `home-shell.tsx` puts them together under every route.
  `nav/` holds the links and the phone's bottom nav. `src/lib/ticker.ts` is the one
  requestAnimationFrame loop and the clamped clock every animation must use.
  `src/styles/index.css` holds the Tailwind theme tokens (`@theme`).
- `apps/core/` — Bun + Hono API, a stub for now (health check). `src/app.ts` builds
  the app so tests can call it without a server; `src/env.ts` validates env.
- `packages/types/` — `@fo/types`, runtime-free types shared by web and core.

## Motion rules

- Two colours: `--color-ink` (forest green) and `--color-paper` (off-white). Blends
  of the two are fine; nothing else, except the pencil line, which is graphite black.
- Calm and smooth: tiny amplitudes, long wavelengths, slow flow. No glitches, no
  snapping, no overshoot: `ease` (smootherstep) everywhere. The one accent at a page
  change is the pencil line: a single stroke that traces the skyline by arc length
  over the morph and fades behind itself, wandering a touch off the contour. Every animation subscribes to `subscribeTick` and reads time from
  `createClock` (clamped per frame), never from `Date.now()` or frame timestamps.
- Wind and the mark's breathing outline come from slow simplex noise over position and time; anything
  that must loop seamlessly is sampled on circles in noise space, and any spin is
  measured against a resting length so the waves never race when a shape changes.
- Respect `prefers-reduced-motion`: the clock freezes and the picture holds still.
- Keep a frame cheap: anything that varies over tens of pixels (hills, wind) is tabled
  once a frame at a coarse pitch and interpolated; the tree and ground outlines carry
  no per-point noise at all (a pencil wobble was tried and dropped: it cost most of the
  frame and read as blur). `forest.tsx` lowers the canvas's pixel density when frames
  run slow and restores it when they run fast; the picture itself never changes.
- Page changes are morphs in place, never slides or camera flights: the skyline is one
  polyline, and every tree has a form per page with the same point count. The f of
  the mark is a tree in that line too (kind `mark`, finer point count): its form on
  the home and about pages is the sprout's outline cut at the ground, written every
  frame; on music it sinks into the ground (a flat form) and the stump grows out of
  the ground beside it as a tree of its own; on finds every tree and the f sink first,
  then the whole skyline flows into a tree (`trunkOutline`): each point goes to the
  place as far along the trunk's outline as it was along the land, so the line lifts
  as one into the trunk on the right and its long branch with twigs and leaves, with
  no loops left to tangle into gaps. Only the o is drawn on its own.

## Verify before you finish

The dev box has 2 vCPUs: every turbo script runs with `--concurrency=2`. Do not start
several verifies or builds at once; run heavy commands under `nice`.

`pnpm check-types`, `pnpm lint` (`pnpm lint:write` to auto-fix), `pnpm test`, and
`pnpm build`. All four run on every PR (`.github/workflows/ci.yml`) and the first two
run in the pre-commit hook.

## Conventions

- Files are `kebab-case.ts(x)`; components are named arrow-function exports; no
  default exports except `router.tsx`.
- `verbatimModuleSyntax` is on: use `import type` for types.
- Conventional commits with lowercase subjects (Commitlint rejects capitals).
  Batch related tweaks into one commit; the user reviews on the dev server first.

## Do one phase at a time

When asked to work on a plan (`papercamp/ideas/<ID>.md`), complete only the phase
asked for, mark it `[x]`, keep `status:` honest, and stop. When every phase is done,
set `status: review`, never `done`.
