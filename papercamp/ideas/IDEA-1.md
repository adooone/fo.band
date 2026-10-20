---
id: IDEA-1
title: Ліс — the calm home page in green and paper
type: feat
status: in-progress
tags: [web, home, canvas, motion, design, logo]
created: 2026-10-19
---

The home page is a paper sky over an ink forest: the lower third of the screen
is dark green, the upper two thirds off-white, and the edge between them is a
hand-drawn silhouette of spruces, pines, oaks, bushes and grass. Every plant is
a small ink polygon sampled finely and displaced by slow noise, so the edges
look drawn by hand and keep moving a touch (the sbjectv technique, slowed
down). Trees lean with a wind that drifts and gusts, grass bends in waves, the
ground breathes, and on load the forest grows out of the ground from the
middle outward. In the clearing the mark from Figma ("Laboratory", node 519:2)
grows: the f is a sprout shooting up from the ground, the o a sun rising and
settling above the horizon beside it. Corner links (Музика, Концерти, Про нас)
are ink in the sky and paper on the ground; hovering sends a breeze through
the forest. Portrait phones keep the composition and get a bottom nav on the
forest floor.

The first iteration (tree rings, dark ground) was dropped on 2026-10-20 at the
user's request; the two-colour palette now takes the logo's green (#2d493a).

Everything animated shares one requestAnimationFrame loop and a clock clamped
per frame (`src/lib/ticker.ts`).

### Phases

- [x] Scaffold the monorepo like sbjectv.shop (pnpm 12, Turbo 2, Biome 2, web + core + types)
  Ports 3300/3301, `@fo/*` scope, Paper Camp, AGENTS.md and README.md, GitHub, Vercel.
- [x] Forest silhouette on the canvas: plants, wind, gusts, breath, grow-in
  `forest-renderer.ts` + `forest.tsx` on the shared ticker.
- [x] The mark: f grows from the clearing, o rises as the sun; corner links and phone nav
  `logo.tsx`, `logo-paths.ts`, `corner-link.tsx`, `home-shell.tsx`, `nav/mobile-nav.tsx`.
- [x] Cartoon trees on a hilly ground, grass ripple, morph intro, slider panel
  2026-10-20: each tree a separate smooth polygon morphing from a mound; `tuner.tsx`.
- [x] One-line skyline, smooth shapes, the mark on the canvas, the f sprouting like a fern
  2026-10-20: ground, grass and trees as one line; f grows along its spine (`sprout.ts`).
- [ ] Tune on the dev server with the user (tree shapes, density, wind, mark size, colours)
  Reviewed live at deimos:3300 with the sidebar sliders; bake the chosen values into the defaults.
