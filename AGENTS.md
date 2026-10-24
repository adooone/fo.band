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
  skyline (hilly ground and every tree's outline spliced into the same
  line, morphing out of mounds), plus the mark with a breathing outline
  (`logo-paths.ts` from Figma with the f's spine, flattened by `path-outline.ts`;
  `sprout.ts` grows the f along its spine), `forest.tsx` wires
  it to the shared loop; the knobs are `DEFAULT_OPTIONS` / `DEFAULT_MARK` in code,
  `instruments.ts` the orchestra's instruments (cello, drums, guitar: bodies drawn in
  Figma, stems that curl like the f, drums hanging from a crook) as ink outlines and
  cut-outs in local units, drawn by the renderer over the land in their own layer
  (a cut-out is a clip the background is painted back into, so a sound hole shows
  the far hills through it, never a white disc glowing on them), since what hangs over air cannot be part of the skyline (everything under it
  is ink); they stand in clearings the size of a tree, grow in the opening like the
  trees, sink for music and about and go with the camera into art,
  `film-overlay.tsx` old film over everything (a vignette, grain that jitters, a warm
  cast, light leaks through a corner now and then, a viewfinder's gate, corner marks
  and the meter's circle; the frame weaves a hair on `.home`), CSS layers composited by
  the GPU with the strengths in `--film-*` variables, plus the wear of the glass,
  scratches and dust, another wear every visit, drawn once on a small canvas (grey through
  `difference`: dark on paper, light on ink);
  `home-footer.tsx` the foot of the home page, `sky-title.tsx`
  a section's title, `home-shell.tsx` puts them together under every route.
  `nav/` holds the links and the phone's bottom nav. `src/lib/ticker.ts` is the one
  requestAnimationFrame loop and the clamped clock every animation must use.
  `src/styles/index.css` holds the Tailwind theme tokens (`@theme`).
- `apps/core/` — Bun + Hono API, a stub for now (health check). `src/app.ts` builds
  the app so tests can call it without a server; `src/env.ts` validates env.
- `packages/types/` — `@fo/types`, runtime-free types shared by web and core.

## Motion rules

- Two colours: `--color-ink` (black) and `--color-paper` (off-white). Blends
  of the two are fine; nothing else, except the pencil line, which is graphite black.
- Calm and smooth: tiny amplitudes, long wavelengths, slow flow. No glitches, no
  snapping: `ease` (smootherstep) for anything that only moves. What grows or sinks
  has a body: it swells a little past its height from halfway on and comes back over
  the last third (`swell`, never `overshoot`'s late twitch), draws up a touch before
  it sinks (`anticipate`); the camera's moves (about, the dive into art) ease in and
  out with no give, and nothing knocks the ground when it lands. All of it
  a few per cent, never a bounce. In the opening the poured land sloshes but never
  spills over the hills. The
  pencil line appears only on load, opening the piece while the page loads: a blank sheet, the pencil
  draws the skyline, hills and trees, left to right, while the land is poured in from
  below the screen like water into a glass, its surface sloshing side to side
  until it settles into the hills; then the trees grow into the drawing from the middle outward as the line
  fades and the clouds swell one by one; the f sprouts and the o rises; last, with
  the text, the far hills rise behind the land (`drawOpening`, `DRAW_*`, `SLOSH*`, `RIPPLE*`). The text waits for the fonts and the
  opening (`introTextAt`), then comes in group by group: titles, paths, the foot
  (`intro.tsx`). Every animation subscribes to `subscribeTick` and reads time from
  `createClock` (clamped per frame), never from `Date.now()` or frame timestamps.
- Wind and the mark's breathing outline come from slow simplex noise over position and time; anything
  that must loop seamlessly is sampled on circles in noise space, and any spin is
  measured against a resting length so the waves never race when a shape changes.
- Respect `prefers-reduced-motion`: the clock freezes and the picture holds still.
- Keep a frame cheap: anything that varies over tens of pixels (hills, wind) is tabled
  once a frame at a coarse pitch and interpolated; the tree and ground outlines carry
  no per-point noise at all (a pencil wobble was tried and dropped: it cost most of the
  frame and read as blur). Whatever does not change with time is found once, not per
  frame: the far hills' rise and treeline, the record's ring wobble, the opening
  pencil's wander, and the grown f's outline (`growMark` keeps the grown outline and
  the direction its breathing pushes each point, and with no breathing writes the cut
  form once). A settled tree's form is used in place, never copied; the ground is
  emitted at every other sample unless the music page's tufts need the fine ones.
  `forest.tsx` lowers the canvas's pixel density when frames run slow and restores it
  when they run fast; the picture itself never changes. The scratchpad profiler
  (a no-op context) must warm Bun's JIT first: the first run of a process is 5× slow.
- Page changes are morphs in place or camera moves, never slides, and each one is a
  choreography of stages with its own delays (`setPage`); leaving, the page's own
  stages unwind first. On music the horizon stays: the f and the o sink first, the scene draws in
  once they are on their way, the trees go into the ground and come up as mushrooms
  in a wave from the middle (a two-stage morph, for forms with nothing in common),
  tufts of grass stand along the floor (at home the same tufts grow only in the instruments' clearings, taller), and the stump grows last with a touch of give. On
  about the forest sinks into the ground first (`ABOUT_HIDE_SECONDS`), then the
  camera draws back: the horizon is drawn up to a thin strip of sky
  (`ABOUT_HORIZON`), the left half a little ahead of the right, and the mark rides
  up on it in the middle, shrinking (`ABOUT_MARK`); the mark follows
  the move with a little inertia: a soft spring over its foot squashes it as the
  ground pulls it and stretches it as the ground stops, then it settles
  (`MARK_SPRING_*`); a few birds take off from the trees by the clearing as the
  camera goes; coming home the forest grows back as the land lands. On finds the
  trees stay: the camera breathes back and dives into the land through them and
  the f (the o sinks, since the camera never leaves it behind) until the screen is
  all ink (`DIVE_ZOOM`), the far hills and clouds gone by then, the
  left of the horizon running well ahead of the right on the way, the line bending
  between them, and coming back going down last (`DIVE_LEAD`) and landing with
  give, then the ink's edge is drawn in from the
  right of the screen into the trunk's edge on the left (`trunkOutline`), the top a
  little ahead of the bottom; the title stands in the middle with the way home under
  it, as on music. On the home page small tinted clouds drift along the top of the
  sky and a few birds cross it now and then, and the page looks past the forest
  with the pointer (`setPointer`, `LOOK_*`, `parallax`): the sky layers and the land
  shift the other way (the near clouds the near clouds some 60 px at the edge of the screen, the land under 10), nearer ones more, following with a lag and easing
  back to the middle on the way to a section; a mouse or a pen only, never a finger. Page changes
  have no pencil line. Every change sends a gust the way of travel. The skyline
  is one polyline, and every tree has a form per page with the same point count. The
  f of the mark is a tree in that line too (kind `mark`, finer point count): its form
  on the home and about pages is the sprout's outline cut at the ground, written
  every frame; on music and finds it is flat, and on music the stump grows out of the ground
  beside it as a tree of its own. Only the o is drawn on its own.

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
