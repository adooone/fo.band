---
id: IDEA-1
title: Річні кільця — calm home page in green and paper
type: feature
status: in-progress
tags: [web, home, canvas, motion, design]
created: 2026-10-19
---

The home page is a cross-section of a trunk: dark-green ink, off-white growth
rings drawn as hand-drawn ink bands with slow travelling noise (the technique
from sbjectv's rings, slowed right down), uneven spacing with a few tight
years, a soft wind wave crossing the picture every ten seconds, the band's
name breathing in the heart, the pith beating at sixty a minute. The bark is
the window: inside it the ground is a shade lighter, outside stays ink to the
screen edges. Corner labels (Музика, Концерти, Про нас) light their ring on
hover; on portrait phones the trunk is fitted to the width and the navigation
is a strip at the bottom.

Everything animated shares one requestAnimationFrame loop and a clock clamped
per frame (`src/lib/ticker.ts`); the wobble's spin is measured against each
ring's resting length so the waves never race.

### Phases

- [x] Scaffold the monorepo like sbjectv.shop (pnpm 12, Turbo 2, Biome 2, web + core + types)
  Ports 3300/3301, `@fo/*` scope, Paper Camp, AGENTS.md and README.md.
- [x] Palette and type: ink `#0b2a1c`, paper `#f3f1e8`, KyivType Serif / Sans
  Tokens in the Tailwind `@theme`; fonts self-hosted.
- [x] Tree rings on the canvas: growth rings, wind wave, pith beat, hover glow
  `tree-rings-renderer.ts` + `tree-rings.tsx` on the shared ticker with adaptive quality.
- [x] Name in the heart, corner links, section routes, phone layout
  `heart.tsx`, `corner-link.tsx`, `home-shell.tsx`, `nav/mobile-nav.tsx`.
- [ ] Tune on the dev server with the user (amplitudes, spacing, colours, type size)
  Reviewed live at deimos:3300; batch tweaks into one commit.
